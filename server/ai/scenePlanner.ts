import type {
  ContentPlan,
  SceneLayerPlan,
  ScenePlan,
  ScenePlanBlock,
  SemanticBlock,
  SpeakerMode,
  StylePreset
} from "@/lib/types";
import { getAiConfigForTask } from "@/lib/config";
import { callChatCompletion } from "@/server/ai/openRouterClient";
import { recordAiUsage } from "@/server/ai/usage";
import { buildScenePlannerSystemPrompt, buildScenePlannerUserPrompt } from "@/server/ai/scenePlannerPrompts";
import { scenePlanSchema } from "@/server/scene/scenePlanSchema";
import type { TemplateSceneCapabilities } from "@/server/scene/sceneCompatibility";
import { getSceneRecipe, listSceneRecipesForBlockType } from "@/server/scene/sceneLibrary";
import { buildMicroBeatsForBlock } from "@/server/scene/microBeatPlanner";

export const SCENE_PLAN_VERSION = "v1";

interface BuildScenePlanInput {
  semanticBlocks: SemanticBlock[];
  contentPlan: ContentPlan;
  styleProfileId: StylePreset;
  capabilities: TemplateSceneCapabilities;
}

export async function buildScenePlan(
  input: BuildScenePlanInput,
  projectId?: string,
  log?: (message: string) => Promise<void> | void
): Promise<ScenePlan> {
  const fallbackPlan = buildDeterministicScenePlan(input);
  const config = getAiConfigForTask("visual_planner");
  if (!config.apiKey) {
    await log?.("AI scene planner skipped: API key is not configured; using deterministic block planner.");
    return fallbackPlan;
  }

  try {
    const result = await callChatCompletion(
      config,
      buildScenePlannerSystemPrompt(),
      buildScenePlannerUserPrompt(input.semanticBlocks, input.contentPlan, input.capabilities)
    );
    await recordAiUsage({ projectId, source: "hyperframes", phase: "scene_planner", result });
    const parsed = parseAiScenePlan(result.content, input, fallbackPlan);
    await log?.(`AI scene planner produced ${parsed.blocks.length} block scenes.`);
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await log?.(`AI scene planner failed; using deterministic block planner. Original error: ${message}`);
    return fallbackPlan;
  }
}

export function buildDeterministicScenePlan(input: BuildScenePlanInput): ScenePlan {
  const initialBlocks = input.semanticBlocks.map((block, index) => buildPlanBlock(block, index, input));
  const { blocks, changedCount } = rebalanceMontageRecipes(initialBlocks, input);
  return {
    version: SCENE_PLAN_VERSION,
    templateId: input.capabilities.templateId,
    templateName: input.capabilities.templateName,
    styleProfileId: input.styleProfileId,
    planner: "deterministic",
    semanticBlocks: input.semanticBlocks,
    blocks,
    diagnostics: [
      `Built ${input.semanticBlocks.length} semantic blocks.`,
      `Allowed recipes: ${input.capabilities.allowedRecipeIds.join(", ")}`,
      `Montage rebalance swapped ${changedCount} adjacent repeated recipes.`
    ]
  };
}

function buildPlanBlock(block: SemanticBlock, index: number, input: BuildScenePlanInput): ScenePlanBlock {
  const allowedRecipes = listSceneRecipesForBlockType(block.type)
    .filter((recipeDef) => input.capabilities.allowedRecipeIds.includes(recipeDef.id));
  const preferredRecipeId = defaultRecipeForBlock(block.type, input.capabilities);
  const recipeDef = allowedRecipes.find((recipeDef) => recipeDef.id === preferredRecipeId)
    ?? allowedRecipes[0]
    ?? getSceneRecipe(preferredRecipeId);
  const words = extractWordsForBlock(block);
  const microBeats = buildMicroBeatsForBlock(block, words).slice(0, recipeDef.microBeatCapacity.max);

  return {
    id: `scene-plan-${String(index + 1).padStart(3, "0")}`,
    blockId: block.id,
    blockType: block.type,
    sceneCategory: recipeDef.category,
    recipeId: recipeDef.id,
    speakerMode: defaultSpeakerMode(recipeDef.allowedSpeakerModes),
    layerPlan: buildLayerPlan(block, recipeDef.id),
    microBeats,
    intensity: block.type === "hook" || block.type === "cta" ? "strong" : block.type === "warning" ? "balanced" : "safe",
    transitionIn: index === 0 ? "zoom" : recipeDef.category === "transition_scene" ? "wipe" : "fade",
    transitionOut: block.type === "transition" ? "wipe" : "fade",
    start: block.start,
    end: block.end,
    rationale: `Deterministic selection for ${block.type}.`,
    fallbackRecipeId: recipeDef.fallbackRecipeId,
    safeMode: false,
    allowedRecipeIds: allowedRecipes.map((entry) => entry.id),
    recommendedRecipeId: recipeDef.id
  };
}

