import { ffprobePath, runCommand } from "@/server/video/ffmpeg";

export interface VideoMetadata {
  duration: number;
  width?: number;
  height?: number;
  fps?: number;
  hasAudio: boolean;
}

export async function probeVideo(inputPath: string): Promise<VideoMetadata> {
  const { stdout } = await runCommand(ffprobePath(), [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    inputPath
  ]);
  const data = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: Array<{
      codec_type?: string;
      width?: number;
      height?: number;
      avg_frame_rate?: string;
    }>;
  };
  const video = data.streams?.find((stream) => stream.codec_type === "video");
  const audio = data.streams?.some((stream) => stream.codec_type === "audio") ?? false;
  return {
    duration: Number(data.format?.duration ?? 0),
    width: video?.width,
    height: video?.height,
    fps: parseFps(video?.avg_frame_rate),
    hasAudio: audio
  };
}

function parseFps(rate?: string) {
  if (!rate || rate === "0/0") return undefined;
  const [left, right] = rate.split("/").map(Number);
  return right ? left / right : left;
}
