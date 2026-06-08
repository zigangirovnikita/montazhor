export type CategoryId = "global" | "titles" | "text" | "numbers" | "charts" | "lists" | "accents" | "surfaces" | "motion" | "cta";
export type PreviewKind = "title" | "text" | "number" | "chart" | "list" | "accent" | "surface" | "cta";
export type Position = "left" | "right" | "center" | "lower";
export type AspectMode = "portrait" | "landscape";
export type SurfaceMode = "glass" | "solid" | "outline" | "neon";
export type ShadowMode = "soft" | "deep" | "glow" | "none";
export type FontMode = "grotesk" | "editorial" | "mono";

export type Category = {
  id: CategoryId;
  title: string;
  note: string;
  help: string;
  kind: PreviewKind;
  presets: string[];
};

type PresetPatch = Partial<{
  position: Position;
  textColor: string;
  accentColor: string;
  surfaceColor: string;
  fontSize: number;
  radius: number;
  weight: number;
  padding: number;
  motion: number;
  surfaceMode: SurfaceMode;
  shadowMode: ShadowMode;
  fontMode: FontMode;
  aspectMode: AspectMode;
}>;

export const categories: Category[] = [
  { id: "global", title: "Глобальный стиль", note: "Общий вкус ролика", help: "Меняет базовую палитру, формат кадра и общую визуальную систему, от которой наследуются остальные элементы.", kind: "surface", presets: ["Course Glass", "Viral Clean", "Premium Calm"] },
  { id: "titles", title: "Заголовки", note: "Hook / insight / lesson", help: "Так будут выглядеть крупные заголовки: хуки, главные инсайты, lesson-кадры и смысловые разделы.", kind: "title", presets: ["Lesson block", "Title slam", "Cinematic"] },
  { id: "text", title: "Обычный текст", note: "Речь по словам", help: "Так выглядит обычный word-timed текст, который появляется в тайминг произносимых слов.", kind: "text", presets: ["Clean phrase", "Highlight", "Glass lower"] },
  { id: "numbers", title: "Цифры", note: "Проценты, деньги, годы", help: "Так будут усиливаться числа: проценты, цены, сроки, возраст, количество и счетчики.", kind: "number", presets: ["Big metric", "Shimmer", "HUD number"] },
  { id: "charts", title: "Графики", note: "Рост и сравнения", help: "Так AI будет показывать рост, падение, прогресс, сравнение до/после и последовательности чисел.", kind: "chart", presets: ["Growth line", "Ratio panel", "Progress bar"] },
  { id: "lists", title: "Списки", note: "Шаги и пункты", help: "Так будут выглядеть перечисления: правила, причины, шаги, ошибки и чеклисты.", kind: "list", presets: ["Checklist", "Bullet cards", "Lesson steps"] },
  { id: "accents", title: "Акценты", note: "Мифы, ошибки, важно", help: "Так выделяются слова типа “важно”, “ошибка”, “миф”, “правда”, “главный инсайт”.", kind: "accent", presets: ["Myth strike", "Warning strip", "Keyword focus"] },
  { id: "surfaces", title: "Подложки", note: "Glass, solid, outline", help: "Настраивает сами карточки: стекло, плотная плашка, контур, неон, скругление и тени.", kind: "surface", presets: ["Dark glass", "Soft card", "Neon HUD"] },
  { id: "motion", title: "Анимации", note: "Как появляется", help: "Настраивает характер движения: спокойно, быстро, резко, слайдом, попом или word-slam.", kind: "text", presets: ["Glass slide", "Soft pop", "Word slam"] },
  { id: "cta", title: "CTA", note: "Финальный призыв", help: "Так будут выглядеть финальные призывы: сохранить, подписаться, перейти, забрать чеклист.", kind: "cta", presets: ["Clean CTA", "Premium CTA", "Viral CTA"] }
];

export const positions: Array<{ id: Position; label: string }> = [
  { id: "left", label: "Слева" },
  { id: "right", label: "Справа" },
  { id: "center", label: "Центр" },
  { id: "lower", label: "Снизу" }
];

export const surfaces: Array<{ id: SurfaceMode; label: string }> = [
  { id: "glass", label: "Glass" },
  { id: "solid", label: "Solid" },
  { id: "outline", label: "Outline" },
  { id: "neon", label: "Neon" }
];

export const shadows: Array<{ id: ShadowMode; label: string }> = [
  { id: "soft", label: "Мягкая" },
  { id: "deep", label: "Глубокая" },
  { id: "glow", label: "Свечение" },
  { id: "none", label: "Нет" }
];

export const fonts: Array<{ id: FontMode; label: string }> = [
  { id: "grotesk", label: "Grotesk" },
  { id: "editorial", label: "Editorial" },
  { id: "mono", label: "Mono" }
];

