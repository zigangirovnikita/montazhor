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
    safeRm(paths.subtitledVideo),
    safeRm(paths.reviewVideo)
  ]);

  await prisma.renderAsset.deleteMany({
    where: {
      projectId,
      type: { not: "final" }
    }
  });
}

async function safeRm(targetPath: string) {
  await rm(targetPath, { force: true, recursive: true }).catch(() => {});
}
