import path from "node:path";
import { prisma } from "@/lib/db";
import { logProject } from "@/lib/logger";
import { pathsForProject, writeJsonFile } from "@/lib/storage";

export interface ProjectAuditInput {
  phase: string;
  step: string;
  kind: string;
  summary?: string;
  payload?: unknown;
  metadata?: Record<string, unknown>;
}

const AUDIT_DISABLED_VALUES = new Set(["0", "false", "off", "no"]);

export function isProjectAuditEnabled() {
  const value = process.env.PROJECT_AUDIT_ENABLED ?? process.env.DEBUG_AUDIT_ENABLED ?? "true";
  return !AUDIT_DISABLED_VALUES.has(value.toLowerCase());
}

export async function auditProjectEvent(projectId: string | undefined, input: ProjectAuditInput) {
  if (!projectId || !isProjectAuditEnabled()) return;

  try {
    const artifactPath = await writeAuditPayload(projectId, input);
    await prisma.projectAuditEvent.create({
      data: {
        projectId,
        phase: input.phase,
        step: input.step,
        kind: input.kind,
        summary: input.summary,
        artifactPath,
        metadataJson: input.metadata ? JSON.stringify(input.metadata) : undefined,
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logProject(projectId, "warn", `Audit event was not saved for ${input.phase}/${input.step}/${input.kind}: ${message}`).catch(() => undefined);
  }
}

async function writeAuditPayload(projectId: string, input: ProjectAuditInput) {
  if (input.payload === undefined) return undefined;
  const paths = pathsForProject(projectId);
  const fileName = `${Date.now()}-${safePart(input.phase)}-${safePart(input.step)}-${safePart(input.kind)}.json`;
  const filePath = path.join(paths.auditDir, fileName);
  await writeJsonFile(filePath, {
    projectId,
    phase: input.phase,
    step: input.step,
    kind: input.kind,
    summary: input.summary,
    metadata: input.metadata,
    payload: input.payload,
  });
  return filePath;
}

function safePart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "event";
}
