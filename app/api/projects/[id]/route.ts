import { stat } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { pathsForProject } from "@/lib/storage";
import { readDraftProposal } from "@/server/pipeline/processProject";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const AGGRESSIVENESS = new Set(["low", "medium", "high"]);
const CLEANUP_MODES = new Set(["pauses_only", "semantic_cleanup"]);
const PRESENTATION_MODES = new Set(["subtitles_only", "subtitles_infographics", "subtitles_infographics_media"]);
const STYLE_PRESETS = new Set(["clean_expert", "dynamic_viral", "premium_calm"]);

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

  return NextResponse.json({
    project,
    draft,
    downloadUrl: project.finalVideoPath ? `/api/projects/${id}/download` : null,
    reviewUrl: project.reviewVideoPath ? `/api/projects/${id}/review` : null,
    cleanPreviewUrl: cleanPreviewReady ? `/api/projects/${id}/clean` : null,
    originalUrl: `/api/projects/${id}/original`
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    aggressiveness?: unknown;
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

  if (body.cleanupMode !== undefined || body.aggressiveness !== undefined) {
    if (project.status !== "uploaded") {
      return NextResponse.json({ error: "Способ чистки можно менять только до старта анализа." }, { status: 409 });
    }

    const cleanupMode = String(body.cleanupMode ?? "").trim();
    const aggressiveness = String(body.aggressiveness ?? "").trim();

    if (cleanupMode) {
      if (!CLEANUP_MODES.has(cleanupMode)) {
        return NextResponse.json({ error: "Unknown cleanup mode." }, { status: 400 });
      }
      data.cleanupMode = cleanupMode;
      data.aggressiveness = cleanupMode === "pauses_only" ? "low" : "medium";
    } else {
      if (!AGGRESSIVENESS.has(aggressiveness)) {
        return NextResponse.json({ error: "Unknown cutting mode." }, { status: 400 });
      }
      data.aggressiveness = aggressiveness;
      data.cleanupMode = aggressiveness === "low" ? "pauses_only" : "semantic_cleanup";
    }
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
      data.editMode = presentationMode === "subtitles_infographics" ? "cut_subtitles_infographics" : "cut_subtitles";
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
