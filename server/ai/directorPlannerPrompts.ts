import type { ContentPlan, SemanticBlock } from "@/lib/types";
import type { TemplateSceneCapabilities } from "@/server/scene/sceneCompatibility";
import { sharedSceneLibrary } from "@/server/scene/sceneLibrary";

export function buildDirectorPlannerSystemPrompt() {
  return [
    "You are a director planner for short-form talking-head videos.",
    "Return JSON only.",
    "Decide which blocks deserve hero scenes versus support overlays.",
    "Choose only recipeIds from the provided recipe vocabulary.",
    "Do not generate HTML, CSS, coordinates, or renderer code.",
    "Prefer fewer strong hero scenes with readable holds.",
    "Use support or ambient treatment for weaker blocks instead of forcing every block into a hero scene."
  ].join(" ");
}

export function buildDirectorPlannerUserPrompt(
  blocks: SemanticBlock[],
  contentPlan: ContentPlan,
  capabilities: TemplateSceneCapabilities
) {
  return JSON.stringify({
    task: "Plan cinematic structure for semantic blocks using the constrained recipe vocabulary.",
    output_schema: {
      blocks: [
        {
          blockId: "semantic block id",
          recipeId: "allowed recipe id",
          speakerMode: "full_frame | reframed | pip | hidden",
          intensity: "safe | balanced | strong",
          scenePriority: "hero | support | ambient | skip",
          sceneDensity: "minimal | balanced | dense",
          visualRole: "hero_scene | support_overlay | micro_emphasis | transition_scene | none",
          holdStrategy: "readable_hold | carry_with_microbeats | quick_punctuate | transition_bridge",
          transitionIn: "fade | slide | zoom | wipe | cut",
          transitionOut: "fade | slide | zoom | wipe | cut",
          rationale: "short debug rationale"
        }
      ]
    },
    content_plan: {
      hook: contentPlan.hook,
      keyPhrases: contentPlan.keyPhrases.slice(0, 8)
    },
    template_capabilities: {
      templateId: capabilities.templateId,
      templateName: capabilities.templateName,
      fullSceneEnabled: capabilities.fullSceneEnabled,
      preferredHookRecipeId: capabilities.preferredHookRecipeId,
      preferredCtaRecipeId: capabilities.preferredCtaRecipeId,
      allowedRecipeIds: capabilities.allowedRecipeIds
    },
    recipe_vocabulary: sharedSceneLibrary
      .filter((recipe) => capabilities.allowedRecipeIds.includes(recipe.id))
      .map((recipe) => ({
        id: recipe.id,
        category: recipe.category,
        blockTypes: recipe.blockTypes,
        speakerModes: recipe.allowedSpeakerModes,
        durationRange: recipe.duration
      })),
    semantic_blocks: blocks.map((block) => ({
      id: block.id,
      type: block.type,
      duration: Number((block.end - block.start).toFixed(2)),
      summary: block.summary,
      text: block.text,
      contextBefore: block.contextBefore,
      contextAfter: block.contextAfter
    }))
  });
}
