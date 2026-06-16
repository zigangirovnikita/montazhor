import type {
  CompiledSceneBlock,
  CompiledScenePlan,
  DirectorPlan,
  DirectorPlanBlock,
  SceneLayerPlan,
  SceneMicroBeat,
  ScenePlan,
  ScreenCopyPayload,
  ScreenCopyBlock,
  ScreenCopyPlan,
  SemanticBlock,
  VisualBeat,
  VisualFrameProfile,
  VisualPlanOptions,
  VisualScene
} from "@/lib/types";
import { getSceneRecipe } from "@/server/scene/sceneLibrary";
import { buildMicroBeatsForBlock, buildMicroBeatsFromSemanticPayload } from "@/server/scene/microBeatPlanner";

export const SCENE_COMPILER_VERSION = "v3";

export function compileScenePlan(
  directorPlan: DirectorPlan,
  screenCopyPlan: ScreenCopyPlan,
  frame: VisualFrameProfile,
  styleOptions?: VisualPlanOptions
): CompiledScenePlan {
  const blocks = directorPlan.blocks
    .filter((block) => block.disabled !== true)
    .map((block) => compileSceneBlock(block, directorPlan.semanticBlocks, screenCopyPlan, frame, styleOptions));
  return {
    version: SCENE_COMPILER_VERSION,
    templateId: directorPlan.templateId,
    styleProfileId: directorPlan.styleProfileId,
    planner: directorPlan.planner,
    blocks,
    diagnostics: [...(directorPlan.diagnostics ?? []), ...(screenCopyPlan.diagnostics ?? [])]
  };
}

export function buildReviewScenePlan(directorPlan: DirectorPlan, screenCopyPlan: ScreenCopyPlan): ScenePlan {
  return {
    version: directorPlan.version,
    templateId: directorPlan.templateId,
    templateName: directorPlan.templateName,
    styleProfileId: directorPlan.styleProfileId,
    planner: directorPlan.planner,
    semanticBlocks: directorPlan.semanticBlocks,
    blocks: directorPlan.blocks.map((block) => {
      const copyBlock = screenCopyPlan.blocks.find((entry) => entry.blockId === block.blockId);
      return {
        id: block.id,
        blockId: block.blockId,
        blockType: block.blockType,
        sceneCategory: block.sceneCategory,
        recipeId: block.recipeId,
        variantId: block.variantId,
        speakerMode: block.speakerMode,
        layerPlan: buildLayerPlan(block, copyBlock),
        microBeats: [],
        intensity: block.intensity,
        transitionIn: block.transitionIn,
        transitionOut: block.transitionOut,
        start: block.start,
        end: block.end,
        rationale: block.rationale,
        fallbackRecipeId: block.fallbackRecipeId,
        safeMode: block.safeMode,
        allowedRecipeIds: block.allowedRecipeIds,
        recommendedRecipeId: block.recommendedRecipeId,
        planningConfidence: block.planningConfidence,
        scenePriority: block.scenePriority,
        sceneDensity: block.sceneDensity,
        visualRole: block.visualRole,
        holdStrategy: block.holdStrategy
      };
    }),
    diagnostics: directorPlan.diagnostics
  };
}

function compileSceneBlock(
  block: DirectorPlanBlock,
  semanticBlocks: SemanticBlock[],
  screenCopyPlan: ScreenCopyPlan,
  frame: VisualFrameProfile,
  styleOptions?: VisualPlanOptions
): CompiledSceneBlock {
  const semanticBlock = semanticBlocks.find((entry) => entry.id === block.blockId);
  if (!semanticBlock) {
    throw new Error(`Missing semantic block for director block ${block.id}`);
  }
  const copyBlock = screenCopyPlan.blocks.find((entry) => entry.blockId === block.blockId);
  if (!copyBlock) {
    throw new Error(`Missing screen copy block for semantic block ${block.blockId}`);
  }

  const initialRecipeId = block.safeMode ? (block.fallbackRecipeId ?? block.recipeId) : block.recipeId;
  const validatedRecipeId = resolveRecipeForPayload(initialRecipeId, copyBlock.payload, block.fallbackRecipeId);
  const recipeDef = getSceneRecipe(validatedRecipeId);
  const microBeats = compileMicroBeats(block, semanticBlock, copyBlock.payload);
  const fallbackApplied = block.safeMode === true || validatedRecipeId !== initialRecipeId || (microBeats.length === 0 && semanticBlock.end - semanticBlock.start > 3);
  const overlayBeats = recipeDef.category === "overlay_scene" || recipeDef.category === "transition_scene"
    ? compileOverlayBeats(block, copyBlock, microBeats, frame, styleOptions, fallbackApplied)
    : [];
  const fullScene = recipeDef.category === "overlay_scene" || recipeDef.category === "transition_scene"
    ? undefined
    : compileFullScene(block, copyBlock, semanticBlock.summary);

  return {
    id: `compiled-${block.id}`,
    blockId: block.blockId,
    sceneId: block.id,
    blockType: block.blockType,
    sceneCategory: recipeDef.category,
    recipeId: recipeDef.id,
    speakerMode: block.speakerMode,
    start: semanticBlock.start,
    end: semanticBlock.end,
    duration: round(Math.max(0.8, semanticBlock.end - semanticBlock.start)),
    renderPath: fullScene ? "full_scene" : "overlay",
    activeLayerIds: buildLayerPlan(block, copyBlock).filter((layer) => layer.enabled).map((layer) => layer.id),
    summary: semanticBlock.summary,
    screenCopy: copyBlock.payload,
    overlayBeats,
    fullScene,
    microBeats,
    fallbackApplied,
    planningConfidence: copyBlock.planningConfidence,
    scenePriority: block.scenePriority,
    sceneDensity: block.sceneDensity,
    visualRole: block.visualRole,
    holdStrategy: block.holdStrategy
  };
}

