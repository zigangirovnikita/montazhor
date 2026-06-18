import { copyFile, readFile, unlink, writeFile } from "node:fs/promises";
import { auditProjectEvent } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { logProject, updateProjectStatus } from "@/lib/logger";
import { pathsForProject } from "@/lib/storage";
import type { ContentPlan, PresentationMode, StylePreset, TranscriptJson } from "@/lib/types";
import { parseVisualPlanOptions } from "@/lib/visualStyleOptions";
import { hyperframesRenderDiagnostics } from "@/server/hyperframes/diagnostics";
import { loadOptionalFaceSafeRegions } from "@/server/hyperframes/faceSafeRegions";
import { renderInfographicPanel } from "@/server/hyperframes/infographic";
import { renderScenePipeline } from "@/server/scene/renderScenePipeline";
import { type RenderProfile } from "@/server/video/encoding";
import { ensureArtifact, fingerprintFile, hashJson } from "@/server/render/renderGraph";
import { cleanupProjectArtifacts } from "@/server/video/cleanup";
import { renderCleanCut } from "@/server/video/cutting";
import {
  assFromSubtitles,
  buildSubtitlesForEdl,
  burnSubtitles,
  renderSubtitlesLayerViaHyperFrames,
  overlaySubtitlesLayer,
  type SubtitleRenderMode
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
  await auditProjectEvent(projectId, {
    phase: "render_preview",
    step: "start",
    kind: "request",
    summary: "Styled preview render started.",
  });

  const { stylePreset, presentationMode } = await buildStyledReview(projectId, "review");

  await updateProjectStatus(projectId, "rendering_preview");
  await logProject(projectId, "info", "Composing review preview MP4...");
  await safeUnlink(paths.reviewVideo);
  await safeUnlink(paths.finalVideo);
  await composeFinalVideo(paths.subtitledVideo, paths.reviewVideo, "review");
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
  await auditProjectEvent(projectId, {
    phase: "render_preview",
    step: "review_ready",
    kind: "result",
    summary: `Review preview is ready. Mode: ${presentationMode}, style: ${stylePreset}, duration: ${reviewMetadata.duration.toFixed(2)}s.`,
    metadata: { reviewVideoPath: paths.reviewVideo, duration: reviewMetadata.duration, presentationMode, stylePreset },
    payload: { reviewMetadata },
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

  // Render high-quality intermediate assets
  const { presentationMode } = await buildStyledReview(projectId, "final");

  let videoForImage = paths.cleanVideo;
  if (presentationMode === "subtitles_only") videoForImage = paths.subtitledVideo;
  if (presentationMode === "subtitles_infographics") videoForImage = paths.subtitledVideo;
  if (presentationMode === "cinematic_scenes") videoForImage = paths.subtitledVideo;

  // Composite final full-quality MP4
  await composeFinalVideo(
    videoForImage,
    paths.finalVideo,
    "final"
  );
  
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
  const contentPlan = JSON.parse(await readFile(paths.contentPlan, "utf8")) as ContentPlan;
  await auditProjectEvent(projectId, {
    phase: "render_preview",
    step: "load_inputs",
    kind: "input",
    summary: `Loaded render inputs: ${edl.keptRanges.length} kept ranges, ${transcript.segments.length} transcript segments.`,
    payload: { edl, transcript, contentPlan },
  });
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
  // Invalidate downstream artifacts that depend on stages not yet cached.
  // clean.mp4 and visual-scene-plan.json are now cached via ensureArtifact;
  // other intermediates are still unconditionally invalidated until Steps 2-3.
  await safeUnlink(paths.subtitledVideo);
  await safeUnlink(paths.splitVideo);
  await safeUnlink(paths.infographicVideo);
  await safeUnlink(paths.semanticOverlayMp4);
  await safeUnlink(paths.cinematicSceneVideo);

  // Stage: clean_cut (cached by original fingerprint + EDL hash + profile)
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
  const subtitles = buildSubtitlesForEdl(transcript, edl);
  let videoForSubtitles = paths.cleanVideo;
  let skipStandaloneSubtitlePass = false;
  let captionRegion = undefined;

  await updateProjectStatus(projectId, "rendering_preview");

  if (presentationMode === "cinematic_scenes" || presentationMode === "subtitles_infographics") {
    try {
      const { semanticBlocks, directorPlan, screenCopyPlan, scenePlan, compiledScenePlan, videoPath } = await renderScenePipeline({
        projectId,
        paths,
        transcript,
        edl,
        subtitles,
        contentPlan,
        stylePreset,
        presentationMode,
        profile,
        duration: cleanMetadata.duration,
        renderProfile,
        styleOptions: effectiveVisualOptions,
        log: (message) => logProject(projectId, "info", message)
      });

      await auditProjectEvent(projectId, {
        phase: "render_preview",
        step: "semantic_blocks",
        kind: "result",
        summary: `Semantic block planner produced ${semanticBlocks.length} blocks.`,
        metadata: { path: paths.semanticBlocks },
        payload: semanticBlocks,
      });
      await auditProjectEvent(projectId, {
        phase: "render_preview",
        step: "director_plan",
        kind: "result",
        summary: `Director planner produced ${directorPlan.blocks.length} cinematic decisions.`,
        metadata: { path: paths.directorPlan },
        payload: directorPlan,
      });
      await auditProjectEvent(projectId, {
        phase: "render_preview",
        step: "screen_copy_plan",
        kind: "result",
        summary: `Screen copy planner produced ${screenCopyPlan.blocks.length} copy payloads.`,
        metadata: { path: paths.screenCopyPlan },
        payload: screenCopyPlan,
      });
      await auditProjectEvent(projectId, {
        phase: "render_preview",
        step: "scene_plan",
        kind: "result",
        summary: `Scene planner produced ${scenePlan.blocks.length} block scenes.`,
        metadata: { path: paths.scenePlan },
        payload: scenePlan,
      });
      await auditProjectEvent(projectId, {
        phase: "render_preview",
        step: "compiled_scene_plan",
        kind: "result",
        summary: `Scene compiler produced ${compiledScenePlan.blocks.length} compiled blocks.`,
        metadata: { path: paths.compiledScenePlan },
        payload: compiledScenePlan,
      });

      videoForSubtitles = videoPath;
      skipStandaloneSubtitlePass = false;
      await prisma.renderAsset.create({ data: { projectId, type: "semantic_overlay", path: videoPath } });
      await logProject(
        projectId,
        "info",
        `Scene pipeline rendered ${compiledScenePlan.blocks.length} compiled blocks (${compiledScenePlan.blocks.filter((block) => block.renderPath === "overlay").length} overlay, ${compiledScenePlan.blocks.filter((block) => block.renderPath === "full_scene").length} full-scene).`
      );
    } catch (sceneError) {
      const message = sceneError instanceof Error ? sceneError.message : String(sceneError);
      await safeUnlink(paths.semanticOverlayMp4);
      await logProject(
        projectId,
        "warn",
        `Scene pipeline failed, continuing with subtitle fallback. ${hyperframesRenderDiagnostics()} Original error: ${message}`
      );
      await auditProjectEvent(projectId, {
        phase: "render_preview",
        step: "scene_pipeline",
        kind: "failed",
        summary: `Scene pipeline failed: ${message}`,
        payload: { error: message, diagnostics: hyperframesRenderDiagnostics() },
      });
      effectivePresentationMode = "subtitles_only";
      videoForSubtitles = paths.cleanVideo;
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
      await auditProjectEvent(projectId, {
        phase: "render_preview",
        step: "infographic_split",
        kind: "result",
        summary: "Infographic split layout rendered.",
        metadata: { infographicVideo: paths.infographicVideo, splitVideo: paths.splitVideo },
      });
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
      await auditProjectEvent(projectId, {
        phase: "render_preview",
        step: "infographic_split",
        kind: "failed",
        summary: `Infographic rendering failed: ${message}`,
        payload: { error: message, diagnostics: hyperframesRenderDiagnostics() },
      });
    }
  }

  if (presentationMode === "subtitles_only") {
    effectivePresentationMode = "subtitles_only";
  }
  if (!skipStandaloneSubtitlePass) {
    await writeFile(paths.subtitlesAss, assFromSubtitles(subtitles, stylePreset, profile, captionRegion), "utf8");
    await logProject(projectId, "info", `Generated ${subtitles.length} subtitle chunks (ASS).`);
  }

  if (skipStandaloneSubtitlePass) {
    await copyFile(videoForSubtitles, paths.subtitledVideo);
    await logProject(projectId, "info", "Standalone subtitle pass skipped because scene composition already carries the spoken text layer.");
    await auditProjectEvent(projectId, {
      phase: "render_preview",
      step: "subtitles_overlay",
      kind: "skipped",
      summary: "Standalone subtitle pass skipped because scene composition already carries the spoken text layer.",
    });
  } else {
    try {
      const subtitleMode: SubtitleRenderMode = renderProfile === "final" ? "final_alpha" : "preview_fast";
      
      if (subtitleMode === "preview_fast") {
        await burnSubtitles(videoForSubtitles, paths.subtitlesAss, profile, renderProfile, paths.subtitledVideo);
        await logProject(projectId, "info", "Subtitles burned via FFmpeg ASS (preview_fast).");
        await auditProjectEvent(projectId, {
          phase: "render_preview",
          step: "subtitles_overlay",
          kind: "result",
          summary: "Subtitles burned via FFmpeg ASS (preview_fast).",
        });
      } else {
        const overlayExt = subtitleMode === "final_alpha" ? "mov" : "mp4";
        const subtitlesOverlayPath = paths.subtitlesOverlayMp4.replace(/\.mp4$/, `.${overlayExt}`);
        
        await renderSubtitlesLayerViaHyperFrames(paths.project, subtitles, stylePreset, profile, subtitlesOverlayPath, captionRegion, subtitleMode === "final_alpha" ? "alpha" : "chroma");
        await overlaySubtitlesLayer(videoForSubtitles, subtitlesOverlayPath, profile, renderProfile, paths.subtitledVideo);
        await prisma.renderAsset.create({ data: { projectId, type: "subtitle", path: subtitlesOverlayPath } });
        await logProject(projectId, "info", `Subtitles rendered via HyperFrames overlay (${subtitleMode}).`);
        await auditProjectEvent(projectId, {
          phase: "render_preview",
          step: "subtitles_overlay",
          kind: "result",
          summary: `Subtitles rendered via HyperFrames overlay (${subtitleMode}).`,
          metadata: { subtitlesOverlayPath },
        });
      }
    } catch (hyperframesError) {
      const msg = hyperframesError instanceof Error ? hyperframesError.message : String(hyperframesError);
      await logProject(projectId, "warn", `HyperFrames subtitles failed, falling back to FFmpeg ASS burn. ${hyperframesRenderDiagnostics()} Original error: ${msg}`);
      await burnSubtitles(videoForSubtitles, paths.subtitlesAss, profile, renderProfile, paths.subtitledVideo);
      await logProject(projectId, "info", "Subtitles burned via FFmpeg ASS fallback.");
      await auditProjectEvent(projectId, {
        phase: "render_preview",
        step: "subtitles_overlay",
        kind: "fallback",
        summary: `HyperFrames subtitles failed, burned via FFmpeg ASS fallback: ${msg}`,
        payload: { error: msg, diagnostics: hyperframesRenderDiagnostics() },
      });
    }
  }

  await logProject(
    projectId,
    "info",
    effectivePresentationMode === "subtitles_only"
      ? "Preview rendered with subtitle fallback because scene rendering was disabled or unavailable."
      : skipStandaloneSubtitlePass
        ? `Preview rendered with ${effectivePresentationMode} scene composition without duplicate subtitle burn.`
        : `Preview rendered with ${effectivePresentationMode} scene composition and subtitle pass.`
  );
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
