import { auditProjectEvent } from "@/lib/audit";
import { logProject } from "@/lib/logger";

export interface StageEvent {
  stage: string;
  status: "started" | "cache_hit" | "done" | "failed";
  startedAt?: number;
  durationMs?: number;
  inputHash?: string;
  outputPath?: string;
  outputSize?: number;
  progress?: string;
  error?: string;
}

/**
 * Thin wrapper over existing logProject + auditProjectEvent.
 * NOT a separate logging system — uses the same ProcessingLog + audit trail.
 */
export async function logStageEvent(projectId: string, event: StageEvent): Promise<void> {
  const summary = formatStageMessage(event);

  await logProject(projectId, event.status === "failed" ? "error" : "info", summary);

  await auditProjectEvent(projectId, {
    phase: "render_graph",
    step: event.stage,
    kind: event.status,
    summary,
    metadata: {
      ...(event.durationMs !== undefined && { durationMs: event.durationMs }),
      ...(event.inputHash && { inputHash: event.inputHash }),
      ...(event.outputPath && { outputPath: event.outputPath }),
      ...(event.outputSize !== undefined && { outputSize: event.outputSize }),
      ...(event.progress && { progress: event.progress }),
    },
  });
}

function formatStageMessage(event: StageEvent): string {
  const parts = [`stage: ${event.stage}`];

  if (event.status === "cache_hit") {
    parts.push("→ cache hit, skipped");
  } else if (event.status === "started") {
    parts.push("→ started");
  } else if (event.status === "done") {
    parts.push("→ done");
    if (event.durationMs !== undefined) {
      parts.push(`(${(event.durationMs / 1000).toFixed(1)}s)`);
    }
    if (event.outputSize !== undefined) {
      parts.push(`[${formatBytes(event.outputSize)}]`);
    }
  } else if (event.status === "failed") {
    parts.push(`→ FAILED: ${event.error ?? "unknown error"}`);
  }

  if (event.progress) {
    parts.push(`[${event.progress}]`);
  }

  return parts.join(" ");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
