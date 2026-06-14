import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { VisualScenePlan } from "@/lib/types";
import { renderHyperframesVideo } from "@/server/hyperframes/render";
import { aisTechSceneTemplate } from "@/server/hyperframes/templates/AisTechScene";
import { standardMp4OutputArgs } from "@/server/video/encoding";
import { ffmpegPath, runCommand } from "@/server/video/ffmpeg";
import type { VideoProfile } from "@/server/video/profile";

export async function renderCinematicSceneTimeline(
  projectDir: string,
  cleanVideoPath: string,
  plan: VisualScenePlan,
  profile: VideoProfile,
  duration: number,
  sceneLayerPath: string,
  outputPath: string
) {
  const dir = path.join(projectDir, "motion", "cinematic-scenes");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), aisTechSceneTemplate(plan, profile, duration), "utf8");
  await renderHyperframesVideo(dir, sceneLayerPath);
  await composeCinematicScenes(cleanVideoPath, sceneLayerPath, plan, profile, outputPath);
}

async function composeCinematicScenes(
  cleanVideoPath: string,
  sceneLayerPath: string,
  plan: VisualScenePlan,
  profile: VideoProfile,
  outputPath: string
) {
  const pipScenes = plan.scenes.filter((scene) => scene.layoutMode === "pip" || scene.layoutMode === "full_frame" || scene.layoutMode === "split");
  const filter = buildComposeFilter(pipScenes, profile);

  await runCommand(ffmpegPath(), [
    "-y",
    "-i",
    cleanVideoPath,
    "-i",
    sceneLayerPath,
    "-filter_complex",
    filter,
    "-map",
    `[v${pipScenes.length}]`,
    "-map",
    "0:a:0",
    ...standardMp4OutputArgs(),
    outputPath
  ]);
}

function buildComposeFilter(pipScenes: VisualScenePlan["scenes"], profile: VideoProfile) {
  const splitLabels = ["basein", ...pipScenes.map((_, index) => `pipin${index}`)];
  const chains: string[] = [
    `[0:v]split=${splitLabels.length}${splitLabels.map((label) => `[${label}]`).join("")}`,
    "[basein]setpts=PTS-STARTPTS[base]",
    "[1:v]setpts=PTS-STARTPTS,colorkey=0x00ff00:0.22:0.04[scene]",
    "[base][scene]overlay=x=0:y=0:eof_action=pass[v0]"
  ];

  pipScenes.forEach((scene, index) => {
    const pip = speakerBox(profile, scene.layoutMode);
    const input = `pipin${index}`;
    const scaled = `pip${index}`;
    const previous = `v${index}`;
    const next = `v${index + 1}`;
    const start = round(scene.start);
    const end = round(scene.start + scene.duration);
    chains.push(
      `[${input}]setpts=PTS-STARTPTS,scale=${pip.width}:${pip.height}:force_original_aspect_ratio=increase,crop=${pip.width}:${pip.height},setsar=1[${scaled}]`,
      `[${previous}][${scaled}]overlay=x=${pip.x}:y=${pip.y}:enable='between(t,${start},${end})':eof_action=pass[${next}]`
    );
  });

  return chains.join(";");
}

function speakerBox(profile: VideoProfile, layoutMode: VisualScenePlan["scenes"][number]["layoutMode"]) {
  if (layoutMode === "split") return splitSpeakerBox(profile);
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

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
