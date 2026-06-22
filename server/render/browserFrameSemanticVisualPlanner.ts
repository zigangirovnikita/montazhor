import type { ContentPlan, SemanticBlock } from "@/lib/types";
import type { BrowserFrameVisualBeat } from "./browserFrameRendererPlan";

export function buildVisualBeatsFromSemanticBlocks(input: {
  semanticBlocks: SemanticBlock[];
  duration: number;
  contentPlan?: ContentPlan | null;
}) {
  const beats: BrowserFrameVisualBeat[] = [];

  for (const block of input.semanticBlocks) {
    const beat = visualBeatForSemanticBlock(block, input.contentPlan);
    if (!beat) continue;
    if (beat.start >= input.duration) continue;

    beats.push({
      ...beat,
      start: roundTime(Math.max(0, beat.start)),
      end: roundTime(Math.min(input.duration, beat.end))
    });
  }

  return beats.filter((beat) => beat.end - beat.start >= 0.9);
}

function visualBeatForSemanticBlock(block: SemanticBlock, contentPlan?: ContentPlan | null): BrowserFrameVisualBeat | null {
  const text = cleanText(block.text);
  const numbers = extractNumbers(text);
  const comparison = extractComparison(text);
  const listItems = extractListItems(text);
  const timelineItems = extractTimelineItems(text);
  const tableRows = extractTableRows(text);

  if (block.type === "cta") {
    return {
      id: `sb-cta-${block.id}`,
      start: block.start,
      end: Math.max(block.end, block.start + 1.4),
      templateId: "cta_plate",
      layout: "center",
      payload: {
        text: firstSentence(text),
        label: "следующий шаг"
      },
      priority: 3
    };
  }

  if (block.type === "myth_vs_truth" || (block.type === "warning" && comparison)) {
    return {
      id: `sb-strike-${block.id}`,
      start: block.start,
      end: Math.max(block.end, block.start + 1.5),
      templateId: "myth_strike",
      layout: "right",
      payload: {
        eyebrow: "МИФ / ПРАВДА",
        falseText: comparison?.left ?? titleFromText(text, 3),
        trueText: comparison?.right ?? block.summary
      },
      priority: 2
    };
  }

  if (block.type === "comparison") {
    return {
      id: `sb-compare-${block.id}`,
      start: block.start,
      end: Math.max(block.end, block.start + 1.4),
      templateId: "concept_map",
      layout: "right",
      payload: {
        mode: "comparison",
        eyebrow: "СРАВНЕНИЕ",
        center: "ВМЕСТО",
        left: comparison?.left ?? firstNWords(text, 3),
        right: comparison?.right ?? lastNWords(text, 3),
        caption: firstSentence(text)
      },
      priority: 2
    };
  }

  if (block.type === "timeline" && timelineItems.length >= 2) {
    return {
      id: `sb-timeline-${block.id}`,
      start: block.start,
      end: Math.max(block.end, block.start + 1.7),
      templateId: "checklist",
      layout: "left",
      payload: {
        title: titleFromText(block.summary, 4),
        mode: "timeline",
        items: timelineItems.slice(0, 3)
      },
      priority: 2
    };
  }

  if (block.type === "list" || (listItems.length >= 3 && (block.type === "explanation" || block.type === "timeline"))) {
    return {
      id: `sb-list-${block.id}`,
      start: block.start,
      end: Math.max(block.end, block.start + 1.6),
      templateId: "checklist",
      layout: "left",
      payload: {
        title: titleFromText(block.summary, 4),
        items: listItems.slice(0, 3)
      },
      priority: 2
    };
  }

  if (block.type === "proof" || block.type === "timeline") {
    if (tableRows.length >= 2) {
      return {
        id: `sb-table-${block.id}`,
        start: block.start,
        end: Math.max(block.end, block.start + 1.5),
        templateId: "metric_chart",
        layout: "right",
        payload: {
          title: titleFromText(block.summary, 4),
          mode: "table",
          rows: tableRows.slice(0, 3)
        },
        priority: 2
      };
    }

    if (numbers.length >= 2) {
      return {
        id: `sb-chart-${block.id}`,
        start: block.start,
        end: Math.max(block.end, block.start + 1.5),
        templateId: "metric_chart",
        layout: "right",
        payload: {
          title: titleFromText(block.summary, 4),
          label: firstSentence(text),
          values: numbers.slice(0, 3)
        },
        priority: 2
      };
    }

    if (numbers.length === 1) {
      return {
        id: `sb-number-${block.id}`,
        start: block.start,
        end: Math.max(block.end, block.start + 1.3),
        templateId: "big_number",
        layout: "right",
        payload: {
          value: numbers[0],
          label: numberContext(text, numbers[0])
        },
        priority: 2
      };
    }
  }

  if ((block.type === "hook" || block.type === "thesis" || block.type === "definition") && shouldHighlightIdea(block, contentPlan)) {
    const definition = extractDefinition(text);
    const branches = extractConceptBranches(text);
    return {
      id: `sb-idea-${block.id}`,
      start: block.start,
      end: Math.max(block.end, block.start + 1.2),
      templateId: "concept_map",
      layout: "top",
      payload: {
        mode: block.type === "definition" && definition ? "definition" : branches.length >= 2 ? "mindmap" : "idea",
        eyebrow: block.type === "definition" ? "ОПРЕДЕЛЕНИЕ" : "КЛЮЧЕВАЯ МЫСЛЬ",
        center: definition?.title ?? titleFromText(text, 2),
        left: firstNWords(text, 2),
        right: lastNWords(text, 2),
        title: definition?.title ?? titleFromText(text, 2),
        body: definition?.body ?? firstSentence(text),
        branches: branches.slice(0, 3),
        caption: firstSentence(text)
      },
      priority: 1
    };
  }

  return null;
}

