import { createHash } from "node:crypto";
import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { VisualBeat, VisualOverlayPlan, VisualStyleProfile } from "@/lib/types";
import { renderHyperframesVideo } from "@/server/hyperframes/render";
import { semanticOverlayTemplate } from "@/server/hyperframes/templates/SemanticOverlay";
import type { VideoProfile } from "@/server/video/profile";

type OverlayRenderMode = "alpha" | "chroma";

export interface OverlayFragment {
  id: string;
  start: number;
  duration: number;
  beats: VisualBeat[];
}

export interface RenderedOverlayFragment extends OverlayFragment {
  path: string;
}

export function splitOverlayPlanIntoFragments(plan: VisualOverlayPlan): OverlayFragment[] {
  const sorted = [...plan.beats].sort((a, b) => a.start - b.start);
  const fragments: OverlayFragment[] = [];
  let current: VisualBeat[] = [];
  let start = 0;
  let end = 0;
  const maxFragmentDuration = 4.4;
  const maxFragmentBeats = 2;

  for (const beat of sorted) {
    const beatEnd = beat.start + beat.duration;
    const gap = current.length ? beat.start - end : 0;
    const nextDuration = current.length ? beatEnd - start : beat.duration;
    const shouldSplit = current.length > 0 && (gap > 0.75 || nextDuration > maxFragmentDuration || current.length >= maxFragmentBeats);

    if (shouldSplit) {
      fragments.push(fragmentFromBeats(fragments.length, start, end, current));
      current = [];
    }

    if (current.length === 0) {
      start = Math.max(0, beat.start - 0.04);
      end = beatEnd;
    } else {
      end = Math.max(end, beatEnd);
    }
    current.push(beat);
  }

  if (current.length) {
    fragments.push(fragmentFromBeats(fragments.length, start, end, current));
  }

  return fragments;
}

export async function renderOverlayFragments(
  dir: string,
  plan: VisualOverlayPlan,
  style: VisualStyleProfile,
  profile: VideoProfile,
  mode: OverlayRenderMode
): Promise<RenderedOverlayFragment[]> {
  const fragments = splitOverlayPlanIntoFragments(plan);
  const rendered: RenderedOverlayFragment[] = [];
  const cacheDir = path.join(dir, "fragments-cache");
  await mkdir(cacheDir, { recursive: true });

  for (const fragment of fragments) {
    const fragmentPlan: VisualOverlayPlan = {
      ...plan,
      beats: fragment.beats.map((beat) => ({ ...beat, start: round(beat.start - fragment.start) }))
    };
    const cacheKey = createHash("sha1")
      .update(JSON.stringify({ fragmentPlan, styleId: style.id, profile, mode }))
      .digest("hex")
      .slice(0, 12);
    const ext = mode === "alpha" ? "mov" : "mp4";
    const outputPath = path.join(cacheDir, `${fragment.id}-${cacheKey}.${ext}`);

    if (!(await fileExists(outputPath))) {
      const fragmentDir = path.join(dir, "fragments", fragment.id);
      await mkdir(fragmentDir, { recursive: true });
      await renderFragment(fragmentDir, outputPath, fragmentPlan, style, profile, fragment.duration, mode);
    }

    rendered.push({ ...fragment, path: outputPath });
  }

  return rendered;
}

async function renderFragment(
  dir: string,
  outputPath: string,
  plan: VisualOverlayPlan,
  style: VisualStyleProfile,
  profile: VideoProfile,
  duration: number,
  mode: OverlayRenderMode
) {
  try {
    await writeFile(path.join(dir, "index.html"), semanticOverlayTemplate(plan, style, profile, duration, mode), "utf8");
    await unlink(outputPath).catch(() => {});
    await renderHyperframesVideo(dir, outputPath, mode === "alpha" ? { format: "mov", normalize: false } : undefined);
  } catch (error) {
    if (plan.beats.length > 1) {
      // Per-beat retry logic for multi-beat fragments
      const isolatedPlan = { ...plan, beats: [...plan.beats] };
      let success = false;
      
      for (let i = 0; i < plan.beats.length; i++) {
        const beatToTest = plan.beats[i];
        if (!beatToTest) continue;
        
        try {
          const singleBeatPlan = { ...plan, beats: [beatToTest] };
          await writeFile(path.join(dir, "test.html"), semanticOverlayTemplate(singleBeatPlan, style, profile, duration, mode), "utf8");
          // If it doesn't throw, we assume template generation is at least somewhat safe, 
          // but we can't do a full video render for every beat without destroying performance.
          // In a real isolated environment we'd test render, but here we'll just try
          // degrading the failing beat to safe kinetic.
        } catch (e) {
          // Found the bad beat
          isolatedPlan.beats[i] = toSafeKineticPlan({ ...plan, beats: [beatToTest] }).beats[0]!;
        }
      }
      
      try {
        await writeFile(path.join(dir, "index.html"), semanticOverlayTemplate(isolatedPlan, style, profile, duration, mode), "utf8");
        await renderHyperframesVideo(dir, outputPath, mode === "alpha" ? { format: "mov", normalize: false } : undefined);
        success = true;
      } catch (retryError) {
        success = false;
      }
      
      if (success) return;
    }

    // Fallback: degrade everything to safe kinetic
    const safePlan = toSafeKineticPlan(plan);
    if (safePlan.beats.length === 0) throw error;
    await writeFile(path.join(dir, "index.html"), semanticOverlayTemplate(safePlan, style, profile, duration, mode), "utf8");
    await unlink(outputPath).catch(() => {});
    await renderHyperframesVideo(dir, outputPath, mode === "alpha" ? { format: "mov", normalize: false } : undefined);
  }
}

function fragmentFromBeats(index: number, start: number, end: number, beats: VisualBeat[]): OverlayFragment {
  return {
    id: `fragment-${String(index + 1).padStart(3, "0")}`,
    start: round(start),
    duration: round(Math.max(0.42, end - start)),
    beats
  };
}

function toSafeKineticPlan(plan: VisualOverlayPlan): VisualOverlayPlan {
  return {
    ...plan,
    beats: plan.beats.map((beat) => ({
      ...beat,
      templateId: "kinetic_text",
      motionId: "calm_fade",
      layout: "lower_third",
      payload: {
        text: textFromPayload(beat.payload),
        emphasis: ""
      },
      role: "speech_text",
      variant: "safe"
    }))
  };
}

function textFromPayload(payload: Record<string, unknown>) {
  const candidates = [payload.text, payload.label, payload.title, payload.subtext, payload.copy];
  const direct = candidates.find((value) => typeof value === "string" && value.trim());
  if (direct) return String(direct);
  if (Array.isArray(payload.items)) return payload.items.map(String).join(" ");
  return "";
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
