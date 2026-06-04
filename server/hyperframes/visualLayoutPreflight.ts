import type { VisualBeat, VisualFrameProfile, VisualOverlayPlan, VisualPlanOptions, VisualStyleProfile, VisualTemplateId } from "@/lib/types";
import { defaultMotionForTemplate, presetById, presetForMoment, templateById } from "@/server/hyperframes/visualRegistry";
import { layoutEngine } from "@/server/hyperframes/layoutEngine";

const templateTextLimits: Record<VisualTemplateId, number> = {
  kinetic_text: 92,
  keyword_slam: 52,
  big_number: 64,
  metric_chart: 82,
  checklist: 112,
  bullet_cards: 118,
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
    const prepared = prepareBeat(beat, profile, duration, options, diagnostics, frame);
    for (const item of prepared) {
      const previous = accepted.at(-1);
      const shifted = previous && item.start < previous.start + previous.duration
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
  frame?: VisualFrameProfile
): VisualBeat[] {
  if (options.disabledTemplates?.includes(beat.templateId)) {
    diagnostics.push(`${beat.id}: ${beat.templateId} disabled; using safe kinetic preset.`);
    return [toSafeKinetic(beat, profile)];
  }

  const template = templateById(beat.templateId);
  const targetMomentType = beat.role === "cta" ? "cta" : beat.templateId === "kinetic_text" ? "kinetic_text" : "keyword";
  const requestedPreset = presetById(beat.presetId);
  const preset = requestedPreset ?? presetForMoment(targetMomentType, options.presetPack ?? "balanced", beat.templateId);
  const normalizedPreset = normalizePresetForOptions(preset, beat, options, diagnostics);
  const maxTextChars = Math.min(templateTextLimits[beat.templateId], normalizedPreset.maxTextChars);
  const text = textFromPayload(beat.payload);

  if (!template || !profile.allowedTemplates.includes(beat.templateId)) {
    diagnostics.push(`${beat.id}: unknown or disallowed template; using safe kinetic preset.`);
    return [toSafeKinetic(beat, profile)];
  }

  if (beat.templateId === "kinetic_text" && text.length > maxTextChars) {
    diagnostics.push(`${beat.id}: long kinetic phrase split before render.`);
    return splitKineticBeat(beat, profile, maxTextChars, duration);
  }

  if (text.length > maxTextChars * 1.35) {
    diagnostics.push(`${beat.id}: payload too long for ${beat.templateId}; using compact kinetic fallback.`);
    return [toSafeKinetic(beat, profile)];
  }

  return [{
    ...beat,
    presetId: normalizedPreset.id,
    payload: clampPayload(beat.payload, beat.templateId, maxTextChars, normalizedPreset.maxItems),
    variant: text.length > maxTextChars ? "compact" : beat.variant,
    motionId: profile.allowedMotions.includes(beat.motionId) ? beat.motionId : defaultMotionForTemplate(beat.templateId, profile),
    layout: layoutEngine(frame, normalizedPreset.preferredLayouts.includes(beat.layout) ? beat.layout : normalizedPreset.preferredLayouts[0] ?? beat.layout, options.faceSafeRegions ?? [], diagnostics, beat.id),
    start: Math.max(0, Math.min(beat.start, duration)),
    duration: Math.max(0.42, beat.duration)
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

  diagnostics.push(`${beat.id}: preset ${preset.id} does not match selected pack ${selectedPack}; remapped before render.`);
  return presetForMoment(beat.role === "cta" ? "cta" : beat.templateId === "kinetic_text" ? "kinetic_text" : "keyword", selectedPack, beat.templateId);
}

function splitKineticBeat(beat: VisualBeat, profile: VisualStyleProfile, maxTextChars: number, duration: number) {
  const text = textFromPayload(beat.payload);
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

  const chunkDuration = Math.max(0.52, beat.duration / Math.max(1, chunks.length));
  return chunks.map((chunk, index) => ({
    ...beat,
    id: `${beat.id}-part-${index + 1}`,
    presetId: "kinetic_phrase_safe",
    start: Math.min(duration, beat.start + index * chunkDuration),
    duration: chunkDuration,
    motionId: profile.allowedMotions.includes("calm_fade") ? "calm_fade" : beat.motionId,
    layout: "lower_third" as const,
    payload: { text: chunk, emphasis: emphasisFromText(chunk) },
    role: "speech_text" as const,
    variant: chunks.length > 1 ? "compact" as const : beat.variant
  }));
}

function toSafeKinetic(beat: VisualBeat, profile: VisualStyleProfile): VisualBeat {
  const text = textFromPayload(beat.payload);
  return {
    ...beat,
    templateId: "kinetic_text",
    presetId: "kinetic_phrase_safe",
    motionId: profile.allowedMotions.includes("calm_fade") ? "calm_fade" : defaultMotionForTemplate("kinetic_text", profile),
    layout: "lower_third",
    payload: { text: trimText(text, templateTextLimits.kinetic_text), emphasis: emphasisFromText(text) },
    role: "speech_text",
    variant: "safe"
  };
}

function clampPayload(payload: Record<string, unknown>, templateId: VisualTemplateId, maxTextChars: number, maxItems = 3) {
  const next = { ...payload };
  for (const key of ["text", "label", "title", "subtext", "copy", "eyebrow"]) {
    if (typeof next[key] === "string") next[key] = trimText(String(next[key]), maxTextChars);
  }
  if (Array.isArray(next.items)) {
    next.items = next.items.map((item) => trimText(String(item), Math.max(28, Math.floor(maxTextChars / 2)))).slice(0, maxItems);
  }
  if (templateId === "kinetic_text" && !next.emphasis) next.emphasis = emphasisFromText(String(next.text ?? ""));
  return next;
}

function textFromPayload(payload: Record<string, unknown>) {
  const direct = [payload.text, payload.label, payload.title, payload.subtext, payload.copy].find((value) => typeof value === "string" && value.trim());
  if (direct) return String(direct);
  if (Array.isArray(payload.items)) return payload.items.map(String).join(" ");
  return "";
}

function emphasisFromText(text: string) {
  return text.split(/\s+/).find((word) => word.length > 5)?.replace(/[^\p{L}\p{N}%$₽-]+/gu, "").toUpperCase() ?? "";
}

function trimText(text: string, maxLength: number) {
  const value = text.replace(/\s+/g, " ").trim();
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(1, maxLength - 3)).trim()}...`;
}
