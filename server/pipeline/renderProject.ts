import { copyFile, readFile, unlink, writeFile } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { logProject, updateProjectStatus } from "@/lib/logger";
import { pathsForProject, writeJsonFile } from "@/lib/storage";
import type { ContentPlan, MotionInsert, PresentationMode, StylePreset, TranscriptJson } from "@/lib/types";
import { parseVisualPlanOptions } from "@/lib/visualStyleOptions";
import { buildVisualOverlayPlanWithAi } from "@/server/ai/visualPlanner";
import { hyperframesRenderDiagnostics } from "@/server/hyperframes/diagnostics";
import { loadOptionalFaceSafeRegions } from "@/server/hyperframes/faceSafeRegions";
import { renderInfographicPanel } from "@/server/hyperframes/infographic";
import { renderSemanticOverlay } from "@/server/hyperframes/semanticOverlay";
import { cleanupProjectArtifacts } from "@/server/video/cleanup";
import { renderCleanCut } from "@/server/video/cutting";
import {
  assFromSubtitles,
  buildSubtitlesForEdl,
  burnSubtitles,
  renderSubtitlesLayerViaHyperFrames,
  overlaySubtitlesLayer
} from "@/server/video/subtitles";
import { composeFinalVideo } from "@/server/video/compose";
import { probeVideo } from "@/server/video/metadata";
import { resolveVideoProfile, splitLayoutForProfile } from "@/server/video/profile";
import { composeSplitLayout } from "@/server/video/splitLayout";
import type { EditDecisionList } from "@/lib/types";

export async function renderStyledPreview(projectId: string) {
  await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const paths = pathsForProject(projectId);
  await logProject(projectId, "info", "Styled preview render started.");

  const { profile, stylePreset, presentationMode } = await buildStyledReview(projectId);
  const motionInserts: MotionInsert[] = [];

  await updateProjectStatus(projectId, "rendering_preview");
  await logProject(projectId, "info", "Composing review preview MP4...");
  await safeUnlink(paths.reviewVideo);
  await composeFinalVideo(paths.subtitledVideo, paths.finalVideo);
  const reviewMetadata = await probeVideo(paths.reviewVideo);

  await prisma.renderAsset.create({ data: { projectId, type: "review", path: paths.reviewVideo } });
  await prisma.project.update({
    where: { id: projectId },
    data: {
      status: "review_ready",
      reviewVideoPath: paths.reviewVideo,
      finalVideoPath: null,
      durationFinal: reviewMetadata.duration
    }
  });

  await logProject(
    projectId,
    "info",
    `Review preview is ready. Mode: ${presentationMode}, style: ${stylePreset}, duration: ${reviewMetadata.duration.toFixed(2)}s.`
  );
}

export async function finalizeProjectExport(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const paths = pathsForProject(projectId);

  if (!project.reviewVideoPath) {
    throw new Error("Review preview is not ready yet. Render the preview before final export.");
  }

  await updateProjectStatus(projectId, "rendering_final");
  await logProject(projectId, "info", "Final export started from approved preview.");

  await safeUnlink(paths.finalVideo);
  await copyFile(project.reviewVideoPath, paths.finalVideo);
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
  await logProject(projectId, "info", "Temporary source, preview, subtitles, audio, and intermediate render files were deleted after final export.");
  await logProject(projectId, "info", `Final MP4 is ready. Duration: ${finalMetadata.duration.toFixed(2)}s.`);
}

