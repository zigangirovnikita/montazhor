import type { CleanupMode, EditDecisionList, EditRange, KeepSegment, TranscriptJson } from "@/lib/types";
import { isFillerWord } from "@/server/ai/fillerWords";
import { isProfanity } from "@/server/ai/profanity";
import { complementRanges, mergeCloseRanges } from "@/server/video/cutting";
import { isAiConfigured } from "@/lib/config";
import { describeAudibleGaps, detectConfirmedGapRemovals, detectTranscriptGaps, gapsToEditRanges } from "@/server/ai/transcriptGaps";
import { formatTranscriptTimingStats, normalizeTranscriptTimings } from "@/server/ai/transcriptTiming";
import { detectVoiceActivity, speechGapsFromVad } from "@/server/ai/voiceActivity";
import type { VoiceActivityMap } from "@/server/ai/voiceActivity";
import { detectRefinedWordGapRemovals } from "@/server/ai/cutBoundaryRefiner";
import { detectUntranscribedVoiceRemovals } from "@/server/pipeline/steps/untranscribedVoice";
import { selectScriptWithAi } from "@/server/ai/scriptSelector";
import { collectWordBoundaries, isReliableWordBoundary, normalizeToken } from "@/server/ai/wordBoundaries";
import type { WordBoundary } from "@/server/ai/wordBoundaries";
import {
  CONSERVATIVE_TRANSCRIPT_GAP_FALLBACK_SECONDS,
  FILLER_EDGE_GUARD_SECONDS,
  isElongatedHesitationToken,
  MAX_VAD_EDGE_PROTECTED_WORD_DURATION,
  MIN_KEPT_FRAGMENT_SECONDS,
  PAUSE_KEEP_HANDLE_SECONDS,
  SCRIPT_KEEP_HANDLE_SECONDS,
  SEMANTIC_EDGE_GUARD_SECONDS,
  WORD_GAP_REMOVAL_THRESHOLD
} from "@/server/ai/cutTimingPolicy";

const GAP_REASONS = new Set(["pause", "silence", "long_pause", "non_silent_gap", "noisy_pause", "vad_pause", "untranscribed_voice"]);
const NON_SEMANTIC_REASONS = new Set([...GAP_REASONS, "not_selected"]);


function clampRange(range: EditRange, duration: number): EditRange {
  return {
    ...range,
    sourceStart: Math.max(0, Math.min(range.sourceStart, duration)),
    sourceEnd: Math.max(0, Math.min(range.sourceEnd, duration)),
  };
}

function marginForGap(gapDuration: number): number {
  return Math.min(PAUSE_KEEP_HANDLE_SECONDS, gapDuration / 2);
}

function normalizeGapRange(range: EditRange, duration: number): EditRange | undefined {
  const clamped = clampRange(range, duration);
  const margin = marginForGap(clamped.sourceEnd - clamped.sourceStart);
  const sourceStart = clamped.sourceStart + margin;
  const sourceEnd = clamped.sourceEnd - margin;

  if (sourceEnd <= sourceStart) return undefined;
  return { ...clamped, sourceStart, sourceEnd };
}



function shouldProtectWordInsideVadGap(word: WordBoundary, gap: EditRange): boolean {
  if (!isReliableWordBoundary(word)) return false;
  if (word.end <= gap.sourceStart || word.start >= gap.sourceEnd) return false;

  const isFullyInsideGap = word.start >= gap.sourceStart && word.end <= gap.sourceEnd;
  if (isFullyInsideGap) return true;

  return word.end - word.start <= MAX_VAD_EDGE_PROTECTED_WORD_DURATION;
}

