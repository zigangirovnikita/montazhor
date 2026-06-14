import type { TemplateInstancePlan } from "@/lib/types/visual";
import { outputArgsForProfile, previewScaleFilter, type RenderProfile } from "@/server/video/encoding";
import { ffmpegPath, runCommand } from "@/server/video/ffmpeg";
import type { VideoProfile } from "@/server/video/profile";
import { ensureArtifact, hashJson } from "@/server/render/renderGraph";

export async function composeTemplateFragments(
  projectId: string,
  cleanVideoPath: string,
  fragmentPaths: string[],
  fragmentCacheKeys: string[],
  cleanFingerprint: string,
  plan: TemplateInstancePlan,
  profile: VideoProfile,
  outputPath: string,
  renderProfile: RenderProfile
) {
  // Cache cinematic_compose via ensureArtifact
  const composeCacheKey = [
    cleanFingerprint,
    ...fragmentCacheKeys,
    hashJson(plan.instances.map(s => ({ 
      id: s.id, 
      start: s.start, 
      duration: s.duration, 
      layout: s.variantId // variantId handles layout in our new schema conceptually
    }))),
    "compose_director_v1",
    renderProfile
  ].join(":");

  await ensureArtifact(
    projectId,
    `template_compose_${renderProfile}`,
    composeCacheKey,
    outputPath,
    async (signal) => {
      await runComposition(cleanVideoPath, fragmentPaths, plan, profile, outputPath, renderProfile, signal);
    },
    { timeoutMs: 5 * 60_000 }
  );
}

async function runComposition(
  cleanVideoPath: string,
  fragmentPaths: string[],
  plan: TemplateInstancePlan,
  profile: VideoProfile,
  outputPath: string,
  renderProfile: RenderProfile,
  signal?: AbortSignal
) {
  if (fragmentPaths.length === 0) {
    await runCommand(ffmpegPath(), [
      "-y",
      "-i", cleanVideoPath,
      "-c:v", "copy",
      "-c:a", "copy",
      outputPath
    ], { signal });
    return;
  }

  // We enforce no PIP unless full_screen (which isn't really PIP, just an overlay)
  // To keep the filter graph simple for now, all our new templates are overlays
  const filter = buildFragmentsComposeFilter(plan.instances, profile, renderProfile);

  const inputs: string[] = [];
  fragmentPaths.forEach(fp => inputs.push("-i", fp));

  await runCommand(ffmpegPath(), [
    "-y",
    "-i", cleanVideoPath,
    ...inputs,
    "-filter_complex", filter,
    "-map", `[v_out]`,
    "-map", "0:a:0",
    ...outputArgsForProfile(renderProfile),
    outputPath
  ], { signal });
}

function buildFragmentsComposeFilter(
  instances: TemplateInstancePlan["instances"],
  profile: VideoProfile,
  renderProfile: RenderProfile
) {
  const chains: string[] = [];
  
  chains.push(`[0:v]copy[basein]`);
  chains.push(`[basein]setpts=PTS-STARTPTS[v0]`);

  instances.forEach((instance, index) => {
    const inputIdx = index + 1;
    const start = instance.start;
    const end = instance.start + instance.duration;
    
    const isOverlay = 
      instance.templateId.includes("callout") ||
      instance.templateId.includes("stat_meter") ||
      instance.templateId.includes("myth_strike") ||
      instance.templateId.includes("warning_dialogue") ||
      instance.templateId.includes("quote_flash");

    if (isOverlay) {
      // Convert green background to transparent (hyperframes standard)
      chains.push(`[${inputIdx}:v]setpts=PTS-STARTPTS,tpad=start_duration=${start}:color=0x00ff00,colorkey=0x00ff00:0.22:0.04[scene${index}]`);
    } else {
      // Fullscreen opaque overlay
      chains.push(`[${inputIdx}:v]setpts=PTS-STARTPTS,tpad=start_duration=${start}:color=black[scene${index}]`);
    }
    
    chains.push(`[v${index}][scene${index}]overlay=x=0:y=0:enable='between(t,${start},${end})':eof_action=pass[v${index + 1}]`);
  });

  const lastOverlayLayer = `v${instances.length}`;

  chains.push(`[${lastOverlayLayer}]copy[v_pre_scale]`);
  chains.push(`[v_pre_scale]${previewScaleFilter(profile, renderProfile)}[v_out]`);

  return chains.join(";");
}
