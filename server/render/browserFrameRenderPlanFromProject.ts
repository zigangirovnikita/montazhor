import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StyleDraftOptions } from "@/app/components/PresentationConfigurator";
import { buildCaptionDesign } from "../../lib/captionDesign";
import type { SemanticBlock, SubtitleDraft, TranscriptJson, TranscriptWord } from "@/lib/types";
import { probeVideo } from "../video/metadata";
import {
  buildCaptionsForBrowserPlan,
  buildSubtitleDraftLocal,
  buildSubtitlesForEdlLocal,
  chunkSubtitleWords,
  selectHighlightedWords,
  splitCaptionLines
} from "./browserFrameCaptionPlan";
import { buildVisualBeatsForBrowserPlan } from "./browserFrameVisualPlanner";
import type {
  BrowserFrameCaptionStyle,
  BrowserFrameRenderPlan
} from "./browserFrameRendererPlan";
import { detectActiveVideoBox } from "./browserFrameActiveBox";
import { buildCameraMoves } from "./browserFrameCameraPlanner";
import {
  DEFAULT_BROWSER_FRAME_STYLE,
  DEFAULT_BROWSER_POC_FPS,
  parseBrowserFrameRenderPlan
} from "./browserFrameRendererPlan";

interface EditDecisionListLike {
  keptRanges: Array<{ sourceStart: number; sourceEnd: number; reason: string }>;
  removedRanges: Array<{ sourceStart: number; sourceEnd: number; reason: string }>;
}

export interface BrowserFrameProjectArtifacts {
  projectDir: string;
  cleanVideoPath: string;
  subtitlesDraftPath?: string;
  transcriptPath?: string;
  remappedTranscriptPath?: string;
  edlPath?: string;
  contentPlanPath?: string;
  semanticBlocksPath?: string;
}

export interface BrowserFramePlanFromProjectOptions {
  projectDir: string;
  fps?: number;
  captionStyle?: BrowserFrameCaptionStyle;
  presentationMode?: string | null;
  stylePreset?: string | null;
  styleOptions?: StyleDraftOptions;
  maxDurationSeconds?: number;
  enableCameraMoves?: boolean;
  debugActiveBox?: boolean;
  log?: (message: string) => void;
  writePlanToProject?: boolean;
  projectPlanOutputPath?: string;
}

export { buildCaptionsForBrowserPlan, buildCameraMoves, chunkSubtitleWords, selectHighlightedWords, splitCaptionLines };

export async function buildBrowserFrameRenderPlanFromProject(
  input: BrowserFramePlanFromProjectOptions
): Promise<{ artifacts: BrowserFrameProjectArtifacts; plan: BrowserFrameRenderPlan; planPath?: string }> {
  const artifacts = await resolveProjectArtifacts(input.projectDir);
  const metadata = await probeVideo(artifacts.cleanVideoPath);
  const subtitleLoad = await loadProjectSubtitles(artifacts);
  const maxDurationSeconds = input.maxDurationSeconds ?? metadata.duration;
  const duration = roundTime(Math.min(metadata.duration, maxDurationSeconds));
  const width = metadata.width ?? 1080;
  const height = metadata.height ?? 1920;
  const fps = Math.min(input.fps ?? DEFAULT_BROWSER_POC_FPS, DEFAULT_BROWSER_POC_FPS);
  const activeBox = await detectActiveVideoBox({
    videoPath: artifacts.cleanVideoPath,
    width,
    height,
    duration,
    log: input.debugActiveBox ? input.log : undefined
  });
  const captionsBuild = buildCaptionsForBrowserPlan(subtitleLoad.subtitles, duration, {
    captionSource: subtitleLoad.captionSource,
    edlApplied: subtitleLoad.edlApplied,
    subtitlesDraftUsed: subtitleLoad.subtitlesDraftUsed,
    warnings: subtitleLoad.warnings
  });
  const contentPlan = artifacts.contentPlanPath
    ? JSON.parse(await readFile(artifacts.contentPlanPath, "utf8"))
    : null;
  const semanticBlocks = artifacts.semanticBlocksPath
    ? JSON.parse(await readFile(artifacts.semanticBlocksPath, "utf8")) as SemanticBlock[]
    : null;
  const visualBeats = buildVisualBeatsForBrowserPlan({
    subtitles: subtitleLoad.subtitles,
    semanticBlocks,
    duration,
    contentPlan,
    styleOptions: input.styleOptions,
    presentationMode: input.presentationMode === "subtitles_only" ? "subtitles_only" : null
  });
  const cameraMovesEnabled = input.enableCameraMoves ?? false;
  const plan = parseBrowserFrameRenderPlan({
    fps,
    width,
    height,
    duration,
    captionStyle: input.captionStyle ?? DEFAULT_BROWSER_FRAME_STYLE,
    captionDesign: buildCaptionDesign(input.stylePreset, input.styleOptions),
    captions: captionsBuild.captions,
    visualBeats,
    cameraMoves: cameraMovesEnabled
      ? buildCameraMoves({ duration, captions: captionsBuild.captions, visualBeats, semanticBlocks })
      : [],
    diagnostics: {
      sourceVideo: {
        width,
        height,
        duration
      },
      output: {
        width,
        height,
        fps
      },
      captionSource: captionsBuild.captionSource,
      edlApplied: captionsBuild.edlApplied,
      subtitlesDraftUsed: captionsBuild.subtitlesDraftUsed,
      cameraMovesEnabled,
      warnings: captionsBuild.warnings,
      activeVideoBox: activeBox.activeVideoBox,
      captionSafeArea: activeBox.captionSafeArea
    }
  });

  let planPath: string | undefined;
  if (input.writePlanToProject !== false) {
    planPath = input.projectPlanOutputPath ?? path.join(input.projectDir, "browser-render-plan.json");
    await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  }

  return { artifacts, plan, planPath };
}

