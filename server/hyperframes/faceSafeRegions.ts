import { readFile } from "node:fs/promises";
import path from "node:path";
import type { VisualSafeRegion } from "@/lib/types";
import type { VideoProfile } from "@/server/video/profile";

const FACE_SAFE_REGIONS_FILE = "face-safe-regions.json";

export async function loadOptionalFaceSafeRegions(projectDir: string, profile: VideoProfile): Promise<VisualSafeRegion[]> {
  const filePath = path.join(projectDir, FACE_SAFE_REGIONS_FILE);
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const regions = parsed.filter(isSafeRegion);
    return regions.length ? regions : [defaultSpeakerRegion(profile)];
  } catch {
    return [defaultSpeakerRegion(profile)];
  }
}

function isSafeRegion(value: unknown): value is VisualSafeRegion {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.x === "number" &&
    typeof item.y === "number" &&
    typeof item.width === "number" &&
    typeof item.height === "number" &&
    item.width > 0 &&
    item.height > 0
  );
}

function defaultSpeakerRegion(profile: VideoProfile): VisualSafeRegion {
  if (profile.orientation === "portrait") {
    return {
      id: "default-talking-head",
      kind: "speaker",
      x: profile.width * 0.18,
      y: profile.height * 0.08,
      width: profile.width * 0.64,
      height: profile.height * 0.34,
      confidence: 0.35
    };
  }

  return {
    id: "default-talking-head",
    kind: "speaker",
    x: profile.width * 0.24,
    y: profile.height * 0.12,
    width: profile.width * 0.28,
    height: profile.height * 0.42,
    confidence: 0.35
  };
}