function compileMicroBeats(block: DirectorPlanBlock, semanticBlock: SemanticBlock, payload: ScreenCopyPayload) {
  const semanticBeats = buildMicroBeatsFromSemanticPayload(semanticBlock, payload, block.recipeId);
  if (semanticBeats.length > 0) return semanticBeats;
  const words = semanticBlock.words.length > 0
    ? semanticBlock.words
    : semanticBlock.text
        .split(/\s+/)
        .filter(Boolean)
        .map((word, index, all) => {
          const slice = (semanticBlock.end - semanticBlock.start) / Math.max(all.length, 1);
          const start = semanticBlock.start + (slice * index);
          return {
            word,
            start,
            end: Math.min(semanticBlock.end, start + Math.max(0.18, slice * 0.9))
          };
        });
  return buildMicroBeatsForBlock(semanticBlock, words, block.recipeId);
}

function compileOverlayBeats(
  block: DirectorPlanBlock,
  copyBlock: ScreenCopyBlock,
  beats: SceneMicroBeat[],
  frame: VisualFrameProfile,
  styleOptions: VisualPlanOptions | undefined,
  fallbackApplied: boolean
) {
  const recipeDef = getSceneRecipe(block.recipeId);
  const basePayload = copyBlock.payload as Record<string, unknown>;
  const supportVisuals = copyBlock.payload.supportVisuals ?? [];
  const layout = chooseLayout(recipeDef.allowedLayouts, frame.orientation);
  const templateId = (recipeDef.visualMapping.overlayTemplateId ?? "kinetic_text") as VisualBeat["templateId"];
  const presetId = recipeDef.visualMapping.overlayPresetId ?? fallbackPresetForTemplate(templateId);
  const motionId = styleOptions?.motionIntensity === "active"
    ? "word_slam"
    : styleOptions?.motionIntensity === "calm"
      ? "calm_fade"
      : "glass_slide";
  const supportBeats = buildSupportingSpeechBeats(block, beats, motionId, supportVisuals);
  const primaryStart = round(Math.max(block.start, beats[0]?.start ?? block.start));
  const primaryEnd = supportBeats[0]
    ? round(Math.max(primaryStart + 0.6, Math.min(block.end, supportBeats[0].start - 0.08)))
    : round(Math.min(block.end, primaryStart + primaryOverlayDuration(block.recipeId, block.end - block.start)));

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
    role: block.recipeId === "cta_finish" ? "cta" : "semantic_accent",
    variant: fallbackApplied ? "safe" : block.scenePriority === "hero" ? "hero" : "standard"
  };

  return [primaryBeat, ...supportBeats];
}

function compileFullScene(block: DirectorPlanBlock, copyBlock: ScreenCopyBlock, summary: string): VisualScene {
  const recipeDef = getSceneRecipe(block.recipeId);
  return {
    id: `${block.id}-full`,
    start: round(block.start),
    duration: round(Math.max(recipeDef.duration.min, Math.min(recipeDef.duration.max, block.end - block.start))),
    sceneType: (recipeDef.visualMapping.fullSceneType ?? "pip_slide") as VisualScene["sceneType"],
    presetId: block.recipeId,
    layoutMode: recipeDef.visualMapping.layoutMode ?? "overlay",
    speakerMode: block.speakerMode,
    sourceText: summary,
    payload: buildFullScenePayload(block.recipeId, copyBlock.payload, summary) as Record<string, unknown>,
    safeRegionPolicy: block.speakerMode === "hidden" ? "full_frame" : block.speakerMode === "pip" ? "pip_safe" : "avoid_speaker",
    transitionIn: block.transitionIn === "wipe" ? "slide" : block.transitionIn === "cut" ? "fade" : block.transitionIn,
    transitionOut: block.transitionOut === "zoom" || block.transitionOut === "wipe" ? "slide" : block.transitionOut
  };
}

