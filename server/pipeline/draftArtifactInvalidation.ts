import { unlink } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { pathsForProject } from "@/lib/storage";

export async function invalidateRenderedReviewArtifacts(projectId: string, includeClean: boolean) {
  const paths = pathsForProject(projectId);
  if (includeClean) await safeUnlink(paths.cleanVideo);
  await safeUnlink(paths.reviewVideo);
  await safeUnlink(paths.finalVideo);
  await safeUnlink(paths.subtitledVideo);
  await safeUnlink(paths.browserRenderedCaptionsVideo);
  await safeUnlink(paths.splitVideo);
  await safeUnlink(paths.infographicVideo);
  await safeUnlink(paths.semanticBlocks);
  await safeUnlink(paths.directorPlan);
  await safeUnlink(paths.screenCopyPlan);
  await safeUnlink(paths.scenePlan);
  await safeUnlink(paths.compiledScenePlan);
  await safeUnlink(paths.visualPlan);
  await safeUnlink(paths.subtitlesAss);
  await safeUnlink(paths.subtitlesOverlayMp4);
  await safeUnlink(paths.semanticOverlayMp4);
  await safeUnlink(paths.browserRenderPlanLive);

  await prisma.renderAsset.deleteMany({
    where: {
      projectId,
      type: {
        in: includeClean
          ? ["clean_preview", "intermediate", "review", "final", "subtitle", "split", "infographic", "semantic_overlay"]
          : ["intermediate", "review", "final", "subtitle", "split", "infographic", "semantic_overlay"]
      }
    }
  });
}

export async function safeUnlink(filePath: string) {
  try {
    await unlink(filePath);
  } catch {
    // File may not exist yet.
  }
}
