import type {
  StylePreset,
  VisualMotionId,
  VisualStyleProfile,
  VisualTemplateDefinition,
  VisualTemplateId
} from "@/lib/types";

export const visualTemplates: VisualTemplateDefinition[] = [
  {
    id: "big_number",
    label: "Big number counter",
    momentTypes: ["number", "chart"],
    minDuration: 1.2,
    maxDuration: 3.4,
    allowedLayouts: ["left", "right", "center", "full_frame"],
    requiredPayload: ["value", "label"]
  },
  {
    id: "bullet_cards",
    label: "Semantic bullet cards",
    momentTypes: ["list", "definition", "comparison"],
    minDuration: 2.2,
    maxDuration: 5.6,
    allowedLayouts: ["left", "right", "full_frame"],
    requiredPayload: ["items"]
  },
  {
    id: "keyword_slam",
    label: "Kinetic keyword",
    momentTypes: ["keyword", "warning", "quote"],
    minDuration: 1.0,
    maxDuration: 2.8,
    allowedLayouts: ["center", "lower_third", "full_frame"],
    requiredPayload: ["text"]
  },
  {
    id: "checklist",
    label: "Checklist",
    momentTypes: ["list", "definition"],
    minDuration: 2.0,
    maxDuration: 5.0,
    allowedLayouts: ["left", "right", "full_frame"],
    requiredPayload: ["items"]
  },
  {
    id: "metric_chart",
    label: "Metric chart",
    momentTypes: ["chart", "number", "comparison"],
    minDuration: 2.0,
    maxDuration: 4.8,
    allowedLayouts: ["left", "right", "center"],
    requiredPayload: ["title"]
  },
  {
    id: "cta_plate",
    label: "CTA plate",
    momentTypes: ["cta"],
    minDuration: 1.6,
    maxDuration: 3.2,
    allowedLayouts: ["center", "lower_third"],
    requiredPayload: ["text"]
  }
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
      background: "#020617",
      surface: "rgba(15, 35, 58, 0.76)",
      surfaceStrong: "rgba(18, 48, 78, 0.88)",
      text: "#ffffff",
      muted: "#b8c6d9",
      accent: "#60bfff",
      accent2: "#f6a941",
      warning: "#ffcf5a",
      border: "rgba(96, 191, 255, 0.36)"
    },
    allowedTemplates: ["big_number", "bullet_cards", "keyword_slam", "checklist", "metric_chart", "cta_plate"],
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
      surface: "rgba(255, 255, 255, 0.9)",
      surfaceStrong: "rgba(255, 255, 255, 0.96)",
      text: "#101010",
      muted: "#525252",
      accent: "#111111",
      accent2: "#2f7d5b",
      warning: "#b45309",
      border: "rgba(16, 16, 16, 0.14)"
    },
    allowedTemplates: ["big_number", "bullet_cards", "keyword_slam", "checklist", "cta_plate"],
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
    allowedTemplates: ["big_number", "bullet_cards", "keyword_slam", "checklist", "metric_chart", "cta_plate"],
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
      surface: "rgba(36, 34, 28, 0.78)",
      surfaceStrong: "rgba(55, 49, 39, 0.9)",
      text: "#f7f0e5",
      muted: "#c9bda8",
      accent: "#d8c5a1",
      accent2: "#9fc6b2",
      warning: "#dfb35f",
      border: "rgba(216, 197, 161, 0.28)"
    },
    allowedTemplates: ["big_number", "bullet_cards", "keyword_slam", "cta_plate"],
    allowedMotions: ["calm_fade", "soft_pop", "glass_slide"]
  }
];

const presetAliases: Partial<Record<StylePreset, StylePreset>> = {
  clean_expert: "expert_clean",
  dynamic_viral: "viral_kinetic"
};

export function resolveVisualStyleProfile(preset: StylePreset): VisualStyleProfile {
  const id = presetAliases[preset] ?? preset;
  return visualStyleProfiles.find((profile) => profile.id === id) ?? visualStyleProfiles[0];
}

export function templateById(id: VisualTemplateId) {
  return visualTemplates.find((template) => template.id === id);
}

export function defaultMotionForTemplate(templateId: VisualTemplateId, profile: VisualStyleProfile): VisualMotionId {
  if (templateId === "big_number" && profile.allowedMotions.includes("depth_zoom")) return "depth_zoom";
  if (templateId === "metric_chart" && profile.allowedMotions.includes("chart_grow")) return "chart_grow";
  if (templateId === "keyword_slam" && profile.allowedMotions.includes("word_slam")) return "word_slam";
  if (profile.allowedMotions.includes("glass_slide")) return "glass_slide";
  return profile.allowedMotions[0] ?? "soft_pop";
}
