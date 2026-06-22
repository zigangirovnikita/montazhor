import type {
  BrowserFrameCameraMove,
  BrowserFrameCaption,
  BrowserFrameVisualBeat,
  BrowserFrameRenderPlan
} from "@/server/render/browserFrameRendererPlan";

export interface BrowserFrameCameraState {
  id: string;
  scale: number;
  x: number;
  y: number;
}

export function secondsToFrameCount(duration: number, fps: number) {
  return Math.max(1, Math.round(duration * fps));
}

export function frameIndexToTimestamp(frameIndex: number, fps: number, duration: number) {
  const timestamp = frameIndex / fps;
  return Math.min(duration, roundTime(timestamp));
}

export function resolveCaptionAtTime(captions: BrowserFrameCaption[], time: number) {
  return captions.find((caption) => time >= caption.start && time < caption.end)
    ?? captions.find((caption) => Math.abs(caption.end - time) < 0.0001)
    ?? null;
}

export function resolveCameraStateAtTime(cameraMoves: BrowserFrameCameraMove[], time: number): BrowserFrameCameraState | null {
  const move = cameraMoves.find((candidate) => time >= candidate.start && time <= candidate.end);
  if (!move) return null;

  const duration = move.end - move.start;
  const progress = duration <= 0 ? 1 : clamp01((time - move.start) / duration);
  const eased = easeForMotionProfile(progress, move.motionProfile);

  return {
    id: move.id,
    scale: interpolate(move.scaleFrom, move.scaleTo, eased),
    x: interpolate(move.xFrom, move.xTo, eased),
    y: interpolate(move.yFrom, move.yTo, eased)
  };
}

export function resolveVisualBeatAtTime(visualBeats: BrowserFrameVisualBeat[], time: number) {
  return visualBeats.find((beat) => time >= beat.start && time < beat.end)
    ?? visualBeats.find((beat) => Math.abs(beat.end - time) < 0.0001)
    ?? null;
}

export function buildFrameTimeline(plan: BrowserFrameRenderPlan) {
  const frameCount = secondsToFrameCount(plan.duration, plan.fps);
  return Array.from({ length: frameCount }, (_, index) => ({
    index,
    time: frameIndexToTimestamp(index, plan.fps, plan.duration)
  }));
}

function interpolate(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

function easeInOut(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function easeOut(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function easeForMotionProfile(
  value: number,
  profile: BrowserFrameCameraMove["motionProfile"] | undefined
) {
  if (profile === "quick_push") {
    return easeOut(value);
  }

  if (profile === "glide") {
    return value < 0.5
      ? 2 * value * value
      : 1 - Math.pow(-2 * value + 2, 2) / 2;
  }

  if (profile === "late_punch") {
    const delayed = clamp01((value - 0.34) / 0.66);
    return easeOut(delayed);
  }

  if (profile === "sweep") {
    return value < 0.35
      ? 0.55 * easeOut(value / 0.35)
      : 0.55 + 0.45 * easeInOut((value - 0.35) / 0.65);
  }

  return easeInOut(value);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function roundTime(value: number) {
  return Math.round(value * 1000) / 1000;
}
