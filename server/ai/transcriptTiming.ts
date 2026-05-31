import type { TranscriptJson, TranscriptSegment, TranscriptWord } from "@/lib/types";
import { isFillerWord } from "@/server/ai/fillerWords";
import { resolveTranscriptWordConflicts } from "@/server/ai/transcriptWordConflicts";

interface SpeechRange {
  start: number;
  end: number;
}

export interface TranscriptTimingNormalizationOptions {
  duration?: number;
  speechRanges?: SpeechRange[];
}

export interface TranscriptTimingNormalizationStats {
  checkedWords: number;
  repairedWords: number;
  repairedSegments: number;
  reasons: Record<string, number>;
}

interface TimedWord extends TranscriptWord {
  issues: string[];
}

const MIN_WORD_DURATION = 0.08;
const MAX_WORD_DURATION = 2.4;
const MAX_FILLER_DURATION = 4;
const FAST_CHARS_PER_SECOND = 34;
const SLOW_CHARS_PER_SECOND = 5;
const MIN_SYLLABLE_SECONDS = 0.11;
const MAX_SYLLABLE_SECONDS = 0.38;
const VOWELS_RE = /[аеёиоуыэюяaeiouy]/giu;

export function normalizeTranscriptTimings(
  transcript: TranscriptJson,
  options: TranscriptTimingNormalizationOptions = {}
): { transcript: TranscriptJson; stats: TranscriptTimingNormalizationStats } {
  const stats: TranscriptTimingNormalizationStats = {
    checkedWords: 0,
    repairedWords: 0,
    repairedSegments: 0,
    reasons: {},
  };

  const segments = transcript.segments.map((segment) => normalizeSegment(segment, options, stats));
  const normalizedTranscript = { ...transcript, segments };
  const conflictResolution = resolveTranscriptWordConflicts(normalizedTranscript);

  stats.repairedWords += conflictResolution.stats.repairedWords;
  stats.repairedSegments += conflictResolution.stats.repairedSegments;
  for (const [reason, count] of Object.entries(conflictResolution.stats.reasons)) {
    stats.reasons[reason] = (stats.reasons[reason] ?? 0) + count;
  }

  return { transcript: conflictResolution.transcript, stats };
}

export function formatTranscriptTimingStats(stats: TranscriptTimingNormalizationStats): string {
  const reasons = Object.entries(stats.reasons)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([reason, count]) => `${reason}: ${count}`)
    .join(", ");

  return `Transcript timing normalization: checked ${stats.checkedWords} words, repaired ${stats.repairedWords} words in ${stats.repairedSegments} segments${reasons ? ` (${reasons})` : ""}.`;
}

function normalizeSegment(
  segment: TranscriptSegment,
  options: TranscriptTimingNormalizationOptions,
  stats: TranscriptTimingNormalizationStats
): TranscriptSegment {
  if (!segment.words?.length) return sanitizeSegmentBounds(segment, options.duration);

  const container = containerForSegment(segment, options);
  const words: TimedWord[] = segment.words.map((word) => ({ ...word, issues: [] }));
  let previousEnd = container.start;

  for (const word of words) {
    stats.checkedWords += 1;
    word.issues = wordTimingIssues(word, previousEnd, container, options.duration);
    if (word.issues.length === 0) {
      previousEnd = word.end;
      continue;
    }

    for (const issue of word.issues) {
      stats.reasons[issue] = (stats.reasons[issue] ?? 0) + 1;
    }
  }

  if (!words.some((word) => word.issues.length > 0)) {
    return sanitizeSegmentBounds(segment, options.duration);
  }

  stats.repairedSegments += 1;
  const repaired = repairWords(words, container, options.duration, options.speechRanges);
  stats.repairedWords += repaired.filter((word, index) => word.start !== segment.words?.[index]?.start || word.end !== segment.words[index]?.end).length;

  return {
    ...segment,
    start: repaired[0]?.start ?? container.start,
    end: repaired.at(-1)?.end ?? container.end,
    words: repaired,
  };
}

