import { prisma } from "@/lib/db";
import { logProject, updateProjectStatus } from "@/lib/logger";
import { PROCESSING_STATUSES } from "@/lib/projectProcessingStatuses";

/**
 * Recovery: find projects stuck in processing states after a server restart
 * and reset them to "error" so they can be retried.
 */
export async function resetStuckProjects(staleMinutes = 10) {
  const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000);
  const stuck = await prisma.project.findMany({
    where: {
      status: { in: [...PROCESSING_STATUSES] },
      updatedAt: { lt: cutoff },
    },
  });

  for (const project of stuck) {
    await logProject(project.id, "warn", `Project was stuck in status "${project.status}" after server restart. Resetting to error.`);
    await updateProjectStatus(project.id, "error", `Stuck in ${project.status} - reset by recovery. Re-run analysis to continue.`);
  }

  return stuck.length;
}
