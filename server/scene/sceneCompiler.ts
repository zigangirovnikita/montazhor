import type {
  CompiledSceneBlock,
  CompiledScenePlan,
  ScenePlan,
  ScenePlanBlock,
  VisualBeat,
  VisualScene
} from "@/lib/types";
import type { VisualFrameProfile, VisualPlanOptions } from "@/lib/types";
import { getSceneRecipe } from "@/server/scene/sceneLibrary";

export const SCENE_COMPILER_VERSION = "v1";

export function compileScenePlan(
  scenePlan: ScenePlan,
  frame: VisualFrameProfile,
  styleOptions?: VisualPlanOptions
): CompiledScenePlan {
  const blocks = scenePlan.blocks.map((block) => compileSceneBlock(block, scenePlan, frame, styleOptions));
  return {
    version: SCENE_COMPILER_VERSION,
    templateId: scenePlan.templateId,
    styleProfileId: scenePlan.styleProfileId,
    planner: scenePlan.planner,
    blocks,
    diagnostics: scenePlan.diagnostics
  };
}

function compileSceneBlock(
  block: ScenePlanBlock,
  scenePlan: ScenePlan,
  frame: VisualFrameProfile,
  styleOptions?: VisualPlanOptions
): CompiledSceneBlock {
  const semanticBlock = scenePlan.semanticBlocks.find((entry) => entry.id === block.blockId);
  if (!semanticBlock) {
    throw new Error(`Missing semantic block for scene block ${block.id}`);
  }

  const recipeDef = getSceneRecipe(block.safeMode ? (block.fallbackRecipeId ?? block.recipeId) : block.recipeId);
  const fallbackApplied = block.safeMode === true || block.microBeats.length === 0 && semanticBlock.end - semanticBlock.start > 3;
  const overlayBeats = recipeDef.category === "overlay_scene" || recipeDef.category === "transition_scene"
    ? compileOverlayBeats(block, recipeDef.id, frame, styleOptions, fallbackApplied)
    : [];
  const fullScene = recipeDef.category === "overlay_scene" || recipeDef.category === "transition_scene"
    ? undefined
    : compileFullScene(block, recipeDef.id, semanticBlock.summary);

  return {
    id: `compiled-${block.id}`,
    blockId: block.blockId,
    sceneId: block.id,
    blockType: block.blockType,
    sceneCategory: block.sceneCategory,
    recipeId: recipeDef.id,
    speakerMode: block.speakerMode,
    start: semanticBlock.start,
    end: semanticBlock.end,
    duration: round(Math.max(0.8, semanticBlock.end - semanticBlock.start)),
    renderPath: fullScene ? "full_scene" : "overlay",
    activeLayerIds: block.layerPlan.filter((layer) => layer.enabled).map((layer) => layer.id),
    summary: semanticBlock.summary,
    overlayBeats,
    fullScene,
    microBeats: block.microBeats,
    fallbackApplied
  };
}

function compileOverlayBeats(
  block: ScenePlanBlock,
  recipeId: ScenePlanBlock["recipeId"],
  frame: VisualFrameProfile,
  styleOptions: VisualPlanOptions | undefined,
  fallbackApplied: boolean
) {
  const recipeDef = getSceneRecipe(recipeId);
  const layers = block.layerPlan.filter((layer) => layer.enabled);
  const basePayload = Object.assign({}, ...layers.map((layer) => layer.payload));
  const layout = chooseLayout(recipeDef.allowedLayouts, frame.orientation);
  const templateId = (recipeDef.visualMapping.overlayTemplateId ?? "kinetic_text") as VisualBeat["templateId"];
  const presetId = recipeDef.visualMapping.overlayPresetId ?? fallbackPresetForTemplate(templateId);
  const motionId = styleOptions?.motionIntensity === "active"
    ? "word_slam"
    : styleOptions?.motionIntensity === "calm"
      ? "calm_fade"
      : "glass_slide";

  const beats = block.microBeats.length > 0 ? block.microBeats : [{
    id: `${block.id}-fallback`,
    start: block.start,
    end: Math.min(block.end, block.start + 0.8),
    type: "subtitle_emphasis" as const,
    anchorText: block.layerPlan.find((layer) => layer.kind === "title")?.payload.text as string | undefined
  }];

  const supportBeats = buildSupportingSpeechBeats(block, beats, motionId);
  const primaryStart = round(Math.max(block.start, beats[0]?.start ?? block.start));
  const primaryEnd = supportBeats[0]
    ? round(Math.max(primaryStart + 0.6, Math.min(block.end, supportBeats[0].start - 0.08)))
    : round(Math.min(block.end, primaryStart + primaryOverlayDuration(block, recipeDef.id)));

  const primaryBeat: VisualBeat = {
    id: `${block.id}-overlay-primary`,
    start: primaryStart,
    duration: round(Math.max(0.45, primaryEnd - primaryStart)),
    templateId,
    presetId,
    motionId,
    layout,
    payload: decoratePayloadForBeat(basePayload, beats[0]?.anchorText, fallbackApplied),
    sourceMomentId: block.blockId,
    role: layers.some((layer) => layer.kind === "cta") ? "cta" : "semantic_accent",
    variant: fallbackApplied ? "safe" : block.intensity === "strong" ? "hero" : "standard"
  };

  return [primaryBeat, ...supportBeats];
}