function sanitizeSegmentBounds(segment: TranscriptSegment, duration: number | undefined): TranscriptSegment {
  const start = clampTime(segment.start, 0, duration);
  const end = Math.max(start, clampTime(segment.end, start, duration));
  return { ...segment, start, end };
}

function wordTimingIssues(word: TranscriptWord, previousEnd: number, container: SpeechRange, duration: number | undefined): string[] {
  const issues: string[] = [];
  const wordDuration = word.end - word.start;

  if (!Number.isFinite(word.start) || !Number.isFinite(word.end)) issues.push("non_finite");
  if (word.start < 0 || word.end < 0) issues.push("negative");
  if (duration !== undefined && (word.start > duration || word.end > duration)) issues.push("outside_duration");
  if (word.end <= word.start) issues.push("non_positive");
  if (word.start < previousEnd) issues.push("overlap");
  if (word.start < container.start - 0.2 || word.end > container.end + 0.2) issues.push("outside_speech_segment");

  if (Number.isFinite(wordDuration) && wordDuration > 0) {
    if (wordDuration < plausibleMinDuration(word.word)) issues.push("implausibly_short");
    if (wordDuration > plausibleMaxDuration(word.word)) issues.push("implausibly_long");
  }

  return Array.from(new Set(issues));
}

function repairWords(
  words: TimedWord[],
  container: SpeechRange,
  duration: number | undefined,
  speechRanges: SpeechRange[] | undefined
): TranscriptWord[] {
  const repaired: TranscriptWord[] = [];

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    const previous = repaired.at(-1);
    const left = previous?.end ?? container.start;
    const nextValidStart = findNextValidStart(words, index + 1, left, container, duration);
    const right = Math.max(left, nextValidStart ?? container.end);

    if (word.issues.length === 0 && word.start >= left && word.end <= right) {
      repaired.push({
        word: word.word,
        start: word.start,
        end: word.end,
        speaker: word.speaker,
        confidence: word.confidence,
      });
      continue;
    }

    const wordContainer = repairContainerForWord(word, left, right, speechRanges);
    const estimatedDuration = Math.min(
      plausibleTargetDuration(word.word),
      Math.max(MIN_WORD_DURATION, wordContainer.end - wordContainer.start)
    );
    const preferredStart = Number.isFinite(word.start)
      ? clampTime(word.start, wordContainer.start, Math.max(wordContainer.start, wordContainer.end - estimatedDuration))
      : wordContainer.start;
    const start = Math.max(wordContainer.start, preferredStart);
    const end = Math.min(wordContainer.end, Math.max(start + MIN_WORD_DURATION, start + estimatedDuration));

    repaired.push({
      word: word.word,
      start: roundTime(clampTime(start, 0, duration)),
      end: roundTime(clampTime(Math.max(end, start + MIN_WORD_DURATION), 0, duration)),
      speaker: word.speaker,
      confidence: word.confidence,
    });
  }

  return repaired.map((word, index) => {
    const previous = index > 0 ? repaired[index - 1] : undefined;
    if (!previous || word.start >= previous.end) return { ...word, start: roundTime(word.start), end: roundTime(word.end) };
    const start = previous.end;
    return { ...word, start: roundTime(start), end: roundTime(Math.max(start + MIN_WORD_DURATION, word.end)) };
  });
}

function repairContainerForWord(
  word: TimedWord,
  left: number,
  right: number,
  speechRanges: SpeechRange[] | undefined
): SpeechRange {
  if (!speechRanges?.length || right - left < MIN_WORD_DURATION) return { start: left, end: right };

  const wordMidpoint = Number.isFinite(word.start) && Number.isFinite(word.end)
    ? (word.start + word.end) / 2
    : left;

  const candidate = speechRanges
    .map((range) => ({
      start: Math.max(left, range.start),
      end: Math.min(right, range.end),
      distance: Math.abs(((range.start + range.end) / 2) - wordMidpoint),
    }))
    .filter((range) => range.end - range.start >= MIN_WORD_DURATION)
    .sort((a, b) => a.distance - b.distance)[0];

  return candidate ? { start: candidate.start, end: candidate.end } : { start: left, end: right };
}

