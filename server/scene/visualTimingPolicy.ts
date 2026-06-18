import type { ScenePriority, TranscriptWord, VisualRole } from "@/lib/types";

const SEQUENTIAL_GAP = 0.08;
const EPSILON = 0.001;

export interface VisualTimingPolicyMetadata {
  timingPolicyApplied: boolean;
  timingPolicyReasons: string[];
  originalObjectStart: number;
  originalObjectEnd: number;
  adjustedObjectStart: number;
  adjustedObjectEnd: number;
}

export interface VisualTimingPolicyCandidate<T extends { id: string; start: number; duration: number }> {
  object: T;
  objectKind: "primary" | "support" | "full_scene";
  visualRole?: VisualRole;
}

export interface ApplyVisualTimingPolicyInput<T extends { id: string; start: number; duration: number }> {
  blockStart: number;
  blockEnd: number;
  renderPath: "overlay" | "full_scene";
  scenePriority?: ScenePriority;
  visualRole?: VisualRole;
  recipeId?: string;
  cleanWords?: TranscriptWord[];
  objects: VisualTimingPolicyCandidate<T>[];
}

export interface VisualTimingPolicyResult<T extends { id: string; start: number; duration: number }> {
  object: T;
  metadata: VisualTimingPolicyMetadata;
}

export function applyVisualTimingPolicy<T extends { id: string; start: number; duration: number }>(
  input: ApplyVisualTimingPolicyInput<T>
): VisualTimingPolicyResult<T>[] {
  const blockStart = round(input.blockStart);
  const blockEnd = round(Math.max(input.blockStart, input.blockEnd));
  const blockDuration = round(Math.max(0, blockEnd - blockStart));
  if (blockDuration <= 0 || input.objects.length === 0) {
    return input.objects.map((candidate) => ({ object: candidate.object, metadata: unchangedMetadata(candidate.object) }));
  }

  if (input.renderPath === "full_scene") {
    return input.objects.map((candidate) => adjustSingleObject(candidate, {
      blockStart,
      blockEnd,
      blockDuration,
      cleanWords: input.cleanWords,
      preferredStart: blockStart,
      preferredEnd: blockEnd,
      scenePriority: input.scenePriority,
      recipeId: input.recipeId
    }));
  }

  const primary = input.objects.find((candidate) => candidate.objectKind === "primary");
  const supports = input.objects
    .filter((candidate) => candidate.objectKind === "support")
    .sort((left, right) => left.object.start - right.object.start);
  const rest = input.objects.filter((candidate) => candidate.objectKind === "full_scene");

  const results = new Map<string, VisualTimingPolicyResult<T>>();
  let supportCursor = blockEnd;

  for (let index = supports.length - 1; index >= 0; index -= 1) {
    const candidate = supports[index]!;
    const minimumDuration = minimumDurationFor({
      kind: "support",
      blockDuration,
      originalDuration: candidate.object.duration,
      recipeId: input.recipeId,
      scenePriority: input.scenePriority
    });
    const preferredEnd = supportCursor;
    const preferredStart = Math.max(blockStart, preferredEnd - minimumDuration);
    const result = adjustSingleObject(candidate, {
      blockStart,
      blockEnd: preferredEnd,
      blockDuration,
      cleanWords: input.cleanWords,
      preferredStart,
      preferredEnd,
      minimumDuration,
      recipeId: input.recipeId,
      scenePriority: input.scenePriority,
      forceTailHold: true
    });
    results.set(candidate.object.id, result);
    supportCursor = Math.max(blockStart, round(result.metadata.adjustedObjectStart - SEQUENTIAL_GAP));
  }

  if (primary) {
    const preferredEnd = supports.length > 0 ? supportCursor : blockEnd;
    const result = adjustSingleObject(primary, {
      blockStart,
      blockEnd: preferredEnd,
      blockDuration,
      cleanWords: input.cleanWords,
      preferredStart: blockStart,
      preferredEnd,
      minimumDuration: minimumDurationFor({
        kind: "primary",
        blockDuration,
        originalDuration: primary.object.duration,
        recipeId: input.recipeId,
        scenePriority: input.scenePriority
      }),
      recipeId: input.recipeId,
      scenePriority: input.scenePriority
    });
    results.set(primary.object.id, result);
  }

  for (const candidate of rest) {
    results.set(candidate.object.id, adjustSingleObject(candidate, {
      blockStart,
      blockEnd,
      blockDuration,
      cleanWords: input.cleanWords,
      preferredStart: blockStart,
      preferredEnd: blockEnd,
      recipeId: input.recipeId,
      scenePriority: input.scenePriority
    }));
  }

  return input.objects.map((candidate) => results.get(candidate.object.id) ?? { object: candidate.object, metadata: unchangedMetadata(candidate.object) });
}

