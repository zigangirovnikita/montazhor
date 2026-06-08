import type { VisualPlanOptions, VisualTemplateId } from "@/lib/types";

export type TemplateBlockId = "headline" | "subtitle" | "stat" | "list" | "comparison" | "accent" | "chart" | "cta" | "authorTag";
export type TemplateEditorTab = "theme" | "headline" | "subtitle" | "stat" | "elements";
export type TemplateAnchor = "left" | "right" | "center" | "bottom";
export type TemplateSurface = "glass" | "solid" | "outline" | "neon" | "none";
export type TemplateShadow = "soft" | "deep" | "glow" | "none";
export type TemplateFont = "Inter" | "Roboto" | "Montserrat" | "Onest" | "Unbounded" | "Manrope" | "Golos";
export type TemplateAnimation =
  | "slide-right"
  | "slide-left"
  | "slide-up"
  | "fade"
  | "scale"
  | "word-by-word"
  | "count-up"
  | "grow-up"
  | "reveal"
  | "slide"
  | "shake"
  | "pulse"
  | "glass_slide"
  | "depth_zoom"
  | "calm_fade"
  | "word_slam"
  | "chart_grow"
  | "soft_pop"
  | "none";

export interface TemplatePosition {
  x: number;
  y: number;
  anchor: TemplateAnchor;
}

export interface VisualTheme {
  colorPrimary: string;
  colorText: string;
  colorBackground: string;
  font: TemplateFont;
  defaultPosition: TemplatePosition;
  defaultSurface: TemplateSurface;
  defaultShadow: TemplateShadow;
  defaultAnimationSpeed: number;
}

export interface TemplateBlockBase {
  enabled: boolean;
  position: TemplatePosition;
  surface: TemplateSurface | null;
  surfaceOpacity: number;
  borderRadius: number;
  padding: number;
  borderColor?: string | null;
  shadow: TemplateShadow | null;
  animationSpeed: number | null;
  colorText?: string | null;
  colorBackground?: string | null;
  colorAccent?: string | null;
  layoutPreset?: string | null;
  animationIn?: string | null;
  animationOut?: string | null;
}

export interface VisualTemplateData {
  id?: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  theme: VisualTheme;
  blocks: Record<TemplateBlockId, TemplateBlockBase & Record<string, unknown>>;
}

