import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DEFAULT_SAMPLE_FRACTIONS = [0.1, 0.3, 0.5, 0.7, 0.9];
const DEFAULT_BLACK_THRESHOLD = 24;
const DEFAULT_BLACK_RATIO = 0.985;
const DEFAULT_NEAR_FULL_FRAME_RATIO = 0.96;

export interface BrowserFrameActiveVideoBox {
  detected: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  source: "frame_black_bar_detection" | "full_frame_fallback";
}

export interface BrowserFrameCaptionSafeArea {
  x: number;
  y: number;
  width: number;
  height: number;
  marginX: number;
  marginBottom: number;
}

export interface BrowserFrameActiveBoxResult {
  activeVideoBox: BrowserFrameActiveVideoBox;
  captionSafeArea: BrowserFrameCaptionSafeArea;
}

export async function detectActiveVideoBox(input: {
  videoPath: string;
  width: number;
  height: number;
  duration: number;
  sampleFractions?: number[];
  log?: (message: string) => void;
}) {
  const sampleFractions = input.sampleFractions?.length ? input.sampleFractions : DEFAULT_SAMPLE_FRACTIONS;
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "montazhor-browser-active-box-"));
  const detections: BrowserFrameActiveVideoBox[] = [];

  try {
    for (const [index, fraction] of sampleFractions.entries()) {
      const time = roundTime(resolveSampleTime(input.duration, fraction));
      const framePath = path.join(tempDir, `sample-${index + 1}.ppm`);
      await extractFrameToPpm({ videoPath: input.videoPath, time, framePath });
      const frame = parsePpm(await readFile(framePath));
      detections.push(detectActiveBoxFromRgbFrame({
        width: frame.width,
        height: frame.height,
        data: frame.data
      }));
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }

  const activeVideoBox = mergeDetectedBoxes(
    detections.filter((box) => box.detected),
    input.width,
    input.height
  );
  const captionSafeArea = buildCaptionSafeArea(activeVideoBox);

  input.log?.(
    `Browser active box: ${activeVideoBox.detected ? "detected" : "fallback"} `
      + `${activeVideoBox.x},${activeVideoBox.y} ${activeVideoBox.width}x${activeVideoBox.height}.`
  );

  return { activeVideoBox, captionSafeArea };
}

export function detectActiveBoxFromRgbFrame(input: {
  width: number;
  height: number;
  data: Uint8Array;
  blackThreshold?: number;
  blackRatio?: number;
  nearFullFrameRatio?: number;
  sampleStride?: number;
}): BrowserFrameActiveVideoBox {
  const blackThreshold = input.blackThreshold ?? DEFAULT_BLACK_THRESHOLD;
  const blackRatio = input.blackRatio ?? DEFAULT_BLACK_RATIO;
  const nearFullFrameRatio = input.nearFullFrameRatio ?? DEFAULT_NEAR_FULL_FRAME_RATIO;
  const sampleStride = Math.max(1, input.sampleStride ?? Math.max(1, Math.floor(Math.min(input.width, input.height) / 360)));

  const isBlackish = (x: number, y: number) => {
    const offset = (y * input.width + x) * 3;
    return input.data[offset] <= blackThreshold
      && input.data[offset + 1] <= blackThreshold
      && input.data[offset + 2] <= blackThreshold;
  };

  const lineIsBlack = (axis: "row" | "column", position: number, start: number, end: number) => {
    let total = 0;
    let black = 0;

    for (let cursor = start; cursor <= end; cursor += sampleStride) {
      const x = axis === "row" ? cursor : position;
      const y = axis === "row" ? position : cursor;
      total += 1;
      if (isBlackish(x, y)) black += 1;
    }

    if ((end - start) % sampleStride !== 0) {
      const x = axis === "row" ? end : position;
      const y = axis === "row" ? position : end;
      total += 1;
      if (isBlackish(x, y)) black += 1;
    }

    return total > 0 && black / total >= blackRatio;
  };

  let top = 0;
  while (top < input.height - 1 && lineIsBlack("row", top, 0, input.width - 1)) top += 1;

  let bottom = input.height - 1;
  while (bottom > top && lineIsBlack("row", bottom, 0, input.width - 1)) bottom -= 1;

  let left = 0;
  while (left < input.width - 1 && lineIsBlack("column", left, top, bottom)) left += 1;

  let right = input.width - 1;
  while (right > left && lineIsBlack("column", right, top, bottom)) right -= 1;

  const boxWidth = right - left + 1;
  const boxHeight = bottom - top + 1;
  if (boxWidth <= 0 || boxHeight <= 0) {
    return buildFullFrameActiveBox(input.width, input.height);
  }

  if (boxWidth / input.width >= nearFullFrameRatio && boxHeight / input.height >= nearFullFrameRatio) {
    return buildFullFrameActiveBox(input.width, input.height);
  }

  return {
    detected: true,
    x: left,
    y: top,
    width: boxWidth,
    height: boxHeight,
    source: "frame_black_bar_detection"
  };
}

