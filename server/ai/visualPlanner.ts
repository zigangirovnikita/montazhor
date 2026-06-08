import type {
  ContentPlan,
  EditDecisionList,
  SemanticMoment,
  StylePreset,
  TranscriptWord,
  TranscriptJson,
  VisualBeat,
  VisualOverlayPlan,
  VisualPlanInput,
  VisualLayout,
  VisualTemplateId,
  VisualPlanOptions
} from "@/lib/types";
import { getAiConfigForTask } from "@/lib/config";
import { callChatCompletion } from "@/server/ai/openRouterClient";
import { recordAiUsage } from "@/server/ai/usage";
import {
  durationForMoment,
  payloadForMoment,
  roundTime,
  variantForMoment,
  variantForPayload
} from "@/server/ai/visualPayload";
import { buildTimedVisualSegments } from "@/server/ai/timedVisualSegments";
import { preflightVisualOverlayPlan } from "@/server/hyperframes/visualLayoutPreflight";
import { defaultMotionForTemplate, presetForMoment, resolveVisualStyleProfile, visualPresets, visualTemplates } from "@/server/hyperframes/visualRegistry";
import { validateVisualOverlayPlan } from "@/server/hyperframes/visualPlanValidator";

export function buildVisualOverlayPlan(input: VisualPlanInput): VisualOverlayPlan {
  const profile = resolveProfileForInput(input);
  const moments = extractSemanticMoments(input.subtitles, input.contentPlan, input.duration);
  const beats = moments
    .map((moment, index) => visualBeatForMoment(moment, input.stylePreset, input.styleOptions?.presetPack ?? "balanced", index, input.styleOptions))
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
    "You are a viral reels editor and motion art director for talking-head videos.",
    "Choose only reusable HyperFrames visual presets from the provided registry.",
    "Do not invent templates, animations, fonts, or effects outside the registry.",
    "Every beat must include a presetId from preset_registry, and that presetId must belong to the same templateId.",
    "The deterministic planner already created word-timed visual beats for the full speech.",
    "Your job is to behave like an editor: choose the most expressive visual form for each useful spoken moment while preserving sourceMomentId.",
    "Show what the speaker says, not a summary. If the speaker lists items, keep item text and item order. If the speaker says a number, make that number visually important.",
    "You have creative freedom inside the registry: kinetic text, title words, big numbers, growing charts, checklists, warning labels, CTA plates, icons, and concise labels.",
    "Return strict JSON only."
  ].join(" ");
}

