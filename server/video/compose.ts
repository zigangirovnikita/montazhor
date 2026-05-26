import type { MotionInsert } from "@/lib/types";
import { standardMp4OutputArgs } from "@/server/video/encoding";
import { ffmpegPath, runCommand } from "@/server/video/ffmpeg";
import type { VideoProfile } from "@/server/video/profile";

/**
 * Compose the final MP4 from the subtitled video.
 * Applies loudness normalization (EBU R128).
 *
 * Motion inserts are not yet composited — once HyperFrames overlay
 * is production-ready, this function will overlay rendered cards.
 */
export async function composeFinalVideo(
  inputPath: string,
  _inserts: MotionInsert[],
  _profile: VideoProfile,
  outputPath: string
) {
  await runCommand(ffmpegPath(), [
    "-y",
    "-i",
    inputPath,
    "-af",
    "loudnorm=I=-16:TP=-1.5:LRA=11",
    ...standardMp4OutputArgs(),
    outputPath
  ]);
}
