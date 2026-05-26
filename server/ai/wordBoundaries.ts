/**
 * Shared utilities for working with transcript word boundaries.
 * Used by planCuts, untranscribedVoice, and other modules that
 * need to reason about individual word positions in time.
 */

import type { TranscriptJson } from "@/lib/types";

export interface WordBoundary {
  start: number;
  end: number;
  word?: string;
}

const MIN_RELIABLE_WORD_DURATION = 0.04;
const MAX_RELIABLE_WORD_DURATION = 1.5;

export function normalizeToken(text: string) {
  return text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s]+/gu, "");
}

export function collectWordBoundaries(transcript: TranscriptJson): WordBoundary[] {
  const words: WordBoundary[] = [];

  for (const segment of transcript.segments) {
    if (segment.words?.length) {
      for (const word of segment.words) {
        words.push({ start: word.start, end: word.end, word: word.word });
      }
      continue;
    }

    words.push({ start: segment.start, end: segment.end });
  }

  return words.sort((a, b) => a.start - b.start);
}

export function isReliableWordBoundary(word: WordBoundary): boolean {
  const duration = word.end - word.start;
  const text = normalizeToken(word.word ?? "");
  return text.length > 0 && duration >= MIN_RELIABLE_WORD_DURATION && duration <= MAX_RELIABLE_WORD_DURATION;
}
