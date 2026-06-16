import type {
  LayerActionBeat,
  PlanningConfidence,
  SceneRecipeId,
  ScreenCopyPayload,
  SemanticBlock,
  SemanticSlot,
  SupportVisualIntent,
  TranscriptWord
} from "@/lib/types";

const NUMBER_RE = /(\d+[.,]?\d*)\s?(%|к|k|тыс|млн|x|раз|₽|\$)?/iu;
const HOTKEY_RE = /\b(command|cmd|ctrl|control|option|alt|shift)\s*[-+]?\s*([a-zа-я0-9])/iu;
const STEP_RE = /\b(перв(ый|ое|ая)|втор(ой|ое|ая)|трет(ий|ье|ья)|шаг|step|пункт)\b/iu;
const NEGATION_RE = /\bне\b/iu;
const FIX_RE = /\b(лучше|используй|используйте|нужно|надо|instead|use)\b/iu;
const COMPARISON_RE = /\b(вместо|или|vs|versus|против|до|после)\b/iu;
const CTA_RE = /\b(подпиш|сохрани|переходи|скачай|join|follow|save|download)\b/iu;

interface SemanticPayloadBuildResult {
  payload: ScreenCopyPayload;
  confidence: PlanningConfidence;
}

export function buildSemanticScreenPayload(
  block: SemanticBlock,
  recipeId: SceneRecipeId,
  directorConfidence: PlanningConfidence,
  preferredTitle?: string
): SemanticPayloadBuildResult {
  const slots = buildSemanticSlots(block, preferredTitle);
  const supportVisuals = buildSupportVisuals(block, slots);
  const layerActions = buildLayerActions(block, slots, supportVisuals);
  const payload = buildRecipePayload(block, recipeId, slots, supportVisuals, layerActions, preferredTitle);
  return {
    payload,
    confidence: mergeSemanticConfidence(directorConfidence, payload)
  };
}

