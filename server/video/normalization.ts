import { detectActiveVideoBox, type BrowserFrameActiveVideoBox } from "../render/browserFrameActiveBox";
import type { VideoMetadata } from "./metadata";
import { resolveVideoProfile, type VideoProfile } from "./profile";

export interface VideoCropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VideoNormalizationPlan {
  profile: VideoProfile;
  crop?: VideoCropBox;
  source: "metadata" | "pillarboxed_portrait_active_box";
}

export async function detectNormalizationPlanForVideo(
  videoPath: string,
  metadata: Pick<VideoMetadata, "width" | "height" | "duration">
) {
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width <= 0 || height <= 0 || metadata.duration <= 0) {
    return resolveNormalizationPlan(metadata);
  }

  const activeBox = await detectActiveVideoBox({
    videoPath,
    width,
    height,
    duration: metadata.duration
  });

  return resolveNormalizationPlan(metadata, activeBox.activeVideoBox);
}

export function resolveNormalizationPlan(
  metadata: Pick<VideoMetadata, "width" | "height">,
  activeVideoBox?: BrowserFrameActiveVideoBox
): VideoNormalizationPlan {
  const profile = resolveVideoProfile(metadata);

  if (!activeVideoBox || !isPillarboxedPortrait(metadata, activeVideoBox)) {
    return {
      profile,
      source: "metadata"
    };
  }

  const cropBox = activeVideoBox;
  const crop = {
    x: cropBox.x,
    y: cropBox.y,
    width: cropBox.width,
    height: cropBox.height
  };

  return {
    profile: resolveVideoProfile(crop),
    crop,
    source: "pillarboxed_portrait_active_box"
  };
}

export function buildCropFilter(crop: VideoCropBox) {
  return `crop=${Math.round(crop.width)}:${Math.round(crop.height)}:${Math.max(0, Math.round(crop.x))}:${Math.max(0, Math.round(crop.y))}`;
}

function isPillarboxedPortrait(
  metadata: Pick<VideoMetadata, "width" | "height">,
  activeVideoBox?: BrowserFrameActiveVideoBox
) {
  if (!activeVideoBox?.detected) return false;

  const sourceWidth = metadata.width ?? 0;
  const sourceHeight = metadata.height ?? 0;
  if (sourceWidth <= sourceHeight || sourceWidth <= 0 || sourceHeight <= 0) return false;

  const widthRatio = activeVideoBox.width / sourceWidth;
  const heightRatio = activeVideoBox.height / sourceHeight;
  const activeAspect = activeVideoBox.height / Math.max(1, activeVideoBox.width);
  const sourceCenterX = sourceWidth / 2;
  const activeCenterX = activeVideoBox.x + activeVideoBox.width / 2;
  const centered = Math.abs(activeCenterX - sourceCenterX) <= sourceWidth * 0.08;

  return centered
    && widthRatio <= 0.72
    && heightRatio >= 0.9
    && activeAspect >= 1.2;
}
