import { readFile, unlink } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { pathsForProject, writeJsonFile } from "@/lib/storage";
import type { ScenePlan, SceneRecipeId } from "@/lib/types";
import { getSceneRecipe } from "@/server/scene/sceneLibrary";

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
  | "switch_to_safe_mode";

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as {
    blockId?: string;
    action?: SceneBlockAction;
    recipeId?: SceneRecipeId;
    layerId?: string;
  } | null;

  if (!body?.blockId || !body.action) {
    return NextResponse.json({ error: "blockId and action are required." }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || !["draft_ready", "review_ready"].includes(project.status)) {
    return NextResponse.json({ error: "Block review is available only for draft_ready or review_ready projects." }, { status: 409 });
  }

  const paths = pathsForProject(id);
  let scenePlan: ScenePlan;
  try {
    scenePlan = JSON.parse(await readFile(paths.scenePlan, "utf8")) as ScenePlan;
  } catch {
    return NextResponse.json({ error: "Scene plan is not ready yet." }, { status: 404 });
  }

  const block = scenePlan.blocks.find((entry) => entry.blockId === body.blockId);
  if (!block) {
    return NextResponse.json({ error: "Scene block was not found." }, { status: 404 });
  }

  switch (body.action) {
    case "regenerate_block":
      block.recipeId = block.recommendedRecipeId ?? block.recipeId;
      block.safeMode = false;
      block.intensity = "balanced";
      block.layerPlan.forEach((layer) => { layer.enabled = true; });
      break;
    case "change_scene":
      if (!body.recipeId || !(block.allowedRecipeIds ?? []).includes(body.recipeId)) {
        return NextResponse.json({ error: "Recipe is not allowed for this block." }, { status: 400 });
      }
      block.recipeId = body.recipeId;
      block.sceneCategory = getSceneRecipe(body.recipeId).category;
      block.safeMode = false;
      break;
    case "simplify_scene":
      block.intensity = "safe";
      block.safeMode = true;
      block.layerPlan.forEach((layer, index) => {
        if (index > 0 && layer.kind !== "speaker") layer.enabled = false;
      });
      break;
    case "make_stronger":
      block.intensity = "strong";
      block.safeMode = false;
      break;
    case "disable_layer":
      if (!body.layerId) {
        return NextResponse.json({ error: "layerId is required for disable_layer." }, { status: 400 });
      }
      const layer = block.layerPlan.find((entry) => entry.id === body.layerId);
      if (!layer) {
        return NextResponse.json({ error: "Layer was not found." }, { status: 404 });
      }
      layer.enabled = false;
      break;
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
      }
      block.intensity = "safe";
      break;
  }

  await writeJsonFile(paths.scenePlan, scenePlan);
  await safeUnlink(paths.compiledScenePlan);
  await safeUnlink(paths.semanticOverlayMp4);
  await safeUnlink(paths.subtitledVideo);
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

  return NextResponse.json({ ok: true, scenePlan });
}

async function safeUnlink(filePath: string) {
  try {
    await unlink(filePath);
  } catch {
    // noop
  }
}