function buildSemanticSlots(block: SemanticBlock, preferredTitle?: string) {
  const slots: SemanticSlot[] = [];
  const contextTitle = compressHeadline(preferredTitle && block.type === "hook" ? preferredTitle : block.summary);
  const words = block.words;
  const numberMatch = NUMBER_RE.exec(block.text);
  const hotkeyMatch = HOTKEY_RE.exec(block.text);
  const wrongRight = extractWrongRight(block.text) ?? extractInstructionFixPair(block.text);
  const comparison = extractComparison(block.text);
  const quote = extractQuote(block.text);
  const step = extractStep(words);

  if (numberMatch) {
    const numberRange = findRangeForText(words, numberMatch[0]);
    if (numberRange) {
      slots.push(makeSlot(block, slots.length, "hero_number", numberMatch[0], "accent", numberRange, shorten(numberMatch[0], 12)));
    }
  }

  if (step) {
    slots.push(makeSlot(block, slots.length, "step_index", step.indexText, "accent", step.range, shorten(step.indexText, 10)));
    if (step.labelText) {
      slots.push(makeSlot(block, slots.length, "step_label", step.labelText, "primary", step.labelRange, shorten(step.labelText, 20)));
    }
  }

  if (wrongRight) {
    slots.push(makeSlot(block, slots.length, "wrong_phrase", wrongRight.wrong, "danger", wrongRight.wrongRange, shorten(wrongRight.wrong, 28)));
    slots.push(makeSlot(block, slots.length, "correct_phrase", wrongRight.correct, "primary", wrongRight.correctRange, shorten(wrongRight.correct, 30)));
  } else if (comparison) {
    slots.push(makeSlot(block, slots.length, "comparison_left", comparison.left, "muted", comparison.leftRange, shorten(comparison.left, 24)));
    slots.push(makeSlot(block, slots.length, "comparison_right", comparison.right, "primary", comparison.rightRange, shorten(comparison.right, 24)));
  }

  if (hotkeyMatch) {
    const hotkeyRange = findRangeForText(words, hotkeyMatch[0]) ?? fallbackRange(block, 0.55);
    slots.push(makeSlot(block, slots.length, "command_hotkey", normalizeHotkey(hotkeyMatch[0]), "chip", hotkeyRange, normalizeHotkey(hotkeyMatch[0])));
  }

  if (!slots.some((slot) => slot.role === "wrong_phrase") && !slots.some((slot) => slot.role === "correct_phrase")) {
    const fallbackFixIndex = words.findIndex((word) => /^(лучше|используй|используйте|instead|use)$/iu.test(word.word));
    if (fallbackFixIndex > 1) {
      const wrongWords = words.slice(0, fallbackFixIndex).filter((word) => !/^(не|делай|делайте)$/iu.test(word.word));
      const correctWords = words.slice(fallbackFixIndex).filter((word) => !/^(лучше)$/iu.test(word.word));
      if (wrongWords.length > 0 && correctWords.length > 0) {
        slots.push(makeSlot(
          block,
          slots.length,
          "wrong_phrase",
          wrongWords.map((word) => word.word).join(" "),
          "danger",
          rangeFromWordsRaw(words, Math.max(0, words.indexOf(wrongWords[0]!)), Math.max(0, words.indexOf(wrongWords.at(-1)!))),
          shorten(wrongWords.map((word) => word.word).join(" "), 28)
        ));
        slots.push(makeSlot(
          block,
          slots.length,
          "correct_phrase",
          correctWords.map((word) => word.word).join(" "),
          "primary",
          rangeFromWordsRaw(words, Math.max(0, words.indexOf(correctWords[0]!)), Math.max(0, words.indexOf(correctWords.at(-1)!))),
          shorten(correctWords.map((word) => word.word).join(" "), 30)
        ));
      }
    }
  }

  if (quote) {
    slots.push(makeSlot(block, slots.length, "quote_pull", quote.text, "primary", quote.range, shorten(quote.text, 42)));
  }

  const headlineText = resolveHeadline(block, contextTitle, slots);
  if (headlineText) {
    const headlineRange = findRangeForText(words, headlineText) ?? rangeFromWords(block, 0, Math.min(words.length - 1, Math.max(0, Math.min(5, words.length - 1))));
    slots.unshift(makeSlot(block, -1, "headline", headlineText, slots.some((slot) => slot.role === "hero_number") ? "primary" : "accent", headlineRange, shorten(headlineText, 34)));
  }

  const keywordSlots = buildKeywordSlots(block, slots);
  slots.push(...keywordSlots);

  if (CTA_RE.test(block.text)) {
    const ctaRange = findRangeForText(words, block.text) ?? fallbackRange(block, 0.8);
    slots.push(makeSlot(block, slots.length, "cta_phrase", compressDetail(block.text, 34), "accent", ctaRange, compressHeadline(block.text)));
  }

  if (slots.length === 0) {
    slots.push(makeSlot(block, 0, "headline", contextTitle || compressHeadline(block.text), "primary", fallbackRange(block, 0.75), contextTitle || compressHeadline(block.text)));
  }

  return dedupeSlots(slots);
}

