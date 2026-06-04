import type {
  StylePreset,
  VisualMotionId,
  VisualPresetDefinition,
  VisualPresetPack,
  VisualStyleProfile,
  VisualTemplateDefinition,
  VisualMomentType,
  VisualTemplateId
} from "@/lib/types";

export const visualTemplates: VisualTemplateDefinition[] = [
  {
    id: "kinetic_text",
    label: "Kinetic Text",
    momentTypes: ["kinetic_text"],
    minDuration: 0.2,
    maxDuration: 10,
    allowedLayouts: ["full_frame", "center", "lower_third"],
    requiredPayload: ["text"]
  },
  {
    id: "big_number",
    label: "Big number",
    momentTypes: ["number", "chart", "comparison"],
    minDuration: 1.4,
    maxDuration: 4.2,
    allowedLayouts: ["left", "right", "center", "lower_third", "full_frame"],
    requiredPayload: ["value", "label"]
  },
  {
    id: "bullet_cards",
    label: "Bullet cards",
    momentTypes: ["list", "definition", "comparison", "quote"],
    minDuration: 2.2,
    maxDuration: 6,
    allowedLayouts: ["left", "right", "full_frame", "lower_third"],
    requiredPayload: ["items"]
  },
  {
    id: "keyword_slam",
    label: "Keyword slam",
    momentTypes: ["keyword", "warning", "quote", "comparison"],
    minDuration: 1.0,
    maxDuration: 2.8,
    allowedLayouts: ["center", "lower_third", "full_frame"],
    requiredPayload: ["text"]
  },
  {
    id: "checklist",
    label: "Checklist",
    momentTypes: ["list", "definition"],
    minDuration: 2.2,
    maxDuration: 5.4,
    allowedLayouts: ["left", "right", "full_frame", "lower_third"],
    requiredPayload: ["items"]
  },
  {
    id: "metric_chart",
    label: "Metric chart",
    momentTypes: ["chart", "number", "comparison"],
    minDuration: 2.0,
    maxDuration: 4.8,
    allowedLayouts: ["left", "right", "center", "full_frame"],
    requiredPayload: ["title"]
  },
  {
    id: "cta_plate",
    label: "CTA plate",
    momentTypes: ["cta"],
    minDuration: 1.8,
    maxDuration: 3.4,
    allowedLayouts: ["center", "lower_third"],
    requiredPayload: ["text"]
  }
];

