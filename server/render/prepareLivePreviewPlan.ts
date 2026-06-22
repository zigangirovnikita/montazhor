import { parseStyleOptions } from "@/app/components/styleState";
import { prisma } from "@/lib/db";
import { browserCaptionStyleForPreset } from "@/lib/browserCaptionStyle";
import { logProject } from "@/lib/logger";
import { pathsForProject } from "@/lib/storage";
import { buildBrowserFrameRenderPlanFromProject } from "@/server/render/browserFrameRenderPlanFromProject";

export async function prepareLivePreviewPlan(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const paths = pathsForProject(projectId);

  const result = await buildBrowserFrameRenderPlanFromProject({
    projectDir: paths.project,
    captionStyle: browserCaptionStyleForPreset(project.stylePreset),
    presentationMode: project.presentationMode,
    stylePreset: project.stylePreset,
    styleOptions: parseStyleOptions(project.styleOptionsJson),
    enableCameraMoves: true,
    writePlanToProject: true,
    projectPlanOutputPath: paths.browserRenderPlanLive,
    log: (message) => logProject(projectId, "info", `[live-preview] ${message}`)
  });

  await logProject(
    projectId,
    "info",
    `Live preview plan is ready: ${result.plan.width}x${result.plan.height}, ${result.plan.captions.length} captions, style ${result.plan.captionDesign.variant}, camera moves ${result.plan.cameraMoves.length}.`
  );

  return result;
}
