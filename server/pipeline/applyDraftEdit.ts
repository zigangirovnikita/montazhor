import { readFile, unlink } from "node:fs/promises";
import { auditProjectEvent } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { logProject } from "@/lib/logger";
import { pathsForProject, writeJsonFile } from "@/lib/storage";
import type { EditDecisionList, EditRange, TranscriptJson } from "@/lib/types";
import { complementRanges, mergeCloseRanges, renderCleanCut } from "@/server/video/cutting";
import { probeVideo } from "@/server/video/metadata";
import { resolveVideoProfile } from "@/server/video/profile";
import { buildSubtitleDraft } from "@/server/video/subtitles";

type DraftEditAction = "restore_removed_range" | "delete_range" | "delete_word" | "edit_word_text" | "apply_review_edits" | "reset_draft";
type DraftEditOperation = Exclude<DraftEditAction, "apply_review_edits" | "reset_draft">;

export interface DraftEditInput {
  action: DraftEditAction;
  sourceStart?: number;
  sourceEnd?: number;
  text?: string;
  edits?: unknown;
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

  if (input.action === "apply_review_edits") {
    return applyReviewEditBatch(projectId, input, currentEdl, duration, metadata);
  }

  if (input.action === "edit_word_text") {
    await applyTranscriptWordEdit(projectId, input);
    return currentEdl;
  }

  const editRange = parseEditRange(input, duration);

  const removedRanges = buildNextRemovedRanges(currentEdl.removedRanges, input.action, editRange);
  const keptRanges = complementRanges(duration, removedRanges);
  if (keptRanges.length === 0) {
    throw new Error("После правки не остается пригодных фрагментов. Удали меньший кусок.");
  }

  const nextEdl: EditDecisionList = { keptRanges, removedRanges };
  await writeJsonFile(paths.edl, nextEdl);
  await auditProjectEvent(projectId, {
    phase: "draft_review",
    step: "single_edit",
    kind: input.action,
    summary: draftEditLogMessage(input.action, editRange),
    payload: { input, editRange, beforeEdl: currentEdl, afterEdl: nextEdl },
  });

  await safeUnlink(paths.cleanVideo);
  await safeUnlink(paths.reviewVideo);
  await safeUnlink(paths.finalVideo);
  await safeUnlink(paths.subtitledVideo);
  await safeUnlink(paths.splitVideo);
  await safeUnlink(paths.infographicVideo);
  await safeUnlink(paths.subtitlesOverlayMp4);
  await safeUnlink(paths.semanticOverlayMp4);
  await safeUnlink(paths.semanticBlocks);
  await safeUnlink(paths.directorPlan);
  await safeUnlink(paths.screenCopyPlan);
  await safeUnlink(paths.scenePlan);
  await safeUnlink(paths.compiledScenePlan);
  await safeUnlink(paths.visualPlan);

  await prisma.renderAsset.deleteMany({
    where: {
      projectId,
      type: { in: ["clean_preview", "intermediate", "review", "final", "subtitle", "split", "infographic", "semantic_overlay"] }
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

async function applyReviewEditBatch(
  projectId: string,
  input: DraftEditInput,
  currentEdl: EditDecisionList,
  duration: number,
  metadata: Awaited<ReturnType<typeof probeVideo>>
) {
  const edits = parseBatchEdits(input.edits);
  if (edits.length === 0) {
    throw new Error("Нет изменений для применения.");
  }

  let removedRanges = currentEdl.removedRanges;
  let transcriptChanged = false;
  let edlChanged = false;
  let transcriptEditCount = 0;
  let edlEditCount = 0;
  let transcript: TranscriptJson | null = null;
  const paths = pathsForProject(projectId);

  for (const edit of edits) {
    if (edit.action === "edit_word_text") {
      transcript = await editTranscriptWord(paths.transcript, transcript, edit);
      transcriptChanged = true;
      transcriptEditCount++;
      continue;
    }
    const editRange = parseEditRange(edit, duration);
    removedRanges = buildNextRemovedRanges(removedRanges, edit.action, editRange);
    edlChanged = true;
    edlEditCount++;
  }

  const keptRanges = complementRanges(duration, removedRanges);
  if (keptRanges.length === 0) {
    throw new Error("После правок не остается пригодных фрагментов. Удали меньший кусок.");
  }

  const nextEdl: EditDecisionList = { keptRanges, removedRanges };
  await writeJsonFile(paths.edl, nextEdl);
  await auditProjectEvent(projectId, {
    phase: "draft_review",
    step: "apply_review_edits",
    kind: "batch",
    summary: `Applied ${edits.length} queued changes (${edlEditCount} montage, ${transcriptEditCount} subtitle text).`,
    payload: {
      edits,
      beforeEdl: currentEdl,
      afterEdl: nextEdl,
      transcriptChanged,
      edlChanged,
      transcript,
    },
  });

  if (transcriptChanged && transcript) {
    await writeJsonFile(paths.transcript, transcript);
    await writeJsonFile(paths.subtitlesDraft, buildSubtitleDraft(transcript));
    await prisma.transcript.updateMany({
      where: { projectId, jsonPath: paths.transcript },
      data: {
        text: transcript.segments.map((segment) => segment.text).join(" ")
      }
    });
  }

  await invalidateRenderedReviewArtifacts(projectId, edlChanged);

  if (edlChanged) {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: "rendering_clean_video",
        reviewVideoPath: null,
        finalVideoPath: null,
        durationFinal: null
      }
    });
    await renderCleanCut((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).originalPath, nextEdl, paths.cleanVideo, resolveVideoProfile(metadata));
    const cleanMetadata = await probeVideo(paths.cleanVideo);
    await prisma.renderAsset.create({ data: { projectId, type: "clean_preview", path: paths.cleanVideo } });
    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: "draft_ready",
        durationFinal: cleanMetadata.duration
      }
    });
  } else {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: "draft_ready",
        reviewVideoPath: null,
        finalVideoPath: null
      }
    });
  }

  await logProject(projectId, "info", `Draft text review: applied ${edits.length} queued changes (${edlEditCount} montage, ${transcriptEditCount} subtitle text) in one re-render.`);
  return nextEdl;
}