function buildLayerPlan(block: SemanticBlock, recipeId: ScenePlanBlock["recipeId"]): SceneLayerPlan[] {
  const baseLayers: SceneLayerPlan[] = [
    {
      id: `${block.id}-title`,
      kind: "title",
      emphasis: "primary",
      enabled: true,
      payload: { text: block.summary }
    },
    {
      id: `${block.id}-subtitle`,
      kind: "subtitle",
      emphasis: "support",
      enabled: block.wordCount > 5,
      payload: { text: block.text }
    }
  ];

  if (recipeId === "checklist_reveal") {
    return [
      ...baseLayers,
      {
        id: `${block.id}-checklist`,
        kind: "checklist",
        emphasis: "dominant",
        enabled: true,
        payload: { items: splitItems(block.text) }
      }
    ];
  }
  if (recipeId === "comparison_split" || recipeId === "myth_vs_truth") {
    const [left, right] = splitItems(block.text);
    return [
      ...baseLayers,
      {
        id: `${block.id}-comparison`,
        kind: "comparison",
        emphasis: "dominant",
        enabled: true,
        payload: { left: left ?? block.summary, right: right ?? block.text }
      }
    ];
  }
  if (recipeId === "big_number_grow" || recipeId === "big_number_plus_text_plate") {
    return [
      ...baseLayers,
      {
        id: `${block.id}-number`,
        kind: "number",
        emphasis: "dominant",
        enabled: true,
        payload: { value: firstNumber(block.text) ?? "1", label: block.summary }
      }
    ];
  }
  if (recipeId === "cta_finish") {
    return [
      {
        id: `${block.id}-cta`,
        kind: "cta",
        emphasis: "dominant",
        enabled: true,
        payload: { text: block.text }
      }
    ];
  }
  if (recipeId === "clean_section_transition") {
    return [
      {
        id: `${block.id}-transition`,
        kind: "transition",
        emphasis: "primary",
        enabled: true,
        payload: { title: block.summary }
      }
    ];
  }
  return baseLayers;
}

function parseAiScenePlan(raw: string, input: BuildScenePlanInput, fallbackPlan: ScenePlan): ScenePlan {
  const parsed = parseJsonObject(raw);
  const aiBlocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];
  const mergedBlocks = fallbackPlan.blocks.map((fallbackBlock) => {
    const candidate = aiBlocks.find((item) => item && typeof item === "object" && (item as Record<string, unknown>).blockId === fallbackBlock.blockId);
    if (!candidate || typeof candidate !== "object") return fallbackBlock;
    const item = candidate as Record<string, unknown>;
    const recipeId = typeof item.recipeId === "string" && input.capabilities.allowedRecipeIds.includes(item.recipeId as ScenePlanBlock["recipeId"])
      ? item.recipeId as ScenePlanBlock["recipeId"]
      : fallbackBlock.recipeId;
    const recipeDef = getSceneRecipe(recipeId);
    return {
      ...fallbackBlock,
      recipeId,
      sceneCategory: recipeDef.category,
      speakerMode: typeof item.speakerMode === "string" && recipeDef.allowedSpeakerModes.includes(item.speakerMode as SpeakerMode)
        ? item.speakerMode as SpeakerMode
        : fallbackBlock.speakerMode,
      intensity: item.intensity === "safe" || item.intensity === "balanced" || item.intensity === "strong"
        ? item.intensity
        : fallbackBlock.intensity,
      transitionIn: parseTransition(item.transitionIn, fallbackBlock.transitionIn),
      transitionOut: parseTransition(item.transitionOut, fallbackBlock.transitionOut),
      rationale: typeof item.rationale === "string" ? item.rationale : fallbackBlock.rationale
    };
  });

  const scenePlan = {
    ...fallbackPlan,
    planner: "ai" as const,
    blocks: rebalanceMontageRecipes(mergedBlocks, input).blocks
  };
  scenePlanSchema.parse(scenePlan);
  return scenePlan;
}

