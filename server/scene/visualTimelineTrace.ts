import type {
  CompiledSceneBlock,
  CompiledScenePlan,
  DirectorPlan,
  DirectorPlanBlock,
  ScreenCopyBlock,
  ScreenCopyPayload,
  ScreenCopyPlan,
  SemanticBlock,
  SubtitleDraft,
  TranscriptJson,
  TranscriptWord,
  VisualBeat,
  VisualScene
} from "@/lib/types";
import { getSceneRecipe } from "./sceneLibrary";
import { guardScenePayload } from "./scenePayloadGuards";
import { buildSceneRecipeRuntime } from "./sceneRecipeRuntime";

const TRACE_VERSION = "v1";
const TEXT_SUMMARY_LIMIT = 80;
const ITEM_SUMMARY_LIMIT = 40;
const ALIGN_TOLERANCE = 0.08;
const SHORT_VISUAL_RATIO = 0.6;

type TraceWarning =
  | "visual_too_short_for_phrase"
  | "visual_starts_after_spoken_phrase_started"
  | "visual_ends_before_spoken_phrase_finished"
  | "payload_text_not_found_in_source_words"
  | "payload_text_was_trimmed"
  | "payload_text_is_partial_phrase"
  | "object_not_aligned_to_word_boundaries"
  | "fallback_applied"
  | "weak_payload_downgraded"
  | "missing_word_range"
  | "missing_clean_word_mapping";

interface TraceItem {
  objectId: string;
  blockId: string;
  renderPath: "overlay" | "full_scene";
  recipeIdSelectedByDirector: string | null;
  recipeIdFromScreenCopy: string | null;
  finalRecipeId: string | null;
  fallbackApplied: boolean;
  downgradeReason: string | null;
  disabled: boolean;
  objectStart: number;
  objectEnd: number;
  objectDuration: number;
  blockStart: number;
  blockEnd: number;
  blockDuration: number;
  sourceTranscriptWordRange: { startIndex: number; endIndex: number } | null;
  sourceStart: number | null;
  sourceEnd: number | null;
  sourceText: string | null;
  wordCount: number | null;
  cleanStart: number | null;
  cleanEnd: number | null;
  cleanText: string | null;
  cleanWordCount: number | null;
  alignsToCleanWordBoundaries: boolean | null;
  blockType: string;
  blockSummary: string | null;
  blockText: string | null;
  blockSource: "subtitle_chunker" | "unknown";
  semanticBlockStart: number;
  semanticBlockEnd: number;
  generatedPayloadSummary: PayloadSummary;
  finalPayloadSummary: PayloadSummary;
  wasTrimmed: boolean;
  droppedText: boolean;
  trimmedTextLength: number;
  payloadTextFoundInSourceWords: boolean | null;
  directorReason: string | null;
  scenePriority: string | null;
  sceneDensity: string | null;
  visualRole: string | null;
  speakerMode: string | null;
  payloadGuardResult: {
    payload_schema_valid: boolean;
    weak_payload_downgrade: boolean;
    fallback_recipe_applied: boolean;
    compiled_without_fallback: boolean;
  };
  recipeRuntimeResult: {
    recipe_allowed_by_template: boolean;
    fallback_recipe_used: boolean;
    original_recipe_used: boolean;
  };
  timingDiagnostics: {
    objectDurationToBlockDurationRatio: number | null;
    objectStartDeltaFromBlockStart: number;
    objectEndDeltaFromBlockEnd: number;
    objectCoversFullBlock: boolean;
    objectCoversMostWords: boolean | null;
    payloadTextCoverageRatio: number | null;
    visualTooShortForPhrase: boolean;
    visualEndsBeforePhraseEnds: boolean | null;
    visualStartsAfterPhraseStarts: boolean | null;
  };
  warnings: TraceWarning[];
}

interface PayloadSummary {
  title: string | null;
  text: string | null;
  items: string[];
  value: string | null;
  label: string | null;
}

export function buildVisualTimelineTrace(input: {
  transcript: TranscriptJson;
  subtitles: SubtitleDraft[];
  directorPlan: DirectorPlan;
  screenCopyPlan: ScreenCopyPlan;
  compiledScenePlan: CompiledScenePlan;
}) {
  const items = input.compiledScenePlan.blocks.flatMap((compiledBlock) =>
    buildTraceItemsForBlock(compiledBlock, input.directorPlan, input.screenCopyPlan, input.subtitles)
  );
  return {
    version: TRACE_VERSION,
    items
  };
}

