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
  VisualLayout,
  VisualTemplateId
} from "@/lib/types";
import { getAiConfigForTask } from "@/lib/config";
import { callChatCompletion } from "@/server/ai/openRouterClient";
import { recordAiUsage } from "@/server/ai/usage";
import {
  cleanText,
  containsAny,
  durationForMoment,
  payloadForMoment,
  roundTime,
  variantForMoment,
  variantForPayload
} from "@/server/ai/visualPayload";
import { segmentIntoPhrases } from "@/server/ai/phraseSegmenter";
import { preflightVisualOverlayPlan } from "@/server/hyperframes/visualLayoutPreflight";
import { defaultMotionForTemplate, presetForMoment, resolveVisualStyleProfile, visualPresets, visualTemplates } from "@/server/hyperframes/visualRegistry";
import { validateVisualOverlayPlan } from "@/server/hyperframes/visualPlanValidator";

const warningWords = ["ошибка", "нельзя", "риск", "опасно", "не делай", "mistake", "risk", "wrong", "avoid"];
const listWords = ["первое", "второе", "третье", "шаг", "способ", "правило", "how", "when", "why", "step", "rule"];
const ctaWords = ["сохрани", "подпишись", "напиши", "save", "subscribe", "follow", "comment"];

export function buildVisualOverlayPlan(input: VisualPlanInput): VisualOverlayPlan {
  const profile = resolveProfileForInput(input);
  const moments = extractSemanticMoments(input.subtitles, input.contentPlan, input.duration);
  const beats = moments
    .map((moment, index) => visualBeatForMoment(moment, input.stylePreset, input.styleOptions?.presetPack ?? "balanced", index))
    .filter(Boolean) as VisualBeat[];

  const plan: VisualOverlayPlan = {
    styleProfileId: profile.id,
    density: profile.density,
    beats,
    fallbackSubtitleMode: "off",
    planner: "continuous"
  };

  return preflightVisualOverlayPlan(validateVisualOverlayPlan(plan, profile), profile, input.duration, input.styleOptions, input.frame);
}

export async function buildVisualOverlayPlanWithAi(
  input: VisualPlanInput,
  projectId?: string,
  log?: (message: string) => Promise<void> | void
): Promise<VisualOverlayPlan> {
  const fallbackPlan = buildVisualOverlayPlan(input);
  const config = getAiConfigForTask("visual_planner");
  if (!config.apiKey) {
    await log?.("AI visual planner skipped: API key is not configured; using deterministic visual planner.");
    return fallbackPlan;
  }

  try {
    await log?.(`AI visual planner: selecting HyperFrames presets using ${config.provider}/${config.model}...`);
    const result = await callChatCompletion(config, buildVisualPlannerSystemPrompt(), buildVisualPlannerUserPrompt(input));
    await recordAiUsage({ projectId, source: "hyperframes", phase: "visual_planner", result });
    const profile = resolveProfileForInput(input);
    const aiPlan = validateVisualOverlayPlan(parseAiVisualPlan(result.content, input.stylePreset, fallbackPlan), profile);
    const plan = preflightVisualOverlayPlan(mergeAiAccentsIntoContinuousPlan(fallbackPlan, aiPlan), profile, input.duration, input.styleOptions, input.frame);
    if (plan.beats.length === 0) {
      await log?.("AI visual planner returned no valid beats; using deterministic visual planner.");
      return fallbackPlan;
    }
    await log?.(`AI visual planner selected ${plan.beats.length} validated HyperFrames beats.`);
    return plan;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await log?.(`AI visual planner failed; using deterministic visual planner. Original error: ${message}`);
    return fallbackPlan;
  }
}

function buildVisualPlannerSystemPrompt() {
  return [
    "You are a video art director for short-form talking-head videos.",
    "Choose only reusable HyperFrames visual presets from the provided registry.",
    "Do not invent templates, animations, fonts, or effects outside the registry.",
    "Every beat must include a presetId from preset_registry, and that presetId must belong to the same templateId.",
    "Pick moments after the clean cut where visual overlays help comprehension: definitions, numbers, contrasts, checklists, warnings, and strong keywords.",
    "Avoid decorating every subtitle. Prefer tasteful premium overlays similar to technical course graphics: glass panels, big numbers, keyword slams, cards, charts.",
    "Return strict JSON only."
  ].join(" ");
}

