import type {
  CaptionPosition,
  CaptionSize,
  StyleDraftOptions,
  SubtitleFontId,
  SubtitleTextCase
} from "@/app/components/PresentationConfigurator";
import { subtitleStyleRecipeOptions, type SubtitleStyleRecipeId } from "@/lib/subtitleStyleRecipe";
import type { StylePreset, VisualTemplateId } from "@/lib/types";

export type SubtitleStylePresetDefinition = {
  id: string;
  recipeId: SubtitleStyleRecipeId;
  title: string;
  category: "clean" | "viral" | "premium" | "story";
  note: string;
  chips: string[];
  normalSample: string;
  accentSample: string;
  stylePreset: StylePreset;
};

export const subtitleStylePresets: SubtitleStylePresetDefinition[] = [
  {
    id: "sales-punch",
    recipeId: "sales-punch",
    title: "Sales Punch",
    category: "viral",
    note: "Жёсткий хук, контрастный акцент, CTA и сравнения.",
    chips: ["CTA", "Сравнения", "Графики"],
    normalSample: "Ты теряешь",
    accentSample: "внимание",
    stylePreset: "dynamic_viral"
  },
  {
    id: "clean-expert",
    recipeId: "clean-expert",
    title: "Clean Expert",
    category: "clean",
    note: "Спокойная экспертная подача без лишнего шума.",
    chips: ["Чисто", "Фразы"],
    normalSample: "Главная",
    accentSample: "мысль",
    stylePreset: "clean_expert"
  },
  {
    id: "glass-focus",
    recipeId: "glass-focus",
    title: "Glass Focus",
    category: "premium",
    note: "Премиальная плашка, мягкий свет, аккуратный акцент.",
    chips: ["Glass", "Премиум"],
    normalSample: "Точный",
    accentSample: "фокус",
    stylePreset: "premium_calm"
  },
  {
    id: "marker-pop",
    recipeId: "marker-pop",
    title: "Marker Pop",
    category: "story",
    note: "Маркерные акценты для сторителлинга и тезисов.",
    chips: ["Маркер", "Списки"],
    normalSample: "Вот это",
    accentSample: "важно",
    stylePreset: "clean_expert"
  },
  {
    id: "neon-pulse",
    recipeId: "neon-pulse",
    title: "Neon Pulse",
    category: "viral",
    note: "Для резких вертикальных роликов с мощным визуальным ударом.",
    chips: ["Неон", "Вирусно"],
    normalSample: "Не делай",
    accentSample: "так",
    stylePreset: "viral_kinetic"
  },
  {
    id: "calm-authority",
    recipeId: "calm-authority",
    title: "Calm Authority",
    category: "premium",
    note: "Уверенный экспертный тон с дорогой типографикой.",
    chips: ["Эксперт", "Спокойно"],
    normalSample: "Разберём",
    accentSample: "спокойно",
    stylePreset: "premium_calm"
  },
  {
    id: "story-ledger",
    recipeId: "story-ledger",
    title: "Story Ledger",
    category: "story",
    note: "Под списки, тезисы и пошаговые объяснения.",
    chips: ["Списки", "Шаги", "Схемы"],
    normalSample: "Три",
    accentSample: "шага",
    stylePreset: "clean_expert"
  },
  {
    id: "sharp-cta",
    recipeId: "sharp-cta",
    title: "Sharp CTA",
    category: "viral",
    note: "Финальные призывы, контрастные концовки и сильный хук.",
    chips: ["CTA", "Финал"],
    normalSample: "Жми",
    accentSample: "сейчас",
    stylePreset: "dynamic_viral"
  }
];

const toggleTemplateMap: Record<"autoLists" | "autoComparisons" | "autoCharts" | "autoCta" | "autoStrike", VisualTemplateId[]> = {
  autoLists: ["checklist", "bullet_cards"],
  autoComparisons: ["concept_map"],
  autoCharts: ["metric_chart", "big_number", "stat_panel"],
  autoCta: ["cta_plate"],
  autoStrike: ["myth_strike"]
};

export function applyStylePresetOptions(
  currentOptions: StyleDraftOptions,
  preset: SubtitleStylePresetDefinition
): StyleDraftOptions {
  const merged = {
    ...currentOptions,
    ...subtitleStyleRecipeOptions(preset.recipeId),
    styleRecipeId: preset.recipeId
  };

  return withTemplateToggles(merged);
}

export function withTemplateToggles(options: StyleDraftOptions): StyleDraftOptions {
  const managedTemplates = new Set<VisualTemplateId>(Object.values(toggleTemplateMap).flat());
  const disabledTemplates = new Set<VisualTemplateId>(
    (options.disabledTemplates ?? []).filter((templateId) => !managedTemplates.has(templateId))
  );

  for (const [toggleKey, templates] of Object.entries(toggleTemplateMap) as Array<[keyof typeof toggleTemplateMap, VisualTemplateId[]]>) {
    if (options[toggleKey] === false) {
      templates.forEach((templateId) => disabledTemplates.add(templateId));
    }
  }

  return {
    ...options,
    disabledTemplates: Array.from(disabledTemplates)
  };
}

export const fontLabelMap: Record<SubtitleFontId, string> = {
  manrope: "Manrope",
  onest: "Onest",
  unbounded: "Unbounded",
  montserrat: "Montserrat",
  golos: "Golos Text"
};

export const textCaseLabels: Array<{ id: SubtitleTextCase; label: string }> = [
  { id: "sentence", label: "Обычный" },
  { id: "upper", label: "ВЕРХНИЙ" }
];

export const captionPositionLabels: Array<{ id: CaptionPosition; label: string }> = [
  { id: "lower", label: "Низ" },
  { id: "middle", label: "Центр" }
];

export const captionSizeLabels: Array<{ id: CaptionSize; label: string }> = [
  { id: "sm", label: "S" },
  { id: "md", label: "M" },
  { id: "lg", label: "L" }
];