function adjustSingleObject<T extends { id: string; start: number; duration: number }>(
  candidate: VisualTimingPolicyCandidate<T>,
  input: {
    blockStart: number;
    blockEnd: number;
    blockDuration: number;
    cleanWords?: TranscriptWord[];
    preferredStart: number;
    preferredEnd: number;
    minimumDuration?: number;
    recipeId?: string;
    scenePriority?: ScenePriority;
    forceTailHold?: boolean;
  }
): VisualTimingPolicyResult<T> {
  const originalStart = round(candidate.object.start);
  const originalEnd = round(candidate.object.start + candidate.object.duration);
  const reasons: string[] = [];
  const minimumDuration = round(Math.min(
    Math.max(0, input.blockEnd - input.blockStart),
    Math.max(0, input.minimumDuration ?? minimumDurationFor({
      kind: candidate.objectKind === "full_scene" ? "primary" : candidate.objectKind,
      blockDuration: input.blockDuration,
      originalDuration: candidate.object.duration,
      recipeId: input.recipeId,
      scenePriority: input.scenePriority
    }))
  ));

  let adjustedStart = clamp(input.preferredStart, input.blockStart, input.blockEnd);
  let adjustedEnd = clamp(input.preferredEnd, adjustedStart, input.blockEnd);

  if (adjustedEnd - adjustedStart + EPSILON < minimumDuration) {
    adjustedStart = Math.max(input.blockStart, adjustedEnd - minimumDuration);
    adjustedEnd = Math.min(input.blockEnd, Math.max(adjustedStart + minimumDuration, adjustedEnd));
    if (adjustedEnd - adjustedStart + EPSILON < minimumDuration) {
      adjustedEnd = input.blockEnd;
      adjustedStart = Math.max(input.blockStart, adjustedEnd - minimumDuration);
    }
    reasons.push("expanded_to_minimum_duration");
  }

  if (!input.forceTailHold) {
    if (adjustedStart > input.blockStart + EPSILON) reasons.push("kept_within_block_window");
  } else {
    reasons.push("support_tail_hold");
  }

  const aligned = alignToWordBoundaries({
    start: adjustedStart,
    end: adjustedEnd,
    blockStart: input.blockStart,
    blockEnd: input.blockEnd,
    minimumDuration,
    cleanWords: input.cleanWords
  });
  adjustedStart = aligned.start;
  adjustedEnd = aligned.end;
  if (aligned.applied) reasons.push("snapped_to_word_boundaries");

  adjustedStart = round(clamp(adjustedStart, input.blockStart, input.blockEnd));
  adjustedEnd = round(clamp(adjustedEnd, adjustedStart, input.blockEnd));

  if (adjustedEnd - adjustedStart + EPSILON < minimumDuration) {
    adjustedStart = Math.max(input.blockStart, round(adjustedEnd - minimumDuration));
  }

  if (adjustedEnd > input.blockEnd + EPSILON) {
    adjustedEnd = input.blockEnd;
    adjustedStart = Math.max(input.blockStart, round(adjustedEnd - minimumDuration));
    reasons.push("clamped_to_block_end");
  }
  if (adjustedStart < input.blockStart - EPSILON) {
    adjustedStart = input.blockStart;
    reasons.push("clamped_to_block_start");
  }

  const adjustedDuration = round(Math.max(0, adjustedEnd - adjustedStart));
  const timingPolicyApplied = Math.abs(adjustedStart - originalStart) > EPSILON || Math.abs(adjustedEnd - originalEnd) > EPSILON;
  const metadata: VisualTimingPolicyMetadata = {
    timingPolicyApplied,
    timingPolicyReasons: timingPolicyApplied ? [...new Set(reasons)] : [],
    originalObjectStart: originalStart,
    originalObjectEnd: originalEnd,
    adjustedObjectStart: adjustedStart,
    adjustedObjectEnd: adjustedEnd
  };

  return {
    object: {
      ...candidate.object,
      start: adjustedStart,
      duration: adjustedDuration
    },
    metadata
  };
}

