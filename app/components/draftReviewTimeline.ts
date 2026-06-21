import { buildDraftReviewCandidates } from "@/lib/draftReviewCandidates";
import type { TranscriptWord } from "@/lib/types";
import type { DraftEditOperation, ProjectPayload } from "@/app/components/projectFlowTypes";

export type PieceState = "kept" | "removed" | "candidate";

export type TimelinePiece =
  | {
    kind: "word";
    id: string;
    sourceStart: number;
    sourceEnd: number;
    playbackStart: number;
    playbackEnd: number;
    text: string;
    state: PieceState;
    reason?: string;
    reviewIssueId?: string;
    segmentId: number;
  }
  | {
    kind: "range";
    id: string;
    sourceStart: number;
    sourceEnd: number;
    playbackStart: number;
    playbackEnd: number;
    text: string;
    state: PieceState;
    reason: string;
    reviewIssueId?: string;
    segmentId?: number;
  };

export type TextSegment = {
  id: string;
  start: number;
  end: number;
  pieces: TimelinePiece[];
};

const GAP_REASONS = new Set(["pause", "silence", "long_pause", "non_silent_gap", "noisy_pause", "vad_pause", "untranscribed_voice"]);

export function buildTimelinePieces(
  payload: ProjectPayload,
  approvedCandidates: Set<string>,
  pendingEdits: DraftEditOperation[],
  compareMode: "after" | "before"
): TimelinePiece[] {
  const transcript = payload.draft?.transcript ?? { language: "ru", segments: [] };
  const removed = payload.draft?.edl?.removedRanges ?? [];
  const keptRanges = payload.draft?.edl?.keptRanges ?? [];
  const mapPlaybackTime = compareMode === "before"
    ? (time: number) => time
    : (time: number) => sourceTimeToOutputTime(keptRanges, time);
  const candidates = buildDraftReviewCandidates(transcript, removed);
  const issues = [
    ...removed.map((range, index) => ({ ...range, state: "removed" as const, id: `removed-${index}-${range.sourceStart}-${range.sourceEnd}` })),
    ...candidates.map((range, index) => ({ ...range, state: "candidate" as const, id: `candidate-${index}-${range.sourceStart}-${range.sourceEnd}` }))
  ].sort((a, b) => a.sourceStart - b.sourceStart);
  const words = transcript.segments
    .flatMap((segment) => (segment.words ?? wordsFromSegmentText(segment.text, segment.start, segment.end)).map((word, index) => ({ ...word, segmentId: segment.id, index })))
    .sort((a, b) => a.start - b.start);
  const pieces: TimelinePiece[] = [];

  for (const [wordIndex, word] of words.entries()) {
    const wordIssue = issues.find((issue) => wordBelongsToRange(word, issue.sourceStart, issue.sourceEnd) && !approvedCandidates.has(issue.id));
    pieces.push(applyPendingToPiece({
      kind: "word",
      id: `word-${word.segmentId}-${word.index}-${word.start}-${word.end}-${word.word}`,
      sourceStart: word.start,
      sourceEnd: word.end,
      playbackStart: mapPlaybackTime(word.start),
      playbackEnd: mapPlaybackTime(word.end),
      text: word.word,
      state: wordIssue?.state ?? "kept",
      reason: wordIssue?.reason,
      reviewIssueId: wordIssue?.id,
      segmentId: word.segmentId
    }, pendingEdits));

    const nextWord = words[wordIndex + 1];
    const gapEnd = nextWord?.start ?? word.end;
    for (const issue of issues) {
      if (approvedCandidates.has(issue.id)) continue;
      const overlapsWord = words.some((item) => wordBelongsToRange(item, issue.sourceStart, issue.sourceEnd));
      if (overlapsWord) continue;
      if (issue.sourceStart < word.end - 0.02 || issue.sourceStart > gapEnd + 0.02) continue;
      const rangePiece = applyPendingToPiece({
        kind: "range",
        id: issue.id,
        sourceStart: issue.sourceStart,
        sourceEnd: issue.sourceEnd,
        playbackStart: mapPlaybackTime(issue.sourceStart),
        playbackEnd: mapPlaybackTime(issue.sourceEnd),
        text: displayRangeLabel(issue.reason, issue.sourceEnd - issue.sourceStart, issue.state) ?? issue.text ?? fallbackRangeText(issue.reason, issue.sourceEnd - issue.sourceStart),
        state: issue.state,
        reason: issue.reason,
        reviewIssueId: issue.id,
        segmentId: word.segmentId
      }, pendingEdits);
      if (rangePiece.state !== "kept") pieces.push(rangePiece as TimelinePiece);
    }
  }

  return pieces.sort((a, b) => a.sourceStart - b.sourceStart);
}