export interface StoredTemplate {
  id: string;
  name: string;
  data: VisualTemplateData;
  isPreset: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export const templateBlockLabels: Record<TemplateEditorTab, { title: string; note: string }> = {
  theme: { title: "Цветовое решение", note: "Глобальная тема" },
  headline: { title: "Заголовки", note: "Блок урока / инсайт" },
  subtitle: { title: "Обычный текст", note: "Речь по словам" },
  stat: { title: "Акцентные цифры", note: "Числа и показатели" },
  elements: { title: "Элементы", note: "Списки, графики, схемы" }
};

export const templateTabs: TemplateEditorTab[] = ["theme", "headline", "subtitle", "stat", "elements"];

export const templateAnimationsOut: Array<{ id: string; label: string }> = [
  { id: "slide-up", label: "Slide up (Вверх)" },
  { id: "slide-down", label: "Slide down (Вниз)" },
  { id: "fade", label: "Fade (Затухание)" },
  { id: "scale-down", label: "Scale down (Уменьшение)" },
  { id: "none", label: "Нет" }
];

export const templateSurfaces: Array<{ id: TemplateSurface; label: string }> = [
  { id: "glass", label: "Glass" },
  { id: "solid", label: "Solid" },
  { id: "outline", label: "Outline" },
  { id: "neon", label: "Neon" },
  { id: "none", label: "Нет" }
];

export const templateShadows: Array<{ id: TemplateShadow; label: string }> = [
  { id: "soft", label: "Мягкая" },
  { id: "deep", label: "Глубокая" },
  { id: "glow", label: "Свечение" },
  { id: "none", label: "Нет" }
];

export const templateFonts: Array<{ id: TemplateFont; label: string }> = [
  { id: "Inter", label: "Inter (Grotesk)" },
  { id: "Roboto", label: "Roboto (Grotesk)" },
  { id: "Montserrat", label: "Montserrat (Grotesk)" },
  { id: "Onest", label: "Onest (Grotesk)" },
  { id: "Unbounded", label: "Unbounded (Editorial)" },
  { id: "Manrope", label: "Manrope (Editorial)" },
  { id: "Golos", label: "Golos Text (Mono)" }
];

export const templateAnimations: Array<{ id: TemplateAnimation; label: string }> = [
  { id: "glass_slide", label: "Glass slide" },
  { id: "depth_zoom", label: "Depth zoom" },
  { id: "calm_fade", label: "Calm fade" },
  { id: "word_slam", label: "Word slam" },
  { id: "soft_pop", label: "Soft pop" },
  { id: "slide-up", label: "Slide up (legacy)" },
  { id: "slide-right", label: "Slide right (legacy)" },
  { id: "fade", label: "Fade (legacy)" },
  { id: "scale", label: "Scale (legacy)" },
  { id: "word-by-word", label: "Word by word (legacy)" },
  { id: "none", label: "Нет" }
];

export const blockLayoutPresets: Record<TemplateBlockId, Array<{ id: string; label: string }>> = {
  headline: [
    { id: "lesson_title_block", label: "Блок урока" },
    { id: "lesson_title_cinematic", label: "Кинематографичный заголовок" }
  ],
  subtitle: [
    { id: "kinetic_phrase_clean", label: "Чистая фраза" },
    { id: "kinetic_phrase_glass", label: "Стеклянная фраза" },
    { id: "caption_kinetic_slam", label: "Ритмичный слайд (Slam)" },
    { id: "caption_neon_glow", label: "Неоновое свечение" },
    { id: "caption_gradient_fill", label: "Градиентная заливка" },
    { id: "caption_matrix_decode", label: "Код Матрицы (Matrix)" },
    { id: "caption_clip_wipe", label: "Срез-появление (Clip Wipe)" },
    { id: "caption_highlight", label: "Маркер-выделение (Highlight)" },
    { id: "caption_glitch_rgb", label: "Глитч RGB" },
    { id: "caption_emoji_pop", label: "Всплывающий Эмодзи" },
    { id: "caption_particle_burst", label: "Взрыв частиц" },
    { id: "caption_editorial_emphasis", label: "Редакционный акцент" },
    { id: "caption_pill_karaoke", label: "Караоке в плашке" },
    { id: "caption_weight_shift", label: "Смена жирности (Weight)" },
    { id: "caption_neon_accent", label: "Неоновый акцент" },
    { id: "caption_parallax_layers", label: "Параллакс-слои" },
    { id: "caption_texture", label: "Текстурный маскинг" }
  ],
  stat: [
    { id: "big_number_callout", label: "Крупный показатель" },
    { id: "big_number_shimmer", label: "Сияющее число" },
    { id: "hud_ratio_panel", label: "HUD Панель показателей" }
  ],
  list: [
    { id: "checklist_steps", label: "Шаги чек-листа" },
    { id: "checklist_compact", label: "Компактный чек-лист" },
    { id: "bullet_cards_lesson", label: "Карточки урока" },
    { id: "bullet_cards_premium", label: "Премиальные карточки" }
  ],
  comparison: [
    { id: "myth_strike_redline", label: "Зачеркивание мифа" },
    { id: "compare_before_after", label: "Контраст До/После" },
    { id: "concept_orbit_map", label: "Карта понятий" }
  ],
  accent: [
    { id: "keyword_focus", label: "Фокус слова" },
    { id: "keyword_title_slam", label: "Заголовок-акцент" },
    { id: "keyword_warning_strip", label: "Предупреждение" },
    { id: "quote_emphasis", label: "Цитата" },
    { id: "side_note", label: "Сноска" }
  ],
  chart: [
    { id: "metric_chart_compact", label: "Компактный график" },
    { id: "metric_chart_premium", label: "Премиальный график" }
  ],
  cta: [
    { id: "cta_finish_clean", label: "Чистый CTA" },
    { id: "cta_finish_premium", label: "Премиальный CTA" },
    { id: "cta_finish_viral", label: "Вирусный CTA" }
  ],
  authorTag: [
    { id: "default", label: "По умолчанию" }
  ]
};

const baseBlock: TemplateBlockBase = {
  enabled: true,
  position: { x: 72, y: 22, anchor: "right" },
  surface: null,
  surfaceOpacity: 0.82,
  borderRadius: 22,
  padding: 22,
  borderColor: null,
  shadow: null,
  animationSpeed: null,
  colorText: null,
  colorBackground: null,
  colorAccent: null,
  layoutPreset: null
};

export function createDefaultTemplate(name = "Мой шаблон"): VisualTemplateData {
  const now = new Date().toISOString();
  return {
    name,
    createdAt: now,
    updatedAt: now,
    theme: {
      colorPrimary: "#73c8ff",
      colorText: "#ffffff",
      colorBackground: "#0d1f36",
      font: "Inter",
      defaultPosition: { x: 72, y: 22, anchor: "right" },
      defaultSurface: "glass",
      defaultShadow: "soft",
      defaultAnimationSpeed: 0.6
    },
    blocks: {
      headline: { ...baseBlock, font: "Inter", fontSize: 58, fontWeight: 900, lineHeight: 1.05, textTransform: "none", maxLines: 2, kicker: { enabled: true, fontSize: 13, opacity: 0.78 }, caption: { enabled: true, fontSize: 14 }, animationIn: "glass_slide", layoutPreset: "lesson_title_block" },
      subtitle: { ...baseBlock, position: { x: 50, y: 84, anchor: "bottom" }, font: "Inter", fontSize: 42, fontWeight: 850, lineHeight: 1.08, maxCharsPerLine: 34, maxLines: 2, highlightCurrentWord: true, highlightColor: "#73c8ff", animationIn: "calm_fade", layoutPreset: "kinetic_phrase_clean" },
      stat: { ...baseBlock, position: { x: 26, y: 32, anchor: "left" }, number: { fontSize: 86, fontWeight: 950, font: "Inter", animationIn: "depth_zoom" }, label: { enabled: true, fontSize: 18, fontWeight: 700 }, prefix: "", suffix: "%", layoutPreset: "big_number_callout" },
      list: { ...baseBlock, font: "Inter", fontSize: 34, fontWeight: 800, lineHeight: 1.16, marker: { type: "check", size: 18 }, itemDelay: 0.35, maxItems: 4, animationIn: "glass_slide", layoutPreset: "checklist_steps" },
      comparison: { ...baseBlock, layout: "side-by-side", left: { label: "МИФ", strikethrough: true }, right: { label: "ФАКТ" }, fontSize: 32, fontWeight: 850, font: "Inter", animationIn: "depth_zoom", layoutPreset: "myth_strike_redline" },
      accent: { ...baseBlock, preset: "important", icon: null, iconPosition: "left", label: { enabled: true, text: "ВАЖНО", fontSize: 13, fontWeight: 900 }, fontSize: 42, fontWeight: 900, font: "Inter", animationIn: "word_slam", layoutPreset: "keyword_focus" },
      chart: { ...baseBlock, type: "bar", line: { strokeWidth: 4, drawDuration: 0.9, showDots: true, fillUnder: true, fillOpacity: 0.18 }, bar: { gap: 10, animationIn: "depth_zoom" }, progress: { strokeWidth: 8, showPercent: true }, label: { enabled: true, fontSize: 14 }, title: { enabled: true, fontSize: 18, fontWeight: 800 }, layoutPreset: "metric_chart_compact" },
      cta: { ...baseBlock, position: { x: 50, y: 50, anchor: "center" }, layout: "centered", headline: { fontSize: 58, fontWeight: 900, font: "Inter" }, button: { enabled: true, borderRadius: 18, fontSize: 16, fontWeight: 900 }, icon: null, animationIn: "soft_pop", displayDuration: 3, layoutPreset: "cta_finish_clean" },
      authorTag: { ...baseBlock, position: { x: 50, y: 92, anchor: "bottom" }, avatarEnabled: true, nameEnabled: true, handleEnabled: true, platformIcon: "instagram", fontSize: 16, font: "Inter", layoutPreset: "default" }
    }
  };
}

export const builtinTemplatePresets: VisualTemplateData[] = [
  createPreset("Lesson block", "#73c8ff", "#ffffff", "#0d1f36", "Montserrat", "right", "glass"),
  createPreset("Title slam", "#ffe54d", "#ffffff", "#111111", "Onest", "bottom", "solid"),
  createPreset("Cinematic", "#d8c5a1", "#f7f0e5", "#151515", "Unbounded", "center", "glass")
];

export function templateToVisualPlanOptions(template: VisualTemplateData): VisualPlanOptions {
  const disabledTemplates: VisualTemplateId[] = [];
  if (!template.blocks.stat.enabled) disabledTemplates.push("big_number", "stat_panel");
  if (!template.blocks.list.enabled) disabledTemplates.push("checklist", "bullet_cards");
  if (!template.blocks.chart.enabled) disabledTemplates.push("metric_chart");
  if (!template.blocks.cta.enabled) disabledTemplates.push("cta_plate");
  if (!template.blocks.subtitle.enabled) disabledTemplates.push("kinetic_text");
  const premiumFonts = ["Unbounded", "Manrope"];
  return {
    presetPack: premiumFonts.includes(template.theme.font) ? "premium" : "educational",
    motionIntensity: template.theme.defaultAnimationSpeed > 0.76 ? "active" : template.theme.defaultAnimationSpeed < 0.38 ? "calm" : "medium",
    disabledTemplates: Array.from(new Set(disabledTemplates))
  };
}

export function sanitizeTemplateData(value: unknown, fallbackName = "Мой шаблон"): VisualTemplateData {
  const fallback = createDefaultTemplate(fallbackName);
  if (!value || typeof value !== "object") return fallback;
  const raw = value as Partial<VisualTemplateData>;
  const rawBlocks = (raw.blocks || {}) as Record<string, Partial<TemplateBlockBase>>;
  const mergedBlocks = Object.keys(fallback.blocks).reduce((acc, key) => {
    const blockId = key as TemplateBlockId;
    const fbBlock = fallback.blocks[blockId];
    const rawBlock = rawBlocks[blockId] || {};
    acc[blockId] = {
      ...fbBlock,
      ...rawBlock,
      position: { ...(fbBlock.position ?? {}), ...(rawBlock.position ?? {}) }
    } as any;
    return acc;
  }, {} as VisualTemplateData["blocks"]);

  const rawTheme = (raw.theme || {}) as Partial<VisualTheme>;
  return {
    ...fallback,
    ...raw,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 80) : fallbackName,
    theme: {
      ...fallback.theme,
      ...rawTheme,
      defaultPosition: { ...(fallback.theme.defaultPosition ?? {}), ...(rawTheme.defaultPosition ?? {}) }
    },
    blocks: mergedBlocks,
    updatedAt: new Date().toISOString()
  };
}

