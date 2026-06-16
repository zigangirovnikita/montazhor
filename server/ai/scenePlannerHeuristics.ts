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
const HOTKEY_RE = /\b(command|cmd|ctrl|control|option|alt|shift)\s*[-+]?\s*[a-zа-я0-9]/iu;
const NEGATION_RE = /\bне\b/iu;
const FIX_RE = /\b(лучше|используй|используйте|instead|use)\b/iu;

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
    preferredCandidates.push("before_after_phrase_swap", "comparison_split", "myth_vs_truth");
  }
  if (NEGATION_RE.test(text) && FIX_RE.test(text)) {
    preferredCandidates.push("warning_strike_fix", "myth_vs_truth");
  }
  if (HOTKEY_RE.test(text)) {
    preferredCandidates.push("hotkey_command_tip", "warning_strike_fix");
  }
  if (block.type === "myth_vs_truth" || (WARNING_RE.test(text) && COMPARE_RE.test(text))) {
    preferredCandidates.push("warning_strike_fix", "myth_vs_truth", "comparison_split");
  }
  if (TRUST_RE.test(text)) {
    preferredCandidates.push("trust_diagram");
  }
  if (block.type === "list" || LIST_RE.test(text)) {
    preferredCandidates.push(
      numberCount > 0 ? "step_number_callout" : capabilities.fullSceneEnabled ? "voiceover_full_graphic" : "checklist_reveal",
      "list_progression",
      capabilities.fullSceneEnabled ? "voiceover_full_graphic" : "checklist_reveal",
      "checklist_reveal"
    );
  }
  if (block.type === "warning" || WARNING_RE.test(text)) {
    preferredCandidates.push("warning_strike_fix", "camera_punch_in", "big_number_plus_text_plate");
  }
  if (numberCount >= 2) {
    preferredCandidates.push(
      "headline_with_accent_number",
      capabilities.fullSceneEnabled ? "speaker_right_panel_left_infographic" : "big_number_plus_text_plate",
      "big_number_plus_text_plate"
    );
  } else if (numberCount === 1 || block.type === "proof") {
    preferredCandidates.push(
      numberCount === 1 && LIST_RE.test(text) ? "step_number_callout" : "headline_with_accent_number",
      capabilities.fullSceneEnabled ? "speaker_right_panel_left_infographic" : "big_number_grow",
      "big_number_grow"
    );
  }
  if (block.type === "definition") {
    preferredCandidates.push(
      "rule_card",
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
  if (block.type === "list") return ["list_progression", "checklist_reveal", "definition_card"];
  if (HOTKEY_RE.test(block.text)) return ["hotkey_command_tip", "warning_strike_fix", "cta_finish"];
  if (block.type === "comparison" || block.type === "myth_vs_truth") return ["before_after_phrase_swap", "comparison_split", "myth_vs_truth"];
  if (block.type === "warning") return ["camera_punch_in", "big_number_plus_text_plate"];
  if (block.type === "proof") return [capabilities.fullSceneEnabled ? "speaker_right_panel_left_infographic" : "big_number_grow"];
  if (block.type === "transition") return ["clean_section_transition"];
  if (block.type === "definition") return ["rule_card", capabilities.fullSceneEnabled ? "voiceover_full_graphic" : "definition_card"];
  if (block.type === "timeline") return [capabilities.fullSceneEnabled ? "speaker_lower_half_top_visual" : "timeline_year_callout"];
  return [capabilities.fullSceneEnabled ? "speaker_lower_half_top_visual" : "hook_title_left"];
}
