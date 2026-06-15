import { copyFile } from "node:fs/promises";
import type { CompiledScenePlan, VisualPlanOptions } from "@/lib/types";
import type { VideoProfile } from "@/server/video/profile";
import { renderSemanticOverlay } from "@/server/hyperframes/semanticOverlay";
import { splitCompiledRenderModes } from "@/server/scene/renderModes";

export async function composeOverlayScenes(
  projectDir: string,
  inputVideoPath: string,
  compiledPlan: CompiledScenePlan,
  profile: VideoProfile,
  duration: number,
  outputVideoPath: string,
  styleOptions?: VisualPlanOptions
) {
  const { overlayBlocks } = splitCompiledRenderModes(compiledPlan);
  const beats = overlayBlocks.flatMap((block) => block.overlayBeats);
  if (beats.length === 0) {
    await copyFile(inputVideoPath, outputVideoPath);
    return;
  }

  await renderSemanticOverlay(
    projectDir,
    inputVideoPath,
    {
      styleProfileId: compiledPlan.styleProfileId,
      density: styleOptions?.visualDensity ?? "medium",
      beats,
      fallbackSubtitleMode: "off",
      planner: compiledPlan.planner === "ai" ? "ai" : "continuous",
      diagnostics: compiledPlan.diagnostics
    },
    profile,
    duration,
    outputVideoPath,
    styleOptions
  );
}
