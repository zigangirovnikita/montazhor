import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EditDecisionList, StylePreset, SubtitleDraft, TranscriptJson, TranscriptWord } from "@/lib/types";
import { standardMp4OutputArgs } from "@/server/video/encoding";
import { assPathForFilter, ffmpegPath, runCommand } from "@/server/video/ffmpeg";
import { subtitlesOverlayTemplate } from "@/server/hyperframes/templates/SubtitlesOverlay";
import { renderHyperframesVideo } from "@/server/hyperframes/render";
import type { VideoProfile, VideoRegion } from "@/server/video/profile";

const importantWords = [
  "важно",
  "ошибка",
  "почему",
  "как",
  "нельзя",
  "можно",
  "деньги",
  "результат",
  "important",
  "mistake",
  "why",
  "how",
  "money",
  "result"
];

export function buildSubtitleDraft(transcript: TranscriptJson): SubtitleDraft[] {
  return chunkWordsToSubtitles(wordsFromTranscript(transcript));
}

export function buildSubtitlesForEdl(transcript: TranscriptJson, edl: EditDecisionList): SubtitleDraft[] {
  const remappedWords: TranscriptWord[] = [];
  let outputCursor = 0;
  const sourceWords = wordsFromTranscript(transcript);
  const usedWords = new Set<number>();

  for (const range of edl.keptRanges) {
    for (const [wordIndex, word] of sourceWords.entries()) {
      if (usedWords.has(wordIndex)) continue;
      const overlapStart = Math.max(word.start, range.sourceStart);
      const overlapEnd = Math.min(word.end, range.sourceEnd);
      if (overlapEnd - overlapStart < 0.05) continue;

      const start = outputCursor + Math.max(0, overlapStart - range.sourceStart);
      const end = outputCursor + Math.max(start - outputCursor, overlapEnd - range.sourceStart);
      remappedWords.push({ ...word, start, end: Math.max(end, start + 0.08) });
      usedWords.add(wordIndex);
    }
    outputCursor += Math.max(0, range.sourceEnd - range.sourceStart);
  }

  return chunkWordsToSubtitles(remappedWords);
}

function wordsFromTranscript(transcript: TranscriptJson): TranscriptWord[] {
  const words: TranscriptWord[] = [];
  for (const segment of transcript.segments) {
    if (segment.words?.length) {
      words.push(...segment.words);
      continue;
    }
    const segmentWords = segment.text.split(/\s+/).filter(Boolean);
    for (const [index, word] of segmentWords.entries()) {
      const start = segment.start + ((segment.end - segment.start) / Math.max(segmentWords.length, 1)) * index;
      const end = segment.start + ((segment.end - segment.start) / Math.max(segmentWords.length, 1)) * (index + 1);
      words.push({ word, start, end });
    }
  }
  return words.sort((a, b) => a.start - b.start);
}

const MAX_CHUNK_CHARS = 40;
const MIN_CHUNK_WORDS = 3;
const MAX_CHUNK_WORDS = 7;

function chunkWordsToSubtitles(words: TranscriptWord[]): SubtitleDraft[] {
  const subtitles: SubtitleDraft[] = [];
  let index = 0;

  while (index < words.length) {
    let chunkEnd = Math.min(index + MIN_CHUNK_WORDS, words.length);
    let text = words.slice(index, chunkEnd).map((w) => w.word).join(" ");

    // Extend chunk up to MAX_CHUNK_WORDS while under character limit
    while (chunkEnd < words.length && chunkEnd - index < MAX_CHUNK_WORDS) {
      const nextText = `${text} ${words[chunkEnd].word}`;
      if (nextText.length > MAX_CHUNK_CHARS) break;
      text = nextText;
      chunkEnd++;
    }

    const chunk = words.slice(index, chunkEnd);
    const cleaned = cleanSubtitleText(text);
    if (cleaned) {
      subtitles.push({
        id: `sub-${subtitles.length}`,
        start: chunk[0].start,
        end: chunk.at(-1)?.end ?? chunk[0].end,
        text: cleaned,
        words: chunk.map((word) => ({ ...word })),
        highlightedWords: chunk
          .map((word) => word.word.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ""))
          .filter((word) => importantWords.includes(word))
      });
    }
    index = chunkEnd;
  }

  return subtitles;
}

