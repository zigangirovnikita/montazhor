import type { ContentPlan, DirectorPlan, SemanticBlock } from "@/lib/types";
import { getSceneRecipe } from "@/server/scene/sceneLibrary";

export function buildScreenCopyPlannerSystemPrompt() {
  return [
    "You write on-screen copy and semantic slot plans for short-form talking-head motion recipes.",
    "Return JSON only.",
    "First decompose the spoken phrase into semantic roles, then compress them into screen-ready copy.",
    "Think like an editor: wrong phrase versus fix, number versus title, hotkey chip, step label, support icon.",
    "Do not paste long transcript phrases.",
    "Use only the payload fields that fit the chosen recipe.",
    "Prefer concrete labels, contrasts, numbers, commands, and CTA phrasing over subtitle-like sentences."
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
            center: "optional",
            slots: [
              {
                id: "slot id",
                role: "headline | hero_number | step_index | step_label | wrong_phrase | correct_phrase | command_hotkey | keyword_accent | supporting_context | cta_phrase | comparison_left | comparison_right | quote_pull",
                text: "spoken-text-derived phrase only",
                shortText: "compressed on-screen phrase",
                style: "accent | primary | muted | success | danger | chip",
                start: 0,
                end: 1
              }
            ],
            supportVisuals: [
              {
                id: "visual id",
                kind: "cursor | mouse | keyboard | hotkey_keys | warning_mark | number_badge | checkmark | timeline_tick | chart_pulse",
                start: 0,
                end: 1,
                label: "optional"
              }
            ],
            layerActions: [
              {
                id: "action id",
                type: "show_layer | highlight_slot | strike_slot | swap_to_correct | grow_number | reveal_step | show_hotkey | pop_support_visual | camera_push",
                start: 0,
                end: 1,
                targetSlotId: "optional"
              }
            ]
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
        allowedLayerKinds: recipe.allowedLayerKinds,
        requiredSlotRoles: recipe.requiredSlotRoles,
        optionalSlotRoles: recipe.optionalSlotRoles,
        transcript: semanticBlock?.text ?? "",
        summary: semanticBlock?.summary ?? "",
        words: semanticBlock?.words ?? [],
        maxReadableItems: 4
      };
    })
  });
}