function buildVisualPlannerUserPrompt(input: VisualPlanInput) {
  const profile = resolveProfileForInput(input);
  const subtitleMoments = input.subtitles.map((subtitle) => ({
    id: subtitle.id,
    start: roundTime(subtitle.start),
    end: roundTime(subtitle.end),
    text: subtitle.text
  }));

  return JSON.stringify({
    task: "Select HyperFrames visual beats from the registry for this already-cleaned video.",
    output_schema: {
      beats: [
        {
          id: "short unique id",
          start: "seconds on cleaned video timeline",
          duration: "seconds",
          templateId: profile.allowedTemplates,
          presetId: "preset id from preset_registry for the same templateId",
          motionId: profile.allowedMotions,
          layout: ["left", "right", "center", "lower_third", "full_frame"],
          payload: "object matching required fields for template",
          sourceMomentId: "subtitle id if based on a subtitle"
        }
      ],
      fallbackSubtitleMode: "off"
    },
    rules: [
      "Use 3-8 beats for a 30-60 second video unless the transcript is very short.",
      "The deterministic planner already covers every spoken phrase with kinetic_text. Use stronger templates only where they improve the same phrase.",
      "For big_number payload use { value, label }.",
      "For metric_chart payload use { title, label, values }.",
      "For checklist payload use { title, items } with 2-3 short items.",
      "For bullet_cards payload use { eyebrow, title, items }.",
      "For keyword_slam payload use { text, subtext }.",
      "For cta_plate payload use { text, label }.",
      "Start/duration must stay inside the provided video duration.",
      "Choose only from allowed_templates, allowed_motions, registry, and preset_registry.",
      "Every beat must include presetId.",
      "presetId must exist in preset_registry and must match the same templateId."
    ],
    video_duration: roundTime(input.duration),
    style_profile: profile,
    registry: visualTemplates.map((template) => ({
      id: template.id,
      label: template.label,
      momentTypes: template.momentTypes,
      minDuration: template.minDuration,
      maxDuration: template.maxDuration,
      allowedLayouts: template.allowedLayouts,
      requiredPayload: template.requiredPayload
    })),
    preset_registry: visualPresets.map((preset) => ({
      id: preset.id,
      label: preset.label,
      pack: preset.pack,
      templateId: preset.templateId,
      momentTypes: preset.momentTypes,
      preferredLayouts: preset.preferredLayouts,
      maxTextChars: preset.maxTextChars,
      fallbackPresetId: preset.fallbackPresetId
    })),
    content_plan: {
      hook: input.contentPlan.hook,
      keyPhrases: input.contentPlan.keyPhrases,
      titleSuggestions: input.contentPlan.titleSuggestions
    },
    subtitles: subtitleMoments
  });
}

function parseAiVisualPlan(raw: string, stylePreset: StylePreset, fallbackPlan: VisualOverlayPlan): VisualOverlayPlan {
  const parsed = parseJsonObject(raw) as { beats?: unknown[]; fallbackSubtitleMode?: unknown };
  const beats = Array.isArray(parsed.beats)
    ? parsed.beats.map((item, index) => parseAiBeat(item, index)).filter((beat): beat is VisualBeat => Boolean(beat))
    : [];

  return {
    styleProfileId: stylePreset,
    density: fallbackPlan.density,
    beats,
    fallbackSubtitleMode: parsed.fallbackSubtitleMode === "minimal" || parsed.fallbackSubtitleMode === "active_word" ? parsed.fallbackSubtitleMode : "off",
    planner: "ai"
  };
}

function parseAiBeat(value: unknown, index: number): VisualBeat | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Record<string, unknown>;
  if (typeof item.start !== "number" || typeof item.duration !== "number") return undefined;
  if (typeof item.templateId !== "string" || typeof item.motionId !== "string" || typeof item.layout !== "string") return undefined;
  if (typeof item.presetId !== "string" || !item.presetId.trim()) return undefined;
  if (!item.payload || typeof item.payload !== "object" || Array.isArray(item.payload)) return undefined;

  return {
    id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `ai-visual-${index}`,
    start: Math.max(0, item.start),
    duration: Math.max(0.2, item.duration),
    templateId: item.templateId as VisualTemplateId,
    presetId: item.presetId.trim(),
    motionId: item.motionId as VisualBeat["motionId"],
    layout: item.layout as VisualBeat["layout"],
    payload: item.payload as Record<string, unknown>,
    sourceMomentId: typeof item.sourceMomentId === "string" ? item.sourceMomentId : undefined,
    role: "semantic_accent",
    variant: "standard"
  };
}

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI visual planner returned non-JSON content.");
    return JSON.parse(match[0]) as Record<string, unknown>;
  }
}

