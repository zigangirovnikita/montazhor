import { ffmpegPath, runCommand } from "@/server/video/ffmpeg";
import { probeVideo } from "@/server/video/metadata";
import { buildCropFilter, detectNormalizationPlanForVideo } from "@/server/video/normalization";
import { standardMp4OutputArgs, scalePadFilter } from "@/server/video/encoding";

export async function optimizeUploadedVideo(inputPath: string, outputPath: string) {
  const metadata = await probeVideo(inputPath);
  const normalization = await detectNormalizationPlanForVideo(inputPath, metadata);
  const filters = [
    normalization.crop ? buildCropFilter(normalization.crop) : null,
    scalePadFilter(normalization.profile)
  ].filter(Boolean);

  await runCommand(ffmpegPath(), [
    "-y",
    "-i",
    inputPath,
    "-vf",
    filters.join(","),
    ...standardMp4OutputArgs(),
    outputPath
  ]);
}
