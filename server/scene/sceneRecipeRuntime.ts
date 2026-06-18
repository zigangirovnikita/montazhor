import type { DirectorPlanBlock, ScreenCopyPayload } from "../../lib/types";
import { getSceneRecipe } from "./sceneLibrary";

export function resolveRecipeForPayload(
  recipeId: DirectorPlanBlock["recipeId"],
  payload: ScreenCopyPayload,
  fallbackRecipeId?: DirectorPlanBlock["recipeId"]
) {
  const recipe = getSceneRecipe(recipeId);
  const slotRoles = new Set((payload.slots ?? []).map((slot) => slot.role));
  const satisfies = recipe.requiredSlotRoles.every((role) => slotRoles.has(role));
  if (satisfies) return recipeId;
  return fallbackRecipeId ?? recipe.fallbackRecipeId ?? recipeId;
}

export function buildSceneRecipeRuntime(
  recipeId: DirectorPlanBlock["recipeId"],
  payload: ScreenCopyPayload,
  fallbackRecipeId?: DirectorPlanBlock["recipeId"]
) {
  const validatedRecipeId = resolveRecipeForPayload(recipeId, payload, fallbackRecipeId);
  const recipeDef = getSceneRecipe(validatedRecipeId);
  return {
    recipeId: validatedRecipeId,
    recipeDef,
    overlayRole: validatedRecipeId === "cta_finish" ? "cta" : "semantic_accent",
    fullScenePresetId: validatedRecipeId,
  };
}
