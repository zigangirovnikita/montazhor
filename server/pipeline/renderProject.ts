import { copyFile, readFile, unlink, writeFile } from "node:fs/promises";
import { auditProjectEvent } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { logProject, updateProjectStatus } from "@/lib/logger";
import { pathsForProject, writeJsonFile } from "@/lib/storage";
import type { ContentPlan, PresentationMode, StylePreset, TranscriptJson } from "@/lib/types";
import { parseVisualPlanOptions } from "@/lib/visualStyleOptions";
import { buildVisualScenePlanWithAi, SCENE_PLANNER_VERSION, SCENE_REGISTRY_VERSION } from "@/server/ai/visualScenePlanner";
import { buildVisualOverlayPlanWithAi } from "@/server/ai/visualPlanner";
import { hyperframesRenderDiagnostics } from "@/server/hyperframes/diagnostics";
import { loadOptionalFaceSafeRegions } from "@/server/hyperframes/faceSafeRegions";
import { renderInfographicPanel } from "@/server/hyperframes/infographic";
import { renderSceneFragments } from "@/server/hyperframes/sceneComposer";
import { type RenderProfile } from "@/server/video/encoding";
import { renderSemanticOverlay } from "@/server/hyperframes/semanticOverlay";
import { ensureArtifact, fingerprintFile, hashJson } from "@/server/render/renderGraph";
import { logStageEvent } from "@/server/render/stageProgress";
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
import type { VisualScenePlan } from "@/lib/types";

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
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
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
  const { profile, presentationMode } = await buildStyledReview(projectId, "final");

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
  await safeUnlink(paths.cinematicComposedVideo);

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
  let captionRegion = undefined;

  await updateProjectStatus(projectId, "rendering_preview");

  if (presentationMode === "cinematic_scenes") {
    // Stage: scene_plan (cached by transcript + EDL + contentPlan + planner/registry versions)
    // If cache hit, AI is NOT called at all — saves API cost and latency.
    const scenePlanCacheKey = [
      hashJson(transcript),
      hashJson(edl),
      hashJson(contentPlan),
      SCENE_PLANNER_VERSION,
      SCENE_REGISTRY_VERSION,
    ].join(":");
    let visualScenePlan: VisualScenePlan;
    const scenePlanResult = await ensureArtifact(
      projectId,
      "scene_plan",
      scenePlanCacheKey,
      paths.visualScenePlan,
      async () => {
        const plan = await buildVisualScenePlanWithAi(
          {
            transcript,
            edl,
            subtitles,
            contentPlan,
            stylePreset,
            duration: cleanMetadata.duration
          },
          projectId,
          (message) => logProject(projectId, "info", message)
        );
        await writeJsonFile(paths.visualScenePlan, plan);
      },
      { timeoutMs: 2 * 60_000 }
    );
    // Load the plan from disk (whether freshly written or cached)
    visualScenePlan = JSON.parse(await readFile(paths.visualScenePlan, "utf8")) as VisualScenePlan;
    if (!scenePlanResult.cached) {
      await auditProjectEvent(projectId, {
        phase: "render_preview",
        step: "visual_scene_plan",
        kind: "result",
        summary: `Cinematic scene plan generated with ${visualScenePlan.scenes.length} scenes.`,
        metadata: { path: paths.visualScenePlan },
        payload: visualScenePlan,
      });
    }

    if (visualScenePlan.scenes.length === 0) {
      throw new Error("Cinematic scene planner produced no scenes.");
    }

    try {
      await logStageEvent(projectId, { stage: "cinematic_scenes", status: "started" });
      await renderSceneFragments(
        projectId,
        paths.project,
        paths.cleanVideo,
        visualScenePlan,
        profile,
        paths.cinematicComposedVideo,
        renderProfile
      );
    } catch (cinematicError) {
      const message = cinematicError instanceof Error ? cinematicError.message : String(cinematicError);
      await logProject(projectId, "error", `Cinematic scene rendering failed. ${hyperframesRenderDiagnostics()} Original error: ${message}`);
      await auditProjectEvent(projectId, {
        phase: "render_preview",
        step: "cinematic_scenes",
        kind: "failed",
        summary: `Cinematic scene rendering failed: ${message}`,
        payload: { error: message, diagnostics: hyperframesRenderDiagnostics() },
      });
      throw cinematicError;
    }

    await prisma.renderAsset.create({ data: { projectId, type: "cinematic_scene_layer", path: paths.cinematicSceneVideo } });
    await prisma.renderAsset.create({ data: { projectId, type: "cinematic_base", path: paths.cinematicComposedVideo } });
    
    const subtitleMode: SubtitleRenderMode = renderProfile === "final" ? "final_alpha" : "preview_rich";
    const overlayExt = subtitleMode === "final_alpha" ? "mov" : "mp4";
    const subtitlesOverlayPath = paths.subtitlesOverlayMp4.replace(/\.mp4$/, `.${overlayExt}`);
    await renderSubtitlesLayerViaHyperFrames(paths.project, subtitles, stylePreset, profile, subtitlesOverlayPath, undefined, subtitleMode === "final_alpha" ? "alpha" : "chroma");
    await overlaySubtitlesLayer(paths.cinematicComposedVideo, subtitlesOverlayPath, profile, renderProfile, paths.subtitledVideo);
    
    await prisma.renderAsset.create({ data: { projectId, type: "subtitle", path: subtitlesOverlayPath } });
    await prisma.renderAsset.create({ data: { projectId, type: "cinematic_preview", path: paths.subtitledVideo } });
    await logProject(projectId, "info", `Cinematic scenes rendered with ${visualScenePlan.scenes.length} directed scenes and subtitle overlay.`);
    await auditProjectEvent(projectId, {
      phase: "render_preview",
      step: "cinematic_scenes",
      kind: "result",
      summary: `Cinematic scenes rendered with ${visualScenePlan.scenes.length} directed scenes and subtitle overlay.`,
      metadata: { sceneLayerPath: paths.cinematicSceneVideo, cinematicComposedPath: paths.cinematicComposedVideo, outputPath: paths.subtitledVideo },
    });
    return { profile, stylePreset, presentationMode: effectivePresentationMode };
  }

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
      await auditProjectEvent(projectId, {
        phase: "render_preview",
        step: "visual_plan",
        kind: "result",
        summary: `Visual plan generated with ${visualPlan.beats.length} beats.`,
        metadata: { path: paths.visualPlan },
        payload: visualPlan,
      });

      if (visualPlan.beats.length > 0) {
        await renderSemanticOverlay(paths.project, paths.cleanVideo, visualPlan, profile, cleanMetadata.duration, paths.subtitledVideo, effectiveVisualOptions);
        await prisma.renderAsset.create({ data: { projectId, type: "semantic_overlay", path: paths.subtitledVideo } });
      await logProject(projectId, `info`, `Semantic overlay rendered with ${visualPlan.beats.length} beats natively.`);
      await auditProjectEvent(projectId, {
        phase: "render_preview",
        step: "semantic_overlay",
        kind: "result",
        summary: `Semantic overlay rendered with ${visualPlan.beats.length} beats natively.`,
        metadata: { outputPath: paths.subtitledVideo },
      });
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
      await auditProjectEvent(projectId, {
        phase: "render_preview",
        step: "semantic_overlay",
        kind: "failed",
        summary: `Semantic overlay failed: ${message}`,
        payload: { error: message, diagnostics: hyperframesRenderDiagnostics() },
      });
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

  effectivePresentationMode = "subtitles_only";
  await writeFile(paths.subtitlesAss, assFromSubtitles(subtitles, stylePreset, profile, captionRegion), "utf8");
  await logProject(projectId, "info", `Generated ${subtitles.length} subtitle chunks (ASS).`);

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
