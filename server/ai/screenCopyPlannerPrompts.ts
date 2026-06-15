import type { ContentPlan, DirectorPlan, SemanticBlock } from "@/lib/types";
import { getSceneRecipe } from "@/server/scene/sceneLibrary";

export function buildScreenCopyPlannerSystemPrompt() {
  return [
    "You write on-screen copy for short-form talking-head motion recipes.",
    "Return JSON only.",
    "Compress spoken meaning into short screen-ready slot text.",
    "Do not paste long transcript phrases.",
    "Use only the slot fields that fit the chosen recipe.",
    "Prefer concrete labels, contrasts, numbers, and CTA phrasing over subtitle-like sentences."
  ].join(" ");
}

export function buildScreenCopyPlannerUserPrompt(
  semanticBlocks: SemanticBlock[],
  directorPlan: DirectorPlan,
  contentPlan: ContentPlan
) {
  return JSON.stringify({
    task: "Generate screen copy payloads for the chosen recipe of each block.",
    output_schema: {
      blocks: [
        {
          blockId: "semantic block id",
          copyCompressionMode: "headline | labelled | bullet | contrast | cta",
          payload: {
            title: "optional",
            subtitle: "optional",
            left: "optional",
            right: "optional",
            items: ["optional"],
            label: "optional",
            cta: "optional",
            value: "optional",
            caption: "optional",
            falseText: "optional",
            trueText: "optional",
            quote: "optional",
            center: "optional"
          },
          rationale: "short debug rationale"
        }
      ]
    },
    content_plan: {
      hook: contentPlan.hook,
      keyPhrases: contentPlan.keyPhrases.slice(0, 8),
      titleSuggestions: contentPlan.titleSuggestions.slice(0, 3)
    },
    blocks: directorPlan.blocks.map((block) => {
      const semanticBlock = semanticBlocks.find((entry) => entry.id === block.blockId);
      const recipe = getSceneRecipe(block.recipeId);
      return {
        blockId: block.blockId,
        type: block.blockType,
        recipeId: block.recipeId,
        recipeCategory: recipe.category,
        allowedSpeakerModes: recipe.allowedSpeakerModes,
        transcript: semanticBlock?.text ?? "",
        summary: semanticBlock?.summary ?? "",
        maxReadableItems: 4
      };
    })
  });
}
