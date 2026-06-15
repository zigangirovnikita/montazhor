import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { VisualScenePlan } from "@/lib/types";
import { renderHyperframesVideo } from "@/server/hyperframes/render";
import { aisTechSceneFragmentTemplate } from "@/server/hyperframes/templates/AisTechScene";
import { outputArgsForProfile, previewScaleFilter, type RenderProfile } from "@/server/video/encoding";
import { ffmpegPath, runCommand } from "@/server/video/ffmpeg";
import type { VideoProfile } from "@/server/video/profile";
import { ensureArtifact, fingerprintFile, hashJson } from "@/server/render/renderGraph";
import { SCENE_PLANNER_VERSION } from "@/server/ai/visualScenePlanner";
import { pathsForProject } from "@/lib/storage";

export async function renderSceneFragments(
  projectId: string,
  projectDir: string,
  cleanVideoPath: string,
  plan: VisualScenePlan,
  profile: VideoProfile,
  outputPath: string,
  renderProfile: RenderProfile
) {
  const paths = pathsForProject(projectId);
  // Separate preview/final fragments physically
  const motionDir = path.join(paths.sceneFragmentsDir, renderProfile);
  await mkdir(motionDir, { recursive: true });

  const cleanFingerprint = await fingerprintFile(cleanVideoPath);
  const fragmentPaths: string[] = [];

  const fragmentCacheKeys: string[] = [];

  for (const [index, scene] of plan.scenes.entries()) {
    const fragmentName = `scene_${index}.mp4`;
    const fragmentPath = path.join(motionDir, fragmentName);
    const templateVersion = "v1";
    const cacheKey = [cleanFingerprint, hashJson(scene), templateVersion, SCENE_PLANNER_VERSION, hashJson(profile), renderProfile].join(":");

    await ensureArtifact(
      projectId,
      `scene_${index}_${renderProfile}`,
      cacheKey,
      fragmentPath,
      async (signal) => {
        const tempDir = path.join(motionDir, `temp_${index}`);
        await mkdir(tempDir, { recursive: true });
        await writeFile(path.join(tempDir, "index.html"), aisTechSceneFragmentTemplate(scene, profile), "utf8");
        await renderHyperframesVideo(tempDir, fragmentPath, { signal, normalize: false });
      },
      { timeoutMs: 2 * 60_000 }
    );
    fragmentCacheKeys.push(cacheKey);
    fragmentPaths.push(fragmentPath);
  }

  // Cache cinematic_compose via ensureArtifact
  const composeCacheKey = [
    cleanFingerprint,
    ...fragmentCacheKeys,
    hashJson(plan.scenes.map(s => ({ id: s.id, start: s.start, duration: s.duration, layoutMode: s.layoutMode }))),
    "compose_v1",
    renderProfile
  ].join(":");
  await ensureArtifact(
    projectId,
    `cinematic_compose_${renderProfile}`,
    composeCacheKey,
    outputPath,
    async (signal) => {
      await composeFragmentsOntoClean(cleanVideoPath, fragmentPaths, plan, profile, outputPath, renderProfile, signal);
    },
    { timeoutMs: 5 * 60_000 }
  );
}