function rebalanceMontageRecipes(blocks: ScenePlanBlock[], input: BuildScenePlanInput) {
  let changedCount = 0;
  const rebalanced = blocks.map((block, index) => {
    const previous = index > 0 ? blocks[index - 1] : undefined;
    if (!previous || previous.recipeId !== block.recipeId) return block;

    const semanticBlock = input.semanticBlocks.find((entry) => entry.id === block.blockId);
    if (!semanticBlock) return block;

    const alternativeRecipeId = pickAlternativeRecipeId(block, previous, input);
    if (!alternativeRecipeId || alternativeRecipeId === block.recipeId) return block;

    const alternativeRecipe = getSceneRecipe(alternativeRecipeId);
    changedCount += 1;

    return {
      ...block,
      recipeId: alternativeRecipe.id,
      sceneCategory: alternativeRecipe.category,
      layerPlan: buildLayerPlan(semanticBlock, alternativeRecipe.id),
      speakerMode: defaultSpeakerMode(alternativeRecipe.allowedSpeakerModes),
      fallbackRecipeId: alternativeRecipe.fallbackRecipeId,
      recommendedRecipeId: alternativeRecipe.id,
      rationale: `${block.rationale} Rebalanced from ${block.recipeId} to ${alternativeRecipe.id} to avoid adjacent repeated scene recipes.`
    };
  });

  return { blocks: rebalanced, changedCount };
}

function pickAlternativeRecipeId(
  block: ScenePlanBlock,
  previous: ScenePlanBlock,
  input: BuildScenePlanInput
) {
  const preferredCandidates = [
    block.fallbackRecipeId,
    ...(block.allowedRecipeIds ?? [])
  ].filter((recipeId): recipeId is ScenePlanBlock["recipeId"] => Boolean(recipeId));

  for (const recipeId of preferredCandidates) {
    if (recipeId === block.recipeId || recipeId === previous.recipeId) continue;
    if (!input.capabilities.allowedRecipeIds.includes(recipeId)) continue;
    return recipeId;
  }

  const semanticBlock = input.semanticBlocks.find((entry) => entry.id === block.blockId);
  if (!semanticBlock) return undefined;

  const fallbackCandidates = listSceneRecipesForBlockType(semanticBlock.type)
    .map((recipeDef) => recipeDef.id)
    .filter((recipeId) => input.capabilities.allowedRecipeIds.includes(recipeId));

  return fallbackCandidates.find((recipeId) => recipeId !== block.recipeId && recipeId !== previous.recipeId);
}

function parseTransition(value: unknown, fallback: ScenePlanBlock["transitionIn"]) {
  return value === "fade" || value === "slide" || value === "zoom" || value === "wipe" || value === "cut"
    ? value
    : fallback;
}

function parseJsonObject(raw: string) {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("AI scene planner returned non-JSON content.");
    }
    return JSON.parse(match[0]) as Record<string, unknown>;
  }
}

function defaultRecipeForBlock(blockType: SemanticBlock["type"], capabilities: TemplateSceneCapabilities) {
  if (blockType === "hook") return capabilities.preferredHookRecipeId;
  if (blockType === "cta") return capabilities.preferredCtaRecipeId;
  if (blockType === "list") return "checklist_reveal";
  if (blockType === "comparison" || blockType === "myth_vs_truth") return "comparison_split";
  if (blockType === "warning") return "big_number_plus_text_plate";
  if (blockType === "proof") return capabilities.fullSceneEnabled ? "speaker_right_panel_left_infographic" : "big_number_grow";
  if (blockType === "transition") return "clean_section_transition";
  if (blockType === "definition") return capabilities.fullSceneEnabled ? "voiceover_full_graphic" : "definition_card";
  if (blockType === "timeline") return "timeline_year_callout";
  return capabilities.fullSceneEnabled ? "speaker_lower_half_top_visual" : "hook_title_left";
}

function defaultSpeakerMode(allowed: SpeakerMode[]) {
  return allowed.includes("reframed") ? "reframed" : allowed[0] ?? "full_frame";
}

function splitItems(text: string) {
  return text
    .split(/[,:;]| и | and /i)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function firstNumber(text: string) {
  return text.match(/\d+[.,]?\d*%?/u)?.[0];
}

function extractWordsForBlock(block: SemanticBlock) {
  return block.text.split(/\s+/).filter(Boolean).map((word, index) => ({
    word,
    start: block.start + index * Math.max((block.end - block.start) / Math.max(block.wordCount, 1), 0.12),
    end: Math.min(block.end, block.start + (index + 1) * Math.max((block.end - block.start) / Math.max(block.wordCount, 1), 0.12))
  }));
}