function normalizeVadGapRange(
  range: EditRange,
  duration: number,
  words: WordBoundary[]
): EditRange[] {
  const clamped = clampRange(range, duration);
  const protectedWords = words.filter(
    (word) => shouldProtectWordInsideVadGap(word, clamped)
  );

  if (protectedWords.length === 0) {
    const normalized = normalizeGapRange(clamped, duration);
    return normalized ? [normalized] : [];
  }

  const safePieces: EditRange[] = [];
  let cursor = clamped.sourceStart;
  for (const word of protectedWords) {
    if (word.start > cursor) {
      safePieces.push({ ...clamped, sourceStart: cursor, sourceEnd: word.start });
    }
    cursor = Math.max(cursor, word.end);
  }

  if (cursor < clamped.sourceEnd) {
    safePieces.push({ ...clamped, sourceStart: cursor, sourceEnd: clamped.sourceEnd });
  }

  return safePieces
    .map((piece) => normalizeGapRange(piece, duration))
    .filter((piece): piece is EditRange => Boolean(piece));
}

function normalizeSemanticRange(
  range: EditRange,
  duration: number,
  words: WordBoundary[]
): EditRange | undefined {
  const clamped = clampRange(range, duration);
  const overlappedWords = words.filter(
    (word) => word.end > clamped.sourceStart && word.start < clamped.sourceEnd
  );

  if (overlappedWords.length === 0) return undefined;

  const firstWord = overlappedWords[0];
  const lastWord = overlappedWords[overlappedWords.length - 1];
  const firstWordIndex = words.indexOf(firstWord);
  const lastWordIndex = words.indexOf(lastWord);
  const previousWord = firstWordIndex > 0 ? words[firstWordIndex - 1] : undefined;
  const nextWord = lastWordIndex >= 0 ? words[lastWordIndex + 1] : undefined;

  const leftGap = previousWord ? Math.max(0, firstWord.start - previousWord.end) : 0;
  const rightGap = nextWord ? Math.max(0, nextWord.start - lastWord.end) : 0;
  const fillerExpansion = shouldExpandFillerRemoval(range, overlappedWords)
    ? FILLER_EDGE_GUARD_SECONDS
    : SEMANTIC_EDGE_GUARD_SECONDS;

  const sourceStart = Math.max(
    0,
    firstWord.start - Math.min(fillerExpansion, leftGap)
  );
  const sourceEnd = Math.min(
    duration,
    lastWord.end + Math.min(fillerExpansion, rightGap)
  );

  if (sourceEnd <= sourceStart) return undefined;
  return { ...clamped, sourceStart, sourceEnd };
}

function shouldExpandFillerRemoval(range: EditRange, overlappedWords: WordBoundary[]): boolean {
  if (range.reason !== "filler_word" && range.reason !== "hesitation") return false;
  return overlappedWords.some((word) => word.word && isFillerWord(word.word));
}

export function normalizeRemovalRanges(
  transcript: TranscriptJson,
  removedRanges: EditRange[],
  duration: number
): EditRange[] {
  const words = collectWordBoundaries(transcript);

  return removedRanges
    .flatMap((range) => {
      if (range.reason === "vad_pause") {
        return normalizeVadGapRange(range, duration, words);
      }
      const normalized = GAP_REASONS.has(range.reason)
        ? normalizeGapRange(range, duration)
        : normalizeSemanticRange(range, duration, words);
      return normalized ? [normalized] : [];
    })
    .filter((range): range is EditRange => Boolean(range))
    .sort((a, b) => a.sourceStart - b.sourceStart);
}

function mergeShortKeptFragments(ranges: EditRange[], minKeptDuration = MIN_KEPT_FRAGMENT_SECONDS): EditRange[] {
  if (ranges.length < 2) return ranges;

  const merged: EditRange[] = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range.sourceStart - previous.sourceEnd < minKeptDuration) {
      previous.sourceEnd = Math.max(previous.sourceEnd, range.sourceEnd);
      previous.reason = mergeRangeReasons(previous.reason, range.reason);
      previous.text = previous.text ?? range.text;
      continue;
    }

    merged.push({ ...range });
  }

  return merged;
}

function mergeRangeReasons(left: string, right: string): string {
  if (left === right) return left;
  if (left === "untranscribed_voice" || right === "untranscribed_voice") return "untranscribed_voice";
  return "mixed";
}

