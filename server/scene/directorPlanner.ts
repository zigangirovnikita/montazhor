import type {
  ContentPlan,
  DirectorPlan,
  DirectorPlanBlock,
  PlanningConfidence,
  SemanticBlock,
  SpeakerMode,
  StylePreset
} from "@/lib/types";
import { getAiConfigForTask } from "@/lib/config";
import { callChatCompletion } from "@/server/ai/openRouterClient";
import { buildDirectorPlannerSystemPrompt, buildDirectorPlannerUserPrompt } from "@/server/ai/directorPlannerPrompts";
import { choosePreferredRecipe, defaultSpeakerModeForRecipe } from "@/server/ai/scenePlannerHeuristics";
import { recordAiUsage } from "@/server/ai/usage";
import type { TemplateSceneCapabilities } from "@/server/scene/sceneCompatibility";
import { directorPlanSchema } from "@/server/scene/scenePlanSchema";
import { getSceneRecipe, listSceneRecipesForBlockType } from "@/server/scene/sceneLibrary";

export const DIRECTOR_PLAN_VERSION = "v1";
const MAX_HERO_SCENES = 8;

interface BuildDirectorPlanInput {
  semanticBlocks: SemanticBlock[];
  contentPlan: ContentPlan;
  styleProfileId: StylePreset;
  capabilities: TemplateSceneCapabilities;
}

export async function buildDirectorPlan(
  input: BuildDirectorPlanInput,
  projectId?: string,
  log?: (message: string) => Promise<void> | void
): Promise<DirectorPlan> {
  const fallbackPlan = buildDeterministicDirectorPlan(input);
  const config = getAiConfigForTask("visual_planner");
  if (!config.apiKey) {
    await log?.("Director planner: API key is not configured; using deterministic plan.");
    return fallbackPlan;
  }

  try {
    const result = await callChatCompletion(
      config,
      buildDirectorPlannerSystemPrompt(),
      buildDirectorPlannerUserPrompt(input.semanticBlocks, input.contentPlan, input.capabilities)
    );
    await recordAiUsage({ projectId, source: "hyperframes", phase: "director_planner", result });
    const parsed = parseAiDirectorPlan(result.content, input, fallbackPlan);
    await log?.(`Director planner produced ${parsed.blocks.length} blocks.`);
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await log?.(`Director planner failed; using deterministic plan. Original error: ${message}`);
    return fallbackPlan;
  }
}

export function buildDeterministicDirectorPlan(input: BuildDirectorPlanInput): DirectorPlan {
  const initialBlocks = input.semanticBlocks.map((block, index) => buildDirectorBlock(block, index, input));
  const normalizedBlocks = normalizeDirectorStructure(initialBlocks, input);
  const plan: DirectorPlan = {
    version: DIRECTOR_PLAN_VERSION,
    templateId: input.capabilities.templateId,
    templateName: input.capabilities.templateName,
    styleProfileId: input.styleProfileId,
    planner: "deterministic",
    semanticBlocks: input.semanticBlocks,
    blocks: normalizedBlocks,
    diagnostics: [
      `Built ${input.semanticBlocks.length} semantic blocks.`,
      `Allowed recipes: ${input.capabilities.allowedRecipeIds.join(", ")}`,
      `Hero scene cap: ${MAX_HERO_SCENES}.`
    ]
  };
  directorPlanSchema.parse(plan);
  return plan;
}

