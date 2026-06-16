import type { LayerActionBeat, SceneMicroBeat, SceneRecipeId, ScreenCopyPayload, SemanticBlock, TranscriptWord } from "@/lib/types";

const NUMBER_RE = /\d/;
const CONTRAST_RE = /^(но|или|vs|versus|против|вместо|before|after|до|после)$/iu;
const WARNING_RE = /^(стоп|опасно|ошибка|risk|danger|warning)$/iu;
const CTA_RE = /^(подпишись|сохрани|скачай|переходи|join|follow|save|download)$/iu;
const STOP_WORD_RE = /^(и|а|но|не|за|как|это|вот|ну|то|ли|же|the|a|an|and|or|to|of|in)$/iu;

export function buildMicroBeatsForBlock(
  block: SemanticBlock,
  words: TranscriptWord[],
  recipeId?: SceneRecipeId
): SceneMicroBeat[] {
  return buildFallbackMicroBeats(block, words, recipeId);
}

export function buildMicroBeatsFromSemanticPayload(
  block: SemanticBlock,
  payload: ScreenCopyPayload,
  recipeId?: SceneRecipeId
): SceneMicroBeat[] {
  const actionBeats = compileActionBeats(block, payload.layerActions ?? []);
  const slotBeats = compileSlotBeats(block, payload, recipeId);
  const merged = dedupeCandidates([...actionBeats, ...slotBeats]).slice(0, maxBeatsForRecipe(recipeId, block));
  if (merged.length > 0) return merged;
  return buildFallbackMicroBeats(block, block.words, recipeId);
}

function buildFallbackMicroBeats(
  block: SemanticBlock,
  words: TranscriptWord[],
  recipeId?: SceneRecipeId
): SceneMicroBeat[] {
  if (words.length === 0) return [];

  const candidates = buildPhraseCandidates(block, words);
  const filtered = candidates.filter((candidate) => {
    if (!candidate.anchorText) return false;
    const normalized = candidate.anchorText.toLowerCase();
    if (!NUMBER_RE.test(normalized) && STOP_WORD_RE.test(normalized)) return false;
    return true;
  });

  const selected = filtered
    .filter((candidate) => isRecipeRelevant(candidate.type, recipeId))
    .slice(0, maxBeatsForRecipe(recipeId, block));

  if (selected.length > 0) return selected;

  const fallback = words.find((word) => !STOP_WORD_RE.test(word.word)) ?? words[0]!;
  return [{
    id: `${block.id}-beat-safe`,
    type: (block.type === "list" ? "checklist_row" : "subtitle_emphasis") as SceneMicroBeat["type"],
    start: round(Math.max(block.start, fallback.start)),
    end: round(Math.min(block.end, fallback.end + 0.7)),
    anchorText: fallback.word,
    anchorWordRange: {
      startIndex: block.transcriptWordRange.startIndex,
      endIndex: block.transcriptWordRange.startIndex
    }
  }];
}

function compileActionBeats(block: SemanticBlock, actions: LayerActionBeat[]) {
  return actions.map((action, index) => ({
    id: `${block.id}-beat-action-${String(index + 1).padStart(2, "0")}`,
    type: mapActionType(action.type),
    start: round(action.start),
    end: round(Math.min(block.end, Math.max(action.start + 0.18, action.end))),
    anchorText: typeof action.payload?.label === "string"
      ? action.payload.label
      : typeof action.payload?.kind === "string"
        ? action.payload.kind
        : undefined,
    payload: {
      ...action.payload,
      targetSlotId: action.targetSlotId,
      supportVisualId: action.supportVisualId
    }
  }));
}

function compileSlotBeats(block: SemanticBlock, payload: ScreenCopyPayload, recipeId?: SceneRecipeId) {
  const slots = payload.slots ?? [];
  return slots
    .map((slot, index) => ({
      id: `${block.id}-beat-slot-${String(index + 1).padStart(2, "0")}`,
      type: mapSlotRole(slot.role, recipeId),
      start: round(slot.start),
      end: round(Math.min(block.end, Math.max(slot.start + 0.22, slot.end))),
      anchorText: slot.shortText ?? slot.text,
      anchorWordRange: slot.wordRange,
      payload: {
        role: slot.role,
        style: slot.style
      }
    }))
    .filter((candidate) => isRecipeRelevant(candidate.type, recipeId));
}