async function buildStyledReview(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const paths = pathsForProject(projectId);

  const edl = JSON.parse(await readFile(paths.edl, "utf8")) as EditDecisionList;
  const transcript = JSON.parse(await readFile(paths.transcript, "utf8")) as TranscriptJson;
  const contentPlan = JSON.parse(await readFile(paths.contentPlan, "utf8")) as ContentPlan;
  const sourceMetadata = await probeVideo(project.originalPath);
  const profile = resolveVideoProfile(sourceMetadata);
  const stylePreset = project.stylePreset as StylePreset;
  const visualStyleOptions = parseVisualPlanOptions(project.styleOptionsJson);
  const faceSafeRegions = await loadOptionalFaceSafeRegions(paths.project, profile);
  const effectiveVisualOptions = faceSafeRegions.length
    ? { ...visualStyleOptions, faceSafeRegions }
    : visualStyleOptions;
  if (faceSafeRegions.length) {
    await logProject(projectId, "info", `Loaded ${faceSafeRegions.length} face-safe regions for visual overlay layout.`);
  }
  const presentationMode = (project.presentationMode ?? fallbackPresentationMode(project.editMode)) as PresentationMode;
  let effectivePresentationMode = presentationMode;

  await updateProjectStatus(projectId, "rendering_clean_video");
  await safeUnlink(paths.cleanVideo);
  await safeUnlink(paths.subtitledVideo);
  await safeUnlink(paths.splitVideo);
  await safeUnlink(paths.infographicVideo);
  await safeUnlink(paths.semanticOverlayMp4);
  await renderCleanCut(project.originalPath, edl, paths.cleanVideo, profile);
  await prisma.renderAsset.upsert({
    where: { id: `${projectId}-clean` },
    update: { path: paths.cleanVideo },
    create: { id: `${projectId}-clean`, projectId, type: "intermediate", path: paths.cleanVideo }
  });
  await logProject(projectId, "info", "Clean cut rendered for styled preview.");

  const cleanMetadata = await probeVideo(paths.cleanVideo);
  const subtitles = buildSubtitlesForEdl(transcript, edl);
  let videoForSubtitles = paths.cleanVideo;
  let captionRegion = undefined;

  await updateProjectStatus(projectId, "rendering_preview");

  if (presentationMode === "subtitles_infographics") {
    try {
      const visualPlan = await buildVisualOverlayPlanWithAi(
        {
          transcript,
          edl,
          subtitles,
          contentPlan,
          stylePreset,
          duration: cleanMetadata.duration,
          frame: profile,
          styleOptions: effectiveVisualOptions
        },
        projectId,
        (message) => logProject(projectId, "info", message)
      );
      await writeJsonFile(paths.visualPlan, visualPlan);

      if (visualPlan.beats.length > 0) {
        await renderSemanticOverlay(paths.project, paths.cleanVideo, visualPlan, profile, cleanMetadata.duration, paths.subtitledVideo);
        await prisma.renderAsset.create({ data: { projectId, type: "semantic_overlay", path: paths.subtitledVideo } });
        await logProject(projectId, `info`, `Semantic overlay rendered with ${visualPlan.beats.length} beats natively.`);
        return { profile, stylePreset, presentationMode: effectivePresentationMode };
      }

      await logProject(projectId, "warn", "Semantic planner produced no strong beats, falling back to subtitles.");
    } catch (semanticError) {
      const message = semanticError instanceof Error ? semanticError.message : String(semanticError);
      await safeUnlink(paths.semanticOverlayMp4);
      await logProject(
        projectId,
        "warn",
        `Semantic overlay failed, continuing with subtitle fallback. ${hyperframesRenderDiagnostics()} Original error: ${message}`
      );
    }
  }

  if (presentationMode === "subtitles_infographics_media") {
    captionRegion = splitLayoutForProfile(profile).author;
    try {
      await renderInfographicPanel(paths.project, contentPlan, profile, cleanMetadata.duration, paths.infographicVideo);
      await composeSplitLayout(paths.cleanVideo, paths.infographicVideo, profile, cleanMetadata.duration, paths.splitVideo);
      await prisma.renderAsset.create({ data: { projectId, type: "infographic", path: paths.infographicVideo } });
      await prisma.renderAsset.create({ data: { projectId, type: "split", path: paths.splitVideo } });
      videoForSubtitles = paths.splitVideo;
      await logProject(projectId, "info", "Infographic split layout rendered.");
    } catch (infographicError) {
      const message = infographicError instanceof Error ? infographicError.message : String(infographicError);
      effectivePresentationMode = "subtitles_only";
      captionRegion = undefined;
      await safeUnlink(paths.infographicVideo);
      await safeUnlink(paths.splitVideo);
      await logProject(
        projectId,
        "warn",
        `Infographic rendering failed, continuing with subtitles-only preview. ${hyperframesRenderDiagnostics()} Original error: ${message}`
      );
    }
  }

  effectivePresentationMode = "subtitles_only";
  await writeFile(paths.subtitlesAss, assFromSubtitles(subtitles, stylePreset, profile, captionRegion), "utf8");
  await logProject(projectId, "info", `Generated ${subtitles.length} subtitle chunks (ASS).`);

  try {
    const subtitlesMode = "alpha";
    const overlayExt = subtitlesMode === "alpha" ? "mov" : "mp4";
    const subtitlesOverlayPath = paths.subtitlesOverlayMp4.replace(/\.mp4$/, `.${overlayExt}`);
    
    await renderSubtitlesLayerViaHyperFrames(paths.project, subtitles, stylePreset, profile, subtitlesOverlayPath, captionRegion, subtitlesMode);
    await overlaySubtitlesLayer(videoForSubtitles, subtitlesOverlayPath, profile, paths.subtitledVideo);
    await prisma.renderAsset.create({ data: { projectId, type: "subtitle", path: subtitlesOverlayPath } });
    await logProject(projectId, "info", `Subtitles rendered via HyperFrames overlay (${subtitlesMode}).`);
  } catch (hyperframesError) {
    const msg = hyperframesError instanceof Error ? hyperframesError.message : String(hyperframesError);
    await logProject(projectId, "warn", `HyperFrames subtitles failed, falling back to FFmpeg ASS burn. ${hyperframesRenderDiagnostics()} Original error: ${msg}`);
    await burnSubtitles(videoForSubtitles, paths.subtitlesAss, profile, paths.subtitledVideo);
    await logProject(projectId, "info", "Subtitles burned via FFmpeg ASS fallback.");
  }

  await logProject(projectId, "info", "Preview rendered with subtitle fallback because visual overlay mode was disabled or unavailable.");
  return { profile, stylePreset, presentationMode: effectivePresentationMode };
}

function fallbackPresentationMode(editMode: string | null | undefined): PresentationMode {
  return editMode === "cut_subtitles_infographics" ? "subtitles_infographics" : "subtitles_only";
}

async function safeUnlink(filePath: string) {
  try {
    await unlink(filePath);
  } catch {
    // File may not exist — that's fine
  }
}