export function buildCaptionSafeArea(activeVideoBox: BrowserFrameActiveVideoBox): BrowserFrameCaptionSafeArea {
  const marginX = clampInt(Math.round(activeVideoBox.width * 0.045), 36, 72);
  const marginBottom = clampInt(Math.round(activeVideoBox.height * 0.11), 96, 140);
  const width = Math.max(1, activeVideoBox.width - marginX * 2);
  const height = Math.max(1, activeVideoBox.height - marginBottom);

  return {
    x: activeVideoBox.x + marginX,
    y: activeVideoBox.y,
    width,
    height,
    marginX,
    marginBottom
  };
}

function mergeDetectedBoxes(
  detections: BrowserFrameActiveVideoBox[],
  width: number,
  height: number
): BrowserFrameActiveVideoBox {
  if (!detections.length) return buildFullFrameActiveBox(width, height);

  const left = median(detections.map((box) => box.x));
  const top = median(detections.map((box) => box.y));
  const right = median(detections.map((box) => box.x + box.width));
  const bottom = median(detections.map((box) => box.y + box.height));

  const merged: BrowserFrameActiveVideoBox = {
    detected: true,
    x: clampInt(Math.round(left), 0, width - 1),
    y: clampInt(Math.round(top), 0, height - 1),
    width: clampInt(Math.round(right - left), 1, width),
    height: clampInt(Math.round(bottom - top), 1, height),
    source: "frame_black_bar_detection"
  };

  if (
    merged.width / width >= DEFAULT_NEAR_FULL_FRAME_RATIO
    && merged.height / height >= DEFAULT_NEAR_FULL_FRAME_RATIO
  ) {
    return buildFullFrameActiveBox(width, height);
  }

  return merged;
}

function buildFullFrameActiveBox(width: number, height: number): BrowserFrameActiveVideoBox {
  return {
    detected: false,
    x: 0,
    y: 0,
    width,
    height,
    source: "full_frame_fallback"
  };
}

async function extractFrameToPpm(input: {
  videoPath: string;
  time: number;
  framePath: string;
}) {
  const { ffmpegPath, runCommand } = await import("../video/ffmpeg");
  await runCommand(ffmpegPath(), [
    "-y",
    "-ss",
    input.time.toFixed(3),
    "-i",
    input.videoPath,
    "-frames:v",
    "1",
    "-vcodec",
    "ppm",
    input.framePath
  ]);
}

export function parsePpm(buffer: Buffer) {
  let offset = 0;
  const readToken = () => {
    while (offset < buffer.length && isWhitespace(buffer[offset])) offset += 1;
    if (buffer[offset] === 35) {
      while (offset < buffer.length && buffer[offset] !== 10) offset += 1;
      return readToken();
    }

    const start = offset;
    while (offset < buffer.length && !isWhitespace(buffer[offset])) offset += 1;
    return buffer.toString("ascii", start, offset);
  };

  const magic = readToken();
  if (magic !== "P6") throw new Error("Unsupported PPM format.");
  const width = Number.parseInt(readToken(), 10);
  const height = Number.parseInt(readToken(), 10);
  const maxValue = Number.parseInt(readToken(), 10);
  if (!Number.isFinite(width) || !Number.isFinite(height) || maxValue !== 255) {
    throw new Error("Invalid PPM header.");
  }

  if (offset < buffer.length && isWhitespace(buffer[offset])) offset += 1;
  const data = buffer.subarray(offset);
  if (data.length < width * height * 3) {
    throw new Error("PPM frame payload is truncated.");
  }

  return {
    width,
    height,
    data
  };
}

function resolveSampleTime(duration: number, fraction: number) {
  if (duration <= 0.1) return 0;
  return Math.min(Math.max(0, duration * fraction), Math.max(0, duration - 0.05));
}

function isWhitespace(value: number) {
  return value === 9 || value === 10 || value === 13 || value === 32;
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundTime(value: number) {
  return Math.round(value * 1000) / 1000;
}