function buildSupportVisuals(block: SemanticBlock, slots: SemanticSlot[]) {
  const visuals: SupportVisualIntent[] = [];
  const push = (kind: SupportVisualIntent["kind"], label?: string, anchorSlotId?: string, start?: number, end?: number) => {
    visuals.push({
      id: `${block.id}-visual-${String(visuals.length + 1).padStart(2, "0")}`,
      kind,
      label,
      anchorSlotId,
      start: round(start ?? block.start),
      end: round(end ?? Math.min(block.end, block.start + 1.2))
    });
  };

  const hotkeySlot = slots.find((slot) => slot.role === "command_hotkey");
  if (hotkeySlot) {
    push("hotkey_keys", hotkeySlot.shortText ?? hotkeySlot.text, hotkeySlot.id, hotkeySlot.start, hotkeySlot.end + 0.3);
    push("keyboard", "keyboard", hotkeySlot.id, hotkeySlot.start, hotkeySlot.end + 0.4);
  }

  const wrongSlot = slots.find((slot) => slot.role === "wrong_phrase");
  const correctSlot = slots.find((slot) => slot.role === "correct_phrase");
  if (wrongSlot) {
    const wrongText = wrongSlot.text.toLowerCase();
    if (wrongText.includes("мыш") || wrongText.includes("cursor")) push("mouse", "mouse", wrongSlot.id, wrongSlot.start, wrongSlot.end);
    if (wrongText.includes("мыш") || wrongText.includes("курсор")) push("cursor", "cursor", wrongSlot.id, wrongSlot.start, wrongSlot.end);
    push("warning_mark", "warning", wrongSlot.id, wrongSlot.start, wrongSlot.end);
  }
  if (correctSlot) {
    push("checkmark", "ok", correctSlot.id, correctSlot.start, correctSlot.end);
  }

  const numberSlot = slots.find((slot) => slot.role === "hero_number" || slot.role === "step_index");
  if (numberSlot) {
    push("number_badge", numberSlot.shortText ?? numberSlot.text, numberSlot.id, numberSlot.start, numberSlot.end);
  }

  if (block.type === "timeline") {
    push("timeline_tick", "timeline", numberSlot?.id, block.start, Math.min(block.end, block.start + 1.5));
  }
  if (block.type === "proof" || block.type === "comparison") {
    push("chart_pulse", "data", numberSlot?.id, block.start, Math.min(block.end, block.start + 1.2));
  }

  return visuals;
}

function buildLayerActions(block: SemanticBlock, slots: SemanticSlot[], supportVisuals: SupportVisualIntent[]) {
  const actions: LayerActionBeat[] = [];
  const push = (
    type: LayerActionBeat["type"],
    start: number,
    end: number,
    targetSlotId?: string,
    supportVisualId?: string,
    payload?: Record<string, unknown>
  ) => {
    actions.push({
      id: `${block.id}-action-${String(actions.length + 1).padStart(2, "0")}`,
      type,
      start: round(start),
      end: round(Math.max(start + 0.18, Math.min(block.end, end))),
      targetSlotId,
      supportVisualId,
      payload
    });
  };

  slots.forEach((slot) => {
    push("show_layer", slot.start, Math.min(block.end, slot.start + 0.28), slot.id);
    if (slot.role === "hero_number") push("grow_number", slot.start, slot.end, slot.id);
    if (slot.role === "step_index") push("reveal_step", slot.start, slot.end, slot.id);
    if (slot.role === "wrong_phrase") push("strike_slot", slot.start, slot.end, slot.id);
    if (slot.role === "correct_phrase") push("swap_to_correct", slot.start, slot.end, slot.id);
    if (slot.role === "command_hotkey") push("show_hotkey", slot.start, slot.end, slot.id);
    if (slot.role === "keyword_accent" || slot.role === "headline") push("highlight_slot", slot.start, slot.end, slot.id);
  });

  supportVisuals.forEach((visual) => {
    push("pop_support_visual", visual.start, visual.end, visual.anchorSlotId, visual.id, { kind: visual.kind, label: visual.label });
  });

  if (block.type === "hook" || block.type === "warning") {
    push("camera_push", block.start, Math.min(block.end, block.start + 0.9));
  }

  return actions;
}