async function composeFragmentsOntoClean(
  cleanVideoPath: string,
  fragmentPaths: string[],
  plan: VisualScenePlan,
  profile: VideoProfile,
  outputPath: string,
  renderProfile: RenderProfile,
  signal?: AbortSignal
) {
  if (fragmentPaths.length === 0) {
    // If no scenes, just copy the clean video over
    await runCommand(ffmpegPath(), [
      "-y",
      "-i", cleanVideoPath,
      "-c:v", "copy",
      "-c:a", "copy",
      outputPath
    ], { signal });
    return;
  }

  const pipScenes = plan.scenes.map((scene, index) => ({
    scene,
    index,
    isPip: scene.speakerMode === "pip" || scene.speakerMode === "reframed"
  })).filter(x => x.isPip);

  const filter = buildFragmentsComposeFilter(plan.scenes, pipScenes, profile, renderProfile);

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
  scenes: VisualScenePlan["scenes"],
  pipScenes: { scene: VisualScenePlan["scenes"][number]; index: number }[],
  profile: VideoProfile,
  renderProfile: RenderProfile
) {
  const chains: string[] = [];
  const splitLabels = ["basein", ...pipScenes.map((p) => `pipin${p.index}`)];
  
  if (splitLabels.length > 1) {
    chains.push(`[0:v]split=${splitLabels.length}${splitLabels.map((label) => `[${label}]`).join("")}`);
  } else {
    chains.push(`[0:v]copy[basein]`);
  }
  
  chains.push(`[basein]setpts=PTS-STARTPTS[v0]`);

  scenes.forEach((scene, index) => {
    const inputIdx = index + 1;
    const start = round(scene.start);
    const end = round(scene.start + scene.duration);
    
    chains.push(`[${inputIdx}:v]setpts=PTS-STARTPTS,tpad=start_duration=${start}:color=0x00ff00,colorkey=0x00ff00:0.22:0.04[scene${index}]`);
    chains.push(`[v${index}][scene${index}]overlay=x=0:y=0:enable='between(t,${start},${end})':eof_action=pass[v${index + 1}]`);
  });

  const lastOverlayLayer = `v${scenes.length}`;

  if (pipScenes.length === 0) {
    chains.push(`[${lastOverlayLayer}]copy[v_pre_scale]`);
  } else {
    pipScenes.forEach((p, i) => {
      const pip = speakerBox(profile, p.scene.layoutMode, p.scene.speakerMode);
      const input = `pipin${p.index}`;
      const scaled = `pip${p.index}`;
      const previous = i === 0 ? lastOverlayLayer : `pipout${i - 1}`;
      const next = i === pipScenes.length - 1 ? `v_pre_scale` : `pipout${i}`;
      const start = round(p.scene.start);
      const end = round(p.scene.start + p.scene.duration);
      
      chains.push(
        `[${input}]setpts=PTS-STARTPTS,scale=${pip.width}:${pip.height}:force_original_aspect_ratio=increase,crop=${pip.width}:${pip.height},setsar=1[${scaled}]`,
        `[${previous}][${scaled}]overlay=x=${pip.x}:y=${pip.y}:enable='between(t,${start},${end})':eof_action=pass[${next}]`
      );
    });
  }

  chains.push(`[v_pre_scale]${previewScaleFilter(profile, renderProfile)}[v_out]`);

  return chains.join(";");
}

function speakerBox(
  profile: VideoProfile,
  layoutMode: VisualScenePlan["scenes"][number]["layoutMode"],
  speakerMode: VisualScenePlan["scenes"][number]["speakerMode"]
) {
  if (layoutMode === "split") return splitSpeakerBox(profile);
  if (layoutMode === "full_frame" && speakerMode === "reframed") return lowerHalfSpeakerBox(profile);
  return pipBox(profile);
}

function splitSpeakerBox(profile: VideoProfile) {
  if (profile.orientation === "portrait") {
    return {
      width: profile.width,
      height: Math.round(profile.height * 0.42),
      x: 0,
      y: Math.round(profile.height * 0.58)
    };
  }
  return {
    width: Math.round(profile.width * 0.34),
    height: profile.height,
    x: Math.round(profile.width * 0.66),
    y: 0
  };
}

function pipBox(profile: VideoProfile) {
  if (profile.orientation === "portrait") {
    const width = 360;
    const height = 560;
    return {
      width,
      height,
      x: profile.width - width - 54,
      y: profile.height - height - 96
    };
  }

  const width = 360;
  const height = 520;
  return {
    width,
    height,
    x: profile.width - width - 82,
    y: profile.height - height - 70
  };
}

function lowerHalfSpeakerBox(profile: VideoProfile) {
  if (profile.orientation === "portrait") {
    return {
      width: profile.width,
      height: Math.round(profile.height * 0.4),
      x: 0,
      y: Math.round(profile.height * 0.6)
    };
  }

  return {
    width: Math.round(profile.width * 0.38),
    height: profile.height,
    x: Math.round(profile.width * 0.62),
    y: 0
  };
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