function buildTraceItemsForBlock(
  compiledBlock: CompiledSceneBlock,
  directorPlan: DirectorPlan,
  screenCopyPlan: ScreenCopyPlan,
  subtitles: SubtitleDraft[]
) {
  const directorBlock = directorPlan.blocks.find((block) => block.blockId === compiledBlock.blockId);
  const screenCopyBlock = screenCopyPlan.blocks.find((block) => block.blockId === compiledBlock.blockId);
  const semanticBlock = directorPlan.semanticBlocks.find((block) => block.id === compiledBlock.blockId);
  if (!directorBlock || !screenCopyBlock || !semanticBlock) return [];

  const objects: Array<VisualBeat | VisualScene> = compiledBlock.renderPath === "overlay"
    ? compiledBlock.overlayBeats
    : compiledBlock.fullScene
      ? [compiledBlock.fullScene]
      : [];

  return objects.map((object) => buildTraceItem(compiledBlock, object, directorBlock, screenCopyBlock, semanticBlock, subtitles));
}

function buildTraceItem(
  compiledBlock: CompiledSceneBlock,
  object: VisualBeat | VisualScene,
  directorBlock: DirectorPlanBlock,
  screenCopyBlock: ScreenCopyBlock,
  semanticBlock: SemanticBlock,
  subtitles: SubtitleDraft[]
): TraceItem {
  const objectStart = round(object.start);
  const objectDuration = round(object.duration);
  const objectEnd = round(object.start + object.duration);
  const blockDuration = round(Math.max(0, compiledBlock.end - compiledBlock.start));

  const initialRecipeId = directorBlock.safeMode ? (directorBlock.fallbackRecipeId ?? directorBlock.recipeId) : directorBlock.recipeId;
  const runtimeRecipe = buildSceneRecipeRuntime(initialRecipeId, screenCopyBlock.payload, directorBlock.fallbackRecipeId);
  const guardedRecipe = guardScenePayload({
    recipeId: runtimeRecipe.recipeId,
    recipeDef: runtimeRecipe.recipeDef,
    payload: screenCopyBlock.payload,
    fallbackRecipeId: directorBlock.fallbackRecipeId,
    summary: semanticBlock.summary
  });
  const finalRecipeDef = getSceneRecipe(compiledBlock.recipeId);
  const payloadSchemaValid = finalRecipeDef.payloadSchema.safeParse(compiledBlock.screenCopy).success;
  const cleanWords = collectCleanWords(subtitles, semanticBlock.start, semanticBlock.end);
  const cleanText = cleanWords.map((word) => word.word).join(" ").trim() || null;
  const cleanStart = cleanWords[0]?.start ?? null;
  const cleanEnd = cleanWords.at(-1)?.end ?? null;
  const alignsToCleanWordBoundaries = cleanWords.length > 0
    ? isAlignedToWordBoundary(objectStart, objectEnd, cleanWords)
    : null;

  const generatedPayloadSummary = summarizePayload(screenCopyBlock.payload);
  const finalPayloadSummary = summarizePayload(compiledBlock.screenCopy);
  const generatedPayloadText = payloadSummaryText(generatedPayloadSummary);
  const finalPayloadText = payloadSummaryText(finalPayloadSummary);
  const sourceText = semanticBlock.text || semanticBlock.summary || null;
  const payloadCoverageRatio = computeTokenCoverageRatio(finalPayloadText, `${sourceText ?? ""} ${cleanText ?? ""}`);
  const payloadTextFoundInSourceWords = payloadCoverageRatio === null ? null : payloadCoverageRatio > 0;
  const wasTrimmed = generatedPayloadText.length > finalPayloadText.length || generatedPayloadSummary.items.length > finalPayloadSummary.items.length;
  const trimmedTextLength = Math.max(0, generatedPayloadText.length - finalPayloadText.length);
  const droppedText = generatedPayloadText.length > 0 && finalPayloadText.length === 0;
  const phraseStart = cleanStart ?? semanticBlock.start;
  const phraseEnd = cleanEnd ?? semanticBlock.end;
  const phraseDuration = Math.max(0, phraseEnd - phraseStart);
  const visualTooShortForPhrase = phraseDuration > 0 ? objectDuration < round(phraseDuration * SHORT_VISUAL_RATIO) : blockDuration > 0 ? objectDuration < round(blockDuration * SHORT_VISUAL_RATIO) : false;
  const visualStartsAfterPhraseStarts = phraseStart !== null ? objectStart > phraseStart + ALIGN_TOLERANCE : null;
  const visualEndsBeforePhraseEnds = phraseEnd !== null ? objectEnd < phraseEnd - ALIGN_TOLERANCE : null;
  const objectCoversMostWords = phraseDuration > 0 ? objectStart <= phraseStart + ALIGN_TOLERANCE && objectEnd >= phraseStart + phraseDuration * 0.75 : null;
  const warnings: TraceWarning[] = [];

  if (!semanticBlock.transcriptWordRange) warnings.push("missing_word_range");
  if (cleanWords.length === 0) warnings.push("missing_clean_word_mapping");
  if (compiledBlock.fallbackApplied) warnings.push("fallback_applied");
  if (guardedRecipe.recipeId !== runtimeRecipe.recipeId) warnings.push("weak_payload_downgraded");
  if (visualTooShortForPhrase) warnings.push("visual_too_short_for_phrase");
  if (visualStartsAfterPhraseStarts === true) warnings.push("visual_starts_after_spoken_phrase_started");
  if (visualEndsBeforePhraseEnds === true) warnings.push("visual_ends_before_spoken_phrase_finished");
  if (payloadTextFoundInSourceWords === false) warnings.push("payload_text_not_found_in_source_words");
  if (wasTrimmed) warnings.push("payload_text_was_trimmed");
  if (payloadCoverageRatio !== null && payloadCoverageRatio > 0 && payloadCoverageRatio < 1) warnings.push("payload_text_is_partial_phrase");
  if (alignsToCleanWordBoundaries === false) warnings.push("object_not_aligned_to_word_boundaries");

  return {
    objectId: object.id,
    blockId: compiledBlock.blockId,
    renderPath: compiledBlock.renderPath,
    recipeIdSelectedByDirector: directorBlock.recipeId,
    recipeIdFromScreenCopy: screenCopyBlock.recipeId,
    finalRecipeId: compiledBlock.recipeId,
    fallbackApplied: compiledBlock.fallbackApplied === true,
    downgradeReason: inferDowngradeReason(directorBlock, runtimeRecipe.recipeId, guardedRecipe.recipeId, compiledBlock),
    disabled: directorBlock.disabled === true,
    objectStart,
    objectEnd,
    objectDuration,
    blockStart: round(compiledBlock.start),
    blockEnd: round(compiledBlock.end),
    blockDuration,
    sourceTranscriptWordRange: semanticBlock.transcriptWordRange ?? null,
    sourceStart: semanticBlock.words[0]?.start ?? semanticBlock.start,
    sourceEnd: semanticBlock.words.at(-1)?.end ?? semanticBlock.end,
    sourceText,
    wordCount: semanticBlock.wordCount ?? semanticBlock.words.length ?? null,
    cleanStart,
    cleanEnd,
    cleanText: summarizeText(cleanText, TEXT_SUMMARY_LIMIT),
    cleanWordCount: cleanWords.length,
    alignsToCleanWordBoundaries,
    blockType: semanticBlock.type,
    blockSummary: summarizeText(semanticBlock.summary, TEXT_SUMMARY_LIMIT),
    blockText: summarizeText(semanticBlock.text, TEXT_SUMMARY_LIMIT),
    blockSource: "subtitle_chunker",
    semanticBlockStart: round(semanticBlock.start),
    semanticBlockEnd: round(semanticBlock.end),
    generatedPayloadSummary,
    finalPayloadSummary,
    wasTrimmed,
    droppedText,
    trimmedTextLength,
    payloadTextFoundInSourceWords,
    directorReason: directorBlock.rationale ?? screenCopyBlock.rationale ?? null,
    scenePriority: compiledBlock.scenePriority ?? null,
    sceneDensity: compiledBlock.sceneDensity ?? null,
    visualRole: compiledBlock.visualRole ?? null,
    speakerMode: compiledBlock.speakerMode ?? null,
    payloadGuardResult: {
      payload_schema_valid: payloadSchemaValid,
      weak_payload_downgrade: guardedRecipe.recipeId !== runtimeRecipe.recipeId,
      fallback_recipe_applied: compiledBlock.fallbackApplied === true,
      compiled_without_fallback: compiledBlock.fallbackApplied !== true
    },
    recipeRuntimeResult: {
      recipe_allowed_by_template: runtimeRecipe.recipeId === initialRecipeId,
      fallback_recipe_used: runtimeRecipe.recipeId !== initialRecipeId,
      original_recipe_used: runtimeRecipe.recipeId === initialRecipeId
    },
    timingDiagnostics: {
      objectDurationToBlockDurationRatio: blockDuration > 0 ? round(objectDuration / blockDuration) : null,
      objectStartDeltaFromBlockStart: round(objectStart - compiledBlock.start),
      objectEndDeltaFromBlockEnd: round(objectEnd - compiledBlock.end),
      objectCoversFullBlock: Math.abs(objectStart - compiledBlock.start) <= ALIGN_TOLERANCE && Math.abs(objectEnd - compiledBlock.end) <= ALIGN_TOLERANCE,
      objectCoversMostWords,
      payloadTextCoverageRatio: payloadCoverageRatio === null ? null : round(payloadCoverageRatio),
      visualTooShortForPhrase,
      visualEndsBeforePhraseEnds,
      visualStartsAfterPhraseStarts
    },
    warnings: [...new Set(warnings)]
  };
}

