/**
 * Detect pauses from transcript word timestamps.
 *
 * Instead of relying on FFmpeg silencedetect (which fails with
 * background noise), we find gaps between words/segments in the
 * Whisper transcript. These gaps are the actual speech pauses.
 */

import type { EditRange, TranscriptJson } from "@/lib/types";
import { ffmpegPath, runCommand } from "@/server/video/ffmpeg";

export interface TranscriptGap {
  start: number;
  end: number;
  duration: number;
  boundary: "word" | "segment";
  previousWordDuration: number;
  nextWordDuration: number;
  /** If true, FFmpeg detected audio (not silence) in this gap — likely a hesitation sound Whisper missed */
  hasAudio?: boolean;
  rmsDb?: number;
}

/**
 * Extract gaps (pauses) from the transcript by analyzing timing
 * differences between consecutive words and segments.
 */
export function detectTranscriptGaps(transcript: TranscriptJson, minGap = 0.4): TranscriptGap[] {
  // Collect all words with timestamps, falling back to segment-level timing
  const allWords: { start: number; end: number; segmentIndex: number }[] = [];

  for (const [segmentIndex, segment] of transcript.segments.entries()) {
    if (segment.words && segment.words.length > 0) {
      for (const word of segment.words) {
        allWords.push({ start: word.start, end: word.end, segmentIndex });
      }
    } else {
      allWords.push({ start: segment.start, end: segment.end, segmentIndex });
    }
  }

  allWords.sort((a, b) => a.start - b.start);

  const gaps: TranscriptGap[] = [];

  for (let i = 1; i < allWords.length; i++) {
    const gapStart = allWords[i - 1].end;
    const gapEnd = allWords[i].start;
    const duration = gapEnd - gapStart;

    if (duration >= minGap) {
      gaps.push({
        start: gapStart,
        end: gapEnd,
        duration,
        boundary: allWords[i - 1].segmentIndex === allWords[i].segmentIndex ? "word" : "segment",
        previousWordDuration: Math.max(0, allWords[i - 1].end - allWords[i - 1].start),
        nextWordDuration: Math.max(0, allWords[i].end - allWords[i].start),
      });
    }
  }

  return gaps;
}

/**
 * For gaps longer than minDuration, use FFmpeg to check if there's actual audio
 * (not silence) — this catches hesitation sounds like "аааааа" that
 * Whisper ignores. Mutates the gaps array in place.
 */
export async function annotateNonSilentGaps(
  gaps: TranscriptGap[],
  audioPath: string,
  minDuration = 1.0,
  silenceThresholdDb = -35
): Promise<void> {
  const longGaps = gaps.filter((g) => g.duration > minDuration);
  if (longGaps.length === 0) return;

  for (const gap of longGaps) {
    try {
      const rmsDb = await measureRmsDb(audioPath, gap.start, gap.duration);
      gap.rmsDb = rmsDb;
      gap.hasAudio = rmsDb > silenceThresholdDb;
    } catch {
      // If FFmpeg fails for a gap, skip annotation — not critical
    }
  }
}

/**
 * Detect transcript gaps that are safe to remove when VAD is unavailable.
 *
 * Whisper can skip sounds like "аааа", coughs, laughs, knocks, or breaths.
 * These gaps look like empty transcript space. When Silero VAD is unavailable,
 * stay conservative: remove confirmed quiet gaps and only log audible gaps.
 */
export async function detectConfirmedGapRemovals(
  gaps: TranscriptGap[],
  audioPath: string,
  minDuration = 1.0,
  silenceThresholdDb = -35
): Promise<EditRange[]> {
  await annotateNonSilentGaps(gaps, audioPath, minDuration, silenceThresholdDb);

  return gaps
    .filter((gap) => gap.duration >= minDuration)
    .filter((gap) => !isLikelyBadWordTimestampGap(gap))
    .filter((gap) => !gap.hasAudio)
    .map((gap) => ({
      sourceStart: gap.start,
      sourceEnd: gap.end,
      reason: "pause",
    }));
}

function isLikelyBadWordTimestampGap(gap: TranscriptGap): boolean {
  if (gap.boundary === "segment") return false;

  const adjacentWordLooksBroken =
    gap.previousWordDuration <= 0.03 ||
    gap.nextWordDuration <= 0.03 ||
    gap.previousWordDuration >= 2.5 ||
    gap.nextWordDuration >= 2.5;

  return adjacentWordLooksBroken && gap.duration < 1.2;
}

export function describeAudibleGaps(gaps: TranscriptGap[]): string[] {
  return gaps
    .filter((gap) => gap.hasAudio)
    .map((gap) =>
      `${gap.start.toFixed(2)}–${gap.end.toFixed(2)} (${gap.duration.toFixed(2)}s, ${gap.boundary}-gap, rms ${gap.rmsDb?.toFixed(1) ?? "unknown"} dB)`
    );
}

/**
 * Measure RMS level (in dB) of an audio segment using FFmpeg astats.
 */
async function measureRmsDb(audioPath: string, startSec: number, durationSec: number): Promise<number> {
  const { stderr } = await runCommand(ffmpegPath(), [
    "-i", audioPath,
    "-ss", startSec.toFixed(3),
    "-t", durationSec.toFixed(3),
    "-af", "astats=metadata=1:reset=0,ametadata=print:key=lavfi.astats.Overall.RMS_level",
    "-f", "null",
    "-",
  ]);

  // Parse RMS_level from astats output
  const match = stderr.match(/lavfi\.astats\.Overall\.RMS_level=(-?[\d.]+)/);
  if (match) {
    return parseFloat(match[1]);
  }

  // Fallback: try to find any RMS value
  const fallback = stderr.match(/RMS level dB:\s*(-?[\d.]+)/);
  if (fallback) {
    return parseFloat(fallback[1]);
  }

  // If we can't parse, assume silence
  return -Infinity;
}

/**
 * Convert transcript gaps into EditRange[] for use in the pipeline.
 */
export function gapsToEditRanges(gaps: TranscriptGap[]): EditRange[] {
  return gaps.map((gap) => ({
    sourceStart: gap.start,
    sourceEnd: gap.end,
    reason: "pause",
  }));
}