function buildEditDecisionList(transcript: TranscriptJson, removed: EditRange[], duration: number): EditDecisionList {
  const normalized = normalizeRemovalRanges(transcript, removed, duration);
  const merged = mergeCloseRanges(normalized, 0.08);
  const removedRanges = mergeShortKeptFragments(merged);
  const keptRanges = complementRanges(duration, removedRanges);
  return { keptRanges, removedRanges };
}

export function buildEditDecisionListFromKeepSegments(
  transcript: TranscriptJson,
  keepSegments: KeepSegment[],
  technicalRemovals: EditRange[],
  duration: number
): EditDecisionList {
  const selectedRanges = keepSegments
    .map((segment) => ({
      sourceStart: Math.max(0, segment.sourceStart - SCRIPT_KEEP_HANDLE_SECONDS),
      sourceEnd: Math.min(duration, segment.sourceEnd + SCRIPT_KEEP_HANDLE_SECONDS),
      reason: "final_script",
      text: segment.text,
    }))
    .filter((range) => range.sourceEnd > range.sourceStart)
    .sort((a, b) => a.sourceStart - b.sourceStart);

  const technicalRanges = clipRangesToKeepRanges(
    normalizeRemovalRanges(transcript, technicalRemovals, duration),
    selectedRanges
  );
  const notSelectedRanges = complementKeptRanges(duration, selectedRanges);
  const removedRanges = mergeShortKeptFragments(
    mergeCloseRanges([...notSelectedRanges, ...technicalRanges], 0.08)
  );

  return {
    keptRanges: complementRanges(duration, removedRanges)
      .filter((range) => range.sourceEnd - range.sourceStart >= MIN_KEPT_FRAGMENT_SECONDS),
    removedRanges,
  };
}

function clipRangesToKeepRanges(ranges: EditRange[], keepRanges: EditRange[]): EditRange[] {
  return ranges.flatMap((range) => {
    return keepRanges
      .map((keep) => ({
        ...range,
        sourceStart: Math.max(range.sourceStart, keep.sourceStart),
        sourceEnd: Math.min(range.sourceEnd, keep.sourceEnd),
      }))
      .filter((piece) => piece.sourceEnd > piece.sourceStart);
  });
}

function complementKeptRanges(duration: number, keptRanges: EditRange[]): EditRange[] {
  const sorted = [...keptRanges]
    .filter((range) => range.sourceEnd > range.sourceStart)
    .sort((a, b) => a.sourceStart - b.sourceStart);
  const removed: EditRange[] = [];
  let cursor = 0;

  for (const range of sorted) {
    if (range.sourceStart > cursor) {
      removed.push({ sourceStart: cursor, sourceEnd: range.sourceStart, reason: "not_selected" });
    }
    cursor = Math.max(cursor, range.sourceEnd);
  }

  if (duration > cursor) {
    removed.push({ sourceStart: cursor, sourceEnd: duration, reason: "not_selected" });
  }

  return removed.filter((range) => range.sourceEnd - range.sourceStart > 0.08);
}

function shouldKeepContextualFiller(words: { word: string; start: number; end: number }[], index: number): boolean {
  const word = words[index];
  const normalized = normalizeToken(word.word);
  const nextWord = words[index + 1];
  if (!nextWord) return false;

  if (normalized !== "короче") return false;

  // "Короче, я женился" is a discourse connector into the next authored thought,
  // not removable clutter. Keep it in the heuristic fallback to match the AI prompt.
  return nextWord.start - word.end <= 1.0;
}

/**
 * Plan cuts using AI script selection (primary) or heuristic fallback.
 *
 * Primary mode is keep-first: AI selects the final spoken script, then
 * deterministic VAD/gap cleanup is applied inside those selected ranges.
 */