function summarizePayload(payload: ScreenCopyPayload): PayloadSummary {
  return {
    title: summarizeText(readString(payload.title), TEXT_SUMMARY_LIMIT),
    text: summarizeText(readString(payload.text) ?? readString(payload.quote) ?? readString(payload.cta), TEXT_SUMMARY_LIMIT),
    items: Array.isArray(payload.items) ? payload.items.slice(0, 3).map((item) => summarizeText(String(item), ITEM_SUMMARY_LIMIT) ?? "").filter(Boolean) : [],
    value: summarizeText(readString(payload.value), ITEM_SUMMARY_LIMIT),
    label: summarizeText(readString(payload.label), ITEM_SUMMARY_LIMIT)
  };
}

function collectCleanWords(subtitles: SubtitleDraft[], blockStart: number, blockEnd: number) {
  return subtitles
    .filter((subtitle) => subtitle.end >= blockStart - ALIGN_TOLERANCE && subtitle.start <= blockEnd + ALIGN_TOLERANCE)
    .flatMap((subtitle) => subtitle.words)
    .filter((word) => word.end >= blockStart - ALIGN_TOLERANCE && word.start <= blockEnd + ALIGN_TOLERANCE)
    .sort((a, b) => a.start - b.start);
}

function isAlignedToWordBoundary(start: number, end: number, words: TranscriptWord[]) {
  const starts = words.some((word) => Math.abs(word.start - start) <= ALIGN_TOLERANCE);
  const ends = words.some((word) => Math.abs(word.end - end) <= ALIGN_TOLERANCE);
  return starts && ends;
}

function inferDowngradeReason(
  directorBlock: DirectorPlanBlock,
  runtimeRecipeId: string,
  guardedRecipeId: string,
  compiledBlock: CompiledSceneBlock
) {
  if (guardedRecipeId !== runtimeRecipeId) return "weak_payload_downgrade";
  if (runtimeRecipeId !== directorBlock.recipeId) return "runtime_recipe_fallback";
  if (compiledBlock.fallbackApplied) return "fallback_applied";
  return null;
}

function payloadSummaryText(summary: PayloadSummary) {
  return [summary.title, summary.text, summary.value, summary.label, ...summary.items].filter(Boolean).join(" ").trim();
}

function computeTokenCoverageRatio(payloadText: string, sourceText: string) {
  const payloadTokens = tokenize(payloadText);
  if (payloadTokens.length === 0) return null;
  const sourceTokens = new Set(tokenize(sourceText));
  let matches = 0;
  for (const token of payloadTokens) {
    if (sourceTokens.has(token)) matches += 1;
  }
  return matches / payloadTokens.length;
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}%+-]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 || /^\d+$/.test(token) || /[%+-]/.test(token));
}

function summarizeText(value: string | null | undefined, limit: number) {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