function buildDirectorBlock(block: SemanticBlock, index: number, input: BuildDirectorPlanInput): DirectorPlanBlock {
  const allowedRecipes = listSceneRecipesForBlockType(block.type)
    .filter((recipeDef) => input.capabilities.allowedRecipeIds.includes(recipeDef.id));
  const preferredRecipeId = choosePreferredRecipe(block, index, input.capabilities);
  const recipeDef = allowedRecipes.find((recipeDef) => recipeDef.id === preferredRecipeId)
    ?? allowedRecipes[0]
    ?? getSceneRecipe(preferredRecipeId);
  const scenePriority = chooseScenePriority(block, index, input.semanticBlocks.length);
  const sceneDensity = chooseSceneDensity(block, scenePriority);
  const visualRole = chooseVisualRole(block, scenePriority);
  const confidence = buildConfidence(block, recipeDef.id, scenePriority, allowedRecipes.length, false);

  return {
    id: `director-${String(index + 1).padStart(3, "0")}`,
    blockId: block.id,
    blockType: block.type,
    sceneCategory: recipeDef.category,
    recipeId: recipeDef.id,
    speakerMode: pickSpeakerMode(recipeDef.allowedSpeakerModes, scenePriority),
    intensity: scenePriority === "hero" ? "strong" : block.type === "warning" ? "balanced" : "safe",
    scenePriority,
    sceneDensity,
    visualRole,
    holdStrategy: chooseHoldStrategy(block, scenePriority),
    transitionIn: index === 0 ? "zoom" : block.type === "transition" ? "wipe" : "fade",
    transitionOut: block.type === "transition" ? "wipe" : scenePriority === "hero" ? "slide" : "fade",
    start: block.start,
    end: block.end,
    rationale: `Deterministic director choice for ${block.type}.`,
    fallbackRecipeId: recipeDef.fallbackRecipeId,
    safeMode: false,
    disabled: scenePriority === "skip",
    allowedRecipeIds: allowedRecipes.map((entry) => entry.id),
    recommendedRecipeId: recipeDef.id,
    planningConfidence: confidence
  };
}

function normalizeDirectorStructure(blocks: DirectorPlanBlock[], input: BuildDirectorPlanInput): DirectorPlanBlock[] {
  const rebalanced = rebalanceAdjacentRecipes(blocks, input);
  let heroCount = 0;
  return rebalanced.map((block) => {
    if (block.scenePriority !== "hero") return block;
    heroCount += 1;
    if (heroCount <= MAX_HERO_SCENES) return block;
    return {
      ...block,
      scenePriority: "support",
      sceneDensity: "balanced",
      visualRole: "support_overlay",
      intensity: "balanced",
      holdStrategy: "carry_with_microbeats",
      planningConfidence: downgradeConfidence(block.planningConfidence, "hero scene cap applied")
    };
  });
}

function rebalanceAdjacentRecipes(blocks: DirectorPlanBlock[], input: BuildDirectorPlanInput): DirectorPlanBlock[] {
  return blocks.map((block, index) => {
    const previous = index > 0 ? blocks[index - 1] : undefined;
    if (!previous || previous.recipeId !== block.recipeId) return block;
    const alternativeRecipeId = pickAlternativeRecipeId(block, previous, input);
    if (!alternativeRecipeId || alternativeRecipeId === block.recipeId) {
      return {
        ...block,
        planningConfidence: downgradeConfidence(block.planningConfidence, "repeated recipe fallback")
      };
    }
    const alternativeRecipe = getSceneRecipe(alternativeRecipeId);
    return {
      ...block,
      recipeId: alternativeRecipe.id,
      sceneCategory: alternativeRecipe.category,
      speakerMode: pickSpeakerMode(alternativeRecipe.allowedSpeakerModes, block.scenePriority),
      fallbackRecipeId: alternativeRecipe.fallbackRecipeId,
      recommendedRecipeId: alternativeRecipe.id,
      rationale: `${block.rationale} Rebalanced from ${block.recipeId} to ${alternativeRecipe.id} to avoid repeated montage treatment.`
    };
  });
}

function pickAlternativeRecipeId(
  block: DirectorPlanBlock,
  previous: DirectorPlanBlock,
  input: BuildDirectorPlanInput
) {
  const candidates = [block.fallbackRecipeId, ...(block.allowedRecipeIds ?? [])].filter(Boolean) as DirectorPlanBlock["recipeId"][];
  for (const recipeId of candidates) {
    if (recipeId === block.recipeId || recipeId === previous.recipeId) continue;
    if (!input.capabilities.allowedRecipeIds.includes(recipeId)) continue;
    return recipeId;
  }

  const semanticBlock = input.semanticBlocks.find((entry) => entry.id === block.blockId);
  if (!semanticBlock) return undefined;
  return listSceneRecipesForBlockType(semanticBlock.type)
    .map((recipeDef) => recipeDef.id)
    .find((recipeId) => recipeId !== block.recipeId && recipeId !== previous.recipeId && input.capabilities.allowedRecipeIds.includes(recipeId));
}

