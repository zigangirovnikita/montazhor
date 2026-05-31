import { readFile, unlink } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { logProject } from "@/lib/logger";
import { pathsForProject, writeJsonFile } from "@/lib/storage";
import type { EditDecisionList, EditRange } from "@/lib/types";
import { complementRanges, mergeCloseRanges, renderCleanCut } from "@/server/video/cutting";
import { probeVideo } from "@/server/video/metadata";
import { resolveVideoProfile } from "@/server/video/profile";

type DraftEditAction = "restore_removed_range" | "delete_range" | "delete_word" | "reset_draft";

export interface DraftEditInput {
  action: DraftEditAction;
  sourceStart?: number;
  sourceEnd?: number;
}

const MIN_RANGE_SECONDS = 0.04;

export async function applyDraftEdit(projectId: string, input: DraftEditInput) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  if (!["draft_ready", "review_ready", "done"].includes(project.status)) {
    throw new Error("Черновик можно править только после готовности монтажа.");
  }

  const paths = pathsForProject(projectId);
  const currentEdl = JSON.parse(await readFile(paths.edl, "utf8")) as EditDecisionList;
  const metadata = await probeVideo(project.originalPath);
  const duration = project.durationOriginal ?? metadata.duration;
  const editRange = parseEditRange(input, duration);

  const removedRanges = buildNextRemovedRanges(currentEdl.removedRanges, input.action, editRange);
  const keptRanges = complementRanges(duration, removedRanges);
  if (keptRanges.length === 0) {
    throw new Error("После правки не остается пригодных фрагментов. Удали меньший кусок.");
  }

  const nextEdl: EditDecisionList = { keptRanges, removedRanges };
  await writeJsonFile(paths.edl, nextEdl);

  await safeUnlink(paths.cleanVideo);
  await safeUnlink(paths.reviewVideo);
  await safeUnlink(paths.finalVideo);
  await safeUnlink(paths.subtitledVideo);
  await safeUnlink(paths.splitVideo);
  await safeUnlink(paths.infographicVideo);
  await safeUnlink(paths.subtitlesOverlayMp4);

  await prisma.renderAsset.deleteMany({
    where: {
      projectId,
      type: { in: ["clean_preview", "intermediate", "review", "final", "subtitle", "split", "infographic"] }
    }
  });

  await prisma.project.update({
    where: { id: projectId },
    data: {
      status: "rendering_clean_video",
      reviewVideoPath: null,
      finalVideoPath: null,
      durationFinal: null
    }
  });

  await renderCleanCut(project.originalPath, nextEdl, paths.cleanVideo, resolveVideoProfile(metadata));
  const cleanMetadata = await probeVideo(paths.cleanVideo);
  await prisma.renderAsset.create({ data: { projectId, type: "clean_preview", path: paths.cleanVideo } });
  await prisma.project.update({
    where: { id: projectId },
    data: {
      status: "draft_ready",
      durationFinal: cleanMetadata.duration
    }
  });
  await logProject(projectId, "info", draftEditLogMessage(input.action, editRange));

  return nextEdl;
}

function parseEditRange(input: DraftEditInput, duration: number): EditRange | null {
  if (input.action === "reset_draft") return null;

  const sourceStart = Number(input.sourceStart);
  const sourceEnd = Number(input.sourceEnd);
  if (!Number.isFinite(sourceStart) || !Number.isFinite(sourceEnd)) {
    throw new Error("Для правки нужны корректные границы фрагмента.");
  }

  const start = clamp(sourceStart, 0, duration);
  const end = clamp(sourceEnd, 0, duration);
  if (end - start < MIN_RANGE_SECONDS) {
    throw new Error("Фрагмент слишком короткий для безопасной правки.");
  }

  return {
    sourceStart: start,
    sourceEnd: end,
    reason: input.action === "delete_word" ? "manual_word" : "manual_text"
  };
}

function buildNextRemovedRanges(
  currentRemoved: EditRange[],
  action: DraftEditAction,
  editRange: EditRange | null
): EditRange[] {
  if (action === "reset_draft") return [];
  if (!editRange) return currentRemoved;

  if (action === "restore_removed_range") {
    return currentRemoved.flatMap((range) => subtractRange(range, editRange));
  }

  return mergeCloseRanges([...currentRemoved, editRange], 0.08);
}

function subtractRange(range: EditRange, restored: EditRange): EditRange[] {
  if (restored.sourceEnd <= range.sourceStart || restored.sourceStart >= range.sourceEnd) {
    return [range];
  }

  const pieces: EditRange[] = [];
  if (restored.sourceStart - range.sourceStart >= MIN_RANGE_SECONDS) {
    pieces.push({ ...range, sourceEnd: restored.sourceStart });
  }
  if (range.sourceEnd - restored.sourceEnd >= MIN_RANGE_SECONDS) {
    pieces.push({ ...range, sourceStart: restored.sourceEnd });
  }
  return pieces;
}

function draftEditLogMessage(action: DraftEditAction, range: EditRange | null) {
  if (action === "reset_draft") return "Draft text review: all removed fragments were restored.";
  const label = action === "restore_removed_range" ? "restored" : "removed";
  return `Draft text review: ${label} ${range?.sourceStart.toFixed(2)}-${range?.sourceEnd.toFixed(2)}s and re-rendered clean draft.`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

async function safeUnlink(filePath: string) {
  try {
    await unlink(filePath);
  } catch {
    // File may not exist yet.
  }
}
