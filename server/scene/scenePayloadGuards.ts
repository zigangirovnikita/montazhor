import type { DirectorPlanBlock, SceneRecipeId, ScreenCopyPayload } from "@/lib/types";
import type { SceneRecipeDefinition } from "./sceneLibrary";
import { getSceneRecipe } from "./sceneLibrary";

const MAX_TITLE_LENGTH = 84;
const MAX_TEXT_LENGTH = 180;
const MAX_ITEMS = 4;

const PLACEHOLDER_VALUES = new Set(["01", "trust", "[summary]", "summary"]);
const SHORT_COMPARISON_TERMS = new Set(["до", "после", "да", "нет", "можно", "нельзя", "было", "стало", "минус", "плюс"]);

type GuardResult = {
  recipeId: SceneRecipeId;
  recipeDef: SceneRecipeDefinition;
  payload: ScreenCopyPayload;
};

export function guardScenePayload(input: {
  recipeId: SceneRecipeId;
  recipeDef?: SceneRecipeDefinition;
  payload: ScreenCopyPayload;
  fallbackRecipeId?: DirectorPlanBlock["recipeId"];
  summary: string;
}): GuardResult {
  const basePayload = normalizePayload(input.payload);
  const primaryRecipeDef = input.recipeDef ?? getSceneRecipe(input.recipeId);
  const candidateIds = uniqueRecipeIds([
    input.recipeId,
    input.fallbackRecipeId,
    chooseSafeRecipe(basePayload, input.summary),
    primaryRecipeDef.fallbackRecipeId
  ]);

  for (const candidateId of candidateIds) {
    const recipeDef = getSceneRecipe(candidateId);
    const candidatePayload = adaptPayloadForRecipe(candidateId, basePayload, input.summary);
    const parseResult = recipeDef.payloadSchema.safeParse(candidatePayload);
    if (!parseResult.success) continue;
    if (isWeakPayload(candidateId, parseResult.data as ScreenCopyPayload, input.summary)) continue;
    return {
      recipeId: candidateId,
      recipeDef,
      payload: parseResult.data as ScreenCopyPayload
    };
  }

  const safeRecipeId = chooseSafeRecipe(basePayload, input.summary);
  const safeRecipeDef = getSceneRecipe(safeRecipeId);
  const safePayload = adaptPayloadForRecipe(safeRecipeId, basePayload, input.summary);
  const parsedSafePayload = safeRecipeDef.payloadSchema.parse(safePayload) as ScreenCopyPayload;
  return {
    recipeId: safeRecipeId,
    recipeDef: safeRecipeDef,
    payload: parsedSafePayload
  };
}

function chooseSafeRecipe(payload: ScreenCopyPayload, summary: string): SceneRecipeId {
  if ((payload.items ?? []).length >= 2) return "checklist_reveal";
  if (hasMeaningfulComparisonPair(payload.left, payload.right) || hasMeaningfulComparisonPair(payload.falseText, payload.trueText)) return "definition_card";
  if (isMeaningfulValue(payload.value) && isMeaningfulText(payload.label ?? payload.title)) return "big_number_plus_text_plate";
  if (isMeaningfulText(payload.cta)) return "cta_finish";
  if (isMeaningfulText(readPrimaryText(payload) ?? summary)) return "hook_title_center";
  return "hook_title_center";
}

