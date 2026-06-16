import { z } from "zod";
import type { SceneCategory, SceneRecipeId, SemanticBlockType, SemanticSlotRole, SpeakerMode } from "@/lib/types";

export interface SceneRecipeDefinition {
  id: SceneRecipeId;
  label: string;
  category: SceneCategory;
  blockTypes: SemanticBlockType[];
  allowedSpeakerModes: SpeakerMode[];
  allowedLayerKinds: Array<
    "speaker" | "title" | "subtitle" | "number" | "checklist" | "comparison" | "chart" | "quote" | "cta" | "transition" | "supporting_text"
  >;
  allowedLayouts: Array<"left" | "right" | "center" | "lower_third" | "full_frame">;
  microBeatCapacity: { min: number; max: number };
  duration: { min: number; max: number };
  fallbackRecipeId: SceneRecipeId;
  speakerVisibility: SpeakerMode;
  requiredSlotRoles: SemanticSlotRole[];
  optionalSlotRoles: SemanticSlotRole[];
  payloadSchema: z.ZodType<Record<string, unknown>>;
  visualMapping: {
    overlayTemplateId?: string;
    overlayPresetId?: string;
    fullSceneType?: string;
    layoutMode?: "overlay" | "full_frame" | "pip" | "split";
  };
}

function recordSchema(shape: Record<string, z.ZodTypeAny>) {
  return z.object(shape).passthrough() as z.ZodType<Record<string, unknown>>;
}

