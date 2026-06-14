import type { VisualSceneLayoutMode, VisualSceneType } from "@/lib/types";

export interface VisualScenePresetDefinition {
  id: string;
  label: string;
  sceneType: VisualSceneType;
  layoutModes: VisualSceneLayoutMode[];
  minDuration: number;
  maxDuration: number;
  requiredPayload: string[];
}

export const visualScenePresets: VisualScenePresetDefinition[] = [
  preset("ais_lesson_title", "AIS lesson title", "lesson_title", ["overlay", "full_frame"], ["eyebrow", "title"]),
  preset("ais_ratio_stack", "AIS ratio stack", "ratio_stack", ["overlay", "pip"], ["items"]),
  preset("ais_myth_strike", "AIS myth strike", "myth_strike", ["overlay"], ["falseText", "trueText"]),
  preset("ais_stat_hud", "AIS stat HUD", "stat_hud", ["overlay", "pip"], ["value", "label"]),
  preset("ais_trust_map", "AIS trust map", "trust_map", ["pip", "full_frame"], ["center", "left", "right"]),
  preset("ais_pip_slide", "AIS PIP slide", "pip_slide", ["pip"], ["title", "subtitle"]),
  preset("ais_three_cards", "AIS three cards", "three_cards", ["pip", "full_frame"], ["items"]),
  preset("ais_warning_dialogue", "AIS warning dialogue", "warning_dialogue", ["pip", "full_frame"], ["wrong", "right"]),
  preset("ais_compare_split", "AIS compare split", "compare_split", ["overlay", "split", "pip"], ["left", "right"]),
  preset("ais_timeline_steps", "AIS timeline steps", "timeline_steps", ["pip", "full_frame"], ["items"]),
  preset("ais_quote_focus", "AIS quote focus", "quote_focus", ["overlay"], ["quote"]),
  preset("ais_cta_plate", "AIS CTA plate", "cta_plate", ["full_frame", "pip"], ["text"])
];

export function scenePresetById(id: string) {
  return visualScenePresets.find((preset) => preset.id === id);
}

export function scenePresetForType(sceneType: VisualSceneType) {
  const preset = visualScenePresets.find((item) => item.sceneType === sceneType);
  if (!preset) throw new Error(`Unknown visual scene type: ${sceneType}`);
  return preset;
}

function preset(
  id: string,
  label: string,
  sceneType: VisualSceneType,
  layoutModes: VisualSceneLayoutMode[],
  requiredPayload: string[]
): VisualScenePresetDefinition {
  return {
    id,
    label,
    sceneType,
    layoutModes,
    minDuration: 2.6,
    maxDuration: 8.2,
    requiredPayload
  };
}
