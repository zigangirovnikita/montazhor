import type { VideoProfile } from "@/server/video/profile";

const VIDEO_BITRATE = "4000k";
const AUDIO_BITRATE = "128k";
const VIDEO_BUFFER = "8000k";
const VIDEO_FPS = "30";

export function scalePadFilter(profile: VideoProfile) {
  return [
    `scale=${profile.width}:${profile.height}:force_original_aspect_ratio=decrease`,
    `pad=${profile.width}:${profile.height}:(ow-iw)/2:(oh-ih)/2:color=black`,
    "scale=trunc(iw/2)*2:trunc(ih/2)*2",
    "setsar=1"
  ].join(",");
}

export type RenderProfile = "draft" | "review" | "final";

// Draft preview: 720p, 24fps, CRF 30, superfast
export function draftPreviewMp4OutputArgs() {
  return [
    "-c:v", "libx264",
    "-preset", "superfast",
    "-crf", "30",
    "-r", "24",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
  ];
}

// Review preview: 1080p, 24fps, CRF 26, superfast
export function reviewPreviewMp4OutputArgs() {
  return [
    "-c:v", "libx264",
    "-preset", "superfast",
    "-crf", "26",
    "-r", "24",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
  ];
}

// Intermediate profile for cached fragments feeding final
export function intermediateMp4OutputArgs() {
  return [
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "23",
    "-r", "30",
    "-pix_fmt", "yuv420p",
    "-c:a", "pcm_s16le",
    "-movflags", "+faststart",
  ];
}

// Final production profile: 1080p, 30fps, 4000k CBR
export function finalMp4OutputArgs() {
  return [
    ...standardVideoEncodeArgs(),
    ...standardAudioEncodeArgs(),
    "-movflags",
    "+faststart"
  ];
}

export function standardVideoEncodeArgs() {
  return [
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-profile:v",
    "high",
    "-level:v",
    "4.1",
    "-b:v",
    VIDEO_BITRATE,
    "-minrate",
    VIDEO_BITRATE,
    "-maxrate",
    VIDEO_BITRATE,
    "-bufsize",
    VIDEO_BUFFER,
    "-r",
    VIDEO_FPS,
    "-g",
    "60",
    "-keyint_min",
    "60",
    "-sc_threshold",
    "0",
    "-x264-params",
    "nal-hrd=cbr:force-cfr=1",
    "-pix_fmt",
    "yuv420p",
    "-colorspace",
    "bt709",
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-color_range",
    "tv"
  ];
}

export function standardAudioEncodeArgs() {
  return [
    "-c:a",
    "aac",
    "-b:a",
    AUDIO_BITRATE,
    "-ar",
    "48000"
  ];
}

export function standardMp4OutputArgs() {
  return [
    ...standardVideoEncodeArgs(),
    ...standardAudioEncodeArgs(),
    "-movflags",
    "+faststart"
  ];
}

export function outputArgsForProfile(profile: RenderProfile) {
  switch (profile) {
    case "draft":
      return draftPreviewMp4OutputArgs();
    case "review":
      return reviewPreviewMp4OutputArgs();
    case "final":
      return finalMp4OutputArgs();
  }
}

export function previewScaleFilter(profile: VideoProfile, renderProfile: RenderProfile): string {
  if (renderProfile !== "draft") {
    // review/final stay at native size
    return `scale=${profile.width}:${profile.height}`;
  }
  // draft preview is 720p
  if (profile.orientation === "portrait") {
    return "scale=720:-2";
  }
  return "scale=-2:720";
}