function buildRecipePayload(
  block: SemanticBlock,
  recipeId: SceneRecipeId,
  slots: SemanticSlot[],
  supportVisuals: SupportVisualIntent[],
  layerActions: LayerActionBeat[],
  preferredTitle?: string
): ScreenCopyPayload {
  const headline = pickSlot(slots, "headline")?.shortText ?? compressHeadline(preferredTitle && block.type === "hook" ? preferredTitle : block.summary);
  const heroNumber = pickSlot(slots, "hero_number")?.shortText ?? extractFirstNumber(block.text) ?? undefined;
  const stepIndex = pickSlot(slots, "step_index")?.shortText;
  const stepLabel = pickSlot(slots, "step_label")?.shortText;
  const wrongPhrase = pickSlot(slots, "wrong_phrase")?.shortText;
  const correctPhrase = pickSlot(slots, "correct_phrase")?.shortText;
  const hotkey = pickSlot(slots, "command_hotkey")?.shortText;
  const comparisonLeft = pickSlot(slots, "comparison_left")?.shortText;
  const comparisonRight = pickSlot(slots, "comparison_right")?.shortText;
  const quote = pickSlot(slots, "quote_pull")?.shortText;
  const keywordItems = slots.filter((slot) => slot.role === "keyword_accent").map((slot) => slot.shortText ?? slot.text).slice(0, 4);
  const base: ScreenCopyPayload = {
    title: headline,
    subtitle: compressDetail(block.text, 68),
    text: compressDetail(block.text, 68),
    value: heroNumber ?? stepIndex,
    label: stepLabel ?? headline,
    falseText: wrongPhrase,
    trueText: correctPhrase ?? hotkey,
    left: comparisonLeft,
    right: comparisonRight,
    quote,
    cta: pickSlot(slots, "cta_phrase")?.shortText,
    items: keywordItems.length > 0 ? keywordItems : splitItems(block.text),
    slots,
    supportVisuals,
    layerActions
  };

  if (recipeId === "comparison_split") {
    return { ...base, left: comparisonLeft ?? wrongPhrase ?? compressHeadline(block.text), right: comparisonRight ?? correctPhrase ?? compressDetail(block.text, 24), caption: headline };
  }
  if (recipeId === "myth_vs_truth") {
    return { ...base, falseText: wrongPhrase ?? comparisonLeft ?? compressHeadline(block.text), trueText: correctPhrase ?? comparisonRight ?? compressDetail(block.text, 28), label: headline };
  }
  if (recipeId === "warning_strike_fix") {
    const resolvedCorrect = correctPhrase
      ? hotkey && !correctPhrase.toLowerCase().includes(hotkey.toLowerCase())
        ? `${correctPhrase} ${hotkey}`
        : correctPhrase
      : hotkey
        ? `Use ${hotkey}`
        : comparisonRight ?? compressDetail(block.text, 28);
    return {
      ...base,
      falseText: wrongPhrase ?? comparisonLeft ?? compressHeadline(block.text),
      trueText: resolvedCorrect,
      label: headline,
      value: heroNumber ?? stepIndex
    };
  }
  if (recipeId === "headline_with_accent_number") {
    return {
      ...base,
      title: headline,
      value: heroNumber ?? stepIndex ?? "1",
      text: correctPhrase ?? compressDetail(block.text, 42)
    };
  }
  if (recipeId === "step_number_callout") {
    return {
      ...base,
      value: stepIndex ?? heroNumber ?? "1",
      label: stepLabel ?? headline,
      text: correctPhrase ?? compressDetail(block.text, 40),
      items: buildChecklistItems(slots, block.text)
    };
  }
  if (recipeId === "big_number_grow" || recipeId === "big_number_plus_text_plate") {
    return { ...base, value: heroNumber ?? stepIndex ?? "1", label: headline, text: correctPhrase ?? compressDetail(block.text, 44) };
  }
  if (recipeId === "checklist_reveal" || recipeId === "timeline_year_callout") {
    return { ...base, title: headline, items: buildChecklistItems(slots, block.text) };
  }
  if (recipeId === "speaker_right_panel_left_infographic") {
    return { ...base, title: headline, label: correctPhrase ?? stepLabel ?? compressDetail(block.text, 32), value: heroNumber ?? stepIndex ?? "01" };
  }
  if (recipeId === "quote_emphasis") {
    return { ...base, quote: quote ?? compressDetail(block.text, 44), label: headline };
  }
  if (recipeId === "hotkey_command_tip") {
    return {
      ...base,
      title: headline,
      cta: hotkey ?? pickSlot(slots, "cta_phrase")?.shortText ?? "USE SHORTCUT",
      label: correctPhrase ?? stepLabel ?? compressDetail(block.text, 28),
      text: wrongPhrase ?? compressDetail(block.text, 28)
    };
  }
  if (recipeId === "cta_finish") {
    return { ...base, text: headline, cta: pickSlot(slots, "cta_phrase")?.text ?? compressHeadline(block.text), label: hotkey ? `USE ${hotkey}` : "CTA" };
  }
  if (recipeId === "camera_punch_in") {
    return { ...base, title: headline, text: correctPhrase ?? compressDetail(block.text, 36) };
  }
  if (recipeId === "clean_section_transition") {
    return { ...base, title: headline };
  }
  return base;
}