function cleanSubtitleText(text: string): string {
  return text
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\s+-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function assFromSubtitles(
  subtitles: SubtitleDraft[],
  preset: StylePreset,
  profile: VideoProfile,
  captionRegion?: VideoRegion
) {
  const style = styleForPreset(preset, profile, captionRegion);
  const events = subtitles
    .map((subtitle) => {
      const text = subtitle.text.replaceAll("{", "").replaceAll("}", "");
      return `Dialogue: 0,${toAssTime(subtitle.start)},${toAssTime(subtitle.end)},Default,,0,0,0,,${text}`;
    })
    .join("\n");

  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${profile.width}
PlayResY: ${profile.height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.font},${style.size},${style.primary},&H000000FF,${style.outline},&H90000000,${style.bold},0,0,0,100,100,0,0,1,${style.border},${style.shadow},2,${style.marginL},${style.marginR},${style.marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events}
`;
}

export async function burnSubtitles(inputPath: string, assPath: string, _profile: VideoProfile, outputPath: string) {
  await runCommand(ffmpegPath(), [
    "-y",
    "-i",
    inputPath,
    "-vf",
    `ass='${assPathForFilter(assPath)}'`,
    ...standardMp4OutputArgs(),
    outputPath
  ]);
}

export async function renderSubtitlesLayerViaHyperFrames(
  projectDir: string,
  subtitles: SubtitleDraft[],
  preset: StylePreset,
  profile: VideoProfile,
  outputMp4Path: string,
  captionRegion?: VideoRegion
) {
  const dir = path.join(projectDir, "motion", "subtitles-overlay");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), subtitlesOverlayTemplate(subtitles, preset, profile, captionRegion), "utf8");
  await renderHyperframesVideo(dir, outputMp4Path);
}

export async function overlaySubtitlesLayer(
  inputVideoPath: string,
  overlayVideoPath: string,
  _profile: VideoProfile,
  outputPath: string
) {
  await runCommand(ffmpegPath(), [
    "-y",
    "-i",
    inputVideoPath,
    "-i",
    overlayVideoPath,
    "-filter_complex",
    "[1:v]colorkey=0x00ff00:0.1:0.2[ckout];[0:v][ckout]overlay=x=0:y=0[outv]",
    "-map",
    "[outv]",
    "-map",
    "0:a",
    ...standardMp4OutputArgs(),
    outputPath
  ]);
}

function styleForPreset(preset: StylePreset, profile: VideoProfile, captionRegion?: VideoRegion) {
  const landscape = profile.orientation === "landscape";
  const defaultMarginV = landscape ? 104 : 260;
  const regionMarginV = captionRegion
    ? Math.round(profile.height - captionRegion.y - captionRegion.height + Math.min(104, captionRegion.height * 0.12))
    : defaultMarginV;
  const marginL = captionRegion ? Math.max(40, Math.round(captionRegion.x + 40)) : 80;
  const marginR = captionRegion ? Math.max(40, Math.round(profile.width - captionRegion.x - captionRegion.width + 40)) : 80;

  if (preset === "dynamic_viral") {
    return { font: "Arial", size: landscape ? 54 : 70, primary: "&H00FFFFFF", outline: "&H00111111", bold: -1, border: 6, shadow: 2, marginL, marginR, marginV: regionMarginV };
  }
  if (preset === "premium_calm") {
    return { font: "Arial", size: landscape ? 42 : 56, primary: "&H00F7F0E5", outline: "&H00221F1B", bold: 0, border: 4, shadow: 1, marginL, marginR, marginV: regionMarginV };
  }
  return { font: "Arial", size: landscape ? 48 : 62, primary: "&H00FFFFFF", outline: "&H00101010", bold: -1, border: 5, shadow: 2, marginL, marginR, marginV: regionMarginV };
}

function toAssTime(seconds: number) {
  const safe = Math.max(seconds, 0);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  const cs = Math.floor((safe % 1) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