export async function planCuts(
  transcript: TranscriptJson,
  duration: number,
  cleanupMode: CleanupMode,
  log?: (message: string) => void,
  audioPath?: string,
  precomputedVad?: VoiceActivityMap,
  precomputedSileroVad?: VoiceActivityMap,
  projectId?: string
): Promise<EditDecisionList> {
  const info = log ?? (() => {});
  const { transcript: normalizedTranscript, stats: timingStats } = normalizeTranscriptTimings(transcript, {
    duration,
    speechRanges: precomputedVad?.speechRanges,
  });
  if (timingStats.repairedWords > 0) {
    info(formatTranscriptTimingStats(timingStats));
  }

  const deterministicGapRemovals = await detectDeterministicGapRemovals(
    normalizedTranscript,
    duration,
    cleanupMode,
    audioPath,
    info,
    precomputedVad,
    precomputedSileroVad
  );
  const safetyRemovals = detectSafetyRemovals(normalizedTranscript, cleanupMode, info);

  if (cleanupMode === "semantic_cleanup" && isAiConfigured("script_selector_pass_1") && isAiConfigured("script_selector_pass_2")) {
    try {
      info("AI script selection enabled — selecting final spoken script...");
      const scriptPlan = await selectScriptWithAi(normalizedTranscript, cleanupMode, duration, info, projectId);
      info(`AI script selection complete: ${scriptPlan.keepSegments.length} keep segments selected. Reasoning: ${scriptPlan.reasoning}`);

      const edl = buildEditDecisionListFromKeepSegments(
        normalizedTranscript,
        scriptPlan.keepSegments,
        [...deterministicGapRemovals, ...safetyRemovals],
        duration
      );
      logFinalEdl(edl, info);
      return edl;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      info(`AI script selection failed, falling back to heuristic: ${message}`);
    }
  } else if (cleanupMode === "semantic_cleanup") {
    info("AI script selector not fully configured. Using heuristic analysis.");
  }

  // Heuristic fallback
  const edl = planCutsHeuristic(normalizedTranscript, duration, cleanupMode, [...deterministicGapRemovals, ...safetyRemovals]);
  logFinalEdl(edl, info);
  return edl;
}

function detectSafetyRemovals(
  transcript: TranscriptJson,
  cleanupMode: CleanupMode,
  log: (message: string) => void
): EditRange[] {
  const removals: EditRange[] = [];

  if (cleanupMode === "semantic_cleanup") {
    const restartRemovals = detectAbandonedRestartRemovals(transcript);
    if (restartRemovals.length > 0) {
      removals.push(...restartRemovals);
      log(`Restart safety pass: ${restartRemovals.length} abandoned transcript restarts added before AI/heuristic analysis.`);
    }
  }

  const hesitationRemovals = detectObviousHesitationRemovals(transcript, cleanupMode);
  if (hesitationRemovals.length > 0) {
    removals.push(...hesitationRemovals);
    log(`Hesitation safety pass: ${hesitationRemovals.length} obvious elongated filler sounds added before final EDL.`);
  }

  if (cleanupMode !== "semantic_cleanup") return removals;

  for (const segment of transcript.segments) {
    const words = segment.words ?? [];
    const profanityWords = words.filter((word) => isProfanity(word.word));
    if (profanityWords.length === 0) continue;

    if (isProfanityOutburst(segment.text, words.length, profanityWords.length)) {
      removals.push({
        sourceStart: segment.start,
        sourceEnd: segment.end,
        reason: "profanity",
        text: segment.text,
      });
      continue;
    }

    for (const word of profanityWords) {
      removals.push({ sourceStart: word.start, sourceEnd: word.end, reason: "profanity", text: word.word });
    }
  }

  if (removals.length > 0) {
    log(`Safety profanity pass: ${removals.length} profanity removals added/confirmed before final EDL.`);
  }

  return removals;
}

