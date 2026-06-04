import type { VisualBeat, VisualOverlayPlan, VisualStyleProfile } from "@/lib/types";
import { presetById, templateById } from "@/server/hyperframes/visualRegistry";

const maxBeatsByDensity = {
  low: 3,
  medium: 5,
  high: 8
} as const;

const minGapByDensity = {
  low: 3.2,
  medium: 1.6,
  high: 0.8
} as const;

export function validateVisualOverlayPlan(plan: VisualOverlayPlan, profile: VisualStyleProfile): VisualOverlayPlan {
  const accepted: VisualBeat[] = [];
  const maxBeats = maxBeatsByDensity[profile.density];
  const minGap = minGapByDensity[profile.density];

  for (const beat of [...plan.beats].sort((a, b) => a.start - b.start)) {
    if (plan.planner !== "continuous" && accepted.length >= maxBeats) break;

    const template = templateById(beat.templateId);
    if (!template) continue;
    if (!profile.allowedTemplates.includes(beat.templateId)) continue;
    if (!profile.allowedMotions.includes(beat.motionId)) continue;
    if (!template.allowedLayouts.includes(beat.layout)) continue;
    if (!hasAllowedPreset(plan, beat)) continue;
    if (!hasRequiredPayload(beat.payload, template.requiredPayload)) continue;

    const duration = clamp(beat.duration, template.minDuration, template.maxDuration);
    const normalized = { ...beat, duration };
    
    if (plan.planner !== "continuous") {
      const previous = accepted.at(-1);
      if (previous && normalized.start < previous.start + previous.duration + minGap) continue;
    }

    accepted.push(normalized);
  }

  return {
    ...plan,
    density: profile.density,
    beats: accepted
  };
}

function hasAllowedPreset(plan: VisualOverlayPlan, beat: VisualBeat) {
  if (plan.planner !== "ai") return true;
  if (!beat.presetId) return false;
  const preset = presetById(beat.presetId);
  if (!preset) return false;
  return preset.templateId === beat.templateId;
}

function hasRequiredPayload(payload: Record<string, unknown>, required: string[]) {
  return required.every((key) => {
    const value = payload[key];
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && String(value).trim() !== "";
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