function compileFullScene(block: ScenePlanBlock, recipeId: ScenePlanBlock["recipeId"], summary: string): VisualScene {
  const recipeDef = getSceneRecipe(recipeId);
  const payload = Object.assign({}, ...block.layerPlan.filter((layer) => layer.enabled).map((layer) => layer.payload));
  return {
    id: `${block.id}-full`,
    start: round(block.start),
    duration: round(Math.max(recipeDef.duration.min, Math.min(recipeDef.duration.max, block.end - block.start))),
    sceneType: (recipeDef.visualMapping.fullSceneType ?? "pip_slide") as VisualScene["sceneType"],
    presetId: recipeId,
    layoutMode: recipeDef.visualMapping.layoutMode ?? "overlay",
    sourceText: summary,
    payload,
    safeRegionPolicy: block.speakerMode === "hidden" ? "full_frame" : block.speakerMode === "pip" ? "pip_safe" : "avoid_speaker",
    transitionIn: block.transitionIn === "wipe" ? "slide" : block.transitionIn === "cut" ? "fade" : block.transitionIn,
    transitionOut: block.transitionOut === "zoom" || block.transitionOut === "wipe" ? "slide" : block.transitionOut
  };
}

function decoratePayloadForBeat(basePayload: Record<string, unknown>, anchorText: string | undefined, fallbackApplied: boolean) {
  const payload = { ...basePayload };
  if (!payload.text && anchorText) payload.text = anchorText;
  if (!payload.title && typeof payload.text === "string") payload.title = payload.text;
  if (fallbackApplied) payload.subtext = payload.subtext ?? "safe mode";
  return payload;
}

function buildSupportingSpeechBeats(
  block: ScenePlanBlock,
  beats: ScenePlanBlock["microBeats"],
  motionId: VisualBeat["motionId"]
): VisualBeat[] {
  if (block.recipeId === "cta_finish" || block.recipeId === "clean_section_transition") return [];

  const selected = beats
    .filter((beat) => beat.start >= block.start + 1.1)
    .filter((beat, index) => index % 2 === 0)
    .slice(0, block.end - block.start >= 5 ? 3 : 2);

  let lastEnd = block.start;

  return selected.map((beat, index) => {
    const start = Math.max(lastEnd + 0.08, beat.start);
    const end = Math.min(block.end, Math.max(start + 0.42, beat.end));
    lastEnd = end;
    return {
      id: `${block.id}-overlay-support-${index + 1}`,
      start: round(start),
      duration: round(Math.max(0.4, end - start)),
      templateId: "kinetic_text",
      presetId: "kinetic_phrase_clean",
      motionId,
      layout: "lower_third",
      payload: {
        text: beat.anchorText ?? "",
        sourceText: beat.anchorText ?? "",
        emphasis: beat.anchorText ?? ""
      },
      sourceMomentId: block.blockId,
      role: "speech_text",
      variant: "compact"
    };
  });
}

function primaryOverlayDuration(block: ScenePlanBlock, recipeId: ScenePlanBlock["recipeId"]) {
  if (recipeId === "cta_finish") return 1.8;
  if (recipeId === "clean_section_transition") return 1.1;
  return Math.min(1.6, Math.max(0.95, (block.end - block.start) * 0.38));
}

function chooseLayout(layouts: Array<"left" | "right" | "center" | "lower_third" | "full_frame">, orientation: VisualFrameProfile["orientation"]) {
  if (layouts.includes("lower_third") && orientation === "portrait") return "lower_third";
  if (layouts.includes("left")) return "left";
  if (layouts.includes("right")) return "right";
  return layouts[0] ?? "center";
}

function fallbackPresetForTemplate(templateId: VisualBeat["templateId"]) {
  if (templateId === "lesson_title") return "lesson_title_block";
  if (templateId === "big_number") return "big_number_callout";
  if (templateId === "stat_panel") return "hud_ratio_panel";
  if (templateId === "bullet_cards") return "definition_card";
  if (templateId === "checklist") return "checklist_steps";
  if (templateId === "cta_plate") return "cta_finish_clean";
  return "kinetic_phrase_safe";
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
