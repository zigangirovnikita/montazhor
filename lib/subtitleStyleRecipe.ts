export type SubtitleStyleRecipeId =
  | "sales-punch"
  | "clean-expert"
  | "glass-focus"
  | "marker-pop"
  | "neon-pulse"
  | "calm-authority"
  | "story-ledger"
  | "sharp-cta";

export type SubtitleStyleRecipe = {
  id: SubtitleStyleRecipeId;
  title: string;
  description: string;
  options: SubtitleStyleRecipeOptions;
};

export type SubtitleStyleRecipeOptions = {
  subtitleFont?: "manrope" | "onest" | "unbounded" | "montserrat" | "golos";
  accentFont?: "manrope" | "onest" | "unbounded" | "montserrat" | "golos";
  subtitleStyle?: "clean" | "active_word" | "marker";
  captionAnimation?: "slide_up" | "fade" | "pop";
  accentAnimation?: "text" | "fill" | "marker" | "pulse";
  subtitleBackdrop?: "none" | "glass" | "solid";
  subtitleColor?: string;
  accentColor?: string;
  textCase?: "sentence" | "upper";
  captionPosition?: "lower" | "middle";
  captionSize?: "sm" | "md" | "lg";
  infographicAccent?: "mint" | "orange" | "cream";
  emojiEnabled?: boolean;
  autoLists?: boolean;
  autoComparisons?: boolean;
  autoCharts?: boolean;
  autoCta?: boolean;
  autoStrike?: boolean;
  visualDensity?: "low" | "medium" | "high";
  motionIntensity?: "calm" | "medium" | "active";
  presetPack?: "balanced" | "premium" | "viral" | "educational" | "minimal";
};

export const subtitleStyleRecipes: SubtitleStyleRecipe[] = [
  {
    id: "sales-punch",
    title: "Sales Punch",
    description: "Жёсткий хук, контрастный акцент, CTA и сравнения.",
    options: {
      subtitleFont: "manrope",
      accentFont: "montserrat",
      subtitleStyle: "active_word",
      captionAnimation: "pop",
      accentAnimation: "fill",
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
    description: "Спокойная экспертная подача без лишнего шума.",
    options: {
      subtitleFont: "golos",
      accentFont: "onest",
      subtitleStyle: "clean",
      captionAnimation: "fade",
      accentAnimation: "text",
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
    description: "Премиальная плашка, мягкий свет, аккуратный акцент.",
    options: {
      subtitleFont: "manrope",
      accentFont: "golos",
      subtitleStyle: "active_word",
      captionAnimation: "fade",
      accentAnimation: "text",
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
    description: "Маркерные акценты для сторителлинга и тезисов.",
    options: {
      subtitleFont: "montserrat",
      accentFont: "montserrat",
      subtitleStyle: "marker",
      captionAnimation: "slide_up",
      accentAnimation: "marker",
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
    description: "Для резких вертикальных роликов с мощным визуальным ударом.",
    options: {
      subtitleFont: "unbounded",
      accentFont: "unbounded",
      subtitleStyle: "active_word",
      captionAnimation: "pop",
      accentAnimation: "pulse",
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
    description: "Уверенный экспертный тон с дорогой типографикой.",
    options: {
      subtitleFont: "golos",
      accentFont: "unbounded",
      subtitleStyle: "active_word",
      captionAnimation: "fade",
      accentAnimation: "text",
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
    description: "Под списки, тезисы и пошаговые объяснения.",
    options: {
      subtitleFont: "onest",
      accentFont: "montserrat",
      subtitleStyle: "active_word",
      captionAnimation: "slide_up",
      accentAnimation: "marker",
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
    description: "Финальные призывы, контрастные концовки и сильный хук.",
    options: {
      subtitleFont: "montserrat",
      accentFont: "unbounded",
      subtitleStyle: "active_word",
      captionAnimation: "pop",
      accentAnimation: "pulse",
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

export function getSubtitleStyleRecipe(recipeId?: string | null) {
  return subtitleStyleRecipes.find((recipe) => recipe.id === recipeId);
}

export function subtitleStyleRecipeOptions(recipeId?: string | null) {
  return getSubtitleStyleRecipe(recipeId)?.options ?? {};
}
