import { outputArgsForProfile, type RenderProfile } from "@/server/video/encoding";
import { ffmpegPath, runCommand } from "@/server/video/ffmpeg";

/**
 * Final compositing and normalization pass.
 * Loudnorm is skipped for fast preview rendering.
 */
export async function composeFinalVideo(
  inputPath: string,
  outputPath: string,
  renderProfile: RenderProfile
) {
  const audioArgs = renderProfile === "final" ? ["-af", "loudnorm=I=-16:TP=-1.5:LRA=11"] : [];

  await runCommand(ffmpegPath(), [
    "-y",
    "-i",
    inputPath,
    ...audioArgs,
    ...outputArgsForProfile(renderProfile),
    outputPath
  ]);
}