export const sharedSceneLibrary: SceneRecipeDefinition[] = [
  recipe("hook_title_left", "Hook title left", "overlay_scene", ["hook", "thesis"], ["full_frame", "reframed"], ["title", "subtitle"], ["left", "center"], [1, 4], [1.2, 5.2], "hook_title_center", "full_frame", ["headline"], ["keyword_accent", "supporting_context"], recordSchema({ title: z.string(), subtitle: z.string().optional() }), { overlayTemplateId: "lesson_title", overlayPresetId: "lesson_title_block" }),
  recipe("hook_title_center", "Hook title center", "overlay_scene", ["hook", "thesis"], ["full_frame", "reframed"], ["title", "subtitle"], ["center", "full_frame"], [1, 4], [1.2, 5.2], "hook_title_left", "full_frame", ["headline"], ["keyword_accent", "supporting_context"], recordSchema({ title: z.string(), subtitle: z.string().optional() }), { overlayTemplateId: "lesson_title", overlayPresetId: "lesson_title_cinematic" }),
  recipe("headline_with_accent_number", "Headline with accent number", "overlay_scene", ["hook", "list", "proof", "warning"], ["full_frame", "reframed"], ["number", "title", "supporting_text"], ["left", "center", "lower_third"], [2, 5], [1.4, 5.4], "big_number_plus_text_plate", "full_frame", ["headline", "hero_number"], ["keyword_accent", "supporting_context"], recordSchema({ value: z.string(), title: z.string(), text: z.string().optional() }), { overlayTemplateId: "stat_panel", overlayPresetId: "hud_ratio_panel" }),
  recipe("step_number_callout", "Step number callout", "overlay_scene", ["list", "timeline", "explanation"], ["full_frame", "reframed"], ["number", "title", "supporting_text"], ["left", "center", "lower_third"], [2, 5], [1.2, 5.6], "checklist_reveal", "full_frame", ["step_index"], ["step_label", "correct_phrase", "keyword_accent"], recordSchema({ value: z.string(), label: z.string(), text: z.string().optional() }), { overlayTemplateId: "checklist", overlayPresetId: "checklist_steps" }),
  recipe("before_after_phrase_swap", "Before after phrase swap", "overlay_scene", ["comparison", "warning", "myth_vs_truth"], ["full_frame", "reframed"], ["comparison", "supporting_text"], ["left", "center", "full_frame"], [2, 5], [1.6, 5.6], "comparison_split", "full_frame", ["comparison_left", "comparison_right"], ["keyword_accent"], recordSchema({ left: z.string(), right: z.string(), caption: z.string().optional() }), { overlayTemplateId: "myth_strike", overlayPresetId: "myth_strike_redline" }),
  recipe("rule_card", "Rule card", "overlay_scene", ["definition", "explanation", "warning"], ["full_frame", "reframed"], ["title", "supporting_text"], ["left", "center", "lower_third"], [1, 4], [1.5, 5.4], "definition_card", "full_frame", ["headline"], ["hero_number", "keyword_accent", "supporting_context"], recordSchema({ title: z.string(), subtitle: z.string().optional(), text: z.string().optional() }), { overlayTemplateId: "lesson_title", overlayPresetId: "lesson_title_block" }),
  recipe("list_progression", "List progression", "overlay_scene", ["list", "timeline", "proof"], ["full_frame", "reframed"], ["checklist", "supporting_text"], ["left", "full_frame", "lower_third"], [2, 6], [2.2, 6.8], "checklist_reveal", "full_frame", ["headline"], ["step_index", "step_label", "keyword_accent"], recordSchema({ title: z.string().optional(), items: z.array(z.string()).min(2) }), { overlayTemplateId: "checklist", overlayPresetId: "checklist_steps" }),
  recipe("big_number_grow", "Big number grow", "overlay_scene", ["proof", "explanation"], ["full_frame", "reframed"], ["number", "supporting_text"], ["left", "right", "center"], [1, 4], [1.2, 4.5], "big_number_plus_text_plate", "full_frame", ["hero_number"], ["headline", "supporting_context"], recordSchema({ value: z.string(), label: z.string() }), { overlayTemplateId: "big_number", overlayPresetId: "big_number_callout" }),
  recipe("big_number_plus_text_plate", "Big number plus text plate", "overlay_scene", ["proof", "explanation", "warning"], ["full_frame", "reframed"], ["number", "supporting_text"], ["left", "right", "lower_third"], [1, 4], [1.4, 5.2], "big_number_grow", "full_frame", ["hero_number"], ["headline", "correct_phrase", "supporting_context"], recordSchema({ value: z.string(), label: z.string(), text: z.string().optional() }), { overlayTemplateId: "stat_panel", overlayPresetId: "hud_ratio_panel" }),
  recipe("warning_strike_fix", "Warning strike fix", "overlay_scene", ["warning", "comparison", "myth_vs_truth", "list"], ["full_frame", "reframed"], ["comparison", "supporting_text"], ["left", "center", "full_frame"], [2, 6], [1.8, 6.2], "myth_vs_truth", "full_frame", ["wrong_phrase", "correct_phrase"], ["command_hotkey", "hero_number"], recordSchema({ falseText: z.string(), trueText: z.string(), label: z.string().optional(), value: z.string().optional() }), { overlayTemplateId: "myth_strike", overlayPresetId: "myth_strike_redline" }),
  recipe("hotkey_command_tip", "Hotkey command tip", "overlay_scene", ["warning", "explanation", "list", "proof"], ["full_frame", "reframed"], ["title", "cta", "supporting_text"], ["right", "left", "lower_third"], [2, 5], [1.4, 5.4], "cta_finish", "full_frame", ["command_hotkey"], ["headline", "correct_phrase", "wrong_phrase"], recordSchema({ title: z.string(), cta: z.string(), label: z.string().optional(), text: z.string().optional() }), { overlayTemplateId: "cta_plate", overlayPresetId: "cta_finish_clean" }),
  recipe("myth_vs_truth", "Myth vs truth", "overlay_scene", ["myth_vs_truth", "warning", "comparison"], ["full_frame", "reframed"], ["comparison", "supporting_text"], ["full_frame", "left"], [2, 5], [2, 6.4], "comparison_split", "full_frame", ["wrong_phrase", "correct_phrase"], ["keyword_accent"], recordSchema({ falseText: z.string(), trueText: z.string(), label: z.string().optional() }), { overlayTemplateId: "myth_strike", overlayPresetId: "myth_strike_redline" }),
  recipe("definition_card", "Definition card", "overlay_scene", ["definition", "explanation"], ["full_frame", "reframed"], ["title", "subtitle", "supporting_text"], ["left", "lower_third", "center"], [1, 4], [1.6, 6], "hook_title_left", "full_frame", ["headline"], ["supporting_context", "keyword_accent"], recordSchema({ title: z.string(), text: z.string(), items: z.array(z.string()).optional() }), { overlayTemplateId: "bullet_cards", overlayPresetId: "definition_card" }),
  recipe("comparison_split", "Comparison split", "split_scene", ["comparison", "myth_vs_truth"], ["pip", "reframed"], ["comparison", "speaker"], ["full_frame", "left"], [2, 5], [2.2, 6.2], "speaker_right_panel_left_infographic", "pip", ["comparison_left", "comparison_right"], ["supporting_context"], recordSchema({ left: z.string(), right: z.string(), caption: z.string().optional() }), { fullSceneType: "compare_split", layoutMode: "split" }),
  recipe("checklist_reveal", "Checklist reveal", "overlay_scene", ["list", "example", "proof"], ["full_frame", "reframed"], ["checklist", "supporting_text"], ["left", "full_frame", "lower_third"], [2, 6], [2.2, 6.8], "definition_card", "full_frame", ["headline"], ["keyword_accent", "correct_phrase"], recordSchema({ title: z.string().optional(), items: z.array(z.string()).min(2) }), { overlayTemplateId: "checklist", overlayPresetId: "checklist_steps" }),
  recipe("timeline_year_callout", "Timeline year callout", "overlay_scene", ["timeline", "explanation"], ["full_frame", "reframed"], ["chart", "supporting_text"], ["left", "right", "full_frame"], [2, 5], [2.2, 6], "definition_card", "full_frame", ["headline"], ["step_index", "keyword_accent"], recordSchema({ title: z.string(), items: z.array(z.string()).min(2) }), { overlayTemplateId: "metric_chart", overlayPresetId: "metric_chart_compact" }),
  recipe("trust_diagram", "Trust diagram", "pip_scene", ["proof", "definition", "comparison"], ["pip", "hidden"], ["chart", "supporting_text", "speaker"], ["full_frame", "left", "right"], [2, 5], [2.4, 6.4], "speaker_right_panel_left_infographic", "pip", ["comparison_left", "comparison_right"], ["hero_number", "headline"], recordSchema({ center: z.string(), left: z.string(), right: z.string(), caption: z.string().optional() }), { fullSceneType: "trust_map", layoutMode: "pip" }),
  recipe("quote_emphasis", "Quote emphasis", "overlay_scene", ["example", "proof", "thesis"], ["full_frame", "reframed"], ["quote", "subtitle"], ["center", "lower_third"], [1, 4], [1.4, 5.6], "hook_title_left", "full_frame", ["quote_pull"], ["headline"], recordSchema({ quote: z.string(), label: z.string().optional() }), { overlayTemplateId: "keyword_slam", overlayPresetId: "quote_emphasis" }),
  recipe("cta_finish", "CTA finish", "overlay_scene", ["cta"], ["full_frame", "reframed"], ["cta", "subtitle"], ["center", "lower_third"], [1, 3], [1.6, 4.4], "hook_title_center", "full_frame", ["cta_phrase"], ["command_hotkey"], recordSchema({ text: z.string(), label: z.string().optional() }), { overlayTemplateId: "cta_plate", overlayPresetId: "cta_finish_clean" }),
  recipe("speaker_lower_half_top_visual", "Speaker lower half top visual", "split_scene", ["explanation", "proof", "list"], ["reframed", "pip"], ["speaker", "title", "subtitle", "chart"], ["full_frame"], [2, 5], [2.2, 7.2], "speaker_right_panel_left_infographic", "reframed", ["headline"], ["keyword_accent", "step_index"], recordSchema({ title: z.string(), subtitle: z.string().optional(), items: z.array(z.string()).optional() }), { fullSceneType: "timeline_steps", layoutMode: "full_frame" }),
  recipe("speaker_right_panel_left_infographic", "Speaker right panel left infographic", "pip_scene", ["explanation", "definition", "proof"], ["pip", "reframed"], ["speaker", "chart", "title", "supporting_text"], ["full_frame", "left"], [2, 5], [2.4, 6.8], "speaker_lower_half_top_visual", "pip", ["headline"], ["hero_number", "command_hotkey", "keyword_accent"], recordSchema({ title: z.string(), label: z.string().optional(), value: z.string().optional(), items: z.array(z.string()).optional() }), { fullSceneType: "stat_hud", layoutMode: "pip" }),
  recipe("voiceover_full_graphic", "Voiceover full graphic", "full_graphic_scene", ["definition", "timeline", "proof", "list"], ["hidden"], ["title", "chart", "checklist", "supporting_text"], ["full_frame"], [2, 6], [2.4, 7.2], "definition_card", "hidden", ["headline"], ["keyword_accent", "step_index"], recordSchema({ title: z.string(), items: z.array(z.string()).optional(), text: z.string().optional() }), { fullSceneType: "three_cards", layoutMode: "full_frame" }),
  recipe("camera_punch_in", "Camera punch in", "camera_emphasis_scene", ["hook", "warning", "proof"], ["reframed"], ["speaker", "title"], ["full_frame", "center"], [1, 3], [1, 3.4], "hook_title_left", "reframed", ["headline"], ["hero_number", "wrong_phrase", "correct_phrase"], recordSchema({ title: z.string(), text: z.string().optional() }), { fullSceneType: "pip_slide", layoutMode: "overlay" }),
  recipe("clean_section_transition", "Clean section transition", "transition_scene", ["transition"], ["hidden", "full_frame"], ["transition", "title"], ["center", "full_frame"], [1, 2], [0.8, 2.2], "hook_title_center", "hidden", ["headline"], [], recordSchema({ title: z.string() }), { overlayTemplateId: "keyword_slam", overlayPresetId: "keyword_warning_strip" })
];