function parseAiDirectorPlan(raw: string, input: BuildDirectorPlanInput, fallbackPlan: DirectorPlan): DirectorPlan {
  const parsed = parseJsonObject(raw);
  const aiBlocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];
  const mergedBlocks = fallbackPlan.blocks.map((fallbackBlock) => {
    const candidate = aiBlocks.find((item) => item && typeof item === "object" && (item as Record<string, unknown>).blockId === fallbackBlock.blockId);
    if (!candidate || typeof candidate !== "object") return fallbackBlock;
    const item = candidate as Record<string, unknown>;
    const recipeId = typeof item.recipeId === "string" && input.capabilities.allowedRecipeIds.includes(item.recipeId as DirectorPlanBlock["recipeId"])
      ? item.recipeId as DirectorPlanBlock["recipeId"]
      : fallbackBlock.recipeId;
    const recipe = getSceneRecipe(recipeId);
    const scenePriority = parseScenePriority(item.scenePriority, fallbackBlock.scenePriority);
    const aiBlock: DirectorPlanBlock = {
      ...fallbackBlock,
      recipeId,
      sceneCategory: recipe.category,
      speakerMode: parseSpeakerMode(item.speakerMode, recipe.allowedSpeakerModes, fallbackBlock.speakerMode),
      intensity: parseIntensity(item.intensity, fallbackBlock.intensity),
      scenePriority,
      sceneDensity: parseSceneDensity(item.sceneDensity, fallbackBlock.sceneDensity),
      visualRole: parseVisualRole(item.visualRole, fallbackBlock.visualRole),
      holdStrategy: parseHoldStrategy(item.holdStrategy, fallbackBlock.holdStrategy),
      transitionIn: parseTransition(item.transitionIn, fallbackBlock.transitionIn),
      transitionOut: parseTransition(item.transitionOut, fallbackBlock.transitionOut),
      rationale: typeof item.rationale === "string" ? item.rationale : fallbackBlock.rationale,
      planningConfidence: buildConfidence(
        input.semanticBlocks.find((entry) => entry.id === fallbackBlock.blockId) ?? input.semanticBlocks[0]!,
        recipeId,
        scenePriority,
        fallbackBlock.allowedRecipeIds?.length ?? 1,
        true
      )
    };
    return aiBlock;
  });

  const scenePlan: DirectorPlan = {
    ...fallbackPlan,
    planner: "ai" as const,
    blocks: normalizeDirectorStructure(mergedBlocks, input)
  };
  directorPlanSchema.parse(scenePlan);
  return scenePlan;
}

function chooseScenePriority(block: SemanticBlock, index: number, total: number): DirectorPlanBlock["scenePriority"] {
  if (block.type === "cta" || block.type === "hook") return "hero";
  if (block.type === "transition") return "ambient";
  if (block.type === "warning" || block.type === "comparison" || block.type === "myth_vs_truth") return "hero";
  if (block.type === "proof" || block.type === "list" || block.type === "definition") return "support";
  if (block.wordCount <= 5 && index > 0 && index < total - 1) return "ambient";
  return "support";
}

function chooseSceneDensity(block: SemanticBlock, scenePriority: DirectorPlanBlock["scenePriority"]): DirectorPlanBlock["sceneDensity"] {
  if (scenePriority === "hero") return block.wordCount > 20 ? "balanced" : "minimal";
  if (block.type === "list" || block.type === "timeline") return "dense";
  return "balanced";
}

function chooseVisualRole(block: SemanticBlock, scenePriority: DirectorPlanBlock["scenePriority"]): DirectorPlanBlock["visualRole"] {
  if (block.type === "transition") return "transition_scene";
  if (scenePriority === "hero") return "hero_scene";
  if (scenePriority === "ambient") return "micro_emphasis";
  if (scenePriority === "skip") return "none";
  return "support_overlay";
}

