import type { VisualBeat, VisualFrameProfile, VisualOverlayPlan, VisualPlanOptions, VisualStyleProfile, VisualTemplateId } from "@/lib/types";
import { estimateReadingDuration } from "@/server/ai/visualPayload";
import { defaultMotionForTemplate, presetById, presetForMoment, templateById } from "@/server/hyperframes/visualRegistry";
import { layoutEngine } from "@/server/hyperframes/layoutEngine";

const templateTextLimits: Record<VisualTemplateId, number> = {
  kinetic_text: 92,
  keyword_slam: 52,
  big_number: 64,
  metric_chart: 82,
  checklist: 112,
  bullet_cards: 118,
  lesson_title: 92,
  myth_strike: 104,
  stat_panel: 132,
  concept_map: 132,
  cta_plate: 58
};

export function preflightVisualOverlayPlan(
  plan: VisualOverlayPlan,
  profile: VisualStyleProfile,
  duration: number,
  options: VisualPlanOptions = {},
  frame?: VisualFrameProfile
): VisualOverlayPlan {
  const diagnostics: string[] = [];
  const accepted: VisualBeat[] = [];

  for (const beat of [...plan.beats].sort((a, b) => a.start - b.start)) {
    const keepPlanTiming = plan.planner === "continuous";
    const prepared = prepareBeat(beat, profile, duration, options, diagnostics, frame, keepPlanTiming);
    for (const item of prepared) {
      const previous = accepted.at(-1);
      const shifted = !keepPlanTiming && previous && item.start < previous.start + previous.duration
        ? { ...item, start: previous.start + Math.max(0.02, previous.duration) }
        : item;
      if (shifted.start >= duration) continue;
      accepted.push({ ...shifted, duration: Math.min(shifted.duration, Math.max(0.42, duration - shifted.start)) });
    }
  }

  return {
    ...plan,
    density: options.visualDensity ?? plan.density,
    beats: accepted,
    diagnostics: [...(plan.diagnostics ?? []), ...diagnostics]
  };
}

function prepareBeat(
  beat: VisualBeat,
  profile: VisualStyleProfile,
  duration: number,
  options: VisualPlanOptions,
  diagnostics: string[],
  frame?: VisualFrameProfile,
  keepPlanTiming = false
): VisualBeat[] {
  if (options.disabledTemplates?.includes(beat.templateId)) {
    diagnostics.push(`${beat.id}: ${beat.templateId} disabled; using safe kinetic preset.`);
    return toSafeKineticBeats(beat, profile, duration);
  }

  const template = templateById(beat.templateId);
  const targetMomentType = beat.role === "cta" ? "cta" : beat.templateId === "kinetic_text" ? "kinetic_text" : "keyword";
  const requestedPreset = presetById(beat.presetId);
  const preset = requestedPreset ?? presetForMoment(targetMomentType, options.presetPack ?? "balanced", beat.templateId);
  const normalizedPreset = normalizePresetForOptions(preset, beat, options, diagnostics);
  const maxTextChars = Math.min(templateTextLimits[beat.templateId], normalizedPreset.maxTextChars);
  const text = textFromPayload(beat.payload);
  const payloadLength = payloadTextLength(beat.payload);

  if (!template || !profile.allowedTemplates.includes(beat.templateId)) {
    diagnostics.push(`${beat.id}: unknown or disallowed template; using safe kinetic preset.`);
    return toSafeKineticBeats(beat, profile, duration);
  }

  if (beat.templateId === "kinetic_text" && payloadLength > maxTextChars) {
    diagnostics.push(`${beat.id}: long kinetic phrase split before render.`);
    return splitKineticBeat(beat, profile, maxTextChars, duration);
  }

  if (beat.templateId !== "kinetic_text" && payloadLength > maxTextChars * 1.15) {
    diagnostics.push(`${beat.id}: payload too long for ${beat.templateId}; using full kinetic fallback.`);
    return toSafeKineticBeats(beat, profile, duration);
  }

  const keepSpokenTiming = beat.role === "speech_text" && beat.templateId === "kinetic_text";

  return [{
    ...beat,
    presetId: normalizedPreset.id,
    payload: clampPayload(beat.payload, beat.templateId, maxTextChars, normalizedPreset.maxItems),
    variant: payloadLength > maxTextChars ? "compact" : beat.variant,
    motionId: (profile.allowedMotions.includes(beat.motionId) || [
      "glass_slide",
      "depth_zoom",
      "calm_fade",
      "word_slam",
      "soft_pop",
      "slide-up",
      "slide-right",
      "fade",
      "scale",
      "word-by-word",
      "none"
    ].includes(beat.motionId)) ? beat.motionId : defaultMotionForTemplate(beat.templateId, profile),
    layout: layoutEngine(frame, normalizedPreset.preferredLayouts.includes(beat.layout) ? beat.layout : normalizedPreset.preferredLayouts[0] ?? beat.layout, options.faceSafeRegions ?? [], diagnostics, beat.id),
    start: Math.max(0, Math.min(beat.start, duration)),
    duration: keepPlanTiming || keepSpokenTiming ? Math.max(0.32, beat.duration) : Math.max(0.42, beat.duration, estimateReadingDuration(text, beat.templateId))
  }];
}