function mergeSemanticConfidence(directorConfidence: PlanningConfidence, payload: ScreenCopyPayload): PlanningConfidence {
  const reasons = [...directorConfidence.reasons];
  let score = directorConfidence.score;
  const slots = payload.slots ?? [];

  if (slots.length < 2) {
    reasons.push("weak semantic decomposition");
    score -= 0.14;
  }
  if ((payload.supportVisuals?.length ?? 0) > 0) {
    reasons.push("support visual intent resolved");
    score += 0.04;
  }
  if (slots.some((slot) => slot.role === "wrong_phrase") && !slots.some((slot) => slot.role === "correct_phrase")) {
    reasons.push("missing correction pair");
    score -= 0.08;
  }
  if (payload.title && payload.title.length > 34) {
    reasons.push("title too long");
    score -= 0.06;
  }

  const normalized = Math.max(0.2, Math.min(0.98, Number(score.toFixed(2))));
  return {
    level: normalized >= 0.8 ? "high" : normalized >= 0.58 ? "medium" : "low",
    score: normalized,
    reasons,
    escalationPolicy: normalized < 0.58 ? "enhanced_ai" : directorConfidence.escalationPolicy
  };
}

function extractWrongRight(text: string) {
  if (!NEGATION_RE.test(text) || !FIX_RE.test(text)) return null;
  const normalized = trimSentence(text);
  const fixMatch = normalized.match(/\b(лучше|используй|используйте|instead|use)\b/iu);
  if (fixMatch?.index == null) return null;
  const wrongRaw = normalized.slice(0, fixMatch.index).trim();
  const wrong = wrongRaw
    .replace(/^(не\s+делай(?:те)?\s+)/iu, "")
    .replace(/^(не\s+)/iu, "")
    .trim();
  const correct = normalized
    .slice(fixMatch.index)
    .replace(/^(лучше\s+)/iu, "")
    .trim();
  if (!wrong || !correct) return null;
  return {
    wrong,
    correct,
    wrongRange: { text: wrong, startHint: 0 },
    correctRange: { text: correct, startHint: fixMatch.index }
  };
}

function extractInstructionFixPair(text: string) {
  const normalized = trimSentence(text);
  const parts = normalized.split(/\b(?:лучше|используй|используйте|instead|use)\b/iu);
  if (parts.length < 2) return null;
  const wrong = parts[0]!.replace(/^(не\s+делай(?:те)?\s+)/iu, "").replace(/^(не\s+)/iu, "").trim();
  const correctVerb = normalized.match(/\b(используй|используйте|use)\b/iu)?.[0] ?? "используйте";
  const rightRest = parts.slice(1).join(" ").trim();
  const correct = `${correctVerb} ${rightRest}`.trim();
  if (!wrong || !rightRest) return null;
  return {
    wrong,
    correct,
    wrongRange: { text: wrong, startHint: 0 },
    correctRange: { text: correct, startHint: normalized.indexOf(rightRest) }
  };
}

function extractComparison(text: string) {
  if (!COMPARISON_RE.test(text)) return null;
  const parts = trimSentence(text).split(/\b(?:вместо|или|vs|versus|против|до|после)\b/iu).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return {
    left: parts[0]!,
    right: parts[1]!,
    leftRange: { text: parts[0]!, startHint: 0 },
    rightRange: { text: parts[1]!, startHint: parts[0]!.length }
  };
}

