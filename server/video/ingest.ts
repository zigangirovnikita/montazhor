import { ffmpegPath, runCommand } from "@/server/video/ffmpeg";
import { probeVideo } from "@/server/video/metadata";
import { standardMp4OutputArgs, scalePadFilter } from "@/server/video/encoding";
import { resolveVideoProfile } from "@/server/video/profile";

export async function optimizeUploadedVideo(inputPath: string, outputPath: string) {
  const metadata = await probeVideo(inputPath);
  const profile = resolveVideoProfile(metadata);

  await runCommand(ffmpegPath(), [
    "-y",
    "-i",
    inputPath,
    "-vf",
    scalePadFilter(profile),
    ...standardMp4OutputArgs(),
    outputPath
  ]);
}