function buildVisualPlannerUserPrompt(input: VisualPlanInput) {
  const profile = resolveProfileForInput(input);
  const visualMoments = buildTimedVisualSegments(input.subtitles, input.contentPlan, input.duration).map((moment) => ({
    id: moment.id,
    start: roundTime(moment.start),
    end: roundTime(moment.end),
    text: moment.text,
    type: moment.type,
    words: moment.words.map((word) => ({
      text: word.word,
      start: roundTime(word.start),
      end: roundTime(word.end)
    }))
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
          sourceMomentId: "visual_moment id this beat upgrades"
        }
      ],
      fallbackSubtitleMode: "off"
    },
    creative_direction: [
      "Think like a viral reels editor, not a subtitle renderer.",
      "Use the speaker words and word timings as the source of truth.",
      "It is allowed to turn a spoken fragment into a title, number callout, checklist item, graph, warning, icon-backed phrase, or kinetic word animation when that helps the viewer understand or feel the point.",
      "Small decorative payload fields like icon, eyebrow, label, and title may be adapted to the meaning, but visible main text must stay grounded in the speaker's words.",
      "For lists, keep the spoken order and make each item feel like it arrives when the author says it.",
      "For growth, progress, comparisons, money, percentages, ages, years, quantities, or metrics, prefer visual reinforcement with numbers or charts."
    ],
    guardrails: [
      "Keep sourceMomentId equal to one of the provided visual_moments ids.",
      "Return at most one upgraded beat per provided visual_moment; the deterministic base layer already covers the rest.",
      "Do not create dense spam: skip weak moments instead of forcing heavy cards everywhere.",
      "Do not invent facts, numbers, names, offers, or claims that are not in the spoken text.",
      "Do not use unsupported templates, unsupported motions, unsupported layouts, or preset ids outside the registry.",
      "The server will preserve deterministic start/duration from sourceMomentId, so focus on template, preset, layout, motion, and payload.",
      "Do not shorten payload text with ellipses. Prefer concise full-word phrases that fit the template.",
      "If a phrase contains 3 or more related numbers or a sequence over time, prefer metric_chart over big_number.",
      "For big_number payload use { value, label }.",
      "For metric_chart payload use { title, label, values }.",
      "For checklist payload use { title, items } with 2-3 short items.",
      "For bullet_cards payload use { eyebrow, title, items }.",
      "For lesson_title payload use { eyebrow, title, subtext }.",
      "For myth_strike payload use { eyebrow, falseText, trueText }.",
      "For stat_panel payload use { eyebrow, title, items: [{ value, label }] }.",
      "For concept_map payload use { eyebrow, center, left, right, caption }.",
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
    visual_moments: visualMoments
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

function extractSemanticMoments(subtitles: VisualPlanInput["subtitles"], contentPlan: ContentPlan, duration: number): SemanticMoment[] {
  return buildTimedVisualSegments(subtitles, contentPlan, duration).map((segment) => ({
    id: segment.id,
    start: Math.max(0, segment.start - 0.02),
    end: Math.min(duration, segment.end + 0.08),
    type: segment.type,
    sourceText: segment.text,
    words: segment.words,
    importance: segment.type === "kinetic_text" ? 1 : 2,
    reason: segment.reason
  }));
}

function blockIdForMoment(moment: SemanticMoment): string {
  const type = moment.type;
  if (type === "kinetic_text") return "subtitle";
  if (type === "number") return "stat";
  if (type === "list") return "list";
  if (type === "cta") return "cta";
  if (type === "chart") return "chart";
  if (type === "warning") return "comparison";
  if (type === "comparison") return "comparison";
  if (type === "definition") return "list";
  if (type === "keyword") return "headline";
  if (type === "quote") return "accent";
  return "accent";
}

function visualBeatForMoment(
  moment: SemanticMoment,
  stylePreset: StylePreset,
  presetPack: NonNullable<VisualPlanInput["styleOptions"]>["presetPack"],
  index: number,
  styleOptions?: VisualPlanOptions
): VisualBeat | null {
  const profile = resolveProfileForStyle(stylePreset);
  let templateId = templateForMoment(moment);
  let preset = presetForMoment(moment.type, presetPack ?? "balanced", templateId);
  let motionId = defaultMotionForTemplate(templateId, profile);

  // Apply custom layout preset and animations from the styleOptions.visualTemplate if present
  const visualTemplate = styleOptions?.visualTemplate as any;
  let motionOutId: string | undefined = undefined;
  let styleOverrides: any = undefined;
  if (visualTemplate?.blocks) {
    const blockId = blockIdForMoment(moment);
    const block = visualTemplate.blocks[blockId];
    if (block && block.enabled) {
      if (block.layoutPreset) {
        const customPreset = visualPresets.find((p) => p.id === block.layoutPreset);
        if (customPreset) {
          preset = customPreset;
          templateId = customPreset.templateId;
        }
      }
      if (block.animationIn && block.animationIn !== "none") {
        motionId = block.animationIn as any;
      }
      if (block.animationOut) {
        motionOutId = block.animationOut;
      }
      styleOverrides = {
        surface: block.surface !== undefined ? block.surface : (visualTemplate.theme?.defaultSurface ?? "glass"),
        surfaceOpacity: typeof block.surfaceOpacity === "number" ? block.surfaceOpacity : 0.82,
        borderRadius: typeof block.borderRadius === "number" ? block.borderRadius : 22,
        padding: typeof block.padding === "number" ? block.padding : 22,
        colorText: block.colorText || visualTemplate.theme?.colorText || null,
        colorBackground: block.colorBackground || visualTemplate.theme?.colorBackground || null,
        colorAccent: block.colorAccent || visualTemplate.theme?.colorPrimary || null,
        borderColor: block.borderColor || null,
        shadow: block.shadow !== undefined ? block.shadow : (visualTemplate.theme?.defaultShadow ?? "soft")
      };
    }
  }

  const role = moment.type === "cta" ? "cta" : templateId === "kinetic_text" ? "speech_text" : "semantic_accent";
  const spokenDuration = Math.max(0.34, moment.end - moment.start);
  const duration = role === "speech_text" ? spokenDuration : Math.max(spokenDuration, durationForMoment(moment, templateId));

  return {
    id: `visual-${index}`,
    start: Math.max(0, moment.start),
    duration,
    templateId,
    presetId: preset.id,
    motionId,
    motionOutId,
    layout: layoutForTemplate(templateId),
    payload: {
      ...payloadForMoment(templateId, moment),
      sourceText: moment.sourceText,
      words: wordsPayload(moment.words ?? [], Math.max(0, moment.start))
    },
    sourceMomentId: moment.id,
    role,
    variant: variantForMoment(moment, templateId),
    styleOverrides
  };
}

function templateForMoment(moment: SemanticMoment): VisualTemplateId {
  if (moment.type === "kinetic_text") return "kinetic_text";
  if (moment.type === "chart") return "stat_panel";
  if (moment.type === "number") return "big_number";
  if (moment.type === "warning") return "myth_strike";
  if (moment.type === "cta") return "cta_plate";
  if (moment.type === "list") return "checklist";
  if (moment.type === "definition") return "concept_map";
  if (moment.type === "comparison") return "concept_map";
  if (moment.type === "keyword") return "lesson_title";
  return "bullet_cards";
}

function layoutForTemplate(templateId: VisualTemplateId): VisualLayout {
  if (templateId === "keyword_slam" || templateId === "cta_plate") return "center";
  if (templateId === "lesson_title" || templateId === "myth_strike" || templateId === "stat_panel" || templateId === "concept_map") return "full_frame";
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
      payload: {
        ...aiBeat.payload,
        ...(typeof fallbackBeat.payload.sourceText === "string" ? { sourceText: fallbackBeat.payload.sourceText } : {}),
        ...(Array.isArray(fallbackBeat.payload.words) ? { words: fallbackBeat.payload.words } : {})
      },
      sourceMomentId: fallbackBeat.sourceMomentId,
      role: "semantic_accent" as const,
      variant: variantForPayload(aiBeat.payload)
    };
  });

  return {
    ...fallbackPlan,
    beats,
    diagnostics: [],
    planner: "continuous"
  };
}

function wordsPayload(words: TranscriptWord[], beatStart: number) {
  return words.map((word) => ({
    text: word.word,
    start: roundTime(Math.max(0, word.start - beatStart)),
    end: roundTime(Math.max(0.08, word.end - beatStart)),
    duration: roundTime(Math.max(0.08, word.end - word.start))
  }));
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