function buildFullScenePayload(recipeId: DirectorPlanBlock["recipeId"], payload: ScreenCopyBlock["payload"], summary: string) {
  const title = readText(payload.title ?? payload.text) ?? summary;
  const subtitle = readText(payload.subtitle ?? payload.caption);
  const items = normalizeItems(payload.items, summary);
  const [left, right] = splitPair(readText(payload.left), readText(payload.right), summary);
  const semanticSlots = payload.slots ?? [];
  const supportVisuals = payload.supportVisuals ?? [];
  const layerActions = payload.layerActions ?? [];

  if (recipeId === "comparison_split") {
    return {
      eyebrow: "COMPARE",
      left,
      right,
      caption: readText(payload.caption),
      semanticSlots,
      supportVisuals
    };
  }
  if (recipeId === "speaker_lower_half_top_visual") {
    return {
      eyebrow: "SEQUENCE",
      title,
      items,
      semanticSlots,
      layerActions
    };
  }
  if (recipeId === "speaker_right_panel_left_infographic") {
    return {
      eyebrow: "SYSTEM",
      value: readText(payload.value) ?? "01",
      label: readText(payload.label) ?? title,
      caption: subtitle,
      semanticSlots,
      supportVisuals
    };
  }
  if (recipeId === "trust_diagram") {
    return {
      eyebrow: "TRUST MAP",
      title,
      center: readText(payload.center) ?? "TRUST",
      left,
      right,
      supportVisuals
    };
  }
  if (recipeId === "voiceover_full_graphic") {
    return {
      eyebrow: "KEY POINTS",
      items,
      semanticSlots
    };
  }
  if (recipeId === "camera_punch_in") {
    return {
      eyebrow: "KEY IDEA",
      title,
      subtitle,
      layerActions
    };
  }
  return {
    ...payload,
    semanticSlots,
    supportVisuals,
    layerActions
  };
}

function buildSupportingSpeechBeats(
  block: DirectorPlanBlock,
  beats: SceneMicroBeat[],
  motionId: VisualBeat["motionId"],
  supportVisuals: NonNullable<ScreenCopyPayload["supportVisuals"]>
): VisualBeat[] {
  if (block.recipeId === "cta_finish" || block.recipeId === "clean_section_transition") return [];
  const selected = beats
    .filter((beat) => beat.start >= block.start + 0.9)
    .slice(0, block.scenePriority === "hero" ? 2 : 1);
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
        emphasis: beat.anchorText ?? "",
        supportVisuals: supportVisuals.filter((visual) => visual.start <= end && visual.end >= start)
      },
      sourceMomentId: block.blockId,
      role: "speech_text",
      variant: "compact"
    };
  });
}

function buildLayerPlan(block: DirectorPlanBlock, copyBlock: ScreenCopyBlock | undefined): SceneLayerPlan[] {
  const payload = copyBlock?.payload ?? {};
  const semanticLayers = buildLayersFromSemanticSlots(block, payload);
  if (semanticLayers.length > 0) return semanticLayers;
  const layers: SceneLayerPlan[] = [];
  if (payload.title || payload.text) {
    layers.push({
      id: `${block.blockId}-title`,
      kind: "title",
      emphasis: "primary",
      enabled: true,
      payload: { text: payload.title ?? payload.text }
    });
  }
  if (payload.subtitle || payload.caption) {
    layers.push({
      id: `${block.blockId}-subtitle`,
      kind: "subtitle",
      emphasis: "support",
      enabled: true,
      payload: { text: payload.subtitle ?? payload.caption }
    });
  }
  if (payload.value) {
    layers.push({
      id: `${block.blockId}-number`,
      kind: "number",
      emphasis: "dominant",
      enabled: true,
      payload: { value: payload.value, label: payload.label ?? payload.title }
    });
  }
  if (payload.items?.length) {
    layers.push({
      id: `${block.blockId}-checklist`,
      kind: "checklist",
      emphasis: "dominant",
      enabled: true,
      payload: { items: payload.items }
    });
  }
  if (payload.left || payload.right || payload.falseText || payload.trueText) {
    layers.push({
      id: `${block.blockId}-comparison`,
      kind: "comparison",
      emphasis: "dominant",
      enabled: true,
      payload: {
        left: payload.left ?? payload.falseText,
        right: payload.right ?? payload.trueText,
        caption: payload.caption ?? payload.label
      }
    });
  }
  if (payload.quote) {
    layers.push({
      id: `${block.blockId}-quote`,
      kind: "quote",
      emphasis: "dominant",
      enabled: true,
      payload: { quote: payload.quote, label: payload.label }
    });
  }
  if (payload.cta) {
    layers.push({
      id: `${block.blockId}-cta`,
      kind: "cta",
      emphasis: "dominant",
      enabled: true,
      payload: { text: payload.cta, label: payload.label ?? payload.title }
    });
  }
  if (layers.length === 0) {
    layers.push({
      id: `${block.blockId}-fallback`,
      kind: "supporting_text",
      emphasis: "support",
      enabled: true,
      payload: { text: payload.title ?? payload.text ?? "" }
    });
  }
  return layers;
}