function createPreset(name: string, accent: string, text: string, surface: string, font: TemplateFont, anchor: TemplateAnchor, surfaceMode: TemplateSurface) {
  const template = createDefaultTemplate(name);
  template.theme = {
    ...template.theme,
    colorPrimary: accent,
    colorText: text,
    colorBackground: surface,
    font,
    defaultPosition: positionForAnchor(anchor),
    defaultSurface: surfaceMode,
    defaultShadow: surfaceMode === "solid" ? "deep" : "soft",
    defaultAnimationSpeed: name === "Title slam" ? 0.88 : name === "Cinematic" ? 0.34 : 0.6
  };
  
  const updatedBlocks = { ...template.blocks };
  for (const [key, block] of Object.entries(updatedBlocks)) {
    updatedBlocks[key as TemplateBlockId] = {
      ...block,
      position: template.theme.defaultPosition,
      surface: surfaceMode,
      shadow: template.theme.defaultShadow,
      animationSpeed: template.theme.defaultAnimationSpeed
    };
  }
  template.blocks = updatedBlocks;
  
  return template;
}

export function positionForAnchor(anchor: TemplateAnchor): TemplatePosition {
  if (anchor === "left") return { x: 24, y: 34, anchor };
  if (anchor === "right") return { x: 76, y: 22, anchor };
  if (anchor === "bottom") return { x: 50, y: 82, anchor };
  return { x: 50, y: 48, anchor };
}

export interface ColorPalette {
  name: string;
  colorText: string;
  colorPrimary: string;
  colorBackground: string;
}

export const curatedPalettes: ColorPalette[] = [
  { name: "Неоновый футуризм", colorText: "#ffffff", colorPrimary: "#73c8ff", colorBackground: "#0d1f36" },
  { name: "Киберпанк", colorText: "#ffffff", colorPrimary: "#ffe54d", colorBackground: "#111111" },
  { name: "Премиум золото", colorText: "#f7f0e5", colorPrimary: "#d8c5a1", colorBackground: "#1a1a17" },
  { name: "Лесной шалфей", colorText: "#f5f7f5", colorPrimary: "#9fc6b2", colorBackground: "#13221b" },
  { name: "Янтарный закат", colorText: "#fffdfa", colorPrimary: "#ffb347", colorBackground: "#1c150d" },
  { name: "Монохром", colorText: "#ffffff", colorPrimary: "#ffffff", colorBackground: "#101010" }
];
