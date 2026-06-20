import { logProject } from "@/lib/logger";
import { pathsForProject } from "@/lib/storage";
import { renderBrowserCaptionsArtifact } from "@/server/render/renderBrowserCaptionsProject";

export async function renderSubtitledVideoViaBrowserRenderer(projectId: string) {
  const paths = pathsForProject(projectId);
  await logProject(projectId, "info", "Rendering browser captions video instead of HyperFrames subtitle path.");

  return renderBrowserCaptionsArtifact({
    projectId,
    outputPath: paths.subtitledVideo,
    renderAssetType: "subtitle",
    startedMessage: "Browser subtitles render started.",
    readyMessagePrefix: "Browser subtitles video is ready",
    writePlanToProject: false
  });
}
