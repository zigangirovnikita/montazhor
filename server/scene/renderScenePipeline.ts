import { copyFile, readFile } from "node:fs/promises";
import type { ContentPlan, EditDecisionList, PresentationMode, ScenePlan, StylePreset, SubtitleDraft, TranscriptJson, VisualPlanOptions } from "@/lib/types";
import { writeJsonFile } from "@/lib/storage";
import { buildScenePlan } from "@/server/ai/scenePlanner";
import { buildSemanticBlocks } from "@/server/scene/blockPlanner";
import { resolveTemplateSceneCapabilities } from "@/server/scene/sceneCompatibility";
import { compileScenePlan } from "@/server/scene/sceneCompiler";
import { composeFullSceneVideo } from "@/server/scene/fullSceneComposer";
import { composeOverlayScenes } from "@/server/scene/overlayComposer";
import type { RenderProfile } from "@/server/video/encoding";
import type { VideoProfile } from "@/server/video/profile";

type ProjectPaths = ReturnType<typeof import("@/lib/storage").pathsForProject>;

interface RenderScenePipelineInput {
  projectId: string;
  paths: ProjectPaths;
  transcript: TranscriptJson;
  edl: EditDecisionList;
  subtitles: SubtitleDraft[];
  contentPlan: ContentPlan;
  stylePreset: StylePreset;
  presentationMode: PresentationMode;
  profile: VideoProfile;
  duration: number;
  renderProfile: RenderProfile;
  styleOptions?: VisualPlanOptions;
  log?: (message: string) => Promise<void> | void;
}

export async function renderScenePipeline(input: RenderScenePipelineInput) {
  const semanticBlocks = buildSemanticBlocks(input.subtitles, input.contentPlan, input.duration);
  const capabilities = resolveTemplateSceneCapabilities(input.stylePreset, input.styleOptions);
  const existingScenePlan = await loadReusableScenePlan(input.paths.scenePlan, semanticBlocks, input.styleOptions?.visualTemplateId);
  const scenePlan = existingScenePlan ?? await buildScenePlan({
    semanticBlocks,
    contentPlan: input.contentPlan,
    styleProfileId: input.stylePreset,
    capabilities
  }, input.projectId, input.log);
  const compiledScenePlan = compileScenePlan(scenePlan, input.profile, input.styleOptions);

  await writeJsonFile(input.paths.semanticBlocks, semanticBlocks);
  await writeJsonFile(input.paths.scenePlan, scenePlan);
  await writeJsonFile(input.paths.compiledScenePlan, compiledScenePlan);

  const sceneBasePath = input.paths.cinematicComposedVideo.replace(/\.mp4$/, `.${input.renderProfile}.mp4`);
  const overlayPath = input.paths.semanticOverlayMp4.replace(/\.mp4$/, `.${input.renderProfile}.mp4`);

  await composeFullSceneVideo(
    input.projectId,
    input.paths.project,
    input.paths.cleanVideo,
    compiledScenePlan,
    input.profile,
    sceneBasePath,
    input.renderProfile
  );

  await composeOverlayScenes(
    input.paths.project,
    sceneBasePath,
    compiledScenePlan,
    input.profile,
    input.duration,
    overlayPath,
    input.styleOptions
  );

  if (input.presentationMode === "cinematic_scenes" && compiledScenePlan.blocks.every((block) => block.renderPath !== "overlay")) {
    return { semanticBlocks, scenePlan, compiledScenePlan, videoPath: sceneBasePath };
  }
  if (compiledScenePlan.blocks.length === 0) {
    await copyFile(input.paths.cleanVideo, overlayPath);
  }
  return { semanticBlocks, scenePlan, compiledScenePlan, videoPath: overlayPath };
}

async function loadReusableScenePlan(filePath: string, semanticBlocks: ScenePlan["semanticBlocks"], templateId: string | undefined) {
  try {
    const raw = JSON.parse(await readFile(filePath, "utf8")) as ScenePlan;
    if (!Array.isArray(raw.blocks) || !Array.isArray(raw.semanticBlocks)) return null;
    if ((raw.templateId ?? undefined) !== templateId) return null;
    const sameIds = raw.semanticBlocks.length === semanticBlocks.length
      && raw.semanticBlocks.every((block, index) => block.id === semanticBlocks[index]?.id);
    return sameIds
      ? {
          ...raw,
          semanticBlocks
        }
      : null;
  } catch {
    return null;
  }
}