function chooseHoldStrategy(block: SemanticBlock, scenePriority: DirectorPlanBlock["scenePriority"]): DirectorPlanBlock["holdStrategy"] {
  if (block.type === "transition") return "transition_bridge";
  if (scenePriority === "hero") return "readable_hold";
  if (block.wordCount > 18) return "carry_with_microbeats";
  return "quick_punctuate";
}

function pickSpeakerMode(allowedSpeakerModes: SpeakerMode[], scenePriority: DirectorPlanBlock["scenePriority"]) {
  if (scenePriority === "hero" && allowedSpeakerModes.includes("pip")) return "pip";
  if (scenePriority === "ambient" && allowedSpeakerModes.includes("hidden")) return "hidden";
  return defaultSpeakerModeForRecipe(allowedSpeakerModes);
}

function buildConfidence(
  block: SemanticBlock,
  recipeId: DirectorPlanBlock["recipeId"],
  scenePriority: DirectorPlanBlock["scenePriority"],
  allowedRecipeCount: number,
  aiPlanned: boolean
): PlanningConfidence {
  const reasons: string[] = [];
  let score = 0.86;

  if (block.type === "example") {
    reasons.push("generic example classification");
    score -= 0.18;
  }
  if (block.wordCount > 24) {
    reasons.push("long spoken block needs stronger compression");
    score -= 0.16;
  }
  if (allowedRecipeCount <= 1) {
    reasons.push("single allowed recipe path");
    score -= 0.1;
  }
  if (scenePriority === "hero" && block.wordCount < 5) {
    reasons.push("short block promoted to hero");
    score -= 0.08;
  }
  if (recipeId === "hook_title_left") {
    reasons.push("generic recipe fallback");
    score -= 0.08;
  }
  if (aiPlanned) score += 0.04;

  const clamped = Math.max(0.2, Math.min(0.98, Number(score.toFixed(2))));
  return {
    level: clamped >= 0.8 ? "high" : clamped >= 0.58 ? "medium" : "low",
    score: clamped,
    reasons,
    escalationPolicy: clamped < 0.58 ? "enhanced_ai" : "none"
  };
}

function downgradeConfidence(confidence: PlanningConfidence, reason: string): PlanningConfidence {
  const score = Math.max(0.2, Number((confidence.score - 0.12).toFixed(2)));
  return {
    level: score >= 0.8 ? "high" : score >= 0.58 ? "medium" : "low",
    score,
    reasons: [...confidence.reasons, reason],
    escalationPolicy: score < 0.58 ? "review_queue" : confidence.escalationPolicy
  };
}

function parseScenePriority(value: unknown, fallback: DirectorPlanBlock["scenePriority"]) {
  return value === "hero" || value === "support" || value === "ambient" || value === "skip" ? value : fallback;
}

function parseSceneDensity(value: unknown, fallback: DirectorPlanBlock["sceneDensity"]) {
  return value === "minimal" || value === "balanced" || value === "dense" ? value : fallback;
}

function parseVisualRole(value: unknown, fallback: DirectorPlanBlock["visualRole"]) {
  return value === "hero_scene" || value === "support_overlay" || value === "micro_emphasis" || value === "transition_scene" || value === "none"
    ? value
    : fallback;
}

function parseHoldStrategy(value: unknown, fallback: DirectorPlanBlock["holdStrategy"]) {
  return value === "readable_hold" || value === "carry_with_microbeats" || value === "quick_punctuate" || value === "transition_bridge"
    ? value
    : fallback;
}

function parseSpeakerMode(value: unknown, allowed: SpeakerMode[], fallback: SpeakerMode) {
  return typeof value === "string" && allowed.includes(value as SpeakerMode) ? value as SpeakerMode : fallback;
}

function parseIntensity(value: unknown, fallback: DirectorPlanBlock["intensity"]) {
  return value === "safe" || value === "balanced" || value === "strong" ? value : fallback;
}

function parseTransition(value: unknown, fallback: DirectorPlanBlock["transitionIn"]) {
  return value === "fade" || value === "slide" || value === "zoom" || value === "wipe" || value === "cut" ? value : fallback;
}

function parseJsonObject(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("Director planner returned invalid JSON.");
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
}