export const presetPatches: Record<string, PresetPatch> = {
  "Course Glass": { textColor: "#ffffff", accentColor: "#73c8ff", surfaceColor: "#0d1f36", surfaceMode: "glass", shadowMode: "soft", fontMode: "grotesk", aspectMode: "portrait" },
  "Viral Clean": { textColor: "#ffffff", accentColor: "#ffe54d", surfaceColor: "#111111", surfaceMode: "solid", shadowMode: "deep", fontMode: "grotesk", aspectMode: "portrait", motion: 88 },
  "Premium Calm": { textColor: "#f7f0e5", accentColor: "#d8c5a1", surfaceColor: "#241f18", surfaceMode: "glass", shadowMode: "soft", fontMode: "editorial", motion: 32 },
  "Lesson block": { position: "right", fontSize: 58, weight: 900, surfaceMode: "glass", shadowMode: "soft", accentColor: "#73c8ff" },
  "Title slam": { position: "center", fontSize: 76, weight: 950, surfaceMode: "solid", shadowMode: "deep", accentColor: "#ffe54d", motion: 92 },
  "Cinematic": { position: "left", fontSize: 64, weight: 850, surfaceMode: "glass", shadowMode: "soft", fontMode: "editorial", accentColor: "#d8c5a1" },
  "Clean phrase": { position: "lower", fontSize: 42, weight: 850, surfaceMode: "solid", shadowMode: "soft", padding: 18 },
  "Highlight": { position: "lower", fontSize: 46, weight: 900, surfaceMode: "glass", shadowMode: "glow", accentColor: "#73c8ff" },
  "Glass lower": { position: "lower", fontSize: 44, weight: 850, surfaceMode: "glass", shadowMode: "soft" },
  "Big metric": { position: "left", fontSize: 86, weight: 950, surfaceMode: "glass", shadowMode: "deep", accentColor: "#73c8ff" },
  "Shimmer": { position: "center", fontSize: 96, weight: 950, surfaceMode: "neon", shadowMode: "glow", accentColor: "#ffe54d", motion: 78 },
  "HUD number": { position: "right", fontSize: 82, weight: 900, surfaceMode: "outline", shadowMode: "glow", fontMode: "mono" },
  "Growth line": { position: "left", surfaceMode: "glass", shadowMode: "soft", accentColor: "#73ffb5" },
  "Ratio panel": { position: "right", surfaceMode: "outline", shadowMode: "glow", fontMode: "mono" },
  "Progress bar": { position: "lower", surfaceMode: "solid", shadowMode: "soft", accentColor: "#ffb347" },
  "Checklist": { position: "right", surfaceMode: "glass", shadowMode: "soft", fontSize: 42 },
  "Bullet cards": { position: "left", surfaceMode: "solid", shadowMode: "deep", fontSize: 40 },
  "Lesson steps": { position: "center", surfaceMode: "glass", shadowMode: "glow", accentColor: "#73c8ff" },
  "Myth strike": { position: "left", surfaceMode: "solid", shadowMode: "deep", accentColor: "#ff4040", motion: 82 },
  "Warning strip": { position: "lower", surfaceMode: "solid", shadowMode: "glow", accentColor: "#ffb347" },
  "Keyword focus": { position: "center", fontSize: 72, surfaceMode: "outline", shadowMode: "glow", accentColor: "#73c8ff" },
  "Dark glass": { surfaceColor: "#0d1f36", surfaceMode: "glass", shadowMode: "soft", radius: 24 },
  "Soft card": { surfaceColor: "#f8fbff", textColor: "#06111f", accentColor: "#2f78ff", surfaceMode: "solid", shadowMode: "soft", radius: 26 },
  "Neon HUD": { surfaceColor: "#020617", textColor: "#ffffff", accentColor: "#73ffb5", surfaceMode: "neon", shadowMode: "glow", fontMode: "mono" },
  "Glass slide": { motion: 58, surfaceMode: "glass", shadowMode: "soft" },
  "Soft pop": { motion: 36, surfaceMode: "solid", shadowMode: "soft" },
  "Word slam": { motion: 94, surfaceMode: "solid", shadowMode: "deep", fontSize: 62, weight: 950 },
  "Clean CTA": { position: "center", surfaceMode: "solid", shadowMode: "soft", accentColor: "#73c8ff", fontSize: 58 },
  "Premium CTA": { position: "center", surfaceMode: "glass", shadowMode: "soft", fontMode: "editorial", accentColor: "#d8c5a1", fontSize: 62 },
  "Viral CTA": { position: "center", surfaceMode: "neon", shadowMode: "glow", accentColor: "#ffe54d", fontSize: 72, motion: 90 }
};
