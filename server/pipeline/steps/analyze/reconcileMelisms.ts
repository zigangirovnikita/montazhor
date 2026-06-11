import type { EditRange, TranscriptJson } from "@/lib/types";
import {
  MAX_MELISM_REMOVAL_SECONDS,
  MELISM_KEEP_HANDLE_SECONDS,
  MELISM_MIN_CONFIDENCE_AUTO_REMOVE,
  MELISM_MIN_CONFIDENCE_REVIEW,
  MIN_MELISM_REMOVAL_SECONDS
} from "@/server/ai/cutTimingPolicy";
import type { MelismCandidate } from "@/server/ai/geminiMelismDetector";
import type { VoiceActivityMap } from "@/server/ai/voiceActivity";
import { collectWordBoundaries, isReliableWordBoundary } from "@/server/ai/wordBoundaries";

export interface MelismReviewItem {
  id: string;
  type: MelismCandidate["type"];
  sourceStart?: number;
  sourceEnd?: number;
  text?: string;
  confidence: number;
  reason: string;
  beforeWordText?: string;
  afterWordText?: string;
  action: MelismCandidate["action"];
}

export interface ReconcileMelismResult {
  autoRemoveRanges: EditRange[];
  reviewItems: MelismReviewItem[];
  keepItems: MelismReviewItem[];
  rejectedCount: number;
}

export function reconcileMelismCandidates(input: {
  candidates: MelismCandidate[];
  transcript: TranscriptJson;
  duration: number;
  vad?: VoiceActivityMap;
}): ReconcileMelismResult {
  const words = collectWordBoundaries(input.transcript);
  const autoRemoveRanges: EditRange[] = [];
  const reviewItems: MelismReviewItem[] = [];
  const keepItems: MelismReviewItem[] = [];
  let rejectedCount = 0;

  for (const candidate of input.candidates) {
    const range = rangeFromCandidate(candidate, input.duration, words);
    const reviewItem = reviewItemFromCandidate(candidate, range);

    if (candidate.action === "keep") {
      keepItems.push(reviewItem);
      continue;
    }

    if (!range) {
      if (candidate.confidence >= MELISM_MIN_CONFIDENCE_REVIEW) {
        reviewItems.push({ ...reviewItem, reason: `${candidate.reason}; safety: missing safe word anchors` });
      } else {
        rejectedCount += 1;
      }
      continue;
    }

    const safety = safetyIssue(candidate, range, input.vad, words);
    if (candidate.action === "review" || candidate.confidence < MELISM_MIN_CONFIDENCE_AUTO_REMOVE) {
      if (candidate.confidence >= MELISM_MIN_CONFIDENCE_REVIEW) reviewItems.push(reviewItem);
      else rejectedCount += 1;
      continue;
    }

    if (safety) {
      if (candidate.confidence >= MELISM_MIN_CONFIDENCE_REVIEW) {
        reviewItems.push({ ...reviewItem, reason: `${candidate.reason}; safety: ${safety}` });
      } else {
        rejectedCount += 1;
      }
      continue;
    }

    autoRemoveRanges.push({
      sourceStart: range.sourceStart,
      sourceEnd: range.sourceEnd,
      reason: reasonForCandidate(candidate),
      text: candidate.text,
    });
  }

  return { autoRemoveRanges, reviewItems, keepItems, rejectedCount };
}

function rangeFromCandidate(
  candidate: MelismCandidate,
  duration: number,
  words: ReturnType<typeof collectWordBoundaries>
): EditRange | undefined {
  const beforeIndex = candidate.beforeWordIndex;
  const afterIndex = candidate.afterWordIndex;

  if (Number.isInteger(beforeIndex) && Number.isInteger(afterIndex)) {
    const before = words[beforeIndex as number];
    const after = words[afterIndex as number];
    if (!before || !after || before.end > after.start) return undefined;

    return {
      sourceStart: clamp(before.end + MELISM_KEEP_HANDLE_SECONDS, 0, duration),
      sourceEnd: clamp(after.start - MELISM_KEEP_HANDLE_SECONDS, 0, duration),
      reason: reasonForCandidate(candidate),
      text: candidate.text,
    };
  }

  if (candidate.action !== "remove") return approximateRange(candidate, duration);
  if (candidate.confidence < 0.92) return undefined;
  return approximateRange(candidate, duration);
}

function approximateRange(candidate: MelismCandidate, duration: number): EditRange | undefined {
  if (typeof candidate.approximateStart !== "number" || typeof candidate.approximateEnd !== "number") return undefined;
  const sourceStart = clamp(candidate.approximateStart + MELISM_KEEP_HANDLE_SECONDS, 0, duration);
  const sourceEnd = clamp(candidate.approximateEnd - MELISM_KEEP_HANDLE_SECONDS, 0, duration);
  if (sourceEnd <= sourceStart) return undefined;
  return { sourceStart, sourceEnd, reason: reasonForCandidate(candidate), text: candidate.text };
}

function safetyIssue(
  candidate: MelismCandidate,
  range: EditRange,
  vad: VoiceActivityMap | undefined,
  words: ReturnType<typeof collectWordBoundaries>
): string | undefined {
  const rangeDuration = range.sourceEnd - range.sourceStart;
  if (rangeDuration < MIN_MELISM_REMOVAL_SECONDS) return "too short";
  if (rangeDuration > MAX_MELISM_REMOVAL_SECONDS) return "too long";

  const overlapsReliableWord = words.some(
    (word) => isReliableWordBoundary(word) && word.end > range.sourceStart && word.start < range.sourceEnd
  );
  if (overlapsReliableWord) return "overlaps reliable transcript word";

  if (!Number.isInteger(candidate.beforeWordIndex) && !Number.isInteger(candidate.afterWordIndex)) {
    const vadConfirmed = vad?.speechRanges.some(
      (speech) => speech.end > range.sourceStart && speech.start < range.sourceEnd
    );
    if (!vadConfirmed) return "approximate range not confirmed by VAD";
  }

  return undefined;
}

function reviewItemFromCandidate(candidate: MelismCandidate, range: EditRange | undefined): MelismReviewItem {
  return {
    id: candidate.id,
    type: candidate.type,
    sourceStart: range?.sourceStart,
    sourceEnd: range?.sourceEnd,
    text: candidate.text,
    confidence: candidate.confidence,
    reason: candidate.reason,
    beforeWordText: candidate.beforeWordText,
    afterWordText: candidate.afterWordText,
    action: candidate.action,
  };
}

function reasonForCandidate(candidate: MelismCandidate): string {
  if (candidate.type === "untranscribed_voice") return "untranscribed_voice";
  if (candidate.type === "filler_word") return "melism";
  return candidate.type;
}

function clamp(value: number, min: number, max: number): number {
  return Math.round(Math.max(min, Math.min(max, value)) * 1000) / 1000;
}
