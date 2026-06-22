import type {
  AccentAnimation,
  CaptionAnimation,
  CaptionPosition,
  CaptionSize,
  StyleDraftOptions,
  SubtitleFontId,
  SubtitleTextCase
} from "@/app/components/PresentationConfigurator";
import { withTemplateToggles } from "@/app/components/subtitleStylePresets";
import { normalizePresentationMode } from "@/lib/presentationMode";
import { subtitleStyleRecipeOptions } from "@/lib/subtitleStyleRecipe";
import type { PresentationMode, StylePreset } from "@/lib/types";

const subtitleFonts = new Set<SubtitleFontId>(["manrope", "onest", "unbounded", "montserrat", "golos"]);
const subtitleStyles = new Set<StyleDraftOptions["subtitleStyle"]>(["clean", "active_word", "marker"]);
const captionAnimations = new Set<CaptionAnimation>(["slide_up", "fade", "pop"]);
const accentAnimations = new Set<AccentAnimation>(["text", "fill", "marker", "pulse"]);
const subtitleBackdrops = new Set<StyleDraftOptions["subtitleBackdrop"]>(["none", "glass", "solid"]);
const textCases = new Set<SubtitleTextCase>(["sentence", "upper"]);
const captionPositions = new Set<CaptionPosition>(["lower", "middle"]);
const captionSizes = new Set<CaptionSize>(["sm", "md", "lg"]);
const infographicTones = new Set<StyleDraftOptions["infographicTone"]>(["glass", "dark", "bright"]);
const infographicAccents = new Set<StyleDraftOptions["infographicAccent"]>(["mint", "orange", "cream"]);
const visualDensities = new Set<NonNullable<StyleDraftOptions["visualDensity"]>>(["low", "medium", "high"]);
const motionIntensities = new Set<NonNullable<StyleDraftOptions["motionIntensity"]>>(["calm", "medium", "active"]);
const presetPacks = new Set<NonNullable<StyleDraftOptions["presetPack"]>>(["balanced", "premium", "viral", "educational", "minimal"]);

export const defaultStyleOptions: StyleDraftOptions = {
  styleRecipeId: "clean-expert",
  subtitleFont: "manrope",
  accentFont: "montserrat",
  subtitleStyle: "active_word",
  captionAnimation: "slide_up",
  accentAnimation: "fill",
  subtitleBackdrop: "glass",
  subtitleColor: "#ffffff",
  accentColor: "#73c8ff",
  textCase: "sentence",
  captionPosition: "lower",
  captionSize: "md",
  infographicTone: "glass",
  infographicAccent: "mint",
  emojiEnabled: false,
  autoLists: true,
  autoComparisons: false,
  autoCharts: false,
  autoCta: false,
  autoStrike: true,
  visualDensity: "medium",
  motionIntensity: "medium",
  presetPack: "educational",
  disabledTemplates: []
};

export function parseStyleOptions(raw: string | null | undefined): StyleDraftOptions {
  if (!raw) return defaultStyleOptions;

  try {
    return normalizeStyleOptions(JSON.parse(raw) as Partial<StyleDraftOptions>);
  } catch {
    return defaultStyleOptions;
  }
}