function extractSemanticMoments(subtitles: SubtitleDraft[], contentPlan: ContentPlan, duration: number): SemanticMoment[] {
  const phrases = segmentIntoPhrases(subtitles, contentPlan);
  const moments: SemanticMoment[] = [];
  
  for (let i = 0; i < phrases.length; i++) {
    const phrase = phrases[i]!;
    
    let type: SemanticMoment["type"] = "kinetic_text";
    
    switch (phrase.semanticRole) {
      case "number": type = "number"; break;
      case "warning": type = "warning"; break;
      case "list_item": type = "list"; break;
      case "cta": type = "cta"; break;
      case "emphasis": type = "keyword"; break;
      default: type = "kinetic_text"; break;
    }
    
    // Convert phrase timing to moment timing, adding standard padding
    const start = Math.max(0, phrase.start - 0.05);
    const end = Math.min(duration, phrase.end + 0.15);

    moments.push({
      id: phrase.id,
      start,
      end,
      type,
      sourceText: phrase.text,
      importance: type === "kinetic_text" ? 1 : 2,
      reason: `Role: ${phrase.semanticRole}, Density: ${phrase.density}`
    });
  }

  return moments;
}

function visualBeatForMoment(moment: SemanticMoment, stylePreset: StylePreset, presetPack: NonNullable<VisualPlanInput["styleOptions"]>["presetPack"], index: number): VisualBeat | null {
  const profile = resolveProfileForStyle(stylePreset);
  const templateId = templateForMoment(moment);
  const preset = presetForMoment(moment.type, presetPack ?? "balanced", templateId);
  const motionId = defaultMotionForTemplate(templateId, profile);
  const duration = durationForMoment(moment, templateId);
  const role = moment.type === "cta" ? "cta" : templateId === "kinetic_text" ? "speech_text" : "semantic_accent";

  return {
    id: `visual-${index}`,
    start: Math.max(0, moment.start),
    duration,
    templateId,
    presetId: preset.id,
    motionId,
    layout: layoutForTemplate(templateId),
    payload: payloadForMoment(templateId, moment),
    sourceMomentId: moment.id,
    role,
    variant: variantForMoment(moment, templateId)
  };
}

function templateForMoment(moment: SemanticMoment): VisualTemplateId {
  if (moment.type === "kinetic_text") return "kinetic_text";
  if (moment.type === "chart") return "metric_chart";
  if (moment.type === "number") return "big_number";
  if (moment.type === "warning") return "keyword_slam";
  if (moment.type === "cta") return "cta_plate";
  if (moment.type === "list") return "checklist";
  return "bullet_cards";
}

function layoutForTemplate(templateId: VisualTemplateId): VisualLayout {
  if (templateId === "keyword_slam" || templateId === "cta_plate") return "center";
  if (templateId === "big_number" || templateId === "metric_chart") return "left";
  if (templateId === "kinetic_text") return "lower_third";
  return "full_frame";
}

function mergeAiAccentsIntoContinuousPlan(fallbackPlan: VisualOverlayPlan, aiPlan: VisualOverlayPlan): VisualOverlayPlan {
  if (aiPlan.beats.length === 0) return fallbackPlan;

  const aiBySource = new Map(
    aiPlan.beats
      .filter((beat) => beat.sourceMomentId)
      .map((beat) => [beat.sourceMomentId, beat])
  );

  const beats = fallbackPlan.beats.map((fallbackBeat) => {
    const aiBeat = fallbackBeat.sourceMomentId ? aiBySource.get(fallbackBeat.sourceMomentId) : undefined;
    if (!aiBeat) return fallbackBeat;
    
    // Skip if it's speech_text, UNLESS the AI has selected a non-kinetic_text template to upgrade it
    if (fallbackBeat.role === "speech_text" && aiBeat.templateId === "kinetic_text") {
      return fallbackBeat;
    }

    return {
      ...aiBeat,
      id: fallbackBeat.id,
      start: fallbackBeat.start,
      duration: fallbackBeat.duration,
      layout: layoutForTemplate(aiBeat.templateId),
      sourceMomentId: fallbackBeat.sourceMomentId,
      role: "semantic_accent" as const,
      variant: variantForPayload(aiBeat.payload)
    };
  });

  return {
    ...fallbackPlan,
    beats,
    planner: "continuous"
  };
}

export type VisualPlannerDependencies = {
  transcript: TranscriptJson;
  edl: EditDecisionList;
};

function resolveProfileForInput(input: VisualPlanInput) {
  const profile = resolveProfileForStyle(input.stylePreset);
  return {
    ...profile,
    density: input.styleOptions?.visualDensity ?? profile.density,
    motionIntensity: input.styleOptions?.motionIntensity ?? profile.motionIntensity
  };
}

function resolveProfileForStyle(stylePreset: StylePreset) {
  return resolveVisualStyleProfile(stylePreset);
}