export function buildTextSegments(pieces: TimelinePiece[]): TextSegment[] {
  const segments: TextSegment[] = [];
  let current: TextSegment | null = null;

  for (const piece of pieces) {
    if (!current || shouldBreakSegment(current, piece)) {
      current = { id: `segment-${segments.length}-${piece.sourceStart}`, start: piece.sourceStart, end: piece.sourceEnd, pieces: [] };
      segments.push(current);
    }
    const segment = current;
    segment.pieces.push(piece);
    segment.end = Math.max(segment.end, piece.sourceEnd);
  }

  return segments;
}

export function buildRailBlocks(pieces: TimelinePiece[], duration: number) {
  if (duration <= 0) return [];
  return pieces.map((piece) => ({
    id: piece.id,
    state: piece.state,
    left: Math.max(0, Math.min(100, (piece.sourceStart / duration) * 100)),
    width: Math.max(0.35, Math.min(100, ((piece.sourceEnd - piece.sourceStart) / duration) * 100))
  }));
}

export function buildWaveformBars(pieces: TimelinePiece[], duration: number, sampleCount = 160) {
  if (duration <= 0 || sampleCount <= 0) return [];
  const bucketDuration = duration / sampleCount;

  return Array.from({ length: sampleCount }, (_, index) => {
    const start = index * bucketDuration;
    const end = start + bucketDuration;
    const piece = pieces.find((item) => item.sourceEnd > start && item.sourceStart < end) ?? null;
    const state = piece?.state ?? "kept";
    const seed = Math.round((piece?.sourceStart ?? start) * 100) + index * 17 + (piece?.text.length ?? 3) * 13;
    const normalized = pseudoRandom(seed);
    const baseHeight = state === "removed" ? 0.42 : state === "candidate" ? 0.58 : 0.72;
    const variance = state === "removed" ? 0.18 : 0.24;
    return {
      id: `wave-${index}-${piece?.id ?? "gap"}`,
      left: (start / duration) * 100,
      width: Math.max(0.28, (bucketDuration / duration) * 100),
      height: Math.min(1, baseHeight + normalized * variance),
      state
    };
  });
}

export function findActivePiece(pieces: TimelinePiece[], time: number) {
  return pieces.find((piece) => piece.playbackEnd - piece.playbackStart > 0.02 && time >= piece.playbackStart && time <= piece.playbackEnd)
    ?? pieces.find((piece) => piece.playbackStart >= time && piece.playbackEnd - piece.playbackStart > 0.02)
    ?? pieces.find((piece) => piece.playbackEnd - piece.playbackStart > 0.02)
    ?? pieces.at(-1);
}

export function findPieceBySourceTime(pieces: TimelinePiece[], sourceTime: number) {
  return pieces.find((piece) => sourceTime >= piece.sourceStart && sourceTime <= piece.sourceEnd)
    ?? pieces.find((piece) => piece.sourceStart >= sourceTime)
    ?? pieces.at(-1);
}

export function findSegmentForPiece(segments: TextSegment[], piece: TimelinePiece) {
  return segments.find((segment) => segment.pieces.some((item) => item.id === piece.id))
    ?? segments.find((segment) => piece.sourceStart >= segment.start && piece.sourceStart <= segment.end)
    ?? segments[0];
}

export function findSegmentBySourceTime(segments: TextSegment[], sourceTime: number) {
  return segments.find((segment) => sourceTime >= segment.start && sourceTime <= segment.end)
    ?? segments.find((segment) => segment.start >= sourceTime)
    ?? segments.at(-1);
}

export function sourceTimeToOutputTime(keptRanges: Array<{ sourceStart: number; sourceEnd: number }>, sourceTime: number) {
  let outputTime = 0;
  for (const range of keptRanges) {
    if (sourceTime <= range.sourceStart) return outputTime;
    if (sourceTime <= range.sourceEnd) return outputTime + sourceTime - range.sourceStart;
    outputTime += Math.max(0, range.sourceEnd - range.sourceStart);
  }
  return outputTime;
}

export function outputTimeToSourceTime(keptRanges: Array<{ sourceStart: number; sourceEnd: number }>, outputTime: number) {
  if (keptRanges.length === 0) return outputTime;
  let elapsed = 0;
  for (const range of keptRanges) {
    const duration = Math.max(0, range.sourceEnd - range.sourceStart);
    if (outputTime <= elapsed + duration) {
      return range.sourceStart + Math.max(0, outputTime - elapsed);
    }
    elapsed += duration;
  }
  return keptRanges.at(-1)?.sourceEnd ?? outputTime;
}

export function timelineDuration(payload: ProjectPayload, pieces: TimelinePiece[]) {
  return Math.max(
    payload.draft?.transcript?.duration ?? 0,
    ...pieces.map((piece) => piece.sourceEnd),
    ...(payload.draft?.edl?.removedRanges ?? []).map((range) => range.sourceEnd),
    0
  );
}