function extractQuote(text: string) {
  const match = text.match(/[«"]([^"»]{6,})[»"]/u);
  if (!match) return null;
  return {
    text: trimSentence(match[1] ?? ""),
    range: { text: trimSentence(match[1] ?? ""), startHint: match.index ?? 0 }
  };
}

function extractStep(words: TranscriptWord[]) {
  const joined = words.map((word) => word.word).join(" ");
  if (!STEP_RE.test(joined)) return null;
  const match = joined.match(STEP_RE);
  if (!match) return null;
  const indexRange = findRangeForText(words, match[0]) ?? fallbackWordRange(words, 0, 1);
  const labelWords = words.slice(indexRange.wordEnd + 1, Math.min(words.length, indexRange.wordEnd + 4));
  return {
    indexText: match[0],
    labelText: labelWords.map((word) => word.word).join(" ").trim(),
    range: indexRange,
    labelRange: labelWords.length > 0
      ? rangeFromWordsRaw(words, indexRange.wordEnd + 1, Math.min(words.length - 1, indexRange.wordEnd + labelWords.length))
      : indexRange
  };
}

function resolveHeadline(block: SemanticBlock, fallbackTitle: string, slots: SemanticSlot[]) {
  const withoutWrong = slots.find((slot) => slot.role === "correct_phrase")?.shortText;
  if (block.type === "list" && slots.find((slot) => slot.role === "hero_number")) {
    const number = slots.find((slot) => slot.role === "hero_number")?.shortText;
    const rest = trimSentence(block.text.replace(number ?? "", "").replace(/^(топ|top)\s+/iu, ""));
    return compressDetail(rest, 34);
  }
  if (withoutWrong) return compressHeadline(withoutWrong);
  return fallbackTitle || compressHeadline(block.text);
}

function buildKeywordSlots(block: SemanticBlock, existingSlots: SemanticSlot[]) {
  const keywords = splitItems(block.text)
    .filter((item) => item.length >= 6)
    .slice(0, 3);

  return keywords.flatMap((item, index) => {
    const range = findRangeForText(block.words, item);
    if (!range) return [];
    if (existingSlots.some((used) => used.start <= range.end && range.start <= used.end)) return [];
    return [
      makeSlot(block, existingSlots.length + index, "keyword_accent", item, "accent", range, shorten(item, 22))
    ];
  });
}

function makeSlot(
  block: SemanticBlock,
  index: number,
  role: SemanticSlot["role"],
  text: string,
  style: SemanticSlot["style"],
  rangeInput: { start: number; end: number; wordStart: number; wordEnd: number } | { text: string; startHint: number },
  shortText?: string
): SemanticSlot {
  const range = "start" in rangeInput ? rangeInput : findRangeForText(block.words, rangeInput.text) ?? fallbackRange(block, 0.5);
  return {
    id: `${block.id}-slot-${index < 0 ? "00" : String(index + 1).padStart(2, "0")}`,
    role,
    text: trimSentence(text),
    shortText,
    style,
    start: round(range.start),
    end: round(range.end),
    wordRange: {
      startIndex: block.transcriptWordRange.startIndex + range.wordStart,
      endIndex: block.transcriptWordRange.startIndex + range.wordEnd
    }
  };
}

function pickSlot(slots: SemanticSlot[], role: SemanticSlot["role"]) {
  return slots.find((slot) => slot.role === role);
}

function findRangeForText(words: TranscriptWord[], rawText: string) {
  const targetTokens = tokenize(rawText);
  if (targetTokens.length === 0 || words.length === 0) return null;

  for (let startIndex = 0; startIndex < words.length; startIndex += 1) {
    if (normalizeToken(words[startIndex]!.word) !== targetTokens[0]) continue;
    let tokenIndex = 1;
    let endIndex = startIndex;
    while (endIndex + 1 < words.length && tokenIndex < targetTokens.length) {
      endIndex += 1;
      if (normalizeToken(words[endIndex]!.word) !== targetTokens[tokenIndex]) break;
      tokenIndex += 1;
    }
    if (tokenIndex === targetTokens.length) {
      return rangeFromWordsRaw(words, startIndex, endIndex);
    }
  }
  return null;
}

function rangeFromWords(block: SemanticBlock, startIndex: number, endIndex: number) {
  return rangeFromWordsRaw(block.words, startIndex, endIndex);
}

function rangeFromWordsRaw(words: TranscriptWord[], startIndex: number, endIndex: number) {
  const safeStart = Math.max(0, Math.min(startIndex, words.length - 1));
  const safeEnd = Math.max(safeStart, Math.min(endIndex, words.length - 1));
  return {
    start: words[safeStart]!.start,
    end: words[safeEnd]!.end,
    wordStart: safeStart,
    wordEnd: safeEnd
  };
}

function fallbackRange(block: SemanticBlock, share: number) {
  const duration = Math.max(0.32, (block.end - block.start) * share);
  return {
    start: block.start,
    end: Math.min(block.end, block.start + duration),
    wordStart: 0,
    wordEnd: Math.max(0, block.words.length - 1)
  };
}

function fallbackWordRange(words: TranscriptWord[], startIndex: number, endIndex: number) {
  return rangeFromWordsRaw(words, startIndex, endIndex);
}

function dedupeSlots(slots: SemanticSlot[]) {
  return slots.filter((slot, index) => {
    const previous = slots[index - 1];
    if (!previous) return true;
    return !(previous.role === slot.role && previous.text === slot.text);
  });
}

function tokenize(text: string) {
  return trimSentence(text)
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean);
}