export const visualPresets: VisualPresetDefinition[] = [
  preset("kinetic_phrase_clean", "Clean kinetic phrase", "balanced", "kinetic_text", ["kinetic_text", "definition"], ["lower_third"], 92, "kinetic_phrase_safe"),
  preset("kinetic_phrase_glass", "Glass phrase", "premium", "kinetic_text", ["kinetic_text", "definition"], ["lower_third", "center"], 88, "kinetic_phrase_safe"),
  preset("kinetic_phrase_slam", "Rhythmic word phrase", "viral", "kinetic_text", ["kinetic_text", "keyword"], ["lower_third", "center"], 76, "kinetic_phrase_safe"),
  preset("kinetic_phrase_safe", "Safe kinetic phrase", "minimal", "kinetic_text", ["kinetic_text", "definition", "quote"], ["lower_third"], 64, "kinetic_phrase_safe"),
  preset("keyword_focus", "Keyword focus", "balanced", "keyword_slam", ["keyword", "warning", "comparison"], ["center", "lower_third"], 44, "kinetic_phrase_safe"),
  preset("keyword_warning_strip", "Warning strip", "educational", "keyword_slam", ["warning"], ["center", "lower_third"], 38, "keyword_focus"),
  preset("keyword_viral_slam", "Viral slam", "viral", "keyword_slam", ["keyword", "warning"], ["center", "full_frame"], 34, "keyword_focus"),
  preset("quote_emphasis", "Quote emphasis", "premium", "keyword_slam", ["quote", "keyword"], ["center"], 52, "kinetic_phrase_safe"),
  preset("big_number_callout", "Big number callout", "balanced", "big_number", ["number"], ["left", "right", "center"], 62, "kinetic_phrase_safe"),
  preset("big_number_metric", "Metric number", "educational", "big_number", ["number", "chart"], ["left", "lower_third"], 54, "big_number_callout"),
  preset("big_number_viral", "Viral number", "viral", "big_number", ["number"], ["center", "full_frame"], 46, "big_number_callout"),
  preset("metric_chart_compact", "Compact metric chart", "educational", "metric_chart", ["chart", "comparison"], ["left", "right"], 72, "big_number_callout"),
  preset("metric_chart_premium", "Premium metric chart", "premium", "metric_chart", ["chart", "number"], ["left", "right"], 68, "metric_chart_compact"),
  preset("checklist_steps", "Step checklist", "educational", "checklist", ["list", "definition"], ["full_frame", "left"], 116, "kinetic_phrase_safe", 3),
  preset("checklist_compact", "Compact checklist", "balanced", "checklist", ["list"], ["lower_third", "left"], 96, "kinetic_phrase_safe", 3),
  preset("checklist_viral", "Punch checklist", "viral", "checklist", ["list"], ["full_frame"], 86, "checklist_compact", 3),
  preset("bullet_cards_lesson", "Lesson cards", "educational", "bullet_cards", ["list", "definition"], ["full_frame", "left"], 118, "checklist_compact", 3),
  preset("bullet_cards_premium", "Premium cards", "premium", "bullet_cards", ["definition", "quote"], ["full_frame", "right"], 104, "kinetic_phrase_safe", 2),
  preset("definition_card", "Definition card", "educational", "bullet_cards", ["definition"], ["lower_third", "left"], 92, "kinetic_phrase_safe", 2),
  preset("compare_before_after", "Before after contrast", "balanced", "bullet_cards", ["comparison"], ["full_frame", "left"], 104, "keyword_focus", 2),
  preset("myth_vs_truth", "Myth versus truth", "viral", "bullet_cards", ["comparison", "warning"], ["full_frame"], 90, "keyword_focus", 2),
  preset("side_note", "Side note", "premium", "bullet_cards", ["quote", "definition"], ["right", "lower_third"], 84, "kinetic_phrase_safe", 2),
  preset("cta_finish_clean", "Clean CTA finish", "balanced", "cta_plate", ["cta"], ["center", "lower_third"], 58, "kinetic_phrase_safe"),
  preset("cta_finish_premium", "Premium CTA finish", "premium", "cta_plate", ["cta"], ["center"], 56, "cta_finish_clean"),
  preset("cta_finish_viral", "Viral CTA finish", "viral", "cta_plate", ["cta"], ["center"], 48, "cta_finish_clean")
];

export const visualStyleProfiles: VisualStyleProfile[] = [
  {
    id: "course_glass",
    label: "Course Glass",
    density: "medium",
    motionIntensity: "medium",
    typography: {
      heading: '"HF Unbounded", "HF Montserrat", Arial, sans-serif',
      body: '"HF Montserrat", Arial, sans-serif',
      number: '"HF Unbounded", "HF Montserrat", Arial, sans-serif'
    },
    colors: {
      background: "#040816",
      surface: "rgba(13, 31, 54, 0.78)",
      surfaceStrong: "rgba(18, 46, 78, 0.9)",
      text: "#ffffff",
      muted: "#a9bdd7",
      accent: "#73c8ff",
      accent2: "#ffb347",
      warning: "#ffb347",
      border: "rgba(115, 200, 255, 0.32)"
    },
    allowedTemplates: ["big_number", "bullet_cards", "keyword_slam", "checklist", "metric_chart", "cta_plate", "kinetic_text"],
    allowedMotions: ["glass_slide", "depth_zoom", "chart_grow", "soft_pop", "calm_fade"]
  },
  {
    id: "expert_clean",
    label: "Expert Clean",
    density: "low",
    motionIntensity: "calm",
    typography: {
      heading: '"HF Manrope", "HF Montserrat", Arial, sans-serif',
      body: '"HF Manrope", Arial, sans-serif',
      number: '"HF Unbounded", "HF Manrope", Arial, sans-serif'
    },
    colors: {
      background: "#f7f7f2",
      surface: "rgba(255, 255, 255, 0.92)",
      surfaceStrong: "rgba(255, 255, 255, 0.98)",
      text: "#101010",
      muted: "#525252",
      accent: "#111111",
      accent2: "#2f7d5b",
      warning: "#b45309",
      border: "rgba(16, 16, 16, 0.14)"
    },
    allowedTemplates: ["big_number", "bullet_cards", "keyword_slam", "checklist", "cta_plate", "kinetic_text"],
    allowedMotions: ["calm_fade", "soft_pop", "glass_slide"]
  },
  {
    id: "viral_kinetic",
    label: "Viral Kinetic",
    density: "high",
    motionIntensity: "active",
    typography: {
      heading: '"HF Unbounded", "HF Montserrat", Arial, sans-serif',
      body: '"HF Montserrat", Arial, sans-serif',
      number: '"HF Unbounded", "HF Montserrat", Arial, sans-serif'
    },
    colors: {
      background: "#050505",
      surface: "rgba(20, 20, 20, 0.84)",
      surfaceStrong: "rgba(255, 255, 255, 0.94)",
      text: "#ffffff",
      muted: "#d4d4d4",
      accent: "#ff4040",
      accent2: "#ffe54d",
      warning: "#ff4040",
      border: "rgba(255, 64, 64, 0.5)"
    },
    allowedTemplates: ["big_number", "bullet_cards", "keyword_slam", "checklist", "metric_chart", "cta_plate", "kinetic_text"],
    allowedMotions: ["word_slam", "depth_zoom", "chart_grow", "soft_pop", "glass_slide"]
  },
  {
    id: "premium_calm",
    label: "Premium Calm",
    density: "low",
    motionIntensity: "calm",
    typography: {
      heading: '"HF Manrope", "HF Montserrat", Arial, sans-serif',
      body: '"HF Manrope", Arial, sans-serif',
      number: '"HF Unbounded", "HF Manrope", Arial, sans-serif'
    },
    colors: {
      background: "#10100e",
      surface: "rgba(36, 34, 28, 0.8)",
      surfaceStrong: "rgba(55, 49, 39, 0.9)",
      text: "#f7f0e5",
      muted: "#c9bda8",
      accent: "#d8c5a1",
      accent2: "#9fc6b2",
      warning: "#dfb35f",
      border: "rgba(216, 197, 161, 0.28)"
    },
    allowedTemplates: ["big_number", "bullet_cards", "keyword_slam", "cta_plate", "kinetic_text"],
    allowedMotions: ["calm_fade", "soft_pop", "glass_slide"]
  }
];