export function formatReviewTime(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = (value % 60).toFixed(2).padStart(5, "0");
  return minutes > 0 ? `${minutes}:${seconds}` : seconds;
}

export function tokenTitle(piece: TimelinePiece) {
  if (piece.state === "removed") return "Оставить или отредактировать";
  if (piece.state === "candidate") return "Оставить, удалить или отредактировать";
  return "Удалить или отредактировать";
}

export function actionHint(piece: TimelinePiece) {
  if (piece.state === "removed") return "Этот фрагмент вырезан из черновика.";
  if (piece.state === "candidate") return "Спорный фрагмент: можно оставить или удалить.";
  return "Обычное слово: можно удалить или исправить текст для субтитров.";
}

function shouldBreakSegment(segment: TextSegment, piece: TimelinePiece) {
  const previous = segment.pieces.at(-1);
  if (!previous) return false;
  if (piece.segmentId !== undefined && previous.segmentId !== undefined && piece.segmentId !== previous.segmentId) return true;
  if (piece.kind === "range" || previous.kind === "range") return piece.sourceStart - previous.sourceEnd > 0.25;
  if (piece.sourceStart - previous.sourceEnd > 0.75) return true;
  if (/[.!?…。]+$/.test(previous.text)) return true;
  if (piece.kind === "word" && segment.end - segment.start >= 5.5) return true;
  if (piece.kind === "word" && segment.pieces.filter((item) => item.kind === "word").length >= 14) return true;
  return false;
}

function applyPendingToPiece(piece: TimelinePiece, pendingEdits: DraftEditOperation[]): TimelinePiece {
  return pendingEdits.reduce<TimelinePiece>((current, edit) => {
    if (edit.action === "edit_word_text" && current.kind === "word" && sameWord(current, edit)) {
      return { ...current, text: edit.text?.trim() || current.text };
    }
    if (edit.action === "delete_word") {
      return current.kind === "word" && sameWord(current, edit) ? { ...current, state: "removed", reason: "manual_word" } : current;
    }
    if (!rangesTouch(current.sourceStart, current.sourceEnd, edit.sourceStart, edit.sourceEnd)) return current;
    if (edit.action === "restore_removed_range") return { ...current, state: "kept" };
    if (edit.action === "delete_range") return { ...current, state: "removed", reason: "manual_text" };
    return current;
  }, piece);
}

function wordsFromSegmentText(text: string, start: number, end: number): TranscriptWord[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  const duration = Math.max(0.1, end - start);
  return tokens.map((word, index) => ({ word, start: start + (duration * index) / tokens.length, end: start + (duration * (index + 1)) / tokens.length }));
}

function wordBelongsToRange(word: TranscriptWord, start: number, end: number) {
  const overlap = Math.max(0, Math.min(word.end, end) - Math.max(word.start, start));
  const share = overlap / Math.max(0.05, word.end - word.start);
  const midpoint = (word.start + word.end) / 2;
  return share >= 0.45 || (midpoint >= start && midpoint <= end);
}

function sameWord(piece: TimelinePiece, edit: DraftEditOperation) {
  return Math.abs(piece.sourceStart - edit.sourceStart) < 0.015 && Math.abs(piece.sourceEnd - edit.sourceEnd) < 0.015;
}

function rangesTouch(start: number, end: number, targetStart: number, targetEnd: number) {
  return Math.min(end, targetEnd) - Math.max(start, targetStart) > 0.02;
}

function formatSeconds(value: number) {
  if (value < 1) return `${value.toFixed(2)} сек`;
  if (value < 10) return `${value.toFixed(1)} сек`;
  return `${Math.round(value)} сек`;
}

function fallbackRangeText(reason: string, duration: number) {
  if (reason === "potential_pause") return `пауза/звук ${formatSeconds(duration)}`;
  if (reason === "potential_filler") return `кандидат ${formatSeconds(duration)}`;
  return `пауза ${formatSeconds(duration)}`;
}

function displayRangeLabel(reason: string, duration: number, kind: "removed" | "candidate") {
  if (kind === "candidate") {
    if (reason === "potential_pause") return `Спорная пауза ${formatSeconds(duration)}`;
    if (reason === "potential_filler") return "Спорное слово";
    return "Спорный фрагмент";
  }
  if (reason === "untranscribed_voice") return `Лишний звук ${formatSeconds(duration)}`;
  if (reason === "hesitation") return "Запинка";
  if (reason === "filler_word") return "Слово-паразит";
  if (reason === "profanity") return "Лишний фрагмент";
  if (GAP_REASONS.has(reason)) return `Пауза ${formatSeconds(duration)}`;
  return "Удалено";
}

function pseudoRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}
