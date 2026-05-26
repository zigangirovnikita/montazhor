import { standardMp4OutputArgs } from "@/server/video/encoding";
import { ffmpegPath, runCommand } from "@/server/video/ffmpeg";
import { splitLayoutForProfile, type VideoProfile } from "@/server/video/profile";

export async function composeSplitLayout(
  cleanVideoPath: string,
  infographicVideoPath: string,
  profile: VideoProfile,
  duration: number,
  outputPath: string
) {
  const layout = splitLayoutForProfile(profile);
  const author = layout.author;
  const infographic = layout.infographic;
  const filter = [
    `color=c=#101312:s=${profile.width}x${profile.height}:r=30:d=${duration.toFixed(3)}[base]`,
    `[0:v]scale=${author.width}:${author.height}:force_original_aspect_ratio=increase,crop=${author.width}:${author.height},setsar=1[author]`,
    `[1:v]scale=${infographic.width}:${infographic.height}:force_original_aspect_ratio=increase,crop=${infographic.width}:${infographic.height},setsar=1[info]`,
    `[base][author]overlay=x=${author.x}:y=${author.y}[tmp]`,
    `[tmp][info]overlay=x=${infographic.x}:y=${infographic.y}:shortest=0[outv]`
  ].join(";");

  await runCommand(ffmpegPath(), [
    "-y",
    "-i",
    cleanVideoPath,
    "-i",
    infographicVideoPath,
    "-filter_complex",
    filter,
    "-map",
    "[outv]",
    "-map",
    "0:a",
    "-t",
    duration.toFixed(3),
    ...standardMp4OutputArgs(),
    outputPath
  ]);
}