function findNextValidStart(
  words: TimedWord[],
  fromIndex: number,
  after: number,
  container: SpeechRange,
  duration: number | undefined
): number | undefined {
  for (let index = fromIndex; index < words.length; index += 1) {
    const word = words[index];
    const issues = wordTimingIssues(word, after, container, duration);
    if (issues.length === 0 && word.start > after) return word.start;
  }
  return undefined;
}

function containerForSegment(segment: TranscriptSegment, options: TranscriptTimingNormalizationOptions): SpeechRange {
  const segmentRange = {
    start: clampTime(segment.start, 0, options.duration),
    end: clampTime(Math.max(segment.end, segment.start), 0, options.duration),
  };

  const overlappingSpeech = (options.speechRanges ?? []).filter((range) => {
    const overlapStart = Math.max(range.start, segmentRange.start);
    const overlapEnd = Math.min(range.end, segmentRange.end);
    return overlapEnd - overlapStart > 0.02;
  });

  if (overlappingSpeech.length === 0) {
    return segmentRange.end > segmentRange.start ? segmentRange : widenEmptyRange(segmentRange, options.duration);
  }

  const start = Math.min(...overlappingSpeech.map((range) => range.start));
  const end = Math.max(...overlappingSpeech.map((range) => range.end));
  return widenEmptyRange({ start: clampTime(start, 0, options.duration), end: clampTime(end, 0, options.duration) }, options.duration);
}

function widenEmptyRange(range: SpeechRange, duration: number | undefined): SpeechRange {
  if (range.end > range.start) return range;
  const end = clampTime(range.start + 0.5, range.start, duration);
  return { start: range.start, end };
}

function plausibleMinDuration(word: string): number {
  const length = normalizedLength(word);
  const syllables = countSyllables(word);
  return roundTime(Math.min(0.45, Math.max(MIN_WORD_DURATION, length / FAST_CHARS_PER_SECOND, syllables * MIN_SYLLABLE_SECONDS)));
}

function plausibleTargetDuration(word: string): number {
  if (isFillerWord(word)) {
    const syllables = countSyllables(word);
    return roundTime(Math.min(2.2, Math.max(0.22, syllables * 0.32)));
  }

  const length = normalizedLength(word);
  const syllables = countSyllables(word);
  return roundTime(Math.min(1.4, Math.max(0.16, length / 14, syllables * 0.2)));
}

function plausibleMaxDuration(word: string): number {
  if (isFillerWord(word)) {
    const syllables = countSyllables(word);
    return roundTime(Math.min(MAX_FILLER_DURATION, Math.max(1.6, syllables * 0.8)));
  }

  const length = normalizedLength(word);
  const syllables = countSyllables(word);
  return roundTime(Math.min(MAX_WORD_DURATION, Math.max(0.75, length / SLOW_CHARS_PER_SECOND, syllables * MAX_SYLLABLE_SECONDS)));
}

function normalizedLength(word: string): number {
  return Math.max(1, word.replace(/[^\p{L}\p{N}]+/gu, "").length);
}

function countSyllables(word: string): number {
  return Math.max(1, word.match(VOWELS_RE)?.length ?? 1);
}

function clampTime(value: number, min: number, max: number | undefined): number {
  if (!Number.isFinite(value)) return min;
  const upper = max ?? Number.POSITIVE_INFINITY;
  return Math.max(min, Math.min(value, upper));
}

function roundTime(value: number): number {
  return Math.round(value * 1000) / 1000;
}