function normalizeToken(text: string) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}%$₽+-]+/gu, "");
}

function splitItems(text: string) {
  return trimSentence(text)
    .split(/[,:;]|(?:\s+-\s+)|(?:\.\s+)/u)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3)
    .slice(0, 4);
}

function buildChecklistItems(slots: SemanticSlot[], rawText: string) {
  const explicit = slots
    .filter((slot) => slot.role === "keyword_accent" || slot.role === "correct_phrase" || slot.role === "supporting_context")
    .map((slot) => slot.shortText ?? slot.text)
    .filter(Boolean)
    .slice(0, 4);
  return explicit.length > 0 ? explicit : splitItems(rawText);
}

function compressHeadline(text: string) {
  return trimSentence(text)
    .split(/\s+/)
    .slice(0, 6)
    .join(" ")
    .slice(0, 34)
    .trim();
}

function compressDetail(text: string, maxChars: number) {
  const cleaned = trimSentence(text);
  if (cleaned.length <= maxChars) return cleaned;
  const words = cleaned.split(/\s+/);
  let result = "";
  for (const word of words) {
    const next = result ? `${result} ${word}` : word;
    if (next.length > maxChars) break;
    result = next;
  }
  return result || cleaned.slice(0, maxChars).trim();
}

function shorten(text: string, maxChars: number) {
  const cleaned = trimSentence(text);
  return cleaned.length <= maxChars ? cleaned : `${cleaned.slice(0, Math.max(0, maxChars - 1)).trim()}`;
}

function trimSentence(text: string) {
  return text.replace(/\s+/g, " ").replace(/^[,.;:!?]+|[,.;:!?]+$/g, "").trim();
}

function normalizeHotkey(text: string) {
  return text
    .replace(/\bcommand\b/giu, "Cmd")
    .replace(/\bctrl\b/giu, "Ctrl")
    .replace(/\bcontrol\b/giu, "Ctrl")
    .replace(/\boption\b/giu, "Opt")
    .replace(/\balt\b/giu, "Alt")
    .replace(/\bshift\b/giu, "Shift")
    .replace(/\s*[-+]\s*/g, "+")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFirstNumber(text: string) {
  return NUMBER_RE.exec(text)?.[0];
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
