/**
 * Shared utilities for working with transcript word boundaries.
 * Used by planCuts, untranscribedVoice, and other modules that
 * need to reason about individual word positions in time.
 */

import type { TranscriptJson } from "@/lib/types";
import { isFillerWord } from "@/server/ai/fillerWords";
import {
  MAX_RELIABLE_FILLER_DURATION,
  MAX_RELIABLE_WORD_DURATION,
  MIN_RELIABLE_WORD_DURATION
} from "@/server/ai/cutTimingPolicy";

export interface WordBoundary {
  start: number;
  end: number;
  word?: string;
  speaker?: string;
  segmentIndex?: number;
}

export function normalizeToken(text: string) {
  return text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s]+/gu, "");
}

export function collectWordBoundaries(transcript: TranscriptJson): WordBoundary[] {
  const words: WordBoundary[] = [];

  for (const [segmentIndex, segment] of transcript.segments.entries()) {
    if (segment.words?.length) {
      for (const word of segment.words) {
        words.push({ start: word.start, end: word.end, word: word.word, speaker: word.speaker, segmentIndex });
      }
      continue;
    }

    words.push({ start: segment.start, end: segment.end, segmentIndex });
  }

  return words.sort((a, b) => a.start - b.start);
}

export function isReliableWordBoundary(word: WordBoundary): boolean {
  const duration = word.end - word.start;
  const text = normalizeToken(word.word ?? "");
  if (text.length === 0 || duration < MIN_RELIABLE_WORD_DURATION) return false;

  const maxDuration = isFillerWord(text)
    ? MAX_RELIABLE_FILLER_DURATION
    : MAX_RELIABLE_WORD_DURATION;
  return duration <= maxDuration;
}

export function hasOverlappingWordConflict(
  words: WordBoundary[],
  range: { start: number; end: number },
  padding = 1.2
): boolean {
  const nearby = words
    .filter((word) => word.end > range.start - padding && word.start < range.end + padding)
    .sort((left, right) => left.start - right.start);

  for (let index = 1; index < nearby.length; index += 1) {
    const previous = nearby[index - 1];
    const current = nearby[index];
    if (current.start < previous.end - 0.08) {
      return true;
    }
  }

  return false;
}