function adaptPayloadForRecipe(recipeId: SceneRecipeId, payload: ScreenCopyPayload, summary: string): ScreenCopyPayload {
  const normalizedSummary = cleanText(summary);
  const title = preferText(payload.title, payload.text, payload.label, normalizedSummary);
  const subtitle = preferText(payload.subtitle, payload.caption);
  const text = preferText(payload.text, payload.subtitle, payload.caption, normalizedSummary);
  const label = preferText(payload.label, payload.title, payload.subtitle);
  const value = normalizeText(payload.value, 24);
  const items = normalizeItems(payload.items, normalizedSummary);
  const left = preferComparisonText(payload.left, payload.falseText);
  const right = preferComparisonText(payload.right, payload.trueText);
  const quote = preferText(payload.quote, normalizedSummary);
  const cta = preferText(payload.cta, title, normalizedSummary);
  const center = preferText(payload.center, title);

  const base: ScreenCopyPayload = {
    ...payload,
    title,
    subtitle,
    text,
    label,
    value,
    items,
    left,
    right,
    quote,
    cta,
    center,
    falseText: preferComparisonText(payload.falseText, payload.left),
    trueText: preferComparisonText(payload.trueText, payload.right),
    caption: preferText(payload.caption, payload.subtitle),
    slots: payload.slots ?? [],
    supportVisuals: payload.supportVisuals ?? [],
    layerActions: payload.layerActions ?? []
  };

  if (recipeId === "hook_title_left" || recipeId === "hook_title_center") {
    return {
      title,
      subtitle,
      slots: base.slots,
      supportVisuals: base.supportVisuals,
      layerActions: base.layerActions
    };
  }
  if (recipeId === "headline_with_accent_number") {
    return { ...base, value, title, text };
  }
  if (recipeId === "step_number_callout") {
    return { ...base, value, label: preferText(label, title), text };
  }
  if (recipeId === "before_after_phrase_swap" || recipeId === "comparison_split") {
    return { ...base, left, right, caption: preferText(base.caption, subtitle) };
  }
  if (recipeId === "rule_card") {
    return { ...base, title, subtitle, text };
  }
  if (recipeId === "list_progression" || recipeId === "checklist_reveal" || recipeId === "timeline_year_callout") {
    return { ...base, title, items };
  }
  if (recipeId === "big_number_grow") {
    return { ...base, value, label: preferText(label, title) };
  }
  if (recipeId === "big_number_plus_text_plate") {
    return { ...base, value, label: preferText(label, title), text };
  }
  if (recipeId === "warning_strike_fix" || recipeId === "myth_vs_truth") {
    return {
      ...base,
      falseText: preferText(base.falseText, left),
      trueText: preferText(base.trueText, right),
      label
    };
  }
  if (recipeId === "hotkey_command_tip") {
    return { ...base, title, cta, label, text };
  }
  if (recipeId === "definition_card") {
    return { ...base, title, text, items };
  }
  if (recipeId === "trust_diagram") {
    return {
      ...base,
      center,
      left,
      right,
      caption: preferText(base.caption, subtitle)
    };
  }
  if (recipeId === "quote_emphasis") {
    return { ...base, quote, label };
  }
  if (recipeId === "cta_finish") {
    return {
      text: cta,
      label,
      slots: base.slots,
      supportVisuals: base.supportVisuals,
      layerActions: base.layerActions
    };
  }
  if (recipeId === "speaker_lower_half_top_visual") {
    return { ...base, title, subtitle, items };
  }
  if (recipeId === "speaker_right_panel_left_infographic") {
    return { ...base, title, label: preferText(label, title), value, items };
  }
  if (recipeId === "voiceover_full_graphic") {
    return { ...base, title, items, text };
  }
  if (recipeId === "camera_punch_in" || recipeId === "clean_section_transition") {
    return { ...base, title, text };
  }
  return base;
}

function isWeakPayload(recipeId: SceneRecipeId, payload: ScreenCopyPayload, summary: string) {
  const primaryText = readPrimaryText(payload) ?? cleanText(summary);
  if (!isMeaningfulText(primaryText)) return true;

  if (recipeId === "list_progression" || recipeId === "checklist_reveal" || recipeId === "timeline_year_callout" || recipeId === "voiceover_full_graphic") {
    return (payload.items?.length ?? 0) < 2;
  }
  if (recipeId === "before_after_phrase_swap" || recipeId === "comparison_split" || recipeId === "trust_diagram") {
    return !hasMeaningfulComparisonPair(payload.left, payload.right) && !hasMeaningfulComparisonPair(payload.falseText, payload.trueText);
  }
  if (recipeId === "warning_strike_fix" || recipeId === "myth_vs_truth") {
    return !hasMeaningfulComparisonPair(payload.falseText, payload.trueText);
  }
  if (recipeId === "headline_with_accent_number" || recipeId === "step_number_callout" || recipeId === "big_number_grow" || recipeId === "big_number_plus_text_plate") {
    return !isMeaningfulValue(payload.value) || !isMeaningfulText(payload.label ?? payload.title);
  }
  if (recipeId === "speaker_right_panel_left_infographic") {
    return !isMeaningfulValue(payload.value) && (payload.items?.length ?? 0) < 2;
  }
  if (recipeId === "quote_emphasis") {
    return !isMeaningfulAccentText(payload.quote);
  }
  if (recipeId === "cta_finish") {
    return !isMeaningfulText(payload.text, 6);
  }
  return false;
}

