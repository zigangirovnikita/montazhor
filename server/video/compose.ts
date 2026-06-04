import type { MotionInsert } from "@/lib/types";
import { standardMp4OutputArgs } from "@/server/video/encoding";
import { ffmpegPath, runCommand } from "@/server/video/ffmpeg";
import type { VideoProfile } from "@/server/video/profile";

/**
 * Final loudness normalization pass (EBU R128).
 * Visual overlay compositing happens upstream in semanticOverlay.ts.
 */
export async function composeFinalVideo(
  inputPath: string,
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