function alignToWordBoundaries(input: {
  start: number;
  end: number;
  blockStart: number;
  blockEnd: number;
  minimumDuration: number;
  cleanWords?: TranscriptWord[];
}) {
  const words = (input.cleanWords ?? []).slice().sort((left, right) => left.start - right.start);
  if (words.length === 0) {
    return { start: input.start, end: input.end, applied: false };
  }

  let start = input.start;
  let end = input.end;
  const startCandidates = words
    .map((word) => round(word.start))
    .filter((value) => value >= input.blockStart - EPSILON && value <= start + 0.25);
  const endCandidates = words
    .map((word) => round(word.end))
    .filter((value) => value >= end - 0.25 && value <= input.blockEnd + EPSILON);

  if (startCandidates.length > 0) {
    const nearestEarlier = [...startCandidates].reverse().find((value) => value <= start + EPSILON);
    start = Math.max(input.blockStart, nearestEarlier ?? startCandidates[0]!);
  }
  if (endCandidates.length > 0) {
    const nearestLater = endCandidates.find((value) => value >= end - EPSILON);
    end = Math.min(input.blockEnd, nearestLater ?? endCandidates[endCandidates.length - 1]!);
  }

  if (end - start + EPSILON < input.minimumDuration) {
    end = Math.min(input.blockEnd, Math.max(end, start + input.minimumDuration));
  }

  return {
    start: round(start),
    end: round(Math.max(start, end)),
    applied: Math.abs(start - input.start) > EPSILON || Math.abs(end - input.end) > EPSILON
  };
}

function minimumDurationFor(input: {
  kind: "primary" | "support";
  blockDuration: number;
  originalDuration: number;
  recipeId?: string;
  scenePriority?: ScenePriority;
}) {
  if (input.blockDuration <= 1.6) {
    const ratio = input.kind === "primary" ? 0.72 : 0.38;
    const floor = input.kind === "primary" ? 0.72 : 0.5;
    return round(Math.min(input.blockDuration, Math.max(input.originalDuration, Math.max(floor, input.blockDuration * ratio))));
  }

  let minimum = input.kind === "primary"
    ? Math.min(2.4, input.blockDuration * 0.75)
    : Math.min(1.6, input.blockDuration * 0.45);

  if (input.kind === "primary" && shouldPreferLongReadableHold(input.recipeId, input.scenePriority)) {
    minimum = Math.max(minimum, Math.min(input.blockDuration, 2.1));
  }

  return round(Math.min(input.blockDuration, Math.max(input.originalDuration, minimum)));
}

function shouldPreferLongReadableHold(recipeId?: string, scenePriority?: ScenePriority) {
  if (scenePriority === "hero") return true;
  if (!recipeId) return false;
  return [
    "quote_emphasis",
    "checklist_reveal",
    "definition_card",
    "before_after_phrase_swap",
    "myth_vs_truth",
    "warning_strike_fix"
  ].includes(recipeId);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function unchangedMetadata<T extends { id: string; start: number; duration: number }>(object: T): VisualTimingPolicyMetadata {
  const end = round(object.start + object.duration);
  return {
    timingPolicyApplied: false,
    timingPolicyReasons: [],
    originalObjectStart: round(object.start),
    originalObjectEnd: end,
    adjustedObjectStart: round(object.start),
    adjustedObjectEnd: end
  };
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
