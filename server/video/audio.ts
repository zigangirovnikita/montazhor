import { ffmpegPath, runCommand } from "@/server/video/ffmpeg";

export async function extractWhisperAudio(inputPath: string, outputPath: string) {
  await runCommand(ffmpegPath(), [
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    outputPath
  ]);
}
