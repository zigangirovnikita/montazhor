import { logProject, updateProjectStatus } from "@/lib/logger";
import { prisma } from "@/lib/db";
import { PROCESSING_STATUS_SET, PROCESSING_STATUSES } from "@/lib/projectProcessingStatuses";

const activeJobs = new Map<string, Promise<void>>();
const activeJobLabels = new Map<string, string>();

async function runLocked(projectId: string, label: string, work: () => Promise<void>) {
  if (activeJobs.has(projectId)) {
    throw new Error(`Project ${projectId} already has an active job.`);
  }

  // Guard against stale in-memory state: check DB status too
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (project && PROCESSING_STATUS_SET.has(project.status)) {
    throw new Error(
      `Project ${projectId} is already being processed (status: ${project.status}). ` +
      `If this is stuck, update the project status to "error" or "uploaded" first.`
    );
  }

  const job = work()
    .catch(async (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      await logProject(projectId, "error", `${label} failed: ${message}`);
      await updateProjectStatus(projectId, "error", message);
    })
    .finally(() => {
      activeJobs.delete(projectId);
      activeJobLabels.delete(projectId);
    });
  activeJobs.set(projectId, job);
  activeJobLabels.set(projectId, label);
}

export function enqueueAnalyze(projectId: string) {
  return runLocked(projectId, "Analysis", async () => {
    const { processProjectAnalyze } = await import("@/server/pipeline/processProject");
    await processProjectAnalyze(projectId);
  });
}

export function enqueueRender(projectId: string) {
  return runLocked(projectId, "Preview render", async () => {
    const { renderStyledPreview } = await import("@/server/pipeline/renderProject");
    await renderStyledPreview(projectId);
  });
}

export function enqueueFinalize(projectId: string) {
  return runLocked(projectId, "Final export", async () => {
    const { finalizeProjectExport } = await import("@/server/pipeline/renderProject");
    await finalizeProjectExport(projectId);
  });
}

export function enqueueSubtitledVideoRender(projectId: string) {
  return runLocked(projectId, "Subtitled video render", async () => {
    const { renderBrowserCaptionsForProject } = await import("@/server/render/renderBrowserCaptionsProject");
    await renderBrowserCaptionsForProject(projectId);
  });
}

export function isProjectJobActive(projectId: string) {
  return activeJobs.has(projectId);
}

export function getProjectJobLabel(projectId: string) {
  return activeJobLabels.get(projectId) ?? null;
}

/**
 * Recovery: find projects stuck in processing states (e.g. after server crash)
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
    if (activeJobs.has(project.id)) continue;
    await logProject(project.id, "warn", `Project was stuck in status "${project.status}" after server restart. Resetting to error.`);
    await updateProjectStatus(project.id, "error", `Stuck in ${project.status} — reset by recovery. Re-run analysis to continue.`);
  }

  return stuck.filter((p) => !activeJobs.has(p.id)).length;
}
