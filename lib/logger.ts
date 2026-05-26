import { prisma } from "@/lib/db";

export type LogLevel = "info" | "warn" | "error";

export async function logProject(projectId: string, level: LogLevel, message: string) {
  await prisma.processingLog.create({
    data: { projectId, level, message }
  });
}

export async function updateProjectStatus(projectId: string, status: string, errorMessage?: string) {
  await prisma.project.update({
    where: { id: projectId },
    data: { status, errorMessage: errorMessage ?? null }
  });
}
