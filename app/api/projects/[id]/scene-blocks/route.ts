import { readFile, unlink } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { pathsForProject, writeJsonFile } from "@/lib/storage";
import type { DirectorPlan, SceneRecipeId, ScreenCopyPayload, ScreenCopyPlan } from "@/lib/types";
import { buildReviewScenePlan } from "@/server/scene/sceneCompiler";
import { getSceneRecipe } from "@/server/scene/sceneLibrary";
import { buildScreenCopyBlock } from "@/server/scene/screenCopyPlanner";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

type SceneBlockAction =
  | "regenerate_block"
  | "change_scene"
  | "simplify_scene"
  | "make_stronger"
  | "disable_layer"
  | "bring_speaker_back"
  | "hide_speaker_for_block"
  | "switch_to_safe_mode"
  | "disable_insert"
  | "edit_copy";

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as {
    blockId?: string;
    action?: SceneBlockAction;
    recipeId?: SceneRecipeId;
    layerId?: string;
    copyPatch?: Partial<ScreenCopyPayload>;
  } | null;

  if (!body?.blockId || !body.action) {
    return NextResponse.json({ error: "blockId and action are required." }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || !["draft_ready", "review_ready"].includes(project.status)) {
    return NextResponse.json({ error: "Block review is available only for draft_ready or review_ready projects." }, { status: 409 });
  }

  const paths = pathsForProject(id);
  let directorPlan: DirectorPlan;
  let screenCopyPlan: ScreenCopyPlan;
  try {
    directorPlan = JSON.parse(await readFile(paths.directorPlan, "utf8")) as DirectorPlan;
    screenCopyPlan = JSON.parse(await readFile(paths.screenCopyPlan, "utf8")) as ScreenCopyPlan;
  } catch {
    return NextResponse.json({ error: "Director plan is not ready yet." }, { status: 404 });
  }

  const block = directorPlan.blocks.find((entry) => entry.blockId === body.blockId);
  const semanticBlock = directorPlan.semanticBlocks.find((entry) => entry.id === body.blockId);
  const copyBlock = screenCopyPlan.blocks.find((entry) => entry.blockId === body.blockId);
  if (!block || !semanticBlock || !copyBlock) {
    return NextResponse.json({ error: "Scene block was not found." }, { status: 404 });
  }

  switch (body.action) {
    case "regenerate_block": {
      block.recipeId = block.recommendedRecipeId ?? block.recipeId;
      block.sceneCategory = getSceneRecipe(block.recipeId).category;
      block.safeMode = false;
      block.disabled = false;
      block.intensity = "balanced";
      const regenerated = buildScreenCopyBlock(semanticBlock, block.recipeId, block.planningConfidence);
      Object.assign(copyBlock, regenerated);
      break;
    }
    case "change_scene": {
      if (!body.recipeId || !(block.allowedRecipeIds ?? []).includes(body.recipeId)) {
        return NextResponse.json({ error: "Recipe is not allowed for this block." }, { status: 400 });
      }
      block.recipeId = body.recipeId;
      block.sceneCategory = getSceneRecipe(body.recipeId).category;
      block.safeMode = false;
      block.disabled = false;
      const regenerated = buildScreenCopyBlock(semanticBlock, block.recipeId, block.planningConfidence);
      Object.assign(copyBlock, regenerated);
      break;
    }
    case "simplify_scene":
      block.intensity = "safe";
      block.safeMode = true;
      block.scenePriority = "support";
      block.sceneDensity = "minimal";
      break;
    case "make_stronger":
      block.intensity = "strong";
      block.safeMode = false;
      block.disabled = false;
      block.scenePriority = "hero";
      break;
    case "disable_layer":
      return NextResponse.json({ error: "Layer disabling is no longer supported directly; simplify or edit copy instead." }, { status: 400 });
    case "bring_speaker_back":
      block.speakerMode = "full_frame";
      break;
    case "hide_speaker_for_block":
      block.speakerMode = "hidden";
      break;
    case "switch_to_safe_mode":
      block.safeMode = true;
      if (block.fallbackRecipeId) {
        block.recipeId = block.fallbackRecipeId;
        block.sceneCategory = getSceneRecipe(block.recipeId).category;
        const regenerated = buildScreenCopyBlock(semanticBlock, block.recipeId, block.planningConfidence);
        Object.assign(copyBlock, regenerated);
      }
      block.intensity = "safe";
      block.sceneDensity = "minimal";
      break;
    case "disable_insert":
      block.disabled = true;
      block.scenePriority = "skip";
      block.visualRole = "none";
      break;
    case "edit_copy":
      if (!body.copyPatch || typeof body.copyPatch !== "object") {
        return NextResponse.json({ error: "copyPatch is required for edit_copy." }, { status: 400 });
      }
      copyBlock.payload = mergeCopyPatch(copyBlock.payload, body.copyPatch);
      break;
  }

  const reviewScenePlan = buildReviewScenePlan(directorPlan, screenCopyPlan);
  await writeJsonFile(paths.directorPlan, directorPlan);
  await writeJsonFile(paths.screenCopyPlan, screenCopyPlan);
  await writeJsonFile(paths.scenePlan, reviewScenePlan);
  await safeUnlink(paths.compiledScenePlan);
  await safeUnlink(paths.semanticOverlayMp4);
  await safeUnlink(paths.subtitledVideo);
  await safeUnlink(paths.browserRenderedCaptionsVideo);
  await safeUnlink(paths.browserRenderPlanLive);
  await safeUnlink(paths.reviewVideo);
  await safeUnlink(paths.finalVideo);

  await prisma.renderAsset.deleteMany({
    where: {
      projectId: id,
      type: { in: ["review", "final", "subtitle", "semantic_overlay", "cinematic_preview", "cinematic_base", "cinematic_scene_layer"] }
    }
  });
  await prisma.project.update({
    where: { id },
    data: {
      status: "draft_ready",
      reviewVideoPath: null,
      finalVideoPath: null,
      durationFinal: null
    }
  });

  return NextResponse.json({ ok: true, directorPlan, screenCopyPlan, scenePlan: reviewScenePlan });
}

function mergeCopyPatch(current: ScreenCopyPayload, patch: Partial<ScreenCopyPayload>) {
  const next: ScreenCopyPayload = { ...current };
  for (const [key, value] of Object.entries(patch) as Array<[keyof ScreenCopyPayload, ScreenCopyPayload[keyof ScreenCopyPayload]]>) {
    if (Array.isArray(value)) {
      next[key] = value.map(String).filter(Boolean) as never;
    } else if (typeof value === "string") {
      next[key] = value.trim() as never;
    }
  }
  return next;
}

async function safeUnlink(filePath: string) {
  try {
    await unlink(filePath);
  } catch {
    // noop
  }
}
