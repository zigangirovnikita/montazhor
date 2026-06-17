import { buildSemanticBlocks } from "../server/scene/blockPlanner";
import { buildDirectorPlan } from "../server/scene/directorPlanner";
import { buildScreenCopyPlan } from "../server/scene/screenCopyPlanner";
import { buildReviewScenePlan, compileScenePlan } from "../server/scene/sceneCompiler";
import type { SubtitleDraft, ContentPlan } from "../lib/types";
import { resolveTemplateSceneCapabilities } from "../server/scene/sceneCompatibility";
import * as fs from "fs";

async function run() {
  const subtitles: SubtitleDraft[] = [
    { id: 1, text: "Топ-3 способа получить классное видео в CapCut.", outputStart: 0, outputEnd: 3, words: [
      { word: "Топ-3", start: 0, end: 0.5 },
      { word: "способа", start: 0.5, end: 1 },
      { word: "получить", start: 1, end: 1.5 },
      { word: "классное", start: 1.5, end: 2 },
      { word: "видео", start: 2, end: 2.5 },
      { word: "в", start: 2.5, end: 2.7 },
      { word: "CapCut.", start: 2.7, end: 3 },
    ] },
    { id: 2, text: "Первый способ", outputStart: 3, outputEnd: 4, words: [
      { word: "Первый", start: 3, end: 3.5 },
      { word: "способ", start: 3.5, end: 4 },
    ] },
    { id: 3, text: "- не режьте мышкой, лучше используйте Command+B.", outputStart: 4, outputEnd: 7, words: [
      { word: "-", start: 4, end: 4.1 },
      { word: "не", start: 4.1, end: 4.3 },
      { word: "режьте", start: 4.3, end: 4.8 },
      { word: "мышкой,", start: 4.8, end: 5.3 },
      { word: "лучше", start: 5.3, end: 5.7 },
      { word: "используйте", start: 5.7, end: 6.3 },
      { word: "Command+B.", start: 6.3, end: 7 },
    ] }
  ];

  const contentPlan: ContentPlan = {
    hook: "Топ-3 способа получить классное видео в CapCut.",
    segments: [],
    cta: ""
  };

  const duration = 7.0;

  const semanticBlocks = buildSemanticBlocks(subtitles, contentPlan, duration);
  
  const capabilities = resolveTemplateSceneCapabilities("dynamic_viral");
  const directorPlan = await buildDirectorPlan({
    semanticBlocks,
    contentPlan,
    styleProfileId: "dynamic_viral",
    capabilities
  }, "test-proj", (msg) => console.log(msg));

  const screenCopyPlan = await buildScreenCopyPlan({
    semanticBlocks,
    directorPlan,
    contentPlan
  }, "test-proj", (msg) => console.log(msg));

  const scenePlan = buildReviewScenePlan(directorPlan, screenCopyPlan);

  const profile = { width: 1080, height: 1920, orientation: "portrait" as const, fps: 30 };
  const compiledScenePlan = compileScenePlan(directorPlan, screenCopyPlan, profile, {});

  fs.writeFileSync("semantic-blocks.json", JSON.stringify(semanticBlocks, null, 2));
  fs.writeFileSync("director-plan.json", JSON.stringify(directorPlan, null, 2));
  fs.writeFileSync("screen-copy-plan.json", JSON.stringify(screenCopyPlan, null, 2));
  fs.writeFileSync("scene-plan.json", JSON.stringify(scenePlan, null, 2));
  fs.writeFileSync("compiled-scene-plan.json", JSON.stringify(compiledScenePlan, null, 2));

  console.log("Plans generated in current directory");
}

run().catch(console.error);
