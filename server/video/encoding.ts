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