function recipe(
  id: SceneRecipeId,
  label: string,
  category: SceneCategory,
  blockTypes: SemanticBlockType[],
  allowedSpeakerModes: SpeakerMode[],
  allowedLayerKinds: SceneRecipeDefinition["allowedLayerKinds"],
  allowedLayouts: SceneRecipeDefinition["allowedLayouts"],
  microBeatCapacity: [number, number],
  duration: [number, number],
  fallbackRecipeId: SceneRecipeId,
  speakerVisibility: SpeakerMode,
  requiredSlotRoles: SemanticSlotRole[],
  optionalSlotRoles: SemanticSlotRole[],
  payloadSchema: SceneRecipeDefinition["payloadSchema"],
  visualMapping: SceneRecipeDefinition["visualMapping"]
): SceneRecipeDefinition {
  return {
    id,
    label,
    category,
    blockTypes,
    allowedSpeakerModes,
    allowedLayerKinds,
    allowedLayouts,
    microBeatCapacity: { min: microBeatCapacity[0], max: microBeatCapacity[1] },
    duration: { min: duration[0], max: duration[1] },
    fallbackRecipeId,
    speakerVisibility,
    requiredSlotRoles,
    optionalSlotRoles,
    payloadSchema,
    visualMapping
  };
}

export function getSceneRecipe(recipeId: SceneRecipeId) {
  const recipeDef = sharedSceneLibrary.find((recipe) => recipe.id === recipeId);
  if (!recipeDef) {
    throw new Error(`Unknown scene recipe: ${recipeId}`);
  }
  return recipeDef;
}

export function listSceneRecipesForBlockType(blockType: SemanticBlockType) {
  return sharedSceneLibrary.filter((recipeDef) => recipeDef.blockTypes.includes(blockType));
}
