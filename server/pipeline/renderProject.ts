import { readFile, unlink } from "node:fs/promises";
import { auditProjectEvent } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { logProject, updateProjectStatus } from "@/lib/logger";
import { normalizePresentationMode } from "@/lib/presentationMode";
import { pathsForProject } from "@/lib/storage";
import type { EditDecisionList, StylePreset, TranscriptJson } from "@/lib/types";
import { prepareLivePreviewPlan } from "@/server/render/prepareLivePreviewPlan";
import { renderSubtitledVideoViaBrowserRenderer } from "@/server/pipeline/renderSubtitledVideoViaBrowserRenderer";
import { ensureArtifact, fingerprintFile, hashJson } from "@/server/render/renderGraph";
import { cleanupProjectArtifacts } from "@/server/video/cleanup";
import { composeFinalVideo } from "@/server/video/compose";
import { renderCleanCut } from "@/server/video/cutting";
import { probeVideo } from "@/server/video/metadata";
import { resolveVideoProfile } from "@/server/video/profile";
import type { RenderProfile } from "@/server/video/encoding";

export async function renderStyledPreview(projectId: string) {
  await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const paths = pathsForProject(projectId);
  await logProject(projectId, "info", "Styled preview render started.");
  await auditProjectEvent(projectId, {
    phase: "render_preview",
    step: "start",
    kind: "request",
    summary: "Styled preview render started.",
  });

  const { stylePreset, presentationMode, cleanMetadata } = await buildStyledReview(projectId, "review");

  await updateProjectStatus(projectId, "rendering_preview");
  await logProject(projectId, "info", "Refreshing live captions preview plan...");
  await prepareLivePreviewPlan(projectId);
  await prisma.project.update({
    where: { id: projectId },
    data: {
      status: "review_ready",
      reviewVideoPath: null,
      finalVideoPath: null,
      durationFinal: cleanMetadata.duration
    }
  });

  await logProject(
    projectId,
    "info",
    `Review preview is ready. Mode: ${presentationMode}, style: ${stylePreset}, live overlay on clean.mp4 (${cleanMetadata.duration.toFixed(2)}s).`
  );
  await auditProjectEvent(projectId, {
    phase: "render_preview",
    step: "review_ready",
    kind: "result",
    summary: `Review preview is ready. Mode: ${presentationMode}, style: ${stylePreset}, live overlay on clean.mp4 (${cleanMetadata.duration.toFixed(2)}s).`,
    metadata: { duration: cleanMetadata.duration, presentationMode, stylePreset, livePlanPath: paths.browserRenderPlanLive },
    payload: { cleanMetadata },
  });
}

export async function finalizeProjectExport(projectId: string) {
  const paths = pathsForProject(projectId);

  await updateProjectStatus(projectId, "rendering_final");
  await logProject(projectId, "info", "Final full-quality export started.");
  await auditProjectEvent(projectId, {
    phase: "final_export",
    step: "start",
    kind: "request",
    summary: "Final export started.",
  });

  await safeUnlink(paths.finalVideo);
  await buildStyledReview(projectId, "final");

  await composeFinalVideo(paths.subtitledVideo, paths.finalVideo, "final");
  const finalMetadata = await probeVideo(paths.finalVideo);

  await prisma.renderAsset.create({ data: { projectId, type: "final", path: paths.finalVideo } });
  await prisma.project.update({
    where: { id: projectId },
    data: {
      status: "done",
      reviewVideoPath: null,
      finalVideoPath: paths.finalVideo,
      durationFinal: finalMetadata.duration
    }
  });

  await cleanupProjectArtifacts(projectId);
  await logProject(
    projectId,
    "info",
    "Removed transient review and legacy intermediate artifacts after final export. Kept final.mp4, subtitled.mp4, clean.mp4, and browser-render-plan.live.json."
  );
  await logProject(projectId, "info", `Final MP4 is ready. Duration: ${finalMetadata.duration.toFixed(2)}s.`);
  await auditProjectEvent(projectId, {
    phase: "final_export",
    step: "done",
    kind: "result",
    summary: `Final MP4 is ready. Duration: ${finalMetadata.duration.toFixed(2)}s.`,
    metadata: { finalVideoPath: paths.finalVideo, duration: finalMetadata.duration },
    payload: { finalMetadata },
  });
}

async function buildStyledReview(projectId: string, renderProfile: RenderProfile) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const paths = pathsForProject(projectId);

  const edl = JSON.parse(await readFile(paths.edl, "utf8")) as EditDecisionList;
  const transcript = JSON.parse(await readFile(paths.transcript, "utf8")) as TranscriptJson;
  await auditProjectEvent(projectId, {
    phase: "render_preview",
    step: "load_inputs",
    kind: "input",
    summary: `Loaded render inputs: ${edl.keptRanges.length} kept ranges, ${transcript.segments.length} transcript segments.`,
    payload: { edl, transcript },
  });

  const sourceMetadata = await probeVideo(project.originalPath);
  const profile = resolveVideoProfile(sourceMetadata);
  const stylePreset = project.stylePreset as StylePreset;
  const presentationMode = normalizePresentationMode(project.presentationMode);

  await updateProjectStatus(projectId, "rendering_clean_video");
  await invalidatePreviewArtifacts(paths);

  const cleanCacheKey = [
    await fingerprintFile(project.originalPath),
    hashJson(edl),
    `${profile.orientation}:${profile.width}x${profile.height}`,
  ].join(":");
  const cleanResult = await ensureArtifact(
    projectId,
    "clean_cut",
    cleanCacheKey,
    paths.cleanVideo,
    async () => {
      await renderCleanCut(project.originalPath, edl, paths.cleanVideo, profile);
    },
    { timeoutMs: 5 * 60_000 }
  );
  if (!cleanResult.cached) {
    await prisma.renderAsset.upsert({
      where: { id: `${projectId}-clean` },
      update: { path: paths.cleanVideo },
      create: { id: `${projectId}-clean`, projectId, type: "intermediate", path: paths.cleanVideo }
    });
  }

  const cleanMetadata = await probeVideo(paths.cleanVideo);
  if (renderProfile === "final") {
    await updateProjectStatus(projectId, "rendering_preview");
    await renderSubtitledVideoViaBrowserRenderer(projectId);
    await logProject(projectId, "info", `Browser-rendered subtitled video is ready after clean cut (${cleanMetadata.duration.toFixed(2)}s).`);
  }
  await auditProjectEvent(projectId, {
    phase: "render_preview",
    step: renderProfile === "final" ? "browser_renderer_mvp" : "live_preview_plan",
    kind: "result",
    summary: renderProfile === "final"
      ? "Preview rendered via browser-renderer MVP path."
      : "Live preview plan refreshed without MP4 rendering.",
    metadata: { renderProfile, presentationMode, stylePreset, duration: cleanMetadata.duration },
  });

  return { profile, stylePreset, presentationMode, cleanMetadata };
}

async function invalidatePreviewArtifacts(paths: ReturnType<typeof pathsForProject>) {
  await Promise.all([
    safeUnlink(paths.subtitledVideo),
    safeUnlink(paths.browserRenderedCaptionsVideo),
    safeUnlink(paths.reviewVideo),
    safeUnlink(paths.finalVideo),
    safeUnlink(paths.splitVideo),
    safeUnlink(paths.infographicVideo),
    safeUnlink(paths.semanticOverlayMp4),
    safeUnlink(paths.cinematicSceneVideo),
    safeUnlink(paths.cinematicComposedVideo),
  ]);
}

async function safeUnlink(filePath: string) {
  try {
    await unlink(filePath);
  } catch {
    // File may not exist.
  }
}
