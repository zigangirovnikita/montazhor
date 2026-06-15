import { copyFile, readFile } from "node:fs/promises";
import type {
  ContentPlan,
  DirectorPlan,
  EditDecisionList,
  PresentationMode,
  ScenePlan,
  ScreenCopyPlan,
  StylePreset,
  SubtitleDraft,
  TranscriptJson,
  VisualPlanOptions
} from "@/lib/types";
import { writeJsonFile } from "@/lib/storage";
import { buildSemanticBlocks } from "@/server/scene/blockPlanner";
import { buildDirectorPlan, DIRECTOR_PLAN_VERSION } from "@/server/scene/directorPlanner";
import { resolveTemplateSceneCapabilities } from "@/server/scene/sceneCompatibility";
import { buildReviewScenePlan, compileScenePlan } from "@/server/scene/sceneCompiler";
import { composeFullSceneVideo } from "@/server/scene/fullSceneComposer";
import { composeOverlayScenes } from "@/server/scene/overlayComposer";
import { buildScreenCopyPlan, SCREEN_COPY_PLAN_VERSION } from "@/server/scene/screenCopyPlanner";
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
  const existingDirectorPlan = await loadReusableDirectorPlan(input.paths.directorPlan, semanticBlocks, input.styleOptions?.visualTemplateId);
  const directorPlan = existingDirectorPlan ?? await buildDirectorPlan({
    semanticBlocks,
    contentPlan: input.contentPlan,
    styleProfileId: input.stylePreset,
    capabilities
  }, input.projectId, input.log);
  const existingScreenCopyPlan = await loadReusableScreenCopyPlan(input.paths.screenCopyPlan, directorPlan);
  const screenCopyPlan = existingScreenCopyPlan ?? await buildScreenCopyPlan({
    semanticBlocks,
    directorPlan,
    contentPlan: input.contentPlan
  }, input.projectId, input.log);
  const compiledScenePlan = compileScenePlan(directorPlan, screenCopyPlan, input.profile, input.styleOptions);
  const scenePlan = buildReviewScenePlan(directorPlan, screenCopyPlan);

  await writeJsonFile(input.paths.semanticBlocks, semanticBlocks);
  await writeJsonFile(input.paths.directorPlan, directorPlan);
  await writeJsonFile(input.paths.screenCopyPlan, screenCopyPlan);
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
    return { semanticBlocks, directorPlan, screenCopyPlan, scenePlan, compiledScenePlan, videoPath: sceneBasePath };
  }
  if (compiledScenePlan.blocks.length === 0) {
    await copyFile(input.paths.cleanVideo, overlayPath);
  }
  return { semanticBlocks, directorPlan, screenCopyPlan, scenePlan, compiledScenePlan, videoPath: overlayPath };
}

async function loadReusableDirectorPlan(filePath: string, semanticBlocks: ScenePlan["semanticBlocks"], templateId: string | undefined) {
  try {
    const raw = JSON.parse(await readFile(filePath, "utf8")) as DirectorPlan;
    if (!Array.isArray(raw.blocks) || !Array.isArray(raw.semanticBlocks)) return null;
    if (raw.version !== DIRECTOR_PLAN_VERSION) return null;
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

async function loadReusableScreenCopyPlan(filePath: string, directorPlan: DirectorPlan) {
  try {
    const raw = JSON.parse(await readFile(filePath, "utf8")) as ScreenCopyPlan;
    if (!Array.isArray(raw.blocks)) return null;
    if (raw.version !== SCREEN_COPY_PLAN_VERSION) return null;
    if ((raw.templateId ?? undefined) !== (directorPlan.templateId ?? undefined)) return null;
    const sameIds = raw.blocks.length === directorPlan.blocks.length
      && raw.blocks.every((block, index) => block.blockId === directorPlan.blocks[index]?.blockId);
    return sameIds ? raw : null;
  } catch {
    return null;
  }
}
