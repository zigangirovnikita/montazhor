import type { StyleDraftOptions } from "@/app/components/PresentationConfigurator";
import type { ContentPlan, PresentationMode, SemanticBlock, SubtitleDraft } from "@/lib/types";
import type { BrowserFrameVisualBeat } from "./browserFrameRendererPlan";
import { buildVisualBeatsFromSemanticBlocks } from "./browserFrameSemanticVisualPlanner";

export function buildVisualBeatsForBrowserPlan(input: {
  subtitles: SubtitleDraft[];
  semanticBlocks?: SemanticBlock[] | null;
  duration: number;
  contentPlan?: ContentPlan | null;
  styleOptions?: StyleDraftOptions | null;
  presentationMode?: PresentationMode | null;
}) {
  if (input.presentationMode && input.presentationMode !== "subtitles_only") {
    return [];
  }

  const beats: BrowserFrameVisualBeat[] = [];
  const allowedTemplates = allowedTemplateIds(input.styleOptions);
  const density = input.styleOptions?.visualDensity ?? "medium";
  const semanticCandidates = input.semanticBlocks?.length
    ? buildVisualBeatsFromSemanticBlocks({
        semanticBlocks: input.semanticBlocks,
        duration: input.duration,
        contentPlan: input.contentPlan
      })
    : [];

  if (semanticCandidates.length > 0) {
    const filteredSemanticBeats = semanticCandidates.filter((beat) => allowedTemplates.has(beat.templateId));
    return applyDensityLimit(dedupeVisualBeats(filteredSemanticBeats), density).filter((beat) => beat.end - beat.start >= 0.9);
  }

  for (const subtitle of input.subtitles) {
    const text = cleanText(subtitle.text);
    if (!text) continue;

    const beat = visualBeatForSubtitle(subtitle, input.contentPlan);
    if (!beat) continue;
    if (beat.start >= input.duration) continue;
    if (!allowedTemplates.has(beat.templateId)) continue;

    beats.push({
      ...beat,
      start: roundTime(Math.max(0, beat.start)),
      end: roundTime(Math.min(input.duration, beat.end))
    });
  }

  return applyDensityLimit(dedupeVisualBeats(beats), density).filter((beat) => beat.end - beat.start >= 0.9);
}

