import type { Aggressiveness, EditRange, TranscriptJson } from "@/lib/types";
import type { VoiceActivityMap } from "@/server/ai/voiceActivity";
import { collectWordBoundaries, isReliableWordBoundary } from "@/server/ai/wordBoundaries";
import type { WordBoundary } from "@/server/ai/wordBoundaries";

function rangeOverlapsReliableWord(range: { start: number; end: number }, words: WordBoundary[]): boolean {
  return words.some((word) => isReliableWordBoundary(word) && word.end > range.start && word.start < range.end);
}

function reliableWordsInRange(range: { start: number; end: number }, words: WordBoundary[]): WordBoundary[] {
  return words.filter((word) => isReliableWordBoundary(word) && word.end > range.start && word.start < range.end);
}

function pushIfLongEnough(removals: EditRange[], start: number, end: number, minDuration: number) {
  if (end - start < minDuration) return;
  removals.push({
    sourceStart: start,
    sourceEnd: end,
    reason: "untranscribed_voice",
    text: "voice-like audio without transcript words",
  });
}

export function detectUntranscribedVoiceRemovals(
  transcript: TranscriptJson,
  vad: VoiceActivityMap,
  aggressiveness: Aggressiveness,
  log: (message: string) => void
): EditRange[] {
  if (aggressiveness === "low") return [];

  const minDuration = aggressiveness === "high" ? 0.45 : 0.8;
  const words = collectWordBoundaries(transcript);
  const removals: EditRange[] = [];

  for (const range of vad.speechRanges) {
    if (!rangeOverlapsReliableWord(range, words)) {
      pushIfLongEnough(removals, range.start, range.end, minDuration);
      continue;
    }

    const rangeWords = reliableWordsInRange(range, words);
    let cursor = range.start;
    for (const word of rangeWords) {
      pushIfLongEnough(removals, cursor, word.start, minDuration);
      cursor = Math.max(cursor, word.end);
    }
    pushIfLongEnough(removals, cursor, range.end, minDuration);
  }

  if (removals.length > 0) {
    log(
      `Voice/transcript mismatch: ${removals.length} voice-like ranges without transcript words detected for diagnostics.`
    );
  }

  return removals;
}
