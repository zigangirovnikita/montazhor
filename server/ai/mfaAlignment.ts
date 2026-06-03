import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { storageRoot } from "@/lib/storage";
import type { TranscriptJson, TranscriptSegment, TranscriptWord } from "@/lib/types";
import { normalizeToken } from "@/server/ai/wordBoundaries";
import { ffmpegPath, runCommand } from "@/server/video/ffmpeg";

interface SuspiciousSegment {
  segmentIndex: number;
  score: number;
  reasons: string[];
}

interface MfaAlignedWord {
  word: string;
  start: number;
  end: number;
}

interface MfaPreparedSegment {
  segmentIndex: number;
  baseName: string;
  sourceStart: number;
  sourceEnd: number;
  normalizedWords: string[];
}

interface MfaJsonOutput {
  tiers?: {
    words?: {
      entries?: [number, number, string][];
    };
  };
}

const DEFAULT_MFA_SEGMENT_PADDING = 0.25;
const DEFAULT_MFA_MAX_SEGMENTS = 4;
const DEFAULT_MFA_MIN_SEGMENT_WORDS = 4;
const DEFAULT_MFA_MAX_SEGMENT_DURATION = 16;
const DEFAULT_MFA_MAX_INTERNAL_GAP = 0.85;
const DEFAULT_MFA_EDGE_DRIFT = 0.35;
const DEFAULT_MFA_LOW_CONFIDENCE = 0.45;

export function isMfaEnabled(language: string): boolean {
  if ((process.env.MFA_ALIGNMENT_ENABLED ?? "true") !== "true") return false;
  return language === "ru" || language === "en";
}

export function detectSuspiciousMfaSegments(transcript: TranscriptJson): SuspiciousSegment[] {
  const minWords = Number(process.env.MFA_MIN_SEGMENT_WORDS ?? DEFAULT_MFA_MIN_SEGMENT_WORDS);
  const maxDuration = Number(process.env.MFA_MAX_SEGMENT_DURATION ?? DEFAULT_MFA_MAX_SEGMENT_DURATION);
  const maxGap = Number(process.env.MFA_SUSPICIOUS_GAP_SECONDS ?? DEFAULT_MFA_MAX_INTERNAL_GAP);
  const edgeDrift = Number(process.env.MFA_EDGE_DRIFT_SECONDS ?? DEFAULT_MFA_EDGE_DRIFT);
  const lowConfidence = Number(process.env.MFA_LOW_CONFIDENCE ?? DEFAULT_MFA_LOW_CONFIDENCE);

  return transcript.segments
    .map((segment, segmentIndex) => {
      const words = segment.words ?? [];
      const normalizedWords = words.map((word) => normalizeToken(word.word)).filter(Boolean);
      if (normalizedWords.length < minWords) return undefined;
      if (segment.end - segment.start > maxDuration) return undefined;

      let score = 0;
      const reasons: string[] = [];
      const firstWord = words[0];
      const lastWord = words.at(-1);

      if (firstWord && firstWord.start - segment.start > edgeDrift) {
        score += 2;
        reasons.push(`leading_edge:${(firstWord.start - segment.start).toFixed(2)}s`);
      }
      if (lastWord && segment.end - lastWord.end > edgeDrift) {
        score += 2;
        reasons.push(`trailing_edge:${(segment.end - lastWord.end).toFixed(2)}s`);
      }

      for (let index = 1; index < words.length; index += 1) {
        const previous = words[index - 1];
        const current = words[index];
        const gap = current.start - previous.end;
        if (gap > maxGap) {
          score += 2;
          reasons.push(`internal_gap:${gap.toFixed(2)}s`);
        }
        if (current.start < previous.end) {
          score += 2;
          reasons.push("overlap");
        }
      }

      for (const word of words) {
        const duration = word.end - word.start;
        if (duration <= 0 || duration < 0.04 || duration > 1.8) {
          score += 1;
          reasons.push(`duration:${duration.toFixed(2)}s`);
        }
        if (typeof word.confidence === "number" && word.confidence < lowConfidence) {
          score += 1;
          reasons.push(`confidence:${word.confidence.toFixed(2)}`);
        }
      }

      if (score < 2) return undefined;
      return { segmentIndex, score, reasons };
    })
    .filter((item): item is SuspiciousSegment => Boolean(item))
    .sort((left, right) => right.score - left.score || left.segmentIndex - right.segmentIndex)
    .slice(0, Number(process.env.MFA_MAX_SEGMENTS_PER_RUN ?? DEFAULT_MFA_MAX_SEGMENTS));
}

