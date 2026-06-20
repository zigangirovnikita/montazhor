import { stat } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProjectJobLabel, isProjectJobActive } from "@/lib/jobs";
import { pathsForProject } from "@/lib/storage";
import { readDraftProposal } from "@/server/pipeline/processProject";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const CLEANUP_MODES = new Set(["pauses_only", "pauses_and_fillers", "semantic_cleanup"]);
const PRESENTATION_MODES = new Set(["subtitles_only", "subtitles_infographics", "subtitles_infographics_media", "cinematic_scenes"]);
const STYLE_PRESETS = new Set(["clean_expert", "dynamic_viral", "premium_calm", "course_glass", "expert_clean", "viral_kinetic"]);

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      logs: { orderBy: { createdAt: "desc" }, take: 20 },
      aiUsages: { orderBy: { createdAt: "asc" } },
      renderAssets: { orderBy: { createdAt: "desc" } }
    }
  });

  if (!project) {
    return NextResponse.json({ error: "Project was not found." }, { status: 404 });
  }

  let draft = null;
  if (["draft_ready", "rendering_clean_video", "rendering_preview", "review_ready", "rendering_final", "done"].includes(project.status)) {
    try {
      draft = await readDraftProposal(id);
    } catch {
      draft = null;
    }
  }

  const paths = pathsForProject(id);
  const cleanPreviewReady = await stat(paths.cleanVideo).then(() => true).catch(() => false);
  const subtitledVideoReady = await stat(paths.subtitledVideo).then(() => true).catch(() => false);
  const revision = project.updatedAt.getTime();
  const activeJobLabel = getProjectJobLabel(id);
  const subtitledVideoActive = isProjectJobActive(id) && activeJobLabel === "Subtitled video render";

  return NextResponse.json({
    project,
    draft,
    downloadUrl: project.finalVideoPath ? `/api/projects/${id}/download?v=${revision}` : null,
    reviewUrl: project.reviewVideoPath ? `/api/projects/${id}/review?v=${revision}` : null,
    cleanPreviewUrl: cleanPreviewReady ? `/api/projects/${id}/clean?v=${revision}` : null,
    originalUrl: `/api/projects/${id}/original?v=${revision}`,
    subtitledVideoUrl: subtitledVideoReady ? `/api/projects/${id}/download-subtitled?v=${revision}` : null,
    subtitledVideoActive
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    cleanupMode?: unknown;
    presentationMode?: unknown;
    stylePreset?: unknown;
    styleOptionsJson?: unknown;
  };

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Project was not found." }, { status: 404 });
  }

  const data: Record<string, string> = {};

  if (body.cleanupMode !== undefined) {
    if (project.status !== "uploaded") {
      return NextResponse.json({ error: "Способ чистки можно менять только до старта анализа." }, { status: 409 });
    }

    const cleanupMode = String(body.cleanupMode ?? "").trim();
    if (!CLEANUP_MODES.has(cleanupMode)) {
      return NextResponse.json({ error: "Unknown cleanup mode." }, { status: 400 });
    }
    data.cleanupMode = cleanupMode;
  }

  if (body.presentationMode !== undefined || body.stylePreset !== undefined || body.styleOptionsJson !== undefined) {
    if (!["draft_ready", "review_ready"].includes(project.status)) {
      return NextResponse.json({ error: "Оформление можно менять только после готовности чернового монтажа." }, { status: 409 });
    }

    if (body.presentationMode !== undefined) {
      const presentationMode = String(body.presentationMode ?? "").trim();
      if (!PRESENTATION_MODES.has(presentationMode)) {
        return NextResponse.json({ error: "Unknown presentation mode." }, { status: 400 });
      }
      data.presentationMode = presentationMode;
      data.editMode = presentationMode === "subtitles_only" ? "cut_subtitles" : "cut_subtitles_infographics";
    }

    if (body.stylePreset !== undefined) {
      const stylePreset = String(body.stylePreset ?? "").trim();
      if (!STYLE_PRESETS.has(stylePreset)) {
        return NextResponse.json({ error: "Unknown style preset." }, { status: 400 });
      }
      data.stylePreset = stylePreset;
    }

    if (body.styleOptionsJson !== undefined) {
      data.styleOptionsJson = typeof body.styleOptionsJson === "string"
        ? body.styleOptionsJson
        : JSON.stringify(body.styleOptionsJson);
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No supported settings were provided." }, { status: 400 });
  }

  await prisma.project.update({
    where: { id },
    data
  });

  return NextResponse.json({ ok: true });
}
