import type { VideoMetadata } from "@/server/video/metadata";

export type VideoOrientation = "landscape" | "portrait";

export interface VideoProfile {
  orientation: VideoOrientation;
  width: number;
  height: number;
}

export interface VideoRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SplitLayout {
  author: VideoRegion;
  infographic: VideoRegion;
}

const LANDSCAPE_PROFILE: VideoProfile = {
  orientation: "landscape",
  width: 1920,
  height: 1080
};

const PORTRAIT_PROFILE: VideoProfile = {
  orientation: "portrait",
  width: 1080,
  height: 1920
};

export function resolveVideoProfile(metadata: Pick<VideoMetadata, "width" | "height">): VideoProfile {
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  return height > width ? PORTRAIT_PROFILE : LANDSCAPE_PROFILE;
}

export function splitLayoutForProfile(profile: VideoProfile): SplitLayout {
  if (profile.orientation === "portrait") {
    const halfHeight = profile.height / 2;
    return {
      author: { x: 0, y: 0, width: profile.width, height: halfHeight },
      infographic: { x: 0, y: halfHeight, width: profile.width, height: halfHeight }
    };
  }

  const halfWidth = profile.width / 2;
  return {
    author: { x: 0, y: 0, width: halfWidth, height: profile.height },
    infographic: { x: halfWidth, y: 0, width: halfWidth, height: profile.height }
  };
}
