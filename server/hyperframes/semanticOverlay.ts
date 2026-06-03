import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { VisualOverlayPlan } from "@/lib/types";
import { renderHyperframesVideo } from "@/server/hyperframes/render";
import { semanticOverlayTemplate } from "@/server/hyperframes/templates/SemanticOverlay";
import { resolveVisualStyleProfile } from "@/server/hyperframes/visualRegistry";
import type { VideoProfile } from "@/server/video/profile";

export async function renderSemanticOverlay(
  projectDir: string,
  plan: VisualOverlayPlan,
  profile: VideoProfile,
  duration: number,
  outputMp4Path: string
) {
  const dir = path.join(projectDir, "motion", "semantic-overlay");
  const style = resolveVisualStyleProfile(plan.styleProfileId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), semanticOverlayTemplate(plan, style, profile, duration), "utf8");
  await renderHyperframesVideo(dir, outputMp4Path);
}