function visualBeatForSubtitle(subtitle: SubtitleDraft, contentPlan?: ContentPlan | null): BrowserFrameVisualBeat | null {
  const text = cleanText(subtitle.text);
  const words = subtitle.words.map((word) => cleanText(word.word)).filter(Boolean);
  const start = subtitle.start;
  const end = subtitle.end;
  const numbers = extractNumbers(text);
  const listItems = extractListItems(text);
  const comparison = extractComparison(text);
  const timelineItems = extractTimelineItems(text);
  const tableRows = extractTableRows(text);

  if (isCtaText(text, contentPlan)) {
    return {
      id: `cta-${subtitle.id}`,
      start,
      end: Math.max(end, start + 1.3),
      templateId: "cta_plate",
      layout: "center",
      payload: {
        text: firstSentence(text),
        label: "следующий шаг"
      },
      priority: 3
    };
  }

  if (comparison) {
    return {
      id: `compare-${subtitle.id}`,
      start,
      end: Math.max(end, start + 1.5),
      templateId: containsMythCue(text) ? "myth_strike" : "concept_map",
      layout: "right",
      payload: containsMythCue(text)
        ? {
            eyebrow: "МИФ / ПРАВДА",
            falseText: comparison.left,
            trueText: comparison.right
          }
        : {
            mode: "comparison",
            eyebrow: "СРАВНЕНИЕ",
            center: comparison.center,
            left: comparison.left,
            right: comparison.right,
            caption: firstSentence(text)
          },
      priority: 2
    };
  }

  if (timelineItems.length >= 2) {
    return {
      id: `timeline-${subtitle.id}`,
      start,
      end: Math.max(end, start + 1.6),
      templateId: "checklist",
      layout: "left",
      payload: {
        title: titleFromText(text, 4),
        mode: "timeline",
        items: timelineItems.slice(0, 3)
      },
      priority: 2
    };
  }

  if (listItems.length >= 3) {
    return {
      id: `list-${subtitle.id}`,
      start,
      end: Math.max(end, start + 1.6),
      templateId: "checklist",
      layout: "left",
      payload: {
        title: titleFromText(text, 4),
        items: listItems.slice(0, 3)
      },
      priority: 2
    };
  }

  if (tableRows.length >= 2) {
    return {
      id: `table-${subtitle.id}`,
      start,
      end: Math.max(end, start + 1.5),
      templateId: "metric_chart",
      layout: "right",
      payload: {
        title: titleFromText(text, 4),
        mode: "table",
        rows: tableRows.slice(0, 3)
      },
      priority: 2
    };
  }

  if (numbers.length >= 2) {
    return {
      id: `chart-${subtitle.id}`,
      start,
      end: Math.max(end, start + 1.5),
      templateId: "metric_chart",
      layout: "right",
      payload: {
        title: titleFromText(text, 4),
        label: firstSentence(text),
        values: numbers.slice(0, 3)
      },
      priority: 2
    };
  }

  if (numbers.length === 1) {
    return {
      id: `number-${subtitle.id}`,
      start,
      end: Math.max(end, start + 1.25),
      templateId: "big_number",
      layout: "right",
      payload: {
        value: numbers[0],
        label: numberContext(text, numbers[0])
      },
      priority: 2
    };
  }

  if (hasKeywordPunch(words, contentPlan)) {
    const definition = extractDefinition(text);
    const branches = extractConceptBranches(text);
    return {
      id: `keyword-${subtitle.id}`,
      start,
      end: Math.max(end, start + 1.1),
      templateId: "concept_map",
      layout: "right",
      payload: {
        mode: definition ? "definition" : branches.length >= 2 ? "mindmap" : "idea",
        eyebrow: "КЛЮЧЕВАЯ МЫСЛЬ",
        center: definition?.title ?? titleFromText(text, 2),
        left: listItems[0] ?? firstNWords(text, 2),
        right: listItems[1] ?? lastNWords(text, 2),
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

function dedupeVisualBeats(beats: BrowserFrameVisualBeat[]) {
  const accepted: BrowserFrameVisualBeat[] = [];

  for (const beat of beats.sort((left, right) => left.start - right.start || right.priority - left.priority)) {
    const overlaps = accepted.find((item) => overlapSeconds(item.start, item.end, beat.start, beat.end) > 0.45);
    if (!overlaps) {
      accepted.push(beat);
      continue;
    }

    if (beat.priority > overlaps.priority) {
      const index = accepted.indexOf(overlaps);
      accepted.splice(index, 1, beat);
    }
  }

  return accepted;
}

function applyDensityLimit(
  beats: BrowserFrameVisualBeat[],
  density: NonNullable<StyleDraftOptions["visualDensity"]>
) {
  if (density === "high") return beats.slice(0, 6);
  if (density === "low") {
    return beats
      .filter((beat) => beat.priority >= 2)
      .slice(0, 2);
  }

  return beats.slice(0, 4);
}

function allowedTemplateIds(styleOptions?: StyleDraftOptions | null) {
  const disabled = new Set(styleOptions?.disabledTemplates ?? []);
  const allowed = new Set<BrowserFrameVisualBeat["templateId"]>([
    "big_number",
    "metric_chart",
    "checklist",
    "concept_map",
    "cta_plate",
    "myth_strike"
  ]);

  if (styleOptions?.autoLists === false) {
    allowed.delete("checklist");
  }

  if (styleOptions?.autoComparisons === false) {
    allowed.delete("concept_map");
  }

  if (styleOptions?.autoCharts === false) {
    allowed.delete("big_number");
    allowed.delete("metric_chart");
  }

  if (styleOptions?.autoCta === false) {
    allowed.delete("cta_plate");
  }

  if (styleOptions?.autoStrike === false) {
    allowed.delete("myth_strike");
  }

  for (const templateId of Array.from(allowed)) {
    if (disabled.has(templateId)) {
      allowed.delete(templateId);
    }
  }

  return allowed;
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

  const ordinalMatches = Array.from(text.matchAll(/(?:первое|второе|третье|1|2|3)[).:-]?\s*([^,.!?:;]+)/gi), (match) => cleanText(match[1]));
  return ordinalMatches.filter(Boolean);
}

function extractComparison(text: string) {
  const contrast = text.match(/(.+?)\s+не\s+(.+?)\s+а\s+(.+)/i) || text.match(/(.+?)\s+(?:versus|vs|против)\s+(.+)/i);
  if (!contrast) return null;

  if (contrast.length >= 4) {
    return {
      center: "ВМЕСТО",
      left: titleFromText(contrast[2], 3),
      right: titleFromText(contrast[3], 3)
    };
  }

  return {
    center: "СРАВНЕНИЕ",
    left: titleFromText(contrast[1], 3),
    right: titleFromText(contrast[2], 3)
  };
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

  return rowMatches.filter((row, index, rows) =>
    rows.findIndex((candidate) => candidate.label === row.label && candidate.value === row.value) === index
  );
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

function containsMythCue(text: string) {
  return /\bмиф|ошибка|неправильно|заблуждение\b/i.test(text);
}

function isCtaText(text: string, contentPlan?: ContentPlan | null) {
  if (/\bподпиш|сохрани|напиши|скачай|забери|пиши|оставь\b/i.test(text)) return true;
  const suggestion = contentPlan?.titleSuggestions?.[0];
  return Boolean(suggestion && cleanText(text).toLowerCase().includes(cleanText(suggestion).toLowerCase()));
}

function hasKeywordPunch(words: string[], contentPlan?: ContentPlan | null) {
  if (words.length < 3) return false;
  if (contentPlan?.hook && cleanText(words.join(" ")).toLowerCase().includes(contentPlan.hook.toLowerCase())) return true;
  return words.some((word) => word.length >= 8);
}

function firstSentence(text: string) {
  return cleanText(text.split(/(?<=[.!?])\s+/)[0] ?? text);
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

function overlapSeconds(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

function roundTime(value: number) {
  return Math.round(value * 1000) / 1000;
}
