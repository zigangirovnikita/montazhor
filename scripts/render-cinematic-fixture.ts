import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { ContentPlan, SubtitleDraft, TranscriptWord } from "@/lib/types";
import { writeJsonFile } from "@/lib/storage";
import { buildVisualScenePlan } from "@/server/ai/visualScenePlanner";
import { renderCinematicSceneTimeline } from "@/server/hyperframes/sceneComposer";
import { standardMp4OutputArgs } from "@/server/video/encoding";
import { ffmpegPath, runCommand } from "@/server/video/ffmpeg";
import type { VideoProfile } from "@/server/video/profile";

const duration = 30;
const profile: VideoProfile = { orientation: "landscape", width: 1920, height: 1080 };
const outDir = path.join(process.cwd(), "storage", "fixtures", "cinematic-scenes");

async function main() {
  await mkdir(outDir, { recursive: true });
  const cleanVideoPath = path.join(outDir, "clean-fixture.mp4");
  const sceneLayerPath = path.join(outDir, "cinematic-scenes.mp4");
  const outputPath = path.join(outDir, "cinematic-preview.mp4");
  await renderCleanFixture(cleanVideoPath);

  const subtitles = fixtureSubtitles();
  const contentPlan: ContentPlan = {
    hook: "The golden ratio of automation",
    keyPhrases: ["60 deterministic", "30 AI assisted", "10 human judgment"],
    titleSuggestions: ["Automation system ratio"],
    description: "Fixture for AIS cinematic scene rendering.",
    hashtags: [],
    motionInserts: []
  };
  const scenePlan = buildVisualScenePlan({ subtitles, contentPlan, stylePreset: "course_glass", duration });
  await writeJsonFile(path.join(outDir, "visualScenePlan.json"), scenePlan);
  await renderCinematicSceneTimeline(outDir, cleanVideoPath, scenePlan, profile, duration, sceneLayerPath, outputPath);
  console.log(`Rendered fixture: ${outputPath}`);
  console.log(`Scene plan: ${path.join(outDir, "visualScenePlan.json")}`);
}

async function renderCleanFixture(outputPath: string) {
  await runCommand(ffmpegPath(), [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=0x1d2228:s=${profile.width}x${profile.height}:d=${duration}:r=30`,
    "-f",
    "lavfi",
    "-i",
    `anullsrc=channel_layout=stereo:sample_rate=48000:d=${duration}`,
    "-filter_complex",
    "[0:v]drawbox=x=770:y=135:w=380:h=720:color=0x58606a@0.9:t=fill,drawbox=x=885:y=195:w=150:h=150:color=0xd4dbe4@0.92:t=fill,drawbox=x=800:y=370:w=320:h=420:color=0x11151b@0.96:t=fill[v]",
    "-map",
    "[v]",
    "-map",
    "1:a",
    "-t",
    String(duration),
    ...standardMp4OutputArgs(),
    outputPath
  ]);
}

function fixtureSubtitles(): SubtitleDraft[] {
  const text = [
    "The golden ratio of automation is sixty percent deterministic logic.",
    "Thirty percent should be AI assisted, but only where the model improves the decision.",
    "The last ten percent is human judgment, manual approval, and taste.",
    "The myth is that magic should sit in the middle, but that turns into trash.",
    "When audits make sense, trust comes from earned proof and inherited context.",
    "By the end you know when, how, and what to charge for."
  ];
  const words = timedWords(text.join(" "), 1, 28);
  const subtitles: SubtitleDraft[] = [];
  let cursor = 0;
  for (const [index, sentence] of text.entries()) {
    const count = sentence.split(/\s+/).length;
    const chunk = words.slice(cursor, cursor + count);
    cursor += count;
    subtitles.push({
      id: `fixture-${index}`,
      start: chunk[0]?.start ?? 0,
      end: chunk.at(-1)?.end ?? 0,
      text: sentence,
      words: chunk,
      highlightedWords: []
    });
  }
  return subtitles;
}

function timedWords(text: string, start: number, end: number): TranscriptWord[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  const step = (end - start) / tokens.length;
  return tokens.map((word, index) => ({
    word,
    start: round(start + index * step),
    end: round(start + index * step + step * 0.76)
  }));
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