function decoratePayloadForBeat(basePayload: Record<string, unknown>, anchorText: string | undefined, fallbackApplied: boolean) {
  const payload = { ...basePayload };
  if (!payload.text && anchorText) payload.text = anchorText;
  if (!payload.title && typeof payload.text === "string") payload.title = payload.text;
  if (Array.isArray(payload.slots) && anchorText) {
    payload.activeSlot = payload.slots.find((slot) => typeof slot === "object" && slot && (slot as { text?: string }).text?.includes(anchorText));
  }
  if (fallbackApplied) payload.subtext = payload.subtext ?? "safe mode";
  return payload;
}

function primaryOverlayDuration(recipeId: DirectorPlanBlock["recipeId"], duration: number) {
  if (recipeId === "cta_finish") return 1.8;
  if (recipeId === "clean_section_transition") return 1.1;
  return Math.min(1.8, Math.max(0.95, duration * 0.42));
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
  if (templateId === "checklist") return "checklist_steps";
  if (templateId === "myth_strike") return "myth_strike_redline";
  if (templateId === "cta_plate") return "cta_finish_clean";
  return "kinetic_phrase_clean";
}

function readText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}


function buildLayersFromSemanticSlots(block: DirectorPlanBlock, payload: ScreenCopyPayload): SceneLayerPlan[] {
  const slots = payload.slots ?? [];
  if (slots.length === 0) return [];

  const layers: SceneLayerPlan[] = [];
  const push = (kind: SceneLayerPlan["kind"], slotRoles: string[], emphasis: SceneLayerPlan["emphasis"] = "primary") => {
    const selected = slots.filter((slot) => slotRoles.includes(slot.role));
    if (selected.length === 0) return;
    layers.push({
      id: `${block.blockId}-${kind}`,
      kind,
      emphasis,
      enabled: true,
      payload: {
        slots: selected,
        text: selected.map((slot) => slot.shortText ?? slot.text).join(" "),
        supportVisuals: (payload.supportVisuals ?? []).filter((visual) => selected.some((slot) => slot.id === visual.anchorSlotId))
      }
    });
  };

  push("title", ["headline", "step_label"], "primary");
  push("number", ["hero_number", "step_index"], "dominant");
  push("comparison", ["wrong_phrase", "correct_phrase", "comparison_left", "comparison_right"], "dominant");
  push("quote", ["quote_pull"], "dominant");
  push("cta", ["cta_phrase", "command_hotkey"], "dominant");
  push("supporting_text", ["keyword_accent", "supporting_context", "command_hotkey"], "support");

  return layers;
}

function resolveRecipeForPayload(recipeId: DirectorPlanBlock["recipeId"], payload: ScreenCopyPayload, fallbackRecipeId?: DirectorPlanBlock["recipeId"]) {
  const recipe = getSceneRecipe(recipeId);
  const slotRoles = new Set((payload.slots ?? []).map((slot) => slot.role));
  const satisfies = recipe.requiredSlotRoles.every((role) => slotRoles.has(role));
  if (satisfies) return recipeId;
  return fallbackRecipeId ?? recipe.fallbackRecipeId ?? recipeId;
}

function normalizeItems(items: unknown, summary: string) {
  if (!Array.isArray(items) || items.length === 0) return [summary];
  return items.map((item) => String(item)).filter(Boolean).slice(0, 4);
}

function splitPair(left: string | undefined, right: string | undefined, summary: string) {
  if (left && right) return [left, right] as const;
  const parts = summary.split(/\s+/);
  return [left ?? parts.slice(0, 2).join(" "), right ?? (parts.slice(2).join(" ") || summary)] as const;
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