function detectObviousHesitationRemovals(
  transcript: TranscriptJson,
  cleanupMode: CleanupMode
): EditRange[] {
  if (cleanupMode === "pauses_only") return [];

  const removals: EditRange[] = [];
  for (const segment of transcript.segments) {
    const words = segment.words ?? [];
    for (const [index, word] of words.entries()) {
      if (shouldKeepContextualFiller(words, index)) continue;
      const normalized = normalizeToken(word.word);
      const duration = word.end - word.start;
      if (isElongatedHesitationToken(normalized) && duration > 0 && duration <= 1.8) {
        removals.push({
          sourceStart: word.start,
          sourceEnd: word.end,
          reason: "hesitation",
          text: word.word,
        });
      }
    }
  }

  return removals;
}

function detectAbandonedRestartRemovals(transcript: TranscriptJson): EditRange[] {
  const removals: EditRange[] = [];
  for (const [index, segment] of transcript.segments.entries()) {
    if (!segment.text.trim().endsWith("...")) continue;

    const currentLead = leadingContentTokens(segment.text, 3);
    if (currentLead.length === 0) continue;

    const restart = transcript.segments
      .slice(index + 1, index + 4)
      .find((candidate) => sharesLead(currentLead, leadingContentTokens(candidate.text, 3)));
    if (!restart) continue;

    removals.push({
      sourceStart: segment.start,
      sourceEnd: segment.end,
      reason: "script_retake",
      text: segment.text,
    });
  }
  return removals;
}

function leadingContentTokens(text: string, max: number): string[] {
  return text
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token) => token.length >= 4 && !RESTART_STOPWORDS.has(token))
    .slice(0, max);
}

function sharesLead(left: string[], right: string[]): boolean {
  if (left.length === 0 || right.length === 0) return false;
  return left.slice(0, 2).some((token) => right.includes(token));
}

const RESTART_STOPWORDS = new Set(["это", "там", "если", "после", "пока", "уже", "можно", "нельзя"]);

function isProfanityOutburst(text: string, wordCount: number, profanityCount: number): boolean {
  if (profanityCount < 2) return false;
  const profanityDensity = profanityCount / Math.max(wordCount, 1);
  const normalizedText = normalizeToken(text);
  const hasUsefulLength = wordCount >= 6 || normalizedText.length >= 45;

  if (hasUsefulLength && profanityDensity < 0.6) return false;
  return profanityDensity >= 0.5 || wordCount <= 4;
}