function normalizePresetForOptions(
  preset: NonNullable<ReturnType<typeof presetById>> | ReturnType<typeof presetForMoment>,
  beat: VisualBeat,
  options: VisualPlanOptions,
  diagnostics: string[]
) {
  const selectedPack = options.presetPack;
  if (!selectedPack || preset.pack === selectedPack || preset.pack === "balanced") {
    return preset;
  }

  const remapped = presetForMoment(beat.role === "cta" ? "cta" : beat.templateId === "kinetic_text" ? "kinetic_text" : "keyword", selectedPack, beat.templateId);
  if (remapped.id !== preset.id) {
    diagnostics.push(`${beat.id}: preset ${preset.id} does not match selected pack ${selectedPack}; remapped before render.`);
  }
  return remapped;
}

function splitKineticBeat(beat: VisualBeat, profile: VisualStyleProfile, maxTextChars: number, duration: number) {
  const text = sourceTextForKineticFallback(beat);
  const chunks = chunkWords(text, maxTextChars);
  const mergedChunks = mergeTinyTrailingChunks(chunks);
  const totalReadDuration = mergedChunks.reduce((sum, chunk) => sum + estimateReadingDuration(chunk, "kinetic_text"), 0);
  const scale = totalReadDuration > 0 ? Math.max(1, beat.duration / totalReadDuration) : 1;
  let cursor = beat.start;

  return mergedChunks.map((chunk, index) => {
    const chunkDuration = Math.max(1.15, estimateReadingDuration(chunk, "kinetic_text") * scale);
    const nextBeat = {
      ...beat,
      id: `${beat.id}-part-${index + 1}`,
      presetId: "kinetic_phrase_safe",
      start: Math.min(duration, cursor),
      duration: chunkDuration,
      motionId: profile.allowedMotions.includes("calm_fade") ? "calm_fade" : beat.motionId,
      layout: "lower_third" as const,
      payload: { text: chunk, emphasis: emphasisFromText(chunk) },
      role: "speech_text" as const,
      variant: mergedChunks.length > 1 ? "compact" as const : beat.variant
    };
    cursor += chunkDuration;
    return nextBeat;
  });
}

function toSafeKineticBeats(beat: VisualBeat, profile: VisualStyleProfile, duration: number) {
  const text = sourceTextForKineticFallback(beat);
  const safeBeat: VisualBeat = {
    ...beat,
    templateId: "kinetic_text",
    presetId: "kinetic_phrase_safe",
    motionId: profile.allowedMotions.includes("calm_fade") ? "calm_fade" : defaultMotionForTemplate("kinetic_text", profile),
    layout: "lower_third",
    payload: { text, emphasis: emphasisFromText(text) },
    role: "speech_text",
    variant: "safe"
  };
  return text.length > templateTextLimits.kinetic_text
    ? splitKineticBeat(safeBeat, profile, templateTextLimits.kinetic_text, duration)
    : [safeBeat];
}

function clampPayload(payload: Record<string, unknown>, templateId: VisualTemplateId, maxTextChars: number, maxItems = 3) {
  const next = { ...payload };
  for (const key of ["text", "label", "title", "subtext", "copy", "eyebrow"]) {
    if (typeof next[key] === "string") next[key] = normalizeText(String(next[key]));
  }
  if (Array.isArray(next.items)) {
    next.items = next.items
      .map(normalizeItem)
      .filter((item) => typeof item === "string" ? Boolean(item) : Boolean(item.label || item.value))
      .slice(0, maxItems);
  }
  if (Array.isArray(next.values)) {
    next.values = next.values.map((item) => normalizeText(String(item))).filter(Boolean).slice(0, maxItems);
  }
  if (templateId === "kinetic_text" && !next.emphasis) next.emphasis = emphasisFromText(String(next.text ?? ""));
  return next;
}

function normalizeItem(item: unknown) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return normalizeText(String(item));
  }
  const record = item as Record<string, unknown>;
  return {
    value: normalizeText(String(record.value ?? "")),
    label: normalizeText(String(record.label ?? record.text ?? "")),
    detail: normalizeText(String(record.detail ?? ""))
  };
}

function textFromPayload(payload: Record<string, unknown>) {
  return collectPayloadText(payload).join(" ").trim();
}

function sourceTextForKineticFallback(beat: VisualBeat) {
  return typeof beat.payload.sourceText === "string" && beat.payload.sourceText.trim()
    ? beat.payload.sourceText.trim()
    : textFromPayload(beat.payload);
}

function payloadTextLength(payload: Record<string, unknown>) {
  return textFromPayload(payload).length;
}

function collectPayloadText(payload: Record<string, unknown>) {
  const parts: string[] = [];
  for (const key of ["text", "label", "title", "subtext", "copy", "eyebrow", "value"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) parts.push(value.trim());
  }
  if (Array.isArray(payload.items)) {
    parts.push(...payload.items.map((item) => String(item).trim()).filter(Boolean));
  }
  if (Array.isArray(payload.values)) {
    parts.push(...payload.values.map((item) => String(item).trim()).filter(Boolean));
  }
  return parts;
}

function emphasisFromText(text: string) {
  return text.split(/\s+/).find((word) => word.length > 5)?.replace(/[^\p{L}\p{N}%$₽-]+/gu, "").toUpperCase() ?? "";
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function chunkWords(text: string, maxTextChars: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxTextChars && current) {
      chunks.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function mergeTinyTrailingChunks(chunks: string[]) {
  if (chunks.length < 2) return chunks;
  const merged = [...chunks];
  for (let i = merged.length - 1; i > 0; i -= 1) {
    const wordCount = merged[i]!.split(/\s+/).filter(Boolean).length;
    if (wordCount <= 2) {
      merged[i - 1] = `${merged[i - 1]} ${merged[i]}`.trim();
      merged.splice(i, 1);
    }
  }
  return merged;
}