export function mergeMfaAlignedWords(segment: TranscriptSegment, alignedWords: MfaAlignedWord[]): TranscriptSegment | undefined {
  const originalWords = segment.words ?? [];
  if (originalWords.length === 0 || alignedWords.length === 0) return undefined;

  const normalizedOriginal = originalWords.map((word) => normalizeToken(word.word)).filter(Boolean);
  const normalizedAligned = alignedWords.map((word) => normalizeToken(word.word)).filter(Boolean);
  if (normalizedOriginal.length === 0 || normalizedOriginal.length !== normalizedAligned.length) return undefined;

  for (let index = 0; index < normalizedOriginal.length; index += 1) {
    if (normalizedOriginal[index] !== normalizedAligned[index]) {
      return undefined;
    }
  }

  const words: TranscriptWord[] = originalWords.map((word, index) => ({
    ...word,
    start: roundTime(alignedWords[index].start),
    end: roundTime(alignedWords[index].end),
  }));

  return {
    ...segment,
    start: words[0].start,
    end: words.at(-1)?.end ?? words[0].end,
    words,
  };
}

export async function selectivelyRealignTranscriptWithMfa(
  transcript: TranscriptJson,
  audioPath: string,
  duration: number,
  log: (message: string) => void
): Promise<TranscriptJson> {
  if (!isMfaEnabled(transcript.language)) return transcript;

  const suspiciousSegments = detectSuspiciousMfaSegments(transcript);
  if (suspiciousSegments.length === 0) {
    log("MFA fallback: no suspicious segments detected.");
    return transcript;
  }

  const env = mfaEnv();
  const workingRoot = await mkdtemp(path.join(os.tmpdir(), "montazhor-mfa-"));
  const corpusDir = path.join(workingRoot, "corpus");
  const outputDir = path.join(workingRoot, "out");
  await mkdir(corpusDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  try {
    const prepared = await Promise.all(
      suspiciousSegments.map((item) => prepareSegmentForMfa(item.segmentIndex, transcript.segments[item.segmentIndex], audioPath, duration, corpusDir))
    );
    const usable = prepared.filter((item): item is MfaPreparedSegment => Boolean(item));
    if (usable.length === 0) {
      log("MFA fallback: suspicious segments were detected, but none were eligible for alignment.");
      return transcript;
    }

    log(`MFA fallback: aligning ${usable.length} suspicious segments (${usable.map((item) => item.segmentIndex).join(", ")}).`);
    await runCommand(env.binary, [
      "align",
      corpusDir,
      env.dictionaryModel,
      env.acousticModel,
      outputDir,
      "--output_format",
      "json",
      "--single_speaker",
      "--num_jobs",
      "1",
      "--no_use_mp",
      "--clean",
      "--temporary_directory",
      env.rootDir,
    ], {
      env: {
        PATH: `${path.dirname(env.binary)}:${process.env.PATH ?? ""}`,
        HOME: env.homeDir,
        MFA_ROOT_DIR: env.rootDir,
        XDG_CACHE_HOME: env.cacheDir,
      }
    });

    const segments = [...transcript.segments];
    let applied = 0;
    for (const item of usable) {
      const alignedWords = await readAlignedWords(path.join(outputDir, `${item.baseName}.json`), item);
      const merged = mergeMfaAlignedWords(segments[item.segmentIndex], alignedWords);
      if (!merged) {
        log(`MFA fallback: skipped segment ${item.segmentIndex} because aligned tokens did not match Whisper tokens.`);
        continue;
      }
      segments[item.segmentIndex] = merged;
      applied += 1;
    }

    if (applied === 0) {
      log("MFA fallback: alignments finished, but no segment passed merge validation.");
      return transcript;
    }

    log(`MFA fallback: applied refined word timings to ${applied} segments.`);
    return {
      ...transcript,
      alignmentProvider: transcript.alignmentProvider === "whisperx" ? "whisperx+mfa" : `${transcript.alignmentProvider ?? "unknown"}+mfa`,
      segments,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`MFA fallback failed, keeping WhisperX timings: ${message}`);
    return transcript;
  } finally {
    await rm(workingRoot, { recursive: true, force: true });
  }
}

async function prepareSegmentForMfa(
  segmentIndex: number,
  segment: TranscriptSegment | undefined,
  audioPath: string,
  duration: number,
  corpusDir: string
): Promise<MfaPreparedSegment | undefined> {
  if (!segment?.words?.length) return undefined;
  const normalizedWords = segment.words.map((word) => normalizeToken(word.word)).filter(Boolean);
  if (normalizedWords.length === 0) return undefined;

  const padding = Number(process.env.MFA_SEGMENT_PADDING_SECONDS ?? DEFAULT_MFA_SEGMENT_PADDING);
  const sourceStart = Math.max(0, segment.start - padding);
  const sourceEnd = Math.min(duration, segment.end + padding);
  if (sourceEnd - sourceStart < 0.8) return undefined;

  const baseName = `segment_${String(segmentIndex).padStart(4, "0")}`;
  const wavPath = path.join(corpusDir, `${baseName}.wav`);
  const textPath = path.join(corpusDir, `${baseName}.txt`);
  await runCommand(ffmpegPath(), [
    "-y",
    "-i",
    audioPath,
    "-ss",
    sourceStart.toFixed(3),
    "-to",
    sourceEnd.toFixed(3),
    "-ar",
    "16000",
    "-ac",
    "1",
    wavPath,
  ]);
  await writeFile(textPath, `${normalizedWords.join(" ")}\n`, "utf8");
  return { segmentIndex, baseName, sourceStart, sourceEnd, normalizedWords };
}

async function readAlignedWords(filePath: string, segment: MfaPreparedSegment): Promise<MfaAlignedWord[]> {
  const raw = JSON.parse(await readFile(filePath, "utf8")) as MfaJsonOutput;
  const entries = raw.tiers?.words?.entries ?? [];
  return entries
    .map(([start, end, word]) => ({
      word,
      start: roundTime(segment.sourceStart + start),
      end: roundTime(segment.sourceStart + end),
    }))
    .filter((word) => normalizeToken(word.word).length > 0 && word.end > word.start);
}

function mfaEnv() {
  const envRoot = process.env.MFA_ENV_ROOT
    ? resolveWithinProject(process.env.MFA_ENV_ROOT)
    : path.join(storageRoot(), "models", "mfa-env");
  const binary = process.env.MFA_BINARY
    ? resolveWithinProject(process.env.MFA_BINARY)
    : path.join(envRoot, "bin", "mfa");

  return {
    binary,
    acousticModel: process.env.MFA_ACOUSTIC_MODEL ?? "russian_mfa",
    dictionaryModel: process.env.MFA_DICTIONARY_MODEL ?? "russian_mfa",
    rootDir: process.env.MFA_ROOT_DIR_OVERRIDE
      ? resolveWithinProject(process.env.MFA_ROOT_DIR_OVERRIDE)
      : path.join(storageRoot(), "models", "mfa-root"),
    homeDir: process.env.MFA_HOME_DIR
      ? resolveWithinProject(process.env.MFA_HOME_DIR)
      : path.join(storageRoot(), "models", "mamba-home"),
    cacheDir: process.env.MFA_XDG_CACHE_HOME
      ? resolveWithinProject(process.env.MFA_XDG_CACHE_HOME)
      : path.join(storageRoot(), "models", ".cache"),
  };
}

function resolveWithinProject(input: string): string {
  if (path.isAbsolute(input)) return input;
  return path.join(process.cwd(), input);
}

function roundTime(value: number): number {
  return Math.round(value * 1000) / 1000;
}
