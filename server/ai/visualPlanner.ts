import type {
  ContentPlan,
  EditDecisionList,
  SemanticMoment,
  StylePreset,
  SubtitleDraft,
  TranscriptJson,
  VisualBeat,
  VisualOverlayPlan,
  VisualPlanInput,
  VisualTemplateId
} from "@/lib/types";
import { defaultMotionForTemplate, resolveVisualStyleProfile } from "@/server/hyperframes/visualRegistry";
import { validateVisualOverlayPlan } from "@/server/hyperframes/visualPlanValidator";

const warningWords = ["ошибка", "нельзя", "риск", "опасно", "не делай", "mistake", "risk", "wrong", "avoid"];
const listWords = ["первое", "второе", "третье", "шаг", "способ", "правило", "first", "second", "step", "rule"];
const ctaWords = ["сохрани", "подпишись", "напиши", "save", "subscribe", "follow", "comment"];

export function buildVisualOverlayPlan(input: VisualPlanInput): VisualOverlayPlan {
  const profile = resolveVisualStyleProfile(input.stylePreset);
  const moments = extractSemanticMoments(input.subtitles, input.contentPlan, input.duration);
  const beats = moments.map((moment, index) => visualBeatForMoment(moment, input.stylePreset, index)).filter(Boolean) as VisualBeat[];
  const plan: VisualOverlayPlan = {
    styleProfileId: profile.id,
    density: profile.density,
    beats,
    fallbackSubtitleMode: beats.length ? "minimal" : "active_word",
    planner: "heuristic"
  };

  return validateVisualOverlayPlan(plan, profile);
}

function extractSemanticMoments(subtitles: SubtitleDraft[], contentPlan: ContentPlan, duration: number): SemanticMoment[] {
  const moments: SemanticMoment[] = [];
  const seenTypes = new Set<string>();

  for (const subtitle of subtitles) {
    const text = cleanText(subtitle.text);
    if (!text || subtitle.end - subtitle.start < 0.6) continue;

    const numberMatch = text.match(/(?:\d+[.,]?\d*|[0-9]+)\s?(?:%|к|k|тыс|млн|x|раз|₽|\$)?/i);
    if (numberMatch && !seenTypes.has("number")) {
      seenTypes.add("number");
      moments.push({
        id: `moment-${moments.length}`,
        start: subtitle.start,
        end: Math.min(duration, subtitle.end + 1.4),
        type: "number",
        sourceText: text,
        importance: 3,
        reason: "Detected numeric value that can be shown as a visual metric."
      });
      continue;
    }

    if (containsAny(text, warningWords) && !seenTypes.has("warning")) {
      seenTypes.add("warning");
      moments.push({
        id: `moment-${moments.length}`,
        start: subtitle.start,
        end: Math.min(duration, subtitle.end + 1.2),
        type: "warning",
        sourceText: text,
        importance: 3,
        reason: "Detected warning or mistake language."
      });
      continue;
    }

    if (containsAny(text, listWords) && !seenTypes.has("list")) {
      seenTypes.add("list");
      moments.push({
        id: `moment-${moments.length}`,
        start: subtitle.start,
        end: Math.min(duration, subtitle.end + 2),
        type: "list",
        sourceText: text,
        importance: 2,
        reason: "Detected list or step-by-step language."
      });
    }
  }

  if (contentPlan.hook && duration > 4) {
    moments.unshift({
      id: "moment-hook",
      start: 0.15,
      end: Math.min(duration, 3),
      type: "quote",
      sourceText: contentPlan.hook,
      importance: 2,
      reason: "Use hook as opening visual anchor."
    });
  }

  const cta = contentPlan.motionInserts.find((insert) => insert.type === "cta")?.text;
  if (cta && duration > 8) {
    moments.push({
      id: "moment-cta",
      start: Math.max(0, duration - 3.2),
      end: duration,
      type: "cta",
      sourceText: cta,
      importance: 2,
      reason: "Use final CTA visual plate."
    });
  } else {
    const ctaSubtitle = subtitles.find((subtitle) => containsAny(subtitle.text, ctaWords));
    if (ctaSubtitle) {
      moments.push({
        id: "moment-cta",
        start: ctaSubtitle.start,
        end: Math.min(duration, ctaSubtitle.end + 1.2),
        type: "cta",
        sourceText: ctaSubtitle.text,
        importance: 2,
        reason: "Detected CTA language."
      });
    }
  }

  return moments;
}

function visualBeatForMoment(moment: SemanticMoment, stylePreset: StylePreset, index: number): VisualBeat | null {
  const profile = resolveVisualStyleProfile(stylePreset);
  const templateId = templateForMoment(moment);
  const motionId = defaultMotionForTemplate(templateId, profile);
  const duration = Math.max(1.4, Math.min(4.2, moment.end - moment.start));

  return {
    id: `visual-${index}`,
    start: Math.max(0, moment.start),
    duration,
    templateId,
    motionId,
    layout: layoutForTemplate(templateId, index),
    payload: payloadForMoment(templateId, moment),
    sourceMomentId: moment.id
  };
}

function templateForMoment(moment: SemanticMoment): VisualTemplateId {
  if (moment.type === "number") return "big_number";
  if (moment.type === "list") return "checklist";
  if (moment.type === "warning") return "keyword_slam";
  if (moment.type === "cta") return "cta_plate";
  return "bullet_cards";
}

function layoutForTemplate(templateId: VisualTemplateId, index: number) {
  if (templateId === "keyword_slam" || templateId === "cta_plate") return "center";
  if (templateId === "big_number") return index % 2 === 0 ? "left" : "right";
  return "full_frame";
}

function payloadForMoment(templateId: VisualTemplateId, moment: SemanticMoment) {
  const text = cleanText(moment.sourceText);
  if (templateId === "big_number") {
    const number = text.match(/(?:\d+[.,]?\d*|[0-9]+)\s?(?:%|к|k|тыс|млн|x|раз|₽|\$)?/i)?.[0] ?? "1";
    return {
      value: number,
      label: trimText(text.replace(number, ""), 42) || "важная цифра"
    };
  }
  if (templateId === "checklist") {
    return {
      title: "Что важно",
      items: splitItems(text).slice(0, 3)
    };
  }
  if (templateId === "keyword_slam") {
    return {
      text: keywordFromText(text),
      subtext: trimText(text, 64)
    };
  }
  if (templateId === "cta_plate") {
    return {
      text: trimText(text, 48),
      label: "следующий шаг"
    };
  }
  return {
    title: trimText(text, 34),
    items: splitItems(text).slice(0, 3)
  };
}

function containsAny(text: string, words: string[]) {
  const normalized = text.toLowerCase();
  return words.some((word) => normalized.includes(word));
}

function cleanText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function splitItems(text: string) {
  const chunks = text
    .split(/[,;:.!?]|\s-\s/g)
    .map((part) => trimText(part, 48))
    .filter(Boolean);
  return chunks.length ? chunks : [trimText(text, 48)];
}

function keywordFromText(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  const important = words.find((word) => word.length > 5) ?? words[0] ?? text;
  return trimText(important.replace(/[^\p{L}\p{N}%$₽-]+/gu, ""), 18).toUpperCase();
}

function trimText(text: string, maxLength: number) {
  const value = cleanText(text);
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trim()}…`;
}

export type VisualPlannerDependencies = {
  transcript: TranscriptJson;
  edl: EditDecisionList;
};