const presetAliases: Partial<Record<StylePreset, StylePreset>> = {
  clean_expert: "course_glass",
  dynamic_viral: "viral_kinetic"
};

export function resolveVisualStyleProfile(preset: StylePreset): VisualStyleProfile {
  const id = presetAliases[preset] ?? preset;
  return visualStyleProfiles.find((profile) => profile.id === id) ?? visualStyleProfiles[0];
}

export function templateById(id: VisualTemplateId) {
  return visualTemplates.find((template) => template.id === id);
}

export function presetsForPack(pack: VisualPresetPack) {
  return visualPresets.filter((presetDefinition) => presetDefinition.pack === pack || presetDefinition.pack === "balanced");
}

export function presetById(id: string | undefined) {
  return visualPresets.find((presetDefinition) => presetDefinition.id === id);
}

export function presetForMoment(type: VisualMomentType, pack: VisualPresetPack, templateId: VisualTemplateId) {
  const exact = visualPresets.filter((presetDefinition) => (
    presetDefinition.templateId === templateId &&
    presetDefinition.momentTypes.includes(type) &&
    presetDefinition.pack === pack
  ));
  const balanced = visualPresets.filter((presetDefinition) => (
    presetDefinition.templateId === templateId &&
    presetDefinition.momentTypes.includes(type) &&
    presetDefinition.pack === "balanced"
  ));
  return exact[0] ?? balanced[0] ?? visualPresets.find((presetDefinition) => presetDefinition.templateId === templateId) ?? visualPresets[0];
}

export function defaultMotionForTemplate(templateId: VisualTemplateId, profile: VisualStyleProfile): VisualMotionId {
  if (templateId === "big_number" && profile.allowedMotions.includes("depth_zoom")) return "depth_zoom";
  if (templateId === "metric_chart" && profile.allowedMotions.includes("chart_grow")) return "chart_grow";
  if (templateId === "keyword_slam" && profile.allowedMotions.includes("word_slam")) return "word_slam";
  if (profile.allowedMotions.includes("glass_slide")) return "glass_slide";
  return profile.allowedMotions[0] ?? "soft_pop";
}

function preset(
  id: string,
  label: string,
  pack: VisualPresetPack,
  templateId: VisualTemplateId,
  momentTypes: VisualMomentType[],
  preferredLayouts: VisualPresetDefinition["preferredLayouts"],
  maxTextChars: number,
  fallbackPresetId: string,
  maxItems?: number
): VisualPresetDefinition {
  return {
    id,
    label,
    pack,
    templateId,
    momentTypes,
    preferredLayouts,
    variants: ["compact", "standard", "hero", "safe"],
    maxTextChars,
    maxItems,
    fallbackPresetId
  };
}
