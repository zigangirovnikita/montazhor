import type {
  CaptionPosition,
  CaptionSize,
  StyleDraftOptions,
  SubtitleFontId,
  SubtitleTextCase
} from "@/app/components/PresentationConfigurator";
import type { StylePreset, VisualTemplateId } from "@/lib/types";

export type SubtitleStylePresetDefinition = {
  id: string;
  title: string;
  category: "clean" | "viral" | "premium" | "story";
  note: string;
  chips: string[];
  normalSample: string;
  accentSample: string;
  stylePreset: StylePreset;
  options: Partial<StyleDraftOptions>;
};

export const subtitleStylePresets: SubtitleStylePresetDefinition[] = [
  {
    id: "sales-punch",
    title: "Sales Punch",
    category: "viral",
    note: "Жёсткий хук, контрастный акцент, CTA и сравнения.",
    chips: ["CTA", "Сравнения", "Графики"],
    normalSample: "Ты теряешь",
    accentSample: "внимание",
    stylePreset: "dynamic_viral",
    options: {
      subtitleFont: "manrope",
      accentFont: "montserrat",
      subtitleStyle: "active_word",
      subtitleBackdrop: "solid",
      subtitleColor: "#ffffff",
      accentColor: "#ffd84d",
      textCase: "upper",
      captionPosition: "lower",
      captionSize: "lg",
      infographicAccent: "orange",
      presetPack: "viral",
      visualDensity: "high",
      motionIntensity: "active",
      emojiEnabled: false,
      autoLists: false,
      autoComparisons: true,
      autoCharts: true,
      autoCta: true,
      autoStrike: true
    }
  },
  {
    id: "clean-expert",
    title: "Clean Expert",
    category: "clean",
    note: "Спокойная экспертная подача без лишнего шума.",
    chips: ["Чисто", "Фразы"],
    normalSample: "Главная",
    accentSample: "мысль",
    stylePreset: "clean_expert",
    options: {
      subtitleFont: "golos",
      accentFont: "onest",
      subtitleStyle: "clean",
      subtitleBackdrop: "none",
      subtitleColor: "#ffffff",
      accentColor: "#8fd4ff",
      textCase: "sentence",
      captionPosition: "lower",
      captionSize: "md",
      infographicAccent: "mint",
      presetPack: "minimal",
      visualDensity: "low",
      motionIntensity: "calm",
      emojiEnabled: false,
      autoLists: false,
      autoComparisons: false,
      autoCharts: false,
      autoCta: false,
      autoStrike: false
    }
  },
  {
    id: "glass-focus",
    title: "Glass Focus",
    category: "premium",
    note: "Премиальная плашка, мягкий свет, аккуратный акцент.",
    chips: ["Glass", "Премиум"],
    normalSample: "Точный",
    accentSample: "фокус",
    stylePreset: "premium_calm",
    options: {
      subtitleFont: "manrope",
      accentFont: "golos",
      subtitleStyle: "active_word",
      subtitleBackdrop: "glass",
      subtitleColor: "#fff7e7",
      accentColor: "#d7b47f",
      textCase: "sentence",
      captionPosition: "lower",
      captionSize: "md",
      infographicAccent: "cream",
      presetPack: "premium",
      visualDensity: "medium",
      motionIntensity: "calm",
      emojiEnabled: false,
      autoLists: true,
      autoComparisons: false,
      autoCharts: false,
      autoCta: true,
      autoStrike: false
    }
  },
  {
    id: "marker-pop",
    title: "Marker Pop",
    category: "story",
    note: "Маркерные акценты для сторителлинга и тезисов.",
    chips: ["Маркер", "Списки"],
    normalSample: "Вот это",
    accentSample: "важно",
    stylePreset: "clean_expert",
    options: {
      subtitleFont: "montserrat",
      accentFont: "montserrat",
      subtitleStyle: "marker",
      subtitleBackdrop: "glass",
      subtitleColor: "#ffffff",
      accentColor: "#ff8b38",
      textCase: "sentence",
      captionPosition: "lower",
      captionSize: "md",
      infographicAccent: "orange",
      presetPack: "educational",
      visualDensity: "medium",
      motionIntensity: "medium",
      emojiEnabled: true,
      autoLists: true,
      autoComparisons: false,
      autoCharts: false,
      autoCta: false,
      autoStrike: true
    }
  },
  {
    id: "neon-pulse",
    title: "Neon Pulse",
    category: "viral",
    note: "Для резких вертикальных роликов с мощным визуальным ударом.",
    chips: ["Неон", "Вирусно"],
    normalSample: "Не делай",
    accentSample: "так",
    stylePreset: "viral_kinetic",
    options: {
      subtitleFont: "unbounded",
      accentFont: "unbounded",
      subtitleStyle: "active_word",
      subtitleBackdrop: "solid",
      subtitleColor: "#f7fbff",
      accentColor: "#b9ff5c",
      textCase: "upper",
      captionPosition: "middle",
      captionSize: "lg",
      infographicAccent: "mint",
      presetPack: "viral",
      visualDensity: "high",
      motionIntensity: "active",
      emojiEnabled: true,
      autoLists: false,
      autoComparisons: true,
      autoCharts: true,
      autoCta: true,
      autoStrike: true
    }
  },
  {
    id: "calm-authority",
    title: "Calm Authority",
    category: "premium",
    note: "Уверенный экспертный тон с дорогой типографикой.",
    chips: ["Эксперт", "Спокойно"],
    normalSample: "Разберём",
    accentSample: "спокойно",
    stylePreset: "premium_calm",
    options: {
      subtitleFont: "golos",
      accentFont: "unbounded",
      subtitleStyle: "active_word",
      subtitleBackdrop: "none",
      subtitleColor: "#f6efe3",
      accentColor: "#73c8ff",
      textCase: "sentence",
      captionPosition: "lower",
      captionSize: "sm",
      infographicAccent: "cream",
      presetPack: "premium",
      visualDensity: "low",
      motionIntensity: "calm",
      emojiEnabled: false,
      autoLists: true,
      autoComparisons: false,
      autoCharts: false,
      autoCta: false,
      autoStrike: false
    }
  },
  {
    id: "story-ledger",
    title: "Story Ledger",
    category: "story",
    note: "Под списки, тезисы и пошаговые объяснения.",
    chips: ["Списки", "Шаги", "Схемы"],
    normalSample: "Три",
    accentSample: "шага",
    stylePreset: "clean_expert",
    options: {
      subtitleFont: "onest",
      accentFont: "montserrat",
      subtitleStyle: "active_word",
      subtitleBackdrop: "glass",
      subtitleColor: "#ffffff",
      accentColor: "#ffd061",
      textCase: "sentence",
      captionPosition: "lower",
      captionSize: "md",
      infographicAccent: "mint",
      presetPack: "educational",
      visualDensity: "medium",
      motionIntensity: "medium",
      emojiEnabled: false,
      autoLists: true,
      autoComparisons: true,
      autoCharts: true,
      autoCta: false,
      autoStrike: true
    }
  },
  {
    id: "sharp-cta",
    title: "Sharp CTA",
    category: "viral",
    note: "Финальные призывы, контрастные концовки и сильный хук.",
    chips: ["CTA", "Финал"],
    normalSample: "Жми",
    accentSample: "сейчас",
    stylePreset: "dynamic_viral",
    options: {
      subtitleFont: "montserrat",
      accentFont: "unbounded",
      subtitleStyle: "active_word",
      subtitleBackdrop: "solid",
      subtitleColor: "#ffffff",
      accentColor: "#66f2ff",
      textCase: "upper",
      captionPosition: "middle",
      captionSize: "lg",
      infographicAccent: "orange",
      presetPack: "viral",
      visualDensity: "medium",
      motionIntensity: "active",
      emojiEnabled: true,
      autoLists: false,
      autoComparisons: false,
      autoCharts: false,
      autoCta: true,
      autoStrike: false
    }
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
    ...preset.options,
    styleRecipeId: preset.id
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
