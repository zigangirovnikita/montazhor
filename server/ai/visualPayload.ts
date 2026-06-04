import type { SemanticMoment, VisualBeat, VisualTemplateId } from "@/lib/types";

export function payloadForMoment(templateId: VisualTemplateId, moment: SemanticMoment) {
  const text = cleanText(moment.sourceText);
  if (templateId === "big_number") {
    const number = text.match(/(?:\d+[.,]?\d*|[0-9]+)\s?(?:%|к|k|тыс|млн|x|раз|₽|\$)?/i)?.[0] ?? "1";
    return {
      value: number,
      label: trimText(text.replace(number, ""), 54) || "ключевая цифра"
    };
  }

  if (templateId === "metric_chart") {
    const values = [...text.matchAll(/(\d+[.,]?\d*)\s?(?:%|к|k|тыс|млн|x|раз|₽|\$)?/gi)].map((match) => match[0]);
    return {
      title: values[0] ?? "Рост",
      label: trimText(text, 76),
      values: values.slice(0, 3)
    };
  }

  if (templateId === "checklist") {
    return {
      title: shortTitle(text, 3),
      items: splitItems(text).slice(0, 3).map((item) => trimText(item, 42))
    };
  }

  if (templateId === "keyword_slam") {
    return {
      text: keywordFromText(text),
      subtext: trimText(text, 72)
    };
  }

  if (templateId === "cta_plate") {
    return {
      text: trimText(text, 52),
      label: "следующий шаг"
    };
  }

  if (templateId === "kinetic_text") {
    return {
      text: trimText(text, 92),
      emphasis: keywordFromText(text)
    };
  }

  const items = buildSemanticItems(text).slice(0, 3);
  return {
    eyebrow: moment.type === "comparison" ? "contrast" : moment.type === "definition" ? "definition" : "key idea",
    title: shortTitle(items[0] ?? text, 3),
    items: items.map((item) => trimText(item, 42))
  };
}

export function durationForMoment(moment: SemanticMoment, templateId: VisualTemplateId) {
  const base = moment.end - moment.start;
  if (templateId === "kinetic_text") return Math.max(0.72, Math.min(2.8, base));
  return Math.max(1.35, Math.min(4.6, base + 0.35));
}

export function variantForMoment(moment: SemanticMoment, templateId: VisualTemplateId): VisualBeat["variant"] {
  const textLength = cleanText(moment.sourceText).length;
  if (textLength > 82) return "compact";
  if (templateId === "keyword_slam" || templateId === "big_number") return "hero";
  return "standard";
}

export function variantForPayload(payload: Record<string, unknown>): VisualBeat["variant"] {
  const length = Object.values(payload).flatMap((value) => Array.isArray(value) ? value : [value]).join(" ").length;
  return length > 90 ? "compact" : "standard";
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
  const chunks = text
    .split(/[,;:.!?]|\s-\s| и /gi)
    .map((part) => trimText(part, 56))
    .filter(Boolean);
  return chunks.length ? chunks : [trimText(text, 56)];
}

function buildSemanticItems(text: string) {
  const contrast = text.match(/(.+?)\s(?:не|but|instead)\s(.+)/i);
  if (contrast) {
    return [trimText(contrast[1], 44), trimText(contrast[2], 44)];
  }
  return splitItems(text);
}

function keywordFromText(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  const important = words.find((word) => word.length > 5) ?? words[0] ?? text;
  return trimText(important.replace(/[^\p{L}\p{N}%$₽-]+/gu, ""), 24).toUpperCase();
}

function shortTitle(text: string, wordLimit: number) {
  return cleanText(text)
    .split(/\s+/)
    .slice(0, wordLimit)
    .join(" ")
    .toUpperCase();
}

function trimText(text: string, maxLength: number) {
  const value = cleanText(text);
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trim()}...`;
}