function normalizePayload(payload: ScreenCopyPayload): ScreenCopyPayload {
  return {
    ...payload,
    title: normalizeText(payload.title, MAX_TITLE_LENGTH),
    subtitle: normalizeText(payload.subtitle, MAX_TEXT_LENGTH),
    text: normalizeText(payload.text, MAX_TEXT_LENGTH),
    left: normalizeText(payload.left, MAX_TEXT_LENGTH),
    right: normalizeText(payload.right, MAX_TEXT_LENGTH),
    label: normalizeText(payload.label, MAX_TITLE_LENGTH),
    cta: normalizeText(payload.cta, MAX_TITLE_LENGTH),
    value: normalizeText(payload.value, 24),
    caption: normalizeText(payload.caption, MAX_TEXT_LENGTH),
    falseText: normalizeText(payload.falseText, MAX_TEXT_LENGTH),
    trueText: normalizeText(payload.trueText, MAX_TEXT_LENGTH),
    quote: normalizeText(payload.quote, MAX_TEXT_LENGTH),
    center: normalizeText(payload.center, MAX_TITLE_LENGTH),
    items: normalizeItems(payload.items)
  };
}

function normalizeItems(items?: string[], summary?: string) {
  const normalized = (items ?? [])
    .map((item) => normalizeText(item, 72))
    .filter((item): item is string => Boolean(item));
  if (normalized.length > 0) return normalized.slice(0, MAX_ITEMS);
  if (!summary) return [];
  const summaryItems = cleanText(summary)
    .split(/[.;]|(?:\s+-\s+)/)
    .map((item) => normalizeText(item, 72))
    .filter((item): item is string => Boolean(item))
    .slice(0, MAX_ITEMS);
  return summaryItems;
}

function preferText(...values: Array<string | undefined>) {
  return values.find((value) => isMeaningfulText(value));
}

function preferComparisonText(...values: Array<string | undefined>) {
  return values.find((value) => normalizeComparisonSide(value) !== undefined);
}

function readPrimaryText(payload: ScreenCopyPayload) {
  return preferText(
    payload.title,
    payload.text,
    payload.quote,
    payload.cta,
    payload.label,
    payload.caption,
    payload.subtitle
  );
}

function hasMeaningfulComparisonPair(left?: string, right?: string) {
  const normalizedLeft = normalizeComparisonSide(left);
  const normalizedRight = normalizeComparisonSide(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return false;
  if (SHORT_COMPARISON_TERMS.has(normalizedLeft) && SHORT_COMPARISON_TERMS.has(normalizedRight)) return true;
  return isMeaningfulText(left) && isMeaningfulText(right);
}

function isMeaningfulValue(value?: string) {
  if (!value) return false;
  const normalized = cleanText(value).toLowerCase();
  if (PLACEHOLDER_VALUES.has(normalized)) return false;
  return normalized.length >= 1 && /[\p{L}\p{N}]/u.test(normalized);
}

function isMeaningfulText(value?: string, minLength = 4) {
  if (!value) return false;
  const normalized = cleanText(value);
  if (normalized.length < minLength) return false;
  if (PLACEHOLDER_VALUES.has(normalized.toLowerCase())) return false;
  return /[\p{L}\p{N}]/u.test(normalized);
}

function isMeaningfulAccentText(value?: string) {
  if (!value) return false;
  const normalized = cleanText(value);
  if (PLACEHOLDER_VALUES.has(normalized.toLowerCase())) return false;
  if (isMeaningfulText(normalized)) return true;
  return /^[+-]?\d+(?:[.,]\d+)?\s*(?:%|x|х)$|^[+-]\d+%$/iu.test(normalized);
}

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return undefined;
  const normalized = cleanText(value);
  if (!normalized) return undefined;
  if (PLACEHOLDER_VALUES.has(normalized.toLowerCase())) return undefined;
  return normalized.slice(0, maxLength).trim();
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeComparisonSide(value?: string) {
  if (!value) return undefined;
  const normalized = cleanText(value).toLowerCase();
  if (!normalized) return undefined;
  if (PLACEHOLDER_VALUES.has(normalized)) return undefined;
  if (!/[\p{L}\p{N}%+-]/u.test(normalized)) return undefined;
  return normalized;
}

function uniqueRecipeIds(values: Array<SceneRecipeId | undefined>) {
  return [...new Set(values.filter(Boolean))] as SceneRecipeId[];
}
