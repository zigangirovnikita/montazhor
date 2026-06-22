import { access } from "node:fs/promises";
import { parseStyleOptions } from "@/app/components/styleState";
import { browserCaptionStyleForPreset } from "@/lib/browserCaptionStyle";
import { prisma } from "@/lib/db";
import { logProject } from "@/lib/logger";
import { pathsForProject } from "@/lib/storage";
import { renderBrowserFrames } from "@/server/render/browserFrameRenderer";
import { probeVideo } from "@/server/video/metadata";

export async function renderBrowserCaptionsForProject(projectId: string) {
  const paths = pathsForProject(projectId);
  return renderBrowserCaptionsArtifact({
    projectId,
    outputPath: paths.subtitledVideo,
    renderAssetType: "subtitle",
    startedMessage: "Subtitled video render started.",
    readyMessagePrefix: "Subtitled video is ready",
    projectPlanOutputPath: paths.browserRenderPlanLive
  });
}

export async function renderBrowserCaptionsArtifact(input: {
  projectId: string;
  outputPath: string;
  renderAssetType: string;
  startedMessage: string;
  readyMessagePrefix: string;
  writePlanToProject?: boolean;
  projectPlanOutputPath?: string;
}) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: input.projectId } });
  const paths = pathsForProject(input.projectId);

  try {
    await access(paths.cleanVideo);
  } catch {
    throw new Error("Clean video is not ready yet. Run analysis first.");
  }

  await logProject(input.projectId, "info", input.startedMessage);
  const sourceMetadata = await probeVideo(paths.cleanVideo);
  await logProject(
    input.projectId,
    "info",
    `Browser captions source: ${sourceMetadata.width ?? "?"}x${sourceMetadata.height ?? "?"}, ${sourceMetadata.duration.toFixed(2)}s.`
  );

  const result = await renderBrowserFrames({
    projectDir: paths.project,
    outputPath: input.outputPath,
    captionStyle: browserCaptionStyleForPreset(project.stylePreset),
    presentationMode: project.presentationMode,
    stylePreset: project.stylePreset,
    styleOptions: parseStyleOptions(project.styleOptionsJson),
    enableCameraMoves: true,
    writePlanToProject: input.writePlanToProject,
    projectPlanOutputPath: input.projectPlanOutputPath,
    log: (message) => logProject(input.projectId, "info", `[browser-renderer] ${message}`)
  });

  await prisma.renderAsset.create({
    data: {
      projectId: input.projectId,
      type: input.renderAssetType,
      path: input.outputPath,
      metadataJson: JSON.stringify({
        renderPlanPath: result.renderPlanPath,
        totalFrames: result.totalFrames,
        duration: result.duration,
        fps: result.fps,
        width: result.width,
        height: result.height
      })
    }
  });

  await logProject(
    input.projectId,
    "info",
    `${input.readyMessagePrefix}: ${result.width}x${result.height}, ${result.totalFrames} frames, ${result.duration.toFixed(2)}s.`
  );

  return {
    ...result,
    projectId: input.projectId,
    originalFilename: project.originalFilename,
    outputPath: input.outputPath
  };
}
