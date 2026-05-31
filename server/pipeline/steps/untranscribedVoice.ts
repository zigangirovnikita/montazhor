import type { CleanupMode, EditRange, TranscriptJson } from "@/lib/types";
import {
  FILLER_MODE_UNTRANSCRIBED_VOICE_MIN_DURATION,
  MAIN_SPEAKER_BRIDGED_SPAN_MAX_DURATION,
  SEMANTIC_MODE_UNTRANSCRIBED_VOICE_MIN_DURATION
} from "@/server/ai/cutTimingPolicy";
import type { VoiceActivityMap } from "@/server/ai/voiceActivity";
import { collectWordBoundaries, hasOverlappingWordConflict, isReliableWordBoundary } from "@/server/ai/wordBoundaries";
import type { WordBoundary } from "@/server/ai/wordBoundaries";

function rangeOverlapsReliableWord(range: { start: number; end: number }, words: WordBoundary[]): boolean {
  return words.some((word) => isReliableWordBoundary(word) && word.end > range.start && word.start < range.end);
}

function reliableWordsInRange(range: { start: number; end: number }, words: WordBoundary[]): WordBoundary[] {
  return words.filter((word) => isReliableWordBoundary(word) && word.end > range.start && word.start < range.end);
}

function supportWordsForRange(
  range: { start: number; end: number },
  words: WordBoundary[],
  mainSpeakerId: string | undefined
): WordBoundary[] {
  const rangeWords = reliableWordsInRange(range, words);
  if (!mainSpeakerId) return rangeWords;

  const taggedRangeWords = rangeWords.filter((word) => typeof word.speaker === "string" && word.speaker.length > 0);
  if (taggedRangeWords.length === 0) return rangeWords;

  const mainSpeakerWords = taggedRangeWords.filter((word) => word.speaker === mainSpeakerId);
  return mainSpeakerWords;
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

function shouldSuppressRemoval(range: { start: number; end: number }, words: WordBoundary[]): boolean {
  return hasOverlappingWordConflict(words, range);
}

function isInternalGap(range: { start: number; end: number }, wordsInRange: WordBoundary[], gapStart: number, gapEnd: number): boolean {
  if (wordsInRange.length < 2) return false;
  const firstWord = wordsInRange[0];
  const lastWord = wordsInRange[wordsInRange.length - 1];
  return gapStart >= firstWord.end && gapEnd <= lastWord.start;
}

function bridgedByMainSpeakerContinuity(
  range: { start: number; end: number },
  supportWords: WordBoundary[],
  mainSpeakerId: string | undefined
): boolean {
  if (!mainSpeakerId) return false;

  const previous = [...supportWords]
    .reverse()
    .find((word) => word.speaker === mainSpeakerId && word.end <= range.start);
  const next = supportWords.find((word) => word.speaker === mainSpeakerId && word.start >= range.end);

  if (!previous || !next) return false;
  return next.start - previous.end <= MAIN_SPEAKER_BRIDGED_SPAN_MAX_DURATION;
}

export function detectUntranscribedVoiceRemovals(
  transcript: TranscriptJson,
  vad: VoiceActivityMap,
  cleanupMode: CleanupMode,
  log: (message: string) => void
): EditRange[] {
  if (cleanupMode === "pauses_only") return [];

  const minDuration = cleanupMode === "semantic_cleanup"
    ? SEMANTIC_MODE_UNTRANSCRIBED_VOICE_MIN_DURATION
    : FILLER_MODE_UNTRANSCRIBED_VOICE_MIN_DURATION;
  const words = collectWordBoundaries(transcript);
  const reliableWords = words.filter((word) => isReliableWordBoundary(word));
  const removals: EditRange[] = [];
  let bridgedSuppressions = 0;

  for (const range of vad.speechRanges) {
    const supportWords = supportWordsForRange(range, words, transcript.mainSpeakerId);

    if (!rangeOverlapsReliableWord(range, supportWords)) {
      if (bridgedByMainSpeakerContinuity(range, reliableWords, transcript.mainSpeakerId)) {
        bridgedSuppressions += 1;
        continue;
      }
      if (shouldSuppressRemoval(range, words)) continue;
      pushIfLongEnough(removals, range.start, range.end, minDuration);
      continue;
    }

    const rangeWords = reliableWordsInRange(range, supportWords);
    let cursor = range.start;
    for (const word of rangeWords) {
      const gap = { start: cursor, end: word.start };
      if (
        isInternalGap(range, rangeWords, gap.start, gap.end) &&
        !shouldSuppressRemoval(gap, words) &&
        !bridgedByMainSpeakerContinuity(gap, reliableWords, transcript.mainSpeakerId)
      ) {
        pushIfLongEnough(removals, cursor, word.start, minDuration);
      } else if (word.start - cursor >= minDuration) {
        bridgedSuppressions += 1;
      }
      cursor = Math.max(cursor, word.end);
    }
    if (range.end - cursor >= minDuration) {
      bridgedSuppressions += 1;
    }
  }

  if (bridgedSuppressions > 0) {
    log(`Voice/transcript mismatch: suppressed ${bridgedSuppressions} bridged main-speaker gaps to avoid cutting through continuous speech.`);
  }

  if (removals.length > 0) {
    log(
      `Voice/transcript mismatch: ${removals.length} voice-like ranges without transcript words detected for diagnostics.`
    );
  }

  return removals;
}
