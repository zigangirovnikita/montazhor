import { logProject, updateProjectStatus } from "@/lib/logger";
import { prisma } from "@/lib/db";
import { processProjectAnalyze } from "@/server/pipeline/processProject";
import { finalizeProjectExport, renderStyledPreview } from "@/server/pipeline/renderProject";
import { renderBrowserCaptionsForProject } from "@/server/render/renderBrowserCaptionsProject";

const activeJobs = new Map<string, Promise<void>>();
const activeJobLabels = new Map<string, string>();

/** Statuses that indicate work is already in progress */
const PROCESSING_STATUSES = new Set([
  "extracting_audio",
  "transcribing",
  "planning",
  "rendering_clean_video",
  "rendering_preview",
  "rendering_final",
  "rendering_subtitles",
  "rendering_motion",
  "composing_final",
]);

async function runLocked(projectId: string, label: string, work: () => Promise<void>) {
  if (activeJobs.has(projectId)) {
    throw new Error(`Project ${projectId} already has an active job.`);
  }

  // Guard against stale in-memory state: check DB status too
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (project && PROCESSING_STATUSES.has(project.status)) {
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
  return runLocked(projectId, "Analysis", () => processProjectAnalyze(projectId));
}

export function enqueueRender(projectId: string) {
  return runLocked(projectId, "Preview render", () => renderStyledPreview(projectId));
}

export function enqueueFinalize(projectId: string) {
  return runLocked(projectId, "Final export", () => finalizeProjectExport(projectId));
}

export function enqueueExperimentalBrowserCaptionsRender(projectId: string) {
  return runLocked(projectId, "Experimental browser captions render", () => renderBrowserCaptionsForProject(projectId).then(() => undefined));
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
