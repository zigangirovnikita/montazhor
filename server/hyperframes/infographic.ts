import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ContentPlan } from "@/lib/types";
import { infographicPanelTemplate } from "@/server/hyperframes/templates/InfographicPanel";
import { renderHyperframesVideo } from "@/server/hyperframes/render";
import { splitLayoutForProfile, type VideoProfile } from "@/server/video/profile";

export async function renderInfographicPanel(
  projectDir: string,
  contentPlan: ContentPlan,
  profile: VideoProfile,
  duration: number,
  outputPath: string
) {
  const dir = path.join(projectDir, "motion", "infographic-panel");
  const region = splitLayoutForProfile(profile).infographic;
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), infographicPanelTemplate(contentPlan, region, duration), "utf8");
  await renderHyperframesVideo(dir, outputPath);
}
