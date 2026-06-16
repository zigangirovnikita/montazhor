import type { SceneRecipeId, StylePreset, VisualPlanOptions } from "@/lib/types";
import type { VisualTemplateData } from "@/lib/templateBuilder";
import { getSceneRecipe, sharedSceneLibrary } from "@/server/scene/sceneLibrary";

export interface TemplateSceneCapabilities {
  templateId?: string;
  templateName?: string;
  styleProfileId: StylePreset;
  allowedRecipeIds: SceneRecipeId[];
  preferredHookRecipeId: SceneRecipeId;
  preferredCtaRecipeId: SceneRecipeId;
  overlayEnabled: boolean;
  fullSceneEnabled: boolean;
  pipEnabled: boolean;
}

type TemplateBlockKey = keyof VisualTemplateData["blocks"];

const recipeBlockOwnership: Record<SceneRecipeId, TemplateBlockKey[]> = {
  hook_title_left: ["headline", "subtitle"],
  hook_title_center: ["headline", "subtitle"],
  headline_with_accent_number: ["headline", "stat", "accent"],
  step_number_callout: ["list", "stat", "headline"],
  before_after_phrase_swap: ["comparison", "accent"],
  rule_card: ["headline", "subtitle", "accent"],
  list_progression: ["list", "headline", "accent"],
  big_number_grow: ["stat"],
  big_number_plus_text_plate: ["stat", "accent"],
  warning_strike_fix: ["comparison", "accent"],
  hotkey_command_tip: ["cta", "accent", "headline"],
  myth_vs_truth: ["comparison"],
  definition_card: ["headline", "list", "subtitle"],
  comparison_split: ["comparison", "list"],
  checklist_reveal: ["list"],
  timeline_year_callout: ["chart", "list"],
  trust_diagram: ["chart", "comparison"],
  quote_emphasis: ["accent", "subtitle"],
  cta_finish: ["cta"],
  speaker_lower_half_top_visual: ["headline", "chart", "list"],
  speaker_right_panel_left_infographic: ["chart", "stat", "list"],
  voiceover_full_graphic: ["chart", "list", "headline"],
  camera_punch_in: ["headline", "accent"],
  clean_section_transition: ["accent", "headline"]
};

export function resolveTemplateSceneCapabilities(
  styleProfileId: StylePreset,
  styleOptions?: VisualPlanOptions
): TemplateSceneCapabilities {
  const template = parseTemplate(styleOptions?.visualTemplate);
  const disabledTemplates = new Set(styleOptions?.disabledTemplates ?? []);
  const allowedRecipeIds = sharedSceneLibrary
    .filter((recipeDef) => isRecipeAllowedByTemplate(recipeDef.id, template, disabledTemplates))
    .map((recipeDef) => recipeDef.id);

  const overlayEnabled = allowedRecipeIds.some((id) => {
    const category = getSceneRecipe(id).category;
    return category === "overlay_scene" || category === "transition_scene";
  });
  const fullSceneEnabled = allowedRecipeIds.some((id) => {
    const category = getSceneRecipe(id).category;
    return category === "split_scene" || category === "pip_scene" || category === "full_graphic_scene" || category === "camera_emphasis_scene";
  });

  return {
    templateId: styleOptions?.visualTemplateId,
    templateName: template?.name,
    styleProfileId,
    allowedRecipeIds: allowedRecipeIds.length > 0 ? allowedRecipeIds : sharedSceneLibrary.map((recipeDef) => recipeDef.id),
    preferredHookRecipeId: template?.blocks.headline.layoutPreset === "lesson_title_cinematic" ? "hook_title_center" : "hook_title_left",
    preferredCtaRecipeId: "cta_finish",
    overlayEnabled,
    fullSceneEnabled,
    pipEnabled: Boolean(template?.blocks.chart.enabled ?? true)
  };
}

export function isRecipeAllowedByTemplate(
  recipeId: SceneRecipeId,
  template: VisualTemplateData | undefined,
  disabledTemplates: Set<string>
) {
  if (!template) return true;
  const ownedBlocks = recipeBlockOwnership[recipeId];
  if (!ownedBlocks) return true;
  if (disabledTemplates.has("kinetic_text") && (recipeId === "hook_title_left" || recipeId === "hook_title_center" || recipeId === "quote_emphasis")) {
    return false;
  }
  return ownedBlocks.every((blockKey) => template.blocks[blockKey]?.enabled !== false);
}

function parseTemplate(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<VisualTemplateData>;
  if (!candidate.blocks || !candidate.theme || typeof candidate.name !== "string") return undefined;
  return candidate as VisualTemplateData;
}
