import type { MotionIntensity, VisualDensity, VisualPlanOptions, VisualPresetPack, VisualSafeRegion, VisualTemplateId } from "@/lib/types";

const densities = new Set<VisualDensity>(["low", "medium", "high"]);
const motionIntensities = new Set<MotionIntensity>(["calm", "medium", "active"]);
const presetPacks = new Set<VisualPresetPack>(["balanced", "premium", "viral", "educational", "minimal"]);
const templates = new Set<VisualTemplateId>(["big_number", "bullet_cards", "keyword_slam", "checklist", "metric_chart", "lesson_title", "myth_strike", "stat_panel", "concept_map", "cta_plate", "kinetic_text"]);

export function parseVisualPlanOptions(raw: string | null | undefined): VisualPlanOptions {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const disabledTemplates = Array.isArray(parsed.disabledTemplates)
      ? parsed.disabledTemplates.filter((item): item is VisualTemplateId => typeof item === "string" && templates.has(item as VisualTemplateId))
      : [];
    const faceSafeRegions = Array.isArray(parsed.faceSafeRegions)
      ? parsed.faceSafeRegions.map(parseSafeRegion).filter((item): item is VisualSafeRegion => Boolean(item))
      : [];

    return {
      visualDensity: typeof parsed.visualDensity === "string" && densities.has(parsed.visualDensity as VisualDensity)
        ? parsed.visualDensity as VisualDensity
        : undefined,
      motionIntensity: typeof parsed.motionIntensity === "string" && motionIntensities.has(parsed.motionIntensity as MotionIntensity)
        ? parsed.motionIntensity as MotionIntensity
        : undefined,
      presetPack: typeof parsed.presetPack === "string" && presetPacks.has(parsed.presetPack as VisualPresetPack)
        ? parsed.presetPack as VisualPresetPack
        : undefined,
      disabledTemplates,
      faceSafeRegions,
      visualTemplateId: typeof parsed.visualTemplateId === "string" ? parsed.visualTemplateId : undefined,
      visualTemplate: parsed.visualTemplate && typeof parsed.visualTemplate === "object" ? parsed.visualTemplate : undefined
    };
  } catch {
    return {};
  }
}

function parseSafeRegion(value: unknown): VisualSafeRegion | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Record<string, unknown>;
  if (typeof item.x !== "number" || typeof item.y !== "number" || typeof item.width !== "number" || typeof item.height !== "number") {
    return undefined;
  }
  if (item.width <= 0 || item.height <= 0) return undefined;
  return {
    id: typeof item.id === "string" ? item.id : undefined,
    kind: item.kind === "face" || item.kind === "speaker" || item.kind === "subtitle_block" ? item.kind : undefined,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    confidence: typeof item.confidence === "number" ? item.confidence : undefined
  };
}