export function normalizeStyleOptions(parsed: Partial<StyleDraftOptions>): StyleDraftOptions {
  const styleRecipeId = parsed.styleRecipeId ?? defaultStyleOptions.styleRecipeId;
  const recipeDefaults = subtitleStyleRecipeOptions(styleRecipeId);

  return withTemplateToggles({
    styleRecipeId,
    subtitleFont: parseRequiredEnum(parsed.subtitleFont, subtitleFonts, recipeDefaults.subtitleFont ?? defaultStyleOptions.subtitleFont),
    accentFont: parseEnum(parsed.accentFont, subtitleFonts, recipeDefaults.accentFont ?? defaultStyleOptions.accentFont),
    subtitleStyle: parseRequiredEnum(
      parsed.subtitleStyle,
      subtitleStyles,
      recipeDefaults.subtitleStyle ?? defaultStyleOptions.subtitleStyle
    ),
    captionAnimation: parseEnum(
      parsed.captionAnimation,
      captionAnimations,
      recipeDefaults.captionAnimation ?? defaultStyleOptions.captionAnimation
    ),
    accentAnimation: parseEnum(
      parsed.accentAnimation,
      accentAnimations,
      recipeDefaults.accentAnimation ?? defaultStyleOptions.accentAnimation
    ),
    subtitleBackdrop: parseRequiredEnum(
      parsed.subtitleBackdrop,
      subtitleBackdrops,
      recipeDefaults.subtitleBackdrop ?? defaultStyleOptions.subtitleBackdrop
    ),
    subtitleColor: parseColor(parsed.subtitleColor, recipeDefaults.subtitleColor ?? defaultStyleOptions.subtitleColor),
    accentColor: parseColor(parsed.accentColor, recipeDefaults.accentColor ?? defaultStyleOptions.accentColor),
    textCase: parseEnum(parsed.textCase, textCases, recipeDefaults.textCase ?? defaultStyleOptions.textCase),
    captionPosition: parseEnum(
      parsed.captionPosition,
      captionPositions,
      recipeDefaults.captionPosition ?? defaultStyleOptions.captionPosition
    ),
    captionSize: parseEnum(parsed.captionSize, captionSizes, recipeDefaults.captionSize ?? defaultStyleOptions.captionSize),
    infographicTone: parseRequiredEnum(parsed.infographicTone, infographicTones, defaultStyleOptions.infographicTone),
    infographicAccent: parseRequiredEnum(
      parsed.infographicAccent,
      infographicAccents,
      recipeDefaults.infographicAccent ?? defaultStyleOptions.infographicAccent
    ),
    emojiEnabled: parseBoolean(parsed.emojiEnabled, recipeDefaults.emojiEnabled ?? defaultStyleOptions.emojiEnabled),
    autoLists: parseBoolean(parsed.autoLists, recipeDefaults.autoLists ?? defaultStyleOptions.autoLists),
    autoComparisons: parseBoolean(
      parsed.autoComparisons,
      recipeDefaults.autoComparisons ?? defaultStyleOptions.autoComparisons
    ),
    autoCharts: parseBoolean(parsed.autoCharts, recipeDefaults.autoCharts ?? defaultStyleOptions.autoCharts),
    autoCta: parseBoolean(parsed.autoCta, recipeDefaults.autoCta ?? defaultStyleOptions.autoCta),
    autoStrike: parseBoolean(parsed.autoStrike, recipeDefaults.autoStrike ?? defaultStyleOptions.autoStrike),
    visualDensity: parseEnum(
      parsed.visualDensity,
      visualDensities,
      recipeDefaults.visualDensity ?? defaultStyleOptions.visualDensity
    ),
    motionIntensity: parseEnum(
      parsed.motionIntensity,
      motionIntensities,
      recipeDefaults.motionIntensity ?? defaultStyleOptions.motionIntensity
    ),
    presetPack: parseEnum(parsed.presetPack, presetPacks, recipeDefaults.presetPack ?? defaultStyleOptions.presetPack),
    disabledTemplates: Array.isArray(parsed.disabledTemplates) ? parsed.disabledTemplates : defaultStyleOptions.disabledTemplates,
    visualTemplateId: typeof parsed.visualTemplateId === "string" ? parsed.visualTemplateId : undefined,
    visualTemplate: parsed.visualTemplate
  });
}

export function resolvePresentationMode(value: string | null | undefined): PresentationMode {
  return normalizePresentationMode(value);
}

export function resolveStylePreset(value: string | null | undefined): StylePreset {
  if (
    value === "dynamic_viral" ||
    value === "premium_calm" ||
    value === "course_glass" ||
    value === "expert_clean" ||
    value === "viral_kinetic"
  ) return value;
  return "clean_expert";
}

function parseEnum<T extends string>(value: unknown, variants: Set<T>, fallback: T | undefined): T | undefined {
  return typeof value === "string" && variants.has(value as T) ? value as T : fallback;
}

function parseRequiredEnum<T extends string>(value: unknown, variants: Set<T>, fallback: T): T {
  return typeof value === "string" && variants.has(value as T) ? value as T : fallback;
}

function parseBoolean(value: unknown, fallback: boolean | undefined) {
  return typeof value === "boolean" ? value : fallback;
}

function parseColor(value: unknown, fallback: string | undefined) {
  return typeof value === "string" && value.trim() ? value : fallback;
}
