import type { TranscriptJson, TranscriptSegment, TranscriptWord } from "@/lib/types";
import { MIN_RELIABLE_WORD_DURATION } from "@/server/ai/cutTimingPolicy";

export interface TranscriptWordConflictStats {
  repairedWords: number;
  repairedSegments: number;
  reasons: Record<string, number>;
}

interface IndexedWord {
  segmentIndex: number;
  wordIndex: number;
  word: TranscriptWord;
}

const ROUND_PRECISION = 1000;
const OVERLAP_EPSILON = 0.001;

export function resolveTranscriptWordConflicts(transcript: TranscriptJson): {
  transcript: TranscriptJson;
  stats: TranscriptWordConflictStats;
} {
  const entries = collectIndexedWords(transcript);
  if (entries.length < 2) {
    return {
      transcript,
      stats: { repairedWords: 0, repairedSegments: 0, reasons: {} },
    };
  }

  const stats: TranscriptWordConflictStats = {
    repairedWords: 0,
    repairedSegments: 0,
    reasons: {},
  };
  const changedWords = new Set<string>();
  const changedSegments = new Set<number>();
  const kept: IndexedWord[] = [];

  for (const entry of entries) {
    const current: IndexedWord = {
      ...entry,
      word: { ...entry.word },
    };

    let keepCurrent = true;
    while (kept.length > 0) {
      const previous = kept.at(-1);
      if (!previous) break;
      if (current.word.start >= previous.word.end - OVERLAP_EPSILON) break;

      const resolution = resolveOverlap(previous, current, transcript.mainSpeakerId);
      incrementReason(stats.reasons, resolution.reason);

      if (resolution.drop === "current") {
        markChanged(current, changedWords, changedSegments);
        keepCurrent = false;
        break;
      }

      if (resolution.drop === "previous") {
        markChanged(previous, changedWords, changedSegments);
        kept.pop();
        continue;
      }

      const boundary = chooseBoundary(previous.word, current.word);
      if (Math.abs(previous.word.end - boundary) > OVERLAP_EPSILON) {
        previous.word.end = roundTime(boundary);
        markChanged(previous, changedWords, changedSegments);
      }
      if (Math.abs(current.word.start - boundary) > OVERLAP_EPSILON) {
        current.word.start = roundTime(boundary);
        markChanged(current, changedWords, changedSegments);
      }
      break;
    }

    if (keepCurrent) kept.push(current);
  }

  stats.repairedWords = changedWords.size;
  stats.repairedSegments = changedSegments.size;

  if (stats.repairedWords === 0) {
    return { transcript, stats };
  }

  return {
    transcript: rebuildTranscript(transcript, kept),
    stats,
  };
}

function collectIndexedWords(transcript: TranscriptJson): IndexedWord[] {
  const entries: IndexedWord[] = [];

  for (const [segmentIndex, segment] of transcript.segments.entries()) {
    for (const [wordIndex, word] of (segment.words ?? []).entries()) {
      entries.push({ segmentIndex, wordIndex, word });
    }
  }

  return entries.sort((left, right) => {
    if (left.word.start !== right.word.start) return left.word.start - right.word.start;
    if (left.word.end !== right.word.end) return left.word.end - right.word.end;
    if (left.segmentIndex !== right.segmentIndex) return left.segmentIndex - right.segmentIndex;
    return left.wordIndex - right.wordIndex;
  });
}

function resolveOverlap(
  previous: IndexedWord,
  current: IndexedWord,
  mainSpeakerId: string | undefined
): { reason: string; drop?: "previous" | "current" } {
  const previousSpeaker = previous.word.speaker;
  const currentSpeaker = current.word.speaker;

  if (mainSpeakerId && previousSpeaker && currentSpeaker && previousSpeaker !== currentSpeaker) {
    if (previousSpeaker === mainSpeakerId && currentSpeaker !== mainSpeakerId) {
      return { reason: "cross_speaker_overlap_suppressed", drop: "current" };
    }
    if (currentSpeaker === mainSpeakerId && previousSpeaker !== mainSpeakerId) {
      return { reason: "cross_speaker_overlap_suppressed", drop: "previous" };
    }
  }

  return { reason: "overlap_resolved" };
}

function chooseBoundary(previous: TranscriptWord, current: TranscriptWord): number {
  const previousDuration = Math.max(MIN_RELIABLE_WORD_DURATION, previous.end - previous.start);
  const currentDuration = Math.max(MIN_RELIABLE_WORD_DURATION, current.end - current.start);
  const totalDuration = previousDuration + currentDuration;
  const spanStart = previous.start;
  const spanEnd = current.end;
  const minBoundary = previous.start + MIN_RELIABLE_WORD_DURATION;
  const maxBoundary = current.end - MIN_RELIABLE_WORD_DURATION;
  const preferred = spanStart + ((spanEnd - spanStart) * previousDuration) / totalDuration;

  if (maxBoundary <= minBoundary) {
    return roundTime((previous.end + current.start) / 2);
  }
  return clamp(preferred, minBoundary, maxBoundary);
}

function rebuildTranscript(transcript: TranscriptJson, keptWords: IndexedWord[]): TranscriptJson {
  const bySegment = new Map<number, TranscriptWord[]>();
  for (const entry of keptWords) {
    const words = bySegment.get(entry.segmentIndex) ?? [];
    words.push(entry.word);
    bySegment.set(entry.segmentIndex, words);
  }

  const segments: TranscriptSegment[] = [];
  for (const [segmentIndex, segment] of transcript.segments.entries()) {
    const originalWords = segment.words ?? [];
    if (originalWords.length === 0) {
      segments.push(segment);
      continue;
    }

    const words = (bySegment.get(segmentIndex) ?? [])
      .sort((left, right) => {
        if (left.start !== right.start) return left.start - right.start;
        return left.end - right.end;
      });
    if (words.length === 0) continue;

    segments.push({
      ...segment,
      start: words[0].start,
      end: words.at(-1)?.end ?? words[0].end,
      text: words.map((word) => word.word).join(" ").replace(/\s+/g, " ").trim(),
      speaker: dominantSpeaker(words) ?? segment.speaker,
      words,
    });
  }

  return { ...transcript, segments };
}

function dominantSpeaker(words: TranscriptWord[]): string | undefined {
  const durations = new Map<string, number>();

  for (const word of words) {
    if (!word.speaker) continue;
    const next = (durations.get(word.speaker) ?? 0) + Math.max(0, word.end - word.start);
    durations.set(word.speaker, next);
  }

  const ranked = [...durations.entries()].sort((left, right) => right[1] - left[1]);
  return ranked[0]?.[0];
}

function markChanged(entry: IndexedWord, words: Set<string>, segments: Set<number>) {
  words.add(`${entry.segmentIndex}:${entry.wordIndex}`);
  segments.add(entry.segmentIndex);
}

function incrementReason(reasons: Record<string, number>, reason: string) {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function roundTime(value: number): number {
  return Math.round(value * ROUND_PRECISION) / ROUND_PRECISION;
}
