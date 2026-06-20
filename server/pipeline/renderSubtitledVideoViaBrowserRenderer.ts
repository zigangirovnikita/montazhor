import { logProject } from "@/lib/logger";
import { pathsForProject } from "@/lib/storage";
import { renderBrowserCaptionsArtifact } from "@/server/render/renderBrowserCaptionsProject";

export async function renderSubtitledVideoViaBrowserRenderer(projectId: string) {
  const paths = pathsForProject(projectId);
  await logProject(projectId, "info", "Using Browser Captions Renderer MVP path.");

  return renderBrowserCaptionsArtifact({
    projectId,
    outputPath: paths.subtitledVideo,
    renderAssetType: "subtitle",
    startedMessage: "Subtitled video render started.",
    readyMessagePrefix: "Subtitled video is ready",
    writePlanToProject: true,
    projectPlanOutputPath: paths.browserRenderPlanLive
  });
}