export async function resolveProjectArtifacts(projectDir: string): Promise<BrowserFrameProjectArtifacts> {
  const cleanVideoPath = path.join(projectDir, "clean.mp4");
  await ensurePathExists(cleanVideoPath, "clean.mp4 was not found in project artifacts.");

  return {
    projectDir,
    cleanVideoPath,
    subtitlesDraftPath: await pickExistingPath(path.join(projectDir, "subtitles-draft.json")),
    transcriptPath: await pickExistingPath(path.join(projectDir, "transcript.json")),
    remappedTranscriptPath: await pickExistingPath(path.join(projectDir, "remapped-transcript.json")),
    edlPath: await pickExistingPath(path.join(projectDir, "edl.json")),
    contentPlanPath: await pickExistingPath(path.join(projectDir, "content-plan.json")),
    semanticBlocksPath: await pickExistingPath(path.join(projectDir, "semantic-blocks.json"))
  };
}

async function loadProjectSubtitles(artifacts: BrowserFrameProjectArtifacts) {
  if (artifacts.transcriptPath && artifacts.edlPath) {
    const transcript = JSON.parse(await readFile(artifacts.transcriptPath, "utf8")) as TranscriptJson;
    const edl = JSON.parse(await readFile(artifacts.edlPath, "utf8")) as EditDecisionListLike;
    return {
      subtitles: buildSubtitlesForEdlLocal(transcript, edl),
      captionSource: "transcript_edl_clean_time" as const,
      edlApplied: true,
      subtitlesDraftUsed: false,
      warnings: []
    };
  }

  if (artifacts.subtitlesDraftPath) {
    const subtitles = JSON.parse(await readFile(artifacts.subtitlesDraftPath, "utf8")) as SubtitleDraft[];
    if (subtitles.length) {
      return {
        subtitles,
        captionSource: "subtitles_draft_fallback" as const,
        edlApplied: false,
        subtitlesDraftUsed: true,
        warnings: ["subtitles_draft_fallback_used"]
      };
    }
  }

  if (artifacts.remappedTranscriptPath) {
    const transcript = JSON.parse(await readFile(artifacts.remappedTranscriptPath, "utf8")) as TranscriptJson;
    return {
      subtitles: buildSubtitleDraftLocal(transcript),
      captionSource: "subtitles_draft_fallback" as const,
      edlApplied: false,
      subtitlesDraftUsed: false,
      warnings: ["transcript_without_edl_fallback_used"]
    };
  }

  if (artifacts.transcriptPath) {
    const transcript = JSON.parse(await readFile(artifacts.transcriptPath, "utf8")) as TranscriptJson;
    return {
      subtitles: buildSubtitleDraftLocal(transcript),
      captionSource: "subtitles_draft_fallback" as const,
      edlApplied: false,
      subtitlesDraftUsed: false,
      warnings: ["transcript_without_edl_fallback_used"]
    };
  }

  throw new Error("Project does not contain transcript.json + edl.json and does not provide subtitles-draft.json fallback.");
}

async function ensurePathExists(filePath: string, errorMessage: string) {
  try {
    await access(filePath);
  } catch {
    throw new Error(errorMessage);
  }
}

async function pickExistingPath(filePath: string) {
  try {
    await access(filePath);
    return filePath;
  } catch {
    return undefined;
  }
}

function roundTime(value: number) {
  return Math.round(value * 1000) / 1000;
}