function parseBatchEdits(value: unknown): Array<DraftEditInput & { action: DraftEditOperation }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as { action?: unknown; sourceStart?: unknown; sourceEnd?: unknown; text?: unknown };
    const action = String(candidate.action ?? "");
    if (action !== "restore_removed_range" && action !== "delete_range" && action !== "delete_word" && action !== "edit_word_text") return [];
    return [{
      action,
      sourceStart: Number(candidate.sourceStart),
      sourceEnd: Number(candidate.sourceEnd),
      text: typeof candidate.text === "string" ? candidate.text : undefined
    }];
  });
}

async function applyTranscriptWordEdit(projectId: string, input: DraftEditInput) {
  const paths = pathsForProject(projectId);
  const nextTranscript = await editTranscriptWord(paths.transcript, null, input);

  await writeJsonFile(paths.transcript, nextTranscript);
  await writeJsonFile(paths.subtitlesDraft, buildSubtitleDraft(nextTranscript));

  await invalidateRenderedReviewArtifacts(projectId, false);

  await prisma.transcript.updateMany({
    where: { projectId, jsonPath: paths.transcript },
    data: {
      text: nextTranscript.segments.map((segment) => segment.text).join(" ")
    }
  });

  await prisma.project.update({
    where: { id: projectId },
    data: {
      status: "draft_ready",
      reviewVideoPath: null,
      finalVideoPath: null
    }
  });
  await logProject(projectId, "info", `Draft text review: corrected subtitle word at ${Number(input.sourceStart).toFixed(2)}-${Number(input.sourceEnd).toFixed(2)}s.`);
  await auditProjectEvent(projectId, {
    phase: "draft_review",
    step: "edit_word_text",
    kind: "single",
    summary: `Corrected subtitle word at ${Number(input.sourceStart).toFixed(2)}-${Number(input.sourceEnd).toFixed(2)}s.`,
    payload: { input, transcript: nextTranscript },
  });
}

async function editTranscriptWord(filePath: string, current: TranscriptJson | null, input: DraftEditInput): Promise<TranscriptJson> {
  const nextText = normalizeEditedWord(input.text);
  const sourceStart = Number(input.sourceStart);
  const sourceEnd = Number(input.sourceEnd);
  if (!Number.isFinite(sourceStart) || !Number.isFinite(sourceEnd)) {
    throw new Error("Для правки слова нужны корректные границы.");
  }

  const transcript = current ?? JSON.parse(await readFile(filePath, "utf8")) as TranscriptJson;
  let edited = false;
  const nextTranscript: TranscriptJson = {
    ...transcript,
    segments: transcript.segments.map((segment) => {
      if (!segment.words?.length) return segment;
      const words = segment.words.map((word) => {
        if (edited || Math.abs(word.start - sourceStart) > 0.015 || Math.abs(word.end - sourceEnd) > 0.015) {
          return word;
        }
        edited = true;
        return { ...word, word: nextText };
      });
      return {
        ...segment,
        words,
        text: words.map((word) => word.word).join(" ")
      };
    })
  };

  if (!edited) {
    throw new Error("Не нашел это слово в транскрипте. Обнови страницу и попробуй еще раз.");
  }
  return nextTranscript;
}

async function invalidateRenderedReviewArtifacts(projectId: string, includeClean: boolean) {
  const paths = pathsForProject(projectId);
  if (includeClean) await safeUnlink(paths.cleanVideo);
  await safeUnlink(paths.reviewVideo);
  await safeUnlink(paths.finalVideo);
  await safeUnlink(paths.subtitledVideo);
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

  await prisma.renderAsset.deleteMany({
    where: {
      projectId,
      type: { in: includeClean
        ? ["clean_preview", "intermediate", "review", "final", "subtitle", "split", "infographic", "semantic_overlay"]
        : ["intermediate", "review", "final", "subtitle", "split", "infographic", "semantic_overlay"] }
    }
  });
}

function normalizeEditedWord(value: string | undefined) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) {
    throw new Error("Слово не может быть пустым.");
  }
  if (text.length > 80) {
    throw new Error("Правка слишком длинная. Здесь можно исправить только одно короткое слово.");
  }
  return text;
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
