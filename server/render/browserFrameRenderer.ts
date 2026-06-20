import { access, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer";
import type { Browser } from "puppeteer";
import { resolveAppDir } from "@/lib/runtimePaths";
import { probeVideo } from "@/server/video/metadata";
import { ffmpegPath, runCommand } from "@/server/video/ffmpeg";
import {
  buildDemoBrowserFrameRenderPlan,
  DEFAULT_BROWSER_POC_DURATION_SECONDS,
  DEFAULT_BROWSER_POC_FPS,
  type BrowserFrameRenderPlan,
  readBrowserFrameRenderPlan
} from "@/server/render/browserFrameRendererPlan";
import {
  buildFrameTimeline,
  resolveCameraStateAtTime,
  resolveCaptionAtTime,
  secondsToFrameCount
} from "@/server/render/browserFrameRendererTiming";
import { buildBrowserFrameRendererHtml } from "@/server/render/browserFrameRendererTemplate";
import {
  buildBrowserFrameRenderPlanFromProject
} from "@/server/render/browserFrameRenderPlanFromProject";
import type { BrowserFrameCaptionStyle } from "@/server/render/browserFrameRendererPlan";

export interface BrowserFrameRendererOptions {
  cleanVideoPath?: string;
  projectDir?: string;
  outputPath: string;
  renderPlanPath?: string;
  captionStyle?: BrowserFrameCaptionStyle;
  enableCameraMoves?: boolean;
  maxDurationSeconds?: number;
  writePlanToProject?: boolean;
  debugActiveBox?: boolean;
  debug?: boolean;
  log?: (message: string) => void;
}

export interface BrowserFrameRendererResult {
  outputPath: string;
  renderPlanPath: string;
  tempDir?: string;
  totalFrames: number;
  duration: number;
  fps: number;
  width: number;
  height: number;
  elapsedMs: number;
  extractMs: number;
  screenshotMs: number;
  composeMs: number;
  peakRssMb: number;
}

export async function renderBrowserFrames(input: BrowserFrameRendererOptions): Promise<BrowserFrameRendererResult> {
  const startedAt = Date.now();
  const log = input.log ?? (() => undefined);
  const resolvedInput = await resolveRendererInput(input);
  const metadata = await probeVideo(resolvedInput.cleanVideoPath);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "montazhor-browser-render-"));
  const backgroundDir = path.join(tempDir, "background");
  const renderedDir = path.join(tempDir, "rendered");
  const htmlPath = path.join(tempDir, "renderer.html");
  const planSnapshotPath = path.join(tempDir, "render-plan.snapshot.json");
  let browser: Browser | null = null;
  let peakRssMb = currentRssMb();
  let extractMs = 0;
  let screenshotMs = 0;
  let composeMs = 0;

  try {
    await mkdir(backgroundDir, { recursive: true });
    await mkdir(renderedDir, { recursive: true });

    const { plan, planPath } = await resolveRenderPlan({
      renderPlanPath: resolvedInput.renderPlanPath,
      sourceWidth: metadata.width,
      sourceHeight: metadata.height,
      sourceDuration: metadata.duration,
      projectDir: resolvedInput.projectDir,
      captionStyle: input.captionStyle,
      enableCameraMoves: input.enableCameraMoves,
      maxDurationSeconds: input.maxDurationSeconds,
      writePlanToProject: input.writePlanToProject,
      debugActiveBox: input.debugActiveBox,
      log
    });
    const timeline = buildFrameTimeline(plan);
    const totalFrames = secondsToFrameCount(plan.duration, plan.fps);
    const fontPath = await resolveFontPath();
    await writeFile(planSnapshotPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
    await writeFile(
      htmlPath,
      buildBrowserFrameRendererHtml({
        width: plan.width,
        height: plan.height,
        fontPath,
        captionSafeArea: plan.diagnostics.captionSafeArea
      }),
      "utf8"
    );

    log(`Browser POC: ${plan.width}x${plan.height}, ${plan.fps} fps, ${plan.duration.toFixed(2)}s, ${totalFrames} frames.`);

    const extractStartedAt = Date.now();
    await extractBackgroundFrames({
      inputPath: resolvedInput.cleanVideoPath,
      outputDir: backgroundDir,
      sourceWidth: metadata.width,
      sourceHeight: metadata.height,
      width: plan.width,
      height: plan.height,
      fps: plan.fps,
      frameCount: totalFrames
    });
    extractMs = Date.now() - extractStartedAt;

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();
    await page.setViewport({ width: plan.width, height: plan.height, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(htmlPath).toString(), { waitUntil: "load" });
    await page.waitForFunction("window.browserFrameRendererReady === true", { timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    const frameRoot = await page.$("#frame-root");
    if (!frameRoot) throw new Error("Browser frame renderer root element was not found.");

    const screenshotStartedAt = Date.now();
    for (const frame of timeline) {
      const backgroundPath = path.join(backgroundDir, `bg_${String(frame.index + 1).padStart(5, "0")}.jpg`);
      const outputFramePath = path.join(renderedDir, `frame_${String(frame.index + 1).padStart(5, "0")}.png`);
      const caption = resolveCaptionAtTime(plan.captions, frame.time);
      const camera = resolveCameraStateAtTime(plan.cameraMoves, frame.time);

      await page.evaluate(
        async (frameData: {
          time: number;
          backgroundUrl: string;
          caption: BrowserFrameRenderPlan["captions"][number] | null;
          camera: { id: string; scale: number; x: number; y: number } | null;
          captionStyle: BrowserFrameCaptionStyle;
        }) => {
          const renderWindow = window as Window & typeof globalThis & {
            renderFrame: (time: number, frameData: {
              backgroundUrl: string;
              caption: BrowserFrameRenderPlan["captions"][number] | null;
              camera: { id: string; scale: number; x: number; y: number } | null;
              captionStyle: BrowserFrameCaptionStyle;
            }) => Promise<void>;
          };
          await renderWindow.renderFrame(frameData.time, {
            backgroundUrl: frameData.backgroundUrl,
            caption: frameData.caption,
            camera: frameData.camera,
            captionStyle: frameData.captionStyle
          });
        },
        {
          time: frame.time,
          backgroundUrl: pathToFileURL(backgroundPath).toString(),
          caption,
          camera,
          captionStyle: plan.captionStyle
        }
      );
      await frameRoot.screenshot({ path: outputFramePath, type: "png" });
      peakRssMb = Math.max(peakRssMb, currentRssMb());

      if ((frame.index + 1) % 25 === 0 || frame.index + 1 === timeline.length) {
        log(`Browser POC progress: ${frame.index + 1}/${timeline.length} frames.`);
      }
    }
    screenshotMs = Date.now() - screenshotStartedAt;

    const composeStartedAt = Date.now();
    await composeBrowserRenderedVideo({
      framesDir: renderedDir,
      fps: plan.fps,
      audioSourcePath: resolvedInput.cleanVideoPath,
      outputPath: input.outputPath
    });
    composeMs = Date.now() - composeStartedAt;

    return {
      outputPath: input.outputPath,
      renderPlanPath: resolvedInput.renderPlanPath ?? planPath ?? planSnapshotPath,
      tempDir: input.debug ? tempDir : undefined,
      totalFrames,
      duration: plan.duration,
      fps: plan.fps,
      width: plan.width,
      height: plan.height,
      elapsedMs: Date.now() - startedAt,
      extractMs,
      screenshotMs,
      composeMs,
      peakRssMb
    };
  } finally {
    await browser?.close().catch(() => undefined);
    if (!input.debug) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

async function resolveRenderPlan(
  input: {
    renderPlanPath?: string;
    sourceWidth: number | undefined;
    sourceHeight: number | undefined;
    sourceDuration: number;
    projectDir?: string;
    captionStyle?: BrowserFrameCaptionStyle;
    enableCameraMoves?: boolean;
    maxDurationSeconds?: number;
    writePlanToProject?: boolean;
    debugActiveBox?: boolean;
    log?: (message: string) => void;
  }
) {
  const width = input.sourceWidth ?? 1080;
  const height = input.sourceHeight ?? 1920;
  const durationLimit = input.maxDurationSeconds ?? (input.projectDir ? input.sourceDuration : DEFAULT_BROWSER_POC_DURATION_SECONDS);
  const cappedDuration = Math.min(input.sourceDuration, durationLimit);

  if (input.renderPlanPath) {
    const plan = await readBrowserFrameRenderPlan(input.renderPlanPath);
    return {
      plan: {
        ...plan,
        duration: Math.min(plan.duration, cappedDuration),
        captionStyle: input.captionStyle ?? plan.captionStyle
      } satisfies BrowserFrameRenderPlan,
      planPath: input.renderPlanPath
    };
  }

  if (input.projectDir) {
    const { plan, planPath } = await buildBrowserFrameRenderPlanFromProject({
      projectDir: input.projectDir,
      fps: DEFAULT_BROWSER_POC_FPS,
      captionStyle: input.captionStyle,
      enableCameraMoves: input.enableCameraMoves,
      debugActiveBox: input.debugActiveBox,
      log: input.log,
      maxDurationSeconds: cappedDuration,
      writePlanToProject: input.writePlanToProject
    });
    return { plan, planPath };
  }

  return {
    plan: buildDemoBrowserFrameRenderPlan({
      width,
      height,
      duration: cappedDuration,
      fps: DEFAULT_BROWSER_POC_FPS,
      captionStyle: input.captionStyle
    })
  };
}

async function resolveRendererInput(input: BrowserFrameRendererOptions) {
  if (input.projectDir) {
    const cleanVideoPath = path.join(input.projectDir, "clean.mp4");
    return {
      cleanVideoPath,
      renderPlanPath: input.renderPlanPath,
      projectDir: input.projectDir
    };
  }

  if (!input.cleanVideoPath) {
    throw new Error("Browser renderer requires either projectDir or cleanVideoPath.");
  }

  return {
    cleanVideoPath: input.cleanVideoPath,
    renderPlanPath: input.renderPlanPath,
    projectDir: undefined
  };
}

async function extractBackgroundFrames(input: {
  inputPath: string;
  outputDir: string;
  sourceWidth: number | undefined;
  sourceHeight: number | undefined;
  width: number;
  height: number;
  fps: number;
  frameCount: number;
}) {
  const needsScale = input.sourceWidth !== input.width || input.sourceHeight !== input.height;
  const videoFilter = needsScale
    ? `fps=${input.fps},scale=${input.width}:${input.height}:force_original_aspect_ratio=decrease,pad=${input.width}:${input.height}:(ow-iw)/2:(oh-ih)/2:black`
    : `fps=${input.fps}`;

  await runCommand(ffmpegPath(), [
    "-y",
    "-i",
    input.inputPath,
    "-frames:v",
    String(input.frameCount),
    "-vf",
    videoFilter,
    "-q:v",
    "2",
    path.join(input.outputDir, "bg_%05d.jpg")
  ]);
}

async function composeBrowserRenderedVideo(input: {
  framesDir: string;
  fps: number;
  audioSourcePath: string;
  outputPath: string;
}) {
  await runCommand(ffmpegPath(), [
    "-y",
    "-framerate",
    String(input.fps),
    "-i",
    path.join(input.framesDir, "frame_%05d.png"),
    "-i",
    input.audioSourcePath,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0?",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(input.fps),
    "-c:a",
    "aac",
    "-b:v",
    "4000k",
    "-movflags",
    "+faststart",
    "-shortest",
    input.outputPath
  ]);
}

async function resolveFontPath() {
  const appDir = resolveAppDir();
  const fontCandidates = [
    path.join(appDir, "public", "fonts", "onest-700.ttf"),
    path.join(appDir, "assets", "fonts", "onest-700.ttf")
  ];

  for (const candidate of fontCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return undefined;
}

function currentRssMb() {
  return Math.round((process.memoryUsage().rss / 1024 / 1024) * 10) / 10;
}