async function detectDeterministicGapRemovals(
  transcript: TranscriptJson,
  duration: number,
  cleanupMode: CleanupMode,
  audioPath: string | undefined,
  log: (message: string) => void,
  precomputedVad?: VoiceActivityMap,
  precomputedSileroVad?: VoiceActivityMap
): Promise<EditRange[]> {
  const minSpeechGap = WORD_GAP_REMOVAL_THRESHOLD;
  const transcriptGaps = detectTranscriptGaps(transcript, minSpeechGap);
  if (!audioPath) return gapsToEditRanges(transcriptGaps);

  try {
    const vad = precomputedVad ?? await detectVoiceActivity(audioPath);
    const sileroVad = precomputedSileroVad ?? (vad.provider === "silero-vad" ? vad : undefined);
    const pauseVad = sileroVad ?? vad;
    const vadGaps = speechGapsFromVad(pauseVad, duration, minSpeechGap);
    const refinedWordGaps = await detectWordGapRemovalsWithFallback(transcript, audioPath, duration, pauseVad, log);
    const nonOverlappingVadGaps = dropVadGapsCoveredByRefinedGaps(vadGaps, refinedWordGaps);
    const untranscribedVoiceRemovals = detectUntranscribedVoiceRemovals(transcript, vad, cleanupMode, log);
    log(
      `${vad.provider}: detected ${vad.speechRanges.length} main-speaker speech ranges; ${pauseVad.provider}: detected ${vadGaps.length} no-speech gaps, ${refinedWordGaps.length} refined word gaps (${nonOverlappingVadGaps.length} standalone after refinement).`
    );
    if (untranscribedVoiceRemovals.length > 0 && cleanupMode === "pauses_only") {
      log(`Voice/transcript mismatch diagnostics only: ${untranscribedVoiceRemovals.length} ranges were detected but not auto-removed.`);
    } else if (untranscribedVoiceRemovals.length > 0) {
      log(`Voice/transcript mismatch safety pass: ${untranscribedVoiceRemovals.length} ranges added to EDL.`);
    }
    return [
      ...nonOverlappingVadGaps.map((gap) => ({
        sourceStart: gap.start,
        sourceEnd: gap.end,
        reason: "vad_pause",
      })),
      ...refinedWordGaps,
      ...(cleanupMode === "pauses_only" ? [] : untranscribedVoiceRemovals),
    ];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Silero VAD failed, falling back to transcript-gap pause detection: ${message}`);
  }

  const conservativeFallbackMinGap = Math.max(minSpeechGap, CONSERVATIVE_TRANSCRIPT_GAP_FALLBACK_SECONDS);
  const gapRemovals = await detectConfirmedGapRemovals(transcriptGaps, audioPath, conservativeFallbackMinGap);
  const noisyGaps = describeAudibleGaps(transcriptGaps);
  if (noisyGaps.length > 0) {
    log(`Audio post-check: ${noisyGaps.length} transcript pauses contain background/audible sound and are treated as noisy pauses, not speech: ${noisyGaps.join("; ")}`);
  }
  return gapRemovals;
}

function dropVadGapsCoveredByRefinedGaps(
  vadGaps: { start: number; end: number }[],
  refinedWordGaps: EditRange[]
): { start: number; end: number }[] {
  return vadGaps.filter(
    (gap) =>
      !refinedWordGaps.some(
        (refined) => refined.sourceStart < gap.end && refined.sourceEnd > gap.start
      )
  );
}

async function detectWordGapRemovalsWithFallback(
  transcript: TranscriptJson,
  audioPath: string,
  duration: number,
  vad: VoiceActivityMap,
  log: (message: string) => void
): Promise<EditRange[]> {
  try {
    return await detectRefinedWordGapRemovals(transcript, audioPath, duration, vad);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Boundary refinement failed, using VAD pauses only: ${message}`);
    return [];
  }
}

/**
 * Heuristic-based cut planning (fallback when AI is unavailable).
 * Detects pauses from transcript gaps + keyword-based filler removal.
 */
export function planCutsHeuristic(
  transcript: TranscriptJson,
  duration: number,
  cleanupMode: CleanupMode,
  extraRemovals: EditRange[] = []
): EditDecisionList {
  const removed: EditRange[] = [...extraRemovals];

  if (cleanupMode === "pauses_and_fillers" || cleanupMode === "semantic_cleanup") {
    for (const segment of transcript.segments) {
      const words = segment.words ?? [];
      for (const [index, word] of words.entries()) {
        if (shouldKeepContextualFiller(words, index)) continue;
        if (isFillerWord(word.word) && word.end - word.start <= 0.8) {
          removed.push({ sourceStart: word.start, sourceEnd: word.end, reason: "filler_word", text: word.word });
        }
      }
    }
  }

  if (cleanupMode === "semantic_cleanup") {
    for (const segment of transcript.segments) {
      for (const word of segment.words ?? []) {
        if (isProfanity(word.word)) {
          removed.push({ sourceStart: word.start, sourceEnd: word.end, reason: "profanity", text: word.word });
        }
      }
    }
  }

  return buildEditDecisionList(transcript, removed, duration);
}

function logFinalEdl(edl: EditDecisionList, log: (message: string) => void): void {
  const removedSeconds = edl.removedRanges.reduce((total, range) => total + range.sourceEnd - range.sourceStart, 0);
  const keptSeconds = edl.keptRanges.reduce((total, range) => total + range.sourceEnd - range.sourceStart, 0);
  const semanticRemoved = edl.removedRanges.filter((range) => !NON_SEMANTIC_REASONS.has(range.reason));
  log(
    `Final EDL: ${edl.keptRanges.length} kept ranges (${keptSeconds.toFixed(2)}s), ${edl.removedRanges.length} removed ranges (${removedSeconds.toFixed(2)}s), ${semanticRemoved.length} semantic removals.`
  );
}
