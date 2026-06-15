import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { VisualOverlayPlan, VisualPlanOptions, VisualStyleProfile } from "@/lib/types";
import { renderOverlayFragments } from "@/server/hyperframes/overlayFragments";
import { resolveVisualStyleProfile } from "@/server/hyperframes/visualRegistry";
import { standardMp4OutputArgs } from "@/server/video/encoding";
import { ffmpegPath, ffprobePath, runCommand } from "@/server/video/ffmpeg";
import type { VideoProfile } from "@/server/video/profile";
import type { VisualTemplateData } from "@/lib/templateBuilder";

export async function renderSemanticOverlay(
  projectDir: string,
  cleanVideoPath: string,
  plan: VisualOverlayPlan,
  profile: VideoProfile,
  duration: number,
  outputMp4Path: string,
  styleOptions?: VisualPlanOptions
) {
  const dir = path.join(projectDir, "motion", "semantic-overlay");
  let style = resolveVisualStyleProfile(plan.styleProfileId);
  if (styleOptions?.visualTemplate) {
    style = mergeTemplateThemeIntoStyle(style, styleOptions.visualTemplate);
  }
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

function fontIdToFontFamily(fontId: string): string {
  if (fontId === "grotesk" || fontId === "Montserrat") return '"HF Montserrat", Arial, sans-serif';
  if (fontId === "Onest") return '"HF Onest", Arial, sans-serif';
  if (fontId === "editorial" || fontId === "Unbounded") return '"HF Unbounded", Arial, sans-serif';
  if (fontId === "Manrope") return '"HF Manrope", Arial, sans-serif';
  if (fontId === "mono" || fontId === "Golos") return '"HF Golos Text", Arial, sans-serif';
  return '"HF Montserrat", Arial, sans-serif';
}

function mergeTemplateThemeIntoStyle(style: VisualStyleProfile, visualTemplate: unknown): VisualStyleProfile {
  if (!visualTemplate || typeof visualTemplate !== "object") return style;
  const theme = (visualTemplate as Partial<VisualTemplateData>).theme;
  if (!theme || typeof theme !== "object") return style;

  const typography = { ...style.typography };
  if (theme.font) {
    const fontFamily = fontIdToFontFamily(theme.font);
    typography.heading = fontFamily;
    typography.body = fontFamily;
    typography.number = fontFamily;
  }

  const colors = { ...style.colors };
  if (theme.colorText) {
    colors.text = theme.colorText;
  }
  if (theme.colorPrimary) {
    colors.accent = theme.colorPrimary;
    colors.border = theme.colorPrimary + "33"; // transparent accent border
  }
  if (theme.colorBackground) {
    colors.background = theme.colorBackground;
    colors.surface = theme.colorBackground + "c6"; // add some alpha for glassmorphism
    colors.surfaceStrong = theme.colorBackground + "e6";
  }

  return {
    ...style,
    typography,
    colors
  };
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
  await overlaySemanticFragmentsInBatches(cleanVideoPath, fragments, outputPath, "alpha");
}

async function overlayChromaSemanticFragments(
  cleanVideoPath: string,
  fragments: Array<{ path: string; start: number }>,
  outputPath: string
) {
  await overlaySemanticFragmentsInBatches(cleanVideoPath, fragments, outputPath, "chroma");
}

async function overlaySemanticFragmentsInBatches(
  cleanVideoPath: string,
  fragments: Array<{ path: string; start: number }>,
  outputPath: string,
  mode: "alpha" | "chroma"
) {
  const batchSize = overlayComposeBatchSize();
  const workDir = path.join(path.dirname(outputPath), ".overlay-compose");
  await mkdir(workDir, { recursive: true });

  let currentInput = cleanVideoPath;

  for (let offset = 0; offset < fragments.length; offset += batchSize) {
    const batch = fragments.slice(offset, offset + batchSize);
    const isLastBatch = offset + batchSize >= fragments.length;
    const passOutput = isLastBatch
      ? outputPath
      : path.join(workDir, `pass-${String(offset / batchSize).padStart(3, "0")}.mp4`);
    const encodeArgs = isLastBatch
      ? standardMp4OutputArgs()
      : intermediateOverlayPassArgs();

    await runCommand(ffmpegPath(), [
      "-y",
      "-i",
      currentInput,
      ...batch.flatMap((fragment) => ["-i", fragment.path]),
      "-filter_complex",
      buildOverlayFilter(batch, mode),
      "-map",
      `[v${batch.length}]`,
      "-map",
      "0:a:0",
      ...encodeArgs,
      passOutput
    ]);

    currentInput = passOutput;
  }
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

function overlayComposeBatchSize() {
  const raw = Number(process.env.HYPERFRAMES_OVERLAY_COMPOSE_BATCH_SIZE ?? "6");
  if (!Number.isFinite(raw)) return 6;
  return Math.max(1, Math.min(12, Math.trunc(raw)));
}

function intermediateOverlayPassArgs() {
  return [
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-profile:v", "high",
    "-level:v", "4.1",
    "-pix_fmt", "yuv420p",
    "-r", "30",
    "-g", "60",
    "-keyint_min", "60",
    "-sc_threshold", "0",
    "-movflags", "+faststart",
    "-c:a", "copy"
  ];
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
