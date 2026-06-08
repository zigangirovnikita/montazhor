import type { SemanticMoment, VisualBeat, VisualTemplateId } from "@/lib/types";

const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+/;
const NUMBER_RE = /(?:\d+[.,]?\d*|[0-9]+)\s?(?:%|к|k|тыс|млн|x|раз|₽|\$)?/i;
const ALL_NUMBERS_RE = /(\d+[.,]?\d*)\s?(?:%|к|k|тыс|млн|x|раз|₽|\$)?/gi;

export function payloadForMoment(templateId: VisualTemplateId, moment: SemanticMoment) {
  const text = cleanText(moment.sourceText);
  if (templateId === "big_number") {
    const number = cleanText(text.match(NUMBER_RE)?.[0] ?? "1");
    return {
      value: number,
      label: extractNumberContext(text, number) || "ключевая цифра"
    };
  }

  if (templateId === "metric_chart") {
    const values = [...text.matchAll(ALL_NUMBERS_RE)].map((match) => cleanText(match[0]));
    return {
      title: shortSentence(text, 5) || values[0] || "Показатели",
      label: firstSentence(text),
      values: values.slice(0, 3)
    };
  }

  if (templateId === "checklist") {
    const items = splitItems(text).slice(0, 3);
    return {
      title: shortTitle(items[0] ?? text, 4),
      items
    };
  }

  if (templateId === "lesson_title") {
    return {
      eyebrow: moment.type === "definition" ? "LESSON" : "KEY IDEA",
      title: shortTitle(text, 5),
      subtext: firstSentence(text)
    };
  }

  if (templateId === "myth_strike") {
    const parts = splitItems(text);
    return {
      eyebrow: "MYTH",
      falseText: shortTitle(parts[0] ?? text, 3),
      trueText: parts[1] ?? firstSentence(text)
    };
  }

  if (templateId === "stat_panel") {
    const values = [...text.matchAll(ALL_NUMBERS_RE)].map((match) => cleanText(match[0]));
    const items = values.length
      ? values.map((value) => ({ value, label: extractNumberContext(text, value) || value }))
      : splitItems(text).slice(0, 3).map((item, index) => ({ value: String(index + 1).padStart(2, "0"), label: item }));
    return {
      eyebrow: "SYSTEM VIEW",
      title: shortSentence(text, 4) || "Key metrics",
      items
    };
  }

  if (templateId === "concept_map") {
    const items = splitItems(text).slice(0, 3);
    return {
      eyebrow: "DEFINITION",
      center: shortTitle(items[0] ?? text, 2),
      left: items[1] ?? "Source A",
      right: items[2] ?? "Source B",
      caption: firstSentence(text)
    };
  }

  if (templateId === "keyword_slam") {
    return {
      text: keywordFromText(text),
      subtext: firstSentence(text)
    };
  }

  if (templateId === "cta_plate") {
    return {
      text: firstSentence(text),
      label: "следующий шаг"
    };
  }

  if (templateId === "kinetic_text") {
    return {
      text,
      emphasis: keywordFromText(text)
    };
  }

  const items = buildSemanticItems(text).slice(0, 3);
  return {
    eyebrow: moment.type === "comparison" ? "contrast" : moment.type === "definition" ? "definition" : "key idea",
    title: shortTitle(items[0] ?? text, 4),
    items
  };
}

export function durationForMoment(moment: SemanticMoment, templateId: VisualTemplateId) {
  const base = Math.max(0.42, moment.end - moment.start);
  const reading = estimateReadingDuration(moment.sourceText, templateId);

  if (templateId === "kinetic_text") {
    return Math.max(base + 0.15, reading);
  }

  return Math.max(base + 0.35, reading);
}

export function estimateReadingDuration(text: string, templateId: VisualTemplateId) {
  const normalized = cleanText(text);
  const wordCount = normalized ? normalized.split(/\s+/).length : 0;
  const charCount = normalized.length;
  const isSceneTemplate = templateId === "lesson_title" || templateId === "myth_strike" || templateId === "stat_panel" || templateId === "concept_map";
  const wordsPerSecond = templateId === "kinetic_text" ? 2.8 : isSceneTemplate ? 2.1 : 2.35;
  const charsPerSecond = templateId === "kinetic_text" ? 16 : isSceneTemplate ? 11 : 13;
  const floor = templateId === "kinetic_text" ? 1.4 : isSceneTemplate ? 2.8 : 2.4;
  const ceiling = templateId === "kinetic_text" ? 6.4 : isSceneTemplate ? 8.5 : 7.2;
  const estimate = Math.max(wordCount / wordsPerSecond, charCount / charsPerSecond, floor);
  return Math.min(ceiling, roundTime(estimate));
}

export function variantForMoment(moment: SemanticMoment, templateId: VisualTemplateId): VisualBeat["variant"] {
  const textLength = cleanText(moment.sourceText).length;
  if (textLength > 110) return "compact";
  if (templateId === "keyword_slam" || templateId === "big_number") return "hero";
  return "standard";
}

export function variantForPayload(payload: Record<string, unknown>): VisualBeat["variant"] {
  const length = Object.values(payload).flatMap((value) => Array.isArray(value) ? value : [value]).join(" ").length;
  return length > 120 ? "compact" : "standard";
}

export function containsAny(text: string, words: string[]) {
  const normalized = text.toLowerCase();
  return words.some((word) => normalized.includes(word));
}

export function cleanText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function roundTime(value: number) {
  return Math.round(value * 100) / 100;
}

function splitItems(text: string) {
  const sentenceItems = text
    .split(SENTENCE_SPLIT_RE)
    .map((part) => cleanText(part))
    .filter(Boolean);

  if (sentenceItems.length >= 2) {
    return sentenceItems;
  }

  const chunks = text
    .split(/[,;:]\s+|\s-\s|(?:^|\s)(?:и|and)\s+/gi)
    .map((part) => cleanText(part))
    .filter(Boolean)
    .filter(Boolean);

  return chunks.length ? chunks : [cleanText(text)];
}

function buildSemanticItems(text: string) {
  const contrast = text.match(/(.+?)\s(?:не|but|instead)\s(.+)/i);
  if (contrast) {
    return [cleanText(contrast[1]), cleanText(contrast[2])];
  }
  return splitItems(text);
}

function keywordFromText(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  const important = words.find((word) => word.length > 5) ?? words[0] ?? text;
  return cleanText(important.replace(/[^\p{L}\p{N}%$₽-]+/gu, "")).toUpperCase();
}

function shortTitle(text: string, wordLimit: number) {
  return cleanText(text)
    .split(/\s+/)
    .slice(0, wordLimit)
    .join(" ")
    .toUpperCase();
}

function firstSentence(text: string) {
  return cleanText(text.split(SENTENCE_SPLIT_RE)[0] ?? text);
}

function shortSentence(text: string, wordLimit: number) {
  return firstSentence(text)
    .split(/\s+/)
    .slice(0, wordLimit)
    .join(" ");
}

function extractNumberContext(text: string, number: string) {
  const normalized = cleanText(text);
  const index = normalized.indexOf(number);
  if (index === -1) return firstSentence(normalized);

  const before = cleanText(normalized.slice(0, index));
  const after = cleanText(normalized.slice(index + number.length));
  const beforeWords = before ? before.split(/\s+/).slice(-2) : [];
  const afterWords = after ? after.split(/\s+/).slice(0, 3) : [];
  return cleanText([...beforeWords, number, ...afterWords].join(" "));
}
