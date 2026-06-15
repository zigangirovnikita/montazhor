import type { SceneRecipeId, SemanticBlock, SpeakerMode } from "@/lib/types";
import type { TemplateSceneCapabilities } from "@/server/scene/sceneCompatibility";
import { listSceneRecipesForBlockType } from "@/server/scene/sceneLibrary";

const NUMBER_RE = /(\d+[.,]?\d*)\s?(%|к|k|тыс|млн|x|раз|₽|\$)?/giu;
const WARNING_RE = /\b(ошибка|миф|нельзя|опасно|стоп|проблема|wrong|mistake|myth|risk|danger)\b/iu;
const TRUST_RE = /\b(довер|trust|источник|source|earned|inherited|relationship|аудит|audit)\b/iu;
const QUOTE_RE = /["«»]/u;
const COMPARE_RE = /\b(против|вместо|или|versus|vs|but|instead|before|after|до|после|лучше|хуже)\b/iu;
const TIMELINE_RE = /\b(сначала|потом|затем|после этого|first|then|next|finally|step|этап|шаг)\b/iu;
const LIST_RE = /\b(первое|второе|третье|шаг|пункт|причина|список|when|how|first|second|third)\b/iu;

export function choosePreferredRecipe(
  block: SemanticBlock,
  index: number,
  capabilities: TemplateSceneCapabilities
) {
  const text = block.text;
  const numberCount = [...text.matchAll(NUMBER_RE)].length;

  const preferredCandidates: SceneRecipeId[] = [];

  if (index === 0) {
    preferredCandidates.push(capabilities.preferredHookRecipeId, "camera_punch_in");
  }
  if (block.type === "cta") {
    preferredCandidates.push(capabilities.preferredCtaRecipeId);
  }
  if (QUOTE_RE.test(text)) {
    preferredCandidates.push("quote_emphasis");
  }
  if (block.type === "timeline" || TIMELINE_RE.test(text)) {
    preferredCandidates.push(
      capabilities.fullSceneEnabled ? "speaker_lower_half_top_visual" : "timeline_year_callout",
      "timeline_year_callout"
    );
  }
  if (block.type === "comparison" || COMPARE_RE.test(text)) {
    preferredCandidates.push("comparison_split", "myth_vs_truth");
  }
  if (block.type === "myth_vs_truth" || (WARNING_RE.test(text) && COMPARE_RE.test(text))) {
    preferredCandidates.push("myth_vs_truth", "comparison_split");
  }
  if (TRUST_RE.test(text)) {
    preferredCandidates.push("trust_diagram");
  }
  if (block.type === "list" || LIST_RE.test(text)) {
    preferredCandidates.push(
      capabilities.fullSceneEnabled ? "voiceover_full_graphic" : "checklist_reveal",
      "checklist_reveal"
    );
  }
  if (block.type === "warning" || WARNING_RE.test(text)) {
    preferredCandidates.push("camera_punch_in", "big_number_plus_text_plate");
  }
  if (numberCount >= 2) {
    preferredCandidates.push(
      capabilities.fullSceneEnabled ? "speaker_right_panel_left_infographic" : "big_number_plus_text_plate",
      "big_number_plus_text_plate"
    );
  } else if (numberCount === 1 || block.type === "proof") {
    preferredCandidates.push(
      capabilities.fullSceneEnabled ? "speaker_right_panel_left_infographic" : "big_number_grow",
      "big_number_grow"
    );
  }
  if (block.type === "definition") {
    preferredCandidates.push(
      capabilities.fullSceneEnabled ? "voiceover_full_graphic" : "definition_card",
      "definition_card"
    );
  }
  if (block.type === "transition") {
    preferredCandidates.push("clean_section_transition");
  }

  preferredCandidates.push(...defaultCandidatesForBlock(block, capabilities));

  const allowed = new Set(capabilities.allowedRecipeIds);
  const sameTypeAllowed = listSceneRecipesForBlockType(block.type)
    .map((recipeDef) => recipeDef.id)
    .filter((recipeId) => allowed.has(recipeId));

  for (const recipeId of [...preferredCandidates, ...sameTypeAllowed]) {
    if (allowed.has(recipeId)) return recipeId;
  }

  return capabilities.allowedRecipeIds[0] ?? "hook_title_left";
}

export function defaultSpeakerModeForRecipe(allowed: SpeakerMode[]) {
  return allowed.includes("reframed") ? "reframed" : allowed[0] ?? "full_frame";
}

function defaultCandidatesForBlock(block: SemanticBlock, capabilities: TemplateSceneCapabilities): SceneRecipeId[] {
  if (block.type === "hook") return [capabilities.preferredHookRecipeId, "hook_title_left"];
  if (block.type === "cta") return [capabilities.preferredCtaRecipeId];
  if (block.type === "list") return ["checklist_reveal", "definition_card"];
  if (block.type === "comparison" || block.type === "myth_vs_truth") return ["comparison_split", "myth_vs_truth"];
  if (block.type === "warning") return ["camera_punch_in", "big_number_plus_text_plate"];
  if (block.type === "proof") return [capabilities.fullSceneEnabled ? "speaker_right_panel_left_infographic" : "big_number_grow"];
  if (block.type === "transition") return ["clean_section_transition"];
  if (block.type === "definition") return [capabilities.fullSceneEnabled ? "voiceover_full_graphic" : "definition_card"];
  if (block.type === "timeline") return [capabilities.fullSceneEnabled ? "speaker_lower_half_top_visual" : "timeline_year_callout"];
  return [capabilities.fullSceneEnabled ? "speaker_lower_half_top_visual" : "hook_title_left"];
}
