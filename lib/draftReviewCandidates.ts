import type { EditRange, TranscriptJson, TranscriptWord } from "@/lib/types";

export interface DraftReviewCandidateRange {
  sourceStart: number;
  sourceEnd: number;
  reason: "potential_pause" | "potential_filler";
  text?: string;
}

const MIN_REVIEW_GAP_SECONDS = 0.12;
const MIN_VISIBLE_OVERLAP_SECONDS = 0.02;
const russianFillers = new Set(["ээ", "эм", "ну", "типа", "короче", "как бы", "вот", "значит", "это самое"]);
const englishFillers = new Set(["um", "uh", "like", "you know", "so", "basically", "actually", "i mean"]);

export function buildDraftReviewCandidates(
  transcript: TranscriptJson,
  removedRanges: EditRange[]
): DraftReviewCandidateRange[] {
  const words = wordsFromTranscript(transcript);
  const candidates: DraftReviewCandidateRange[] = [];

  for (const word of words) {
    if (rangeOverlapsRemoved({ sourceStart: word.start, sourceEnd: word.end }, removedRanges)) continue;
    if (!isPotentialFillerWord(word.word)) continue;

    candidates.push({
      sourceStart: word.start,
      sourceEnd: word.end,
      reason: "potential_filler",
      text: word.word,
    });
  }

  for (let index = 1; index < words.length; index += 1) {
    const previous = words[index - 1];
    const next = words[index];
    const gapStart = previous.end;
    const gapEnd = next.start;
    if (gapEnd - gapStart < MIN_REVIEW_GAP_SECONDS) continue;
    if (rangeOverlapsRemoved({ sourceStart: gapStart, sourceEnd: gapEnd }, removedRanges)) continue;

    candidates.push({
      sourceStart: gapStart,
      sourceEnd: gapEnd,
      reason: "potential_pause",
    });
  }

  return dedupeCandidates(candidates);
}

export function isPotentialFillerWord(text: string) {
  const normalized = normalizeToken(text);
  if (!normalized) return false;
  return russianFillers.has(normalized) || englishFillers.has(normalized) || isElongatedHesitationToken(normalized);
}

function dedupeCandidates(candidates: DraftReviewCandidateRange[]) {
  return candidates
    .sort((left, right) => left.sourceStart - right.sourceStart || left.sourceEnd - right.sourceEnd)
    .filter((candidate, index, all) => {
      const previous = all[index - 1];
      if (!previous) return true;
      return (
        Math.abs(previous.sourceStart - candidate.sourceStart) > 0.001 ||
        Math.abs(previous.sourceEnd - candidate.sourceEnd) > 0.001 ||
        previous.reason !== candidate.reason
      );
    });
}

function wordsFromTranscript(transcript: TranscriptJson): TranscriptWord[] {
  return transcript.segments.flatMap((segment) => {
    if (segment.words?.length) return segment.words;

    const tokens = segment.text.split(/\s+/).filter(Boolean);
    const duration = Math.max(0.1, segment.end - segment.start);
    return tokens.map((word, index) => ({
      word,
      start: segment.start + (duration * index) / tokens.length,
      end: segment.start + (duration * (index + 1)) / tokens.length,
    }));
  });
}

function rangeOverlapsRemoved(range: { sourceStart: number; sourceEnd: number }, removedRanges: EditRange[]) {
  return removedRanges.some((removed) => overlapDuration(range.sourceStart, range.sourceEnd, removed.sourceStart, removed.sourceEnd) >= MIN_VISIBLE_OVERLAP_SECONDS);
}

function overlapDuration(start: number, end: number, targetStart: number, targetEnd: number) {
  return Math.max(0, Math.min(end, targetEnd) - Math.max(start, targetStart));
}

function normalizeToken(text: string) {
  return text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s]+/gu, "");
}

function isElongatedHesitationToken(text: string): boolean {
  return (
    /^э{2,}$/.test(text) ||
    /^е{2,}$/.test(text) ||
    /^м{2,}$/.test(text) ||
    /^а{2,}$/.test(text) ||
    /^у{2,}$/.test(text) ||
    /^ну{2,}$/.test(text) ||
    /^нуу+$/.test(text) ||
    /^эм+$/.test(text) ||
    /^мэ{2,}$/.test(text) ||
    /^бэ+$/.test(text) ||
    /^бэ{2,}$/.test(text) ||
    /^бе{2,}$/.test(text) ||
    /^мм?э{2,}$/.test(text) ||
    /^б+э{2,}$/.test(text)
  );
}
