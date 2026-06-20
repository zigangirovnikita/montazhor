import { rm } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { pathsForProject } from "@/lib/storage";

export async function cleanupProjectArtifacts(projectId: string) {
  const paths = pathsForProject(projectId);

  await Promise.all([
    safeRm(paths.audio),
    safeRm(paths.semanticBlocks),
    safeRm(paths.directorPlan),
    safeRm(paths.screenCopyPlan),
    safeRm(paths.scenePlan),
    safeRm(paths.compiledScenePlan),
    safeRm(paths.visualPlan),
    safeRm(paths.subtitlesOverlayMp4),
    safeRm(paths.semanticOverlayMp4),
    safeRm(paths.infographicVideo),
    safeRm(paths.splitVideo),
    safeRm(paths.browserRenderedCaptionsVideo),
    safeRm(paths.reviewVideo),
    safeRm(paths.cinematicSceneVideo),
    safeRm(paths.cinematicComposedVideo)
  ]);

  await prisma.renderAsset.deleteMany({
    where: {
      projectId,
      OR: [
        { type: { in: ["review", "semantic_overlay", "infographic", "split", "clean_preview", "intermediate"] } },
        { type: "subtitle", path: { not: paths.subtitledVideo } }
      ]
    }
  });
}

async function safeRm(targetPath: string) {
  await rm(targetPath, { force: true, recursive: true }).catch(() => {});
}
