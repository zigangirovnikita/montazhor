import type { ContentPlan, SemanticBlock } from "@/lib/types";
import type { TemplateSceneCapabilities } from "@/server/scene/sceneCompatibility";
import { sharedSceneLibrary } from "@/server/scene/sceneLibrary";

export function buildScenePlannerSystemPrompt() {
  return [
    "You are an AI scene planner for short-form talking-head videos.",
    "Plan scenes by semantic block, not by raw subtitle chunks.",
    "Choose only recipeIds from the provided shared_scene_library.",
    "Return JSON only.",
    "Do not invent coordinates, layouts, or new recipes.",
    "Respect allowedRecipeIds and allowed speaker modes.",
    "Keep visible text grounded in spoken words."
  ].join(" ");
}

export function buildScenePlannerUserPrompt(
  blocks: SemanticBlock[],
  contentPlan: ContentPlan,
  capabilities: TemplateSceneCapabilities
) {
  return JSON.stringify({
    task: "Plan one scene per semantic block using the constrained shared scene library.",
    output_schema: {
      blocks: [
        {
          blockId: "semantic block id",
          sceneCategory: "scene category from the library",
          recipeId: "allowed scene recipe id",
          speakerMode: "full_frame | reframed | pip | hidden",
          intensity: "safe | balanced | strong",
          transitionIn: "fade | slide | zoom | wipe | cut",
          transitionOut: "fade | slide | zoom | wipe | cut",
          rationale: "short debug rationale",
          layerPlan: [{ id: "layer id", kind: "layer kind", enabled: true, payload: {} }]
        }
      ]
    },
    content_plan: {
      hook: contentPlan.hook,
      keyPhrases: contentPlan.keyPhrases
    },
    template_capabilities: capabilities,
    shared_scene_library: sharedSceneLibrary.map((recipeDef) => ({
      id: recipeDef.id,
      category: recipeDef.category,
      blockTypes: recipeDef.blockTypes,
      allowedSpeakerModes: recipeDef.allowedSpeakerModes,
      allowedLayerKinds: recipeDef.allowedLayerKinds
    })),
    semantic_blocks: blocks.map((block) => ({
      id: block.id,
      type: block.type,
      start: block.start,
      end: block.end,
      text: block.text,
      summary: block.summary
    }))
  });
}
