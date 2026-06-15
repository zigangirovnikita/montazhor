import type { CompiledScenePlan } from "@/lib/types";

export function splitCompiledRenderModes(plan: CompiledScenePlan) {
  return {
    overlayBlocks: plan.blocks.filter((block) => block.renderPath === "overlay"),
    fullSceneBlocks: plan.blocks.filter((block) => block.renderPath === "full_scene")
  };
}
