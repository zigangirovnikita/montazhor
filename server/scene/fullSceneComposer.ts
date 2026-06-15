import { copyFile } from "node:fs/promises";
import type { CompiledScenePlan } from "@/lib/types";
import { renderSceneFragments } from "@/server/hyperframes/sceneComposer";
import { splitCompiledRenderModes } from "@/server/scene/renderModes";
import type { RenderProfile } from "@/server/video/encoding";
import type { VideoProfile } from "@/server/video/profile";

export async function composeFullSceneVideo(
  projectId: string,
  projectDir: string,
  cleanVideoPath: string,
  compiledPlan: CompiledScenePlan,
  profile: VideoProfile,
  outputPath: string,
  renderProfile: RenderProfile
) {
  const { fullSceneBlocks } = splitCompiledRenderModes(compiledPlan);
  const scenes = fullSceneBlocks.flatMap((block) => block.fullScene ? [block.fullScene] : []);
  if (scenes.length === 0) {
    await copyFile(cleanVideoPath, outputPath);
    return;
  }

  await renderSceneFragments(
    projectId,
    projectDir,
    cleanVideoPath,
    {
      styleProfileId: compiledPlan.styleProfileId,
      scenes,
      planner: compiledPlan.planner,
      diagnostics: compiledPlan.diagnostics
    },
    profile,
    outputPath,
    renderProfile
  );
}
