import { access } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { logProject } from "@/lib/logger";
import { pathsForProject } from "@/lib/storage";
import { renderBrowserFrames } from "@/server/render/browserFrameRenderer";
import { probeVideo } from "@/server/video/metadata";

export async function renderBrowserCaptionsForProject(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const paths = pathsForProject(projectId);

  try {
    await access(paths.cleanVideo);
  } catch {
    throw new Error("Clean video is not ready yet. Run analysis first.");
  }

  await logProject(projectId, "info", "Experimental browser captions render started.");
  const sourceMetadata = await probeVideo(paths.cleanVideo);
  await logProject(
    projectId,
    "info",
    `Browser captions source: ${sourceMetadata.width ?? "?"}x${sourceMetadata.height ?? "?"}, ${sourceMetadata.duration.toFixed(2)}s.`
  );

  const result = await renderBrowserFrames({
    projectDir: paths.project,
    outputPath: paths.browserRenderedCaptionsVideo,
    captionStyle: "bold-yellow",
    enableCameraMoves: false,
    log: (message) => logProject(projectId, "info", `[browser-renderer] ${message}`)
  });

  await prisma.renderAsset.create({
    data: {
      projectId,
      type: "experimental_browser_captions",
      path: paths.browserRenderedCaptionsVideo,
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
    projectId,
    "info",
    `Experimental browser captions render is ready: ${result.width}x${result.height}, ${result.totalFrames} frames, ${result.duration.toFixed(2)}s.`
  );

  return {
    ...result,
    projectId,
    originalFilename: project.originalFilename,
    outputPath: paths.browserRenderedCaptionsVideo
  };
}