function buildPhraseCandidates(block: SemanticBlock, words: TranscriptWord[]) {
  const candidates: SceneMicroBeat[] = [];
  const push = (startIndex: number, endIndex: number, type: SceneMicroBeat["type"]) => {
    const phraseWords = words.slice(startIndex, endIndex + 1);
    const anchorText = phraseWords.map((word) => word.word).join(" ").trim();
    if (!anchorText) return;
    candidates.push({
      id: `${block.id}-beat-${String(candidates.length + 1).padStart(2, "0")}`,
      type,
      start: round(phraseWords[0]!.start),
      end: round(Math.min(block.end, Math.max(phraseWords.at(-1)!.end, phraseWords[0]!.start + 0.45))),
      anchorText,
      anchorWordRange: {
        startIndex: block.transcriptWordRange.startIndex + startIndex,
        endIndex: block.transcriptWordRange.startIndex + endIndex
      }
    });
  };

  words.forEach((word, index) => {
    const normalized = word.word.toLowerCase();
    if (NUMBER_RE.test(normalized)) {
      push(index, extendPhrase(words, index), "number_emphasis");
      return;
    }
    if (WARNING_RE.test(normalized)) {
      push(index, extendPhrase(words, index), "strike_through");
      return;
    }
    if (CTA_RE.test(normalized)) {
      push(index, extendPhrase(words, index), "label_reveal");
      return;
    }
    if (CONTRAST_RE.test(normalized)) {
      push(index, extendPhrase(words, index), "panel_state_change");
      return;
    }
    if (isStrongPhraseStarter(word.word)) {
      push(index, extendPhrase(words, index), "keyword_highlight");
    }
  });

  if (block.type === "list" && words.length >= 3) {
    push(0, Math.min(words.length - 1, 2), "checklist_row");
  }
  if ((block.type === "comparison" || block.type === "myth_vs_truth") && words.length >= 4) {
    push(0, Math.min(words.length - 1, 1), "label_reveal");
    push(Math.max(0, words.length - 2), words.length - 1, "label_reveal");
  }
  if (recipeIdForQuote(block) && words.length >= 4) {
    push(0, Math.min(words.length - 1, 3), "subtitle_emphasis");
  }

  return dedupeCandidates(candidates);
}

function extendPhrase(words: TranscriptWord[], startIndex: number) {
  let endIndex = startIndex;
  while (endIndex + 1 < words.length) {
    const next = words[endIndex + 1]!;
    if (STOP_WORD_RE.test(next.word)) break;
    if (NUMBER_RE.test(next.word) || next.word.length >= 5 || /^[A-ZА-Я]/u.test(next.word)) {
      endIndex += 1;
      if (endIndex - startIndex >= 2) break;
      continue;
    }
    break;
  }
  return endIndex;
}

function isStrongPhraseStarter(word: string) {
  return word.length >= 6 || /^[A-ZА-Я]/u.test(word);
}

function isRecipeRelevant(type: SceneMicroBeat["type"], recipeId?: SceneRecipeId) {
  if (!recipeId) return true;
  if (recipeId === "quote_emphasis") return type === "keyword_highlight" || type === "subtitle_emphasis";
  if (recipeId === "comparison_split" || recipeId === "myth_vs_truth" || recipeId === "before_after_phrase_swap" || recipeId === "warning_strike_fix") {
    return type === "label_reveal" || type === "panel_state_change" || type === "strike_through";
  }
  if (recipeId === "checklist_reveal" || recipeId === "list_progression" || recipeId === "step_number_callout") {
    return type === "checklist_row" || type === "label_reveal" || type === "keyword_highlight";
  }
  if (recipeId === "big_number_grow" || recipeId === "big_number_plus_text_plate" || recipeId === "speaker_right_panel_left_infographic") {
    return type === "number_emphasis" || type === "panel_state_change";
  }
  if (recipeId === "headline_with_accent_number") return type === "number_emphasis" || type === "keyword_highlight";
  if (recipeId === "hotkey_command_tip" || recipeId === "cta_finish") return type === "label_reveal" || type === "icon_pop" || type === "keyword_highlight";
  if (recipeId === "rule_card") return type === "keyword_highlight" || type === "label_reveal";
  return true;
}

function maxBeatsForRecipe(recipeId: SceneRecipeId | undefined, block: SemanticBlock) {
  if (recipeId === "quote_emphasis") return 2;
  if (recipeId === "comparison_split" || recipeId === "myth_vs_truth" || recipeId === "before_after_phrase_swap" || recipeId === "warning_strike_fix") return 4;
  if (recipeId === "checklist_reveal" || recipeId === "timeline_year_callout" || recipeId === "list_progression" || recipeId === "step_number_callout") return 4;
  if (recipeId === "cta_finish") return 1;
  return block.end - block.start >= 5 ? 3 : 2;
}

function mapActionType(type: LayerActionBeat["type"]): SceneMicroBeat["type"] {
  if (type === "grow_number") return "number_emphasis";
  if (type === "highlight_slot") return "keyword_highlight";
  if (type === "strike_slot" || type === "swap_to_correct") return "strike_through";
  if (type === "reveal_step") return "checklist_row";
  if (type === "show_hotkey" || type === "show_layer") return "label_reveal";
  if (type === "pop_support_visual") return "icon_pop";
  if (type === "camera_push") return "camera_push";
  return "background_shift";
}

function mapSlotRole(role: NonNullable<ScreenCopyPayload["slots"]>[number]["role"], recipeId?: SceneRecipeId): SceneMicroBeat["type"] {
  if (role === "hero_number" || role === "step_index") return "number_emphasis";
  if (role === "wrong_phrase" || role === "correct_phrase") return recipeId === "comparison_split" ? "panel_state_change" : "strike_through";
  if (role === "command_hotkey") return "label_reveal";
  if (role === "keyword_accent" || role === "headline") return "keyword_highlight";
  if (role === "comparison_left" || role === "comparison_right") return "panel_state_change";
  if (role === "cta_phrase") return "label_reveal";
  return "subtitle_emphasis";
}

function recipeIdForQuote(block: SemanticBlock) {
  return block.text.includes("\"") || block.text.includes("«") || block.text.includes("»");
}

function dedupeCandidates(candidates: SceneMicroBeat[]) {
  return candidates.filter((candidate, index) => {
    const previous = candidates[index - 1];
    if (!previous) return true;
    return !(previous.anchorText === candidate.anchorText && Math.abs(previous.start - candidate.start) < 0.05);
  });
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
