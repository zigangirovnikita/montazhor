import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { VisualOverlayPlan } from "@/lib/types";
import { renderOverlayFragments } from "@/server/hyperframes/overlayFragments";
import { resolveVisualStyleProfile } from "@/server/hyperframes/visualRegistry";
import { standardMp4OutputArgs } from "@/server/video/encoding";
import { ffmpegPath, ffprobePath, runCommand } from "@/server/video/ffmpeg";
import type { VideoProfile } from "@/server/video/profile";

export async function renderSemanticOverlay(
  projectDir: string,
  cleanVideoPath: string,
  plan: VisualOverlayPlan,
  profile: VideoProfile,
  duration: number,
  outputMp4Path: string
) {
  const dir = path.join(projectDir, "motion", "semantic-overlay");
  const style = resolveVisualStyleProfile(plan.styleProfileId);
  await mkdir(dir, { recursive: true });
  try {
    const fragments = await renderOverlayFragments(dir, plan, style, profile, "alpha");
    await Promise.all(fragments.map((fragment) => assertAlphaVideo(fragment.path)));
    await overlayAlphaSemanticFragments(cleanVideoPath, fragments, outputMp4Path);
  } catch {
    const fragments = await renderOverlayFragments(dir, plan, style, profile, "chroma");
    await overlayChromaSemanticFragments(cleanVideoPath, fragments, outputMp4Path);
  }
}

async function assertAlphaVideo(videoPath: string) {
  const { stdout } = await runCommand(ffprobePath(), [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=pix_fmt",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    videoPath
  ]);
  const pixFmt = stdout.trim();
  if (!pixFmt.includes("a")) {
    throw new Error(`HyperFrames alpha overlay did not contain alpha channel. pix_fmt=${pixFmt || "unknown"}`);
  }
}

async function overlayAlphaSemanticFragments(
  cleanVideoPath: string,
  fragments: Array<{ path: string; start: number }>,
  outputPath: string
) {
  await runCommand(ffmpegPath(), [
    "-y",
    "-i",
    cleanVideoPath,
    ...fragments.flatMap((fragment) => ["-i", fragment.path]),
    "-filter_complex",
    buildOverlayFilter(fragments, "alpha"),
    "-map",
    `[v${fragments.length}]`,
    "-map",
    "0:a:0",
    ...standardMp4OutputArgs(),
    outputPath
  ]);
}

async function overlayChromaSemanticFragments(
  cleanVideoPath: string,
  fragments: Array<{ path: string; start: number }>,
  outputPath: string
) {
  await runCommand(ffmpegPath(), [
    "-y",
    "-i",
    cleanVideoPath,
    ...fragments.flatMap((fragment) => ["-i", fragment.path]),
    "-filter_complex",
    buildOverlayFilter(fragments, "chroma"),
    "-map",
    `[v${fragments.length}]`,
    "-map",
    "0:a:0",
    ...standardMp4OutputArgs(),
    outputPath
  ]);
}

function buildOverlayFilter(fragments: Array<{ path: string; start: number }>, mode: "alpha" | "chroma") {
  const chains: string[] = ["[0:v]setpts=PTS-STARTPTS[v0]"];
  fragments.forEach((fragment, index) => {
    const input = index + 1;
    const shiftedLabel = `s${input}`;
    const overlayLabel = `ov${input}`;
    const output = `v${input}`;
    chains.push(`[${input}:v]setpts=PTS-STARTPTS+${round(fragment.start)}/TB[${shiftedLabel}]`);
    if (mode === "chroma") {
      chains.push(`[${shiftedLabel}]colorkey=0x00ff00:0.28:0[${overlayLabel}]`);
      chains.push(`[v${index}][${overlayLabel}]overlay=x=0:y=0:eof_action=pass[${output}]`);
    } else {
      chains.push(`[v${index}][${shiftedLabel}]overlay=x=0:y=0:format=auto:eof_action=pass[${output}]`);
    }
  });
  return chains.join(";");
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