function extractNumbers(text: string) {
  return Array.from(text.matchAll(/(\d+[.,]?\d*\s?(?:%|₽|\$|x|к|k|тыс|млн)?)/gi), (match) => cleanText(match[0]));
}

function extractListItems(text: string) {
  const explicit = text
    .split(/[,;]\s+|\s(?:и|and)\s+/gi)
    .map((item) => cleanText(item))
    .filter((item) => item.split(/\s+/).length <= 5)
    .filter(Boolean);

  if (explicit.length >= 3) return explicit;
  return Array.from(text.matchAll(/(?:первое|второе|третье|1|2|3)[).:-]?\s*([^,.!?:;]+)/gi), (match) => cleanText(match[1])).filter(Boolean);
}

function extractComparison(text: string) {
  const contrast = text.match(/(.+?)\s+не\s+(.+?)\s+а\s+(.+)/i) || text.match(/(.+?)\s+(?:versus|vs|против)\s+(.+)/i);
  if (!contrast) return null;
  if (contrast.length >= 4) return { left: titleFromText(contrast[2], 3), right: titleFromText(contrast[3], 3) };
  return { left: titleFromText(contrast[1], 3), right: titleFromText(contrast[2], 3) };
}

function extractTimelineItems(text: string) {
  const yearMatches = Array.from(
    text.matchAll(/\b((?:19|20)\d{2})\b[: -]?\s*([^,.!?:;]+)/g),
    (match) => cleanText(`${match[1]} ${match[2]}`)
  ).filter(Boolean);
  if (yearMatches.length >= 2) return yearMatches;

  const stepMatches = Array.from(
    text.matchAll(/(?:сначала|потом|затем|после этого|первое|второе|третье)\s+([^,.!?:;]+)/gi),
    (match) => cleanText(match[1])
  ).filter(Boolean);
  return stepMatches;
}

function extractTableRows(text: string) {
  const rowMatches = Array.from(
    text.matchAll(/([^,;:.!?]+?)\s+(\d+[.,]?\d*\s?(?:%|₽|\$|x|к|k|тыс|млн)?)/gi),
    (match) => ({
      label: titleFromText(match[1], 3),
      value: cleanText(match[2])
    })
  ).filter((row) => row.label && row.value);

  const uniqueRows = rowMatches.filter((row, index, rows) =>
    rows.findIndex((candidate) => candidate.label === row.label && candidate.value === row.value) === index
  );

  return uniqueRows;
}

function extractDefinition(text: string) {
  const match = text.match(/^(.+?)\s+(?:это|значит|означает)\s+(.+)$/i);
  if (!match) return null;
  return {
    title: titleFromText(match[1], 3),
    body: cleanText(match[2])
  };
}

function extractConceptBranches(text: string) {
  return text
    .split(/[,;]\s+|\s(?:и|and)\s+/gi)
    .map((item) => cleanText(item))
    .filter((item) => item.split(/\s+/).length >= 2 && item.split(/\s+/).length <= 5)
    .filter(Boolean);
}

function shouldHighlightIdea(block: SemanticBlock, contentPlan?: ContentPlan | null) {
  if (block.wordCount <= 3) return false;
  if (contentPlan?.hook && cleanText(block.text).toLowerCase().includes(cleanText(contentPlan.hook).toLowerCase())) return true;
  return block.summary.split(/\s+/).some((word) => word.length >= 8);
}

function numberContext(text: string, value: string) {
  const normalized = cleanText(text);
  const index = normalized.indexOf(value);
  if (index < 0) return firstSentence(text);
  return cleanText(`${lastNWords(normalized.slice(0, index), 2)} ${value} ${firstNWords(normalized.slice(index + value.length), 2)}`);
}

function titleFromText(text: string, maxWords: number) {
  return cleanText(text).split(/\s+/).slice(0, maxWords).join(" ").toUpperCase();
}

function firstSentence(text: string) {
  return cleanText(text.split(/(?<=[.!?])\s+/)[0] ?? text);
}

function firstNWords(text: string, count: number) {
  return cleanText(text).split(/\s+/).slice(0, count).join(" ");
}

function lastNWords(text: string, count: number) {
  const words = cleanText(text).split(/\s+/).filter(Boolean);
  return words.slice(Math.max(0, words.length - count)).join(" ");
}

function cleanText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function roundTime(value: number) {
  return Math.round(value * 1000) / 1000;
}
