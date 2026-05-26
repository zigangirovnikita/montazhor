import type { ContentPlan, ContentPlanInput, MotionInsert } from "@/lib/types";
import { transcriptWithoutSemanticRemovals } from "@/server/ai/edlTranscript";

const triggerWords = [
  "важно",
  "почему",
  "как",
  "нельзя",
  "можно",
  "ошибка",
  "деньги",
  "результат",
  "important",
  "why",
  "how",
  "mistake",
  "money",
  "result"
];

export class HeuristicContentPlanner {
  async plan(input: ContentPlanInput): Promise<ContentPlan> {
    const cleanTranscript = transcriptWithoutSemanticRemovals(input.transcript, input.edl);
    const text = cleanTranscript.segments.map((segment) => segment.text).join(" ").replace(/\s+([,.!?])/g, "$1").replace(/\s+-\s*/g, "-").trim();
    const sentences = splitSentences(text);
    const hook = sentences[0] || "Главная мысль этого видео";
    const keyPhrases = sentences
      .filter((sentence) => triggerWords.some((word) => sentence.toLowerCase().includes(word)) || /\d/.test(sentence))
      .slice(0, 5);
    const usefulKeys = keyPhrases.length ? keyPhrases : sentences.slice(1, 4);
    const cta = input.transcript.language === "en" ? "Save this so you do not lose it" : "Сохрани, чтобы не потерять";
    const outputDuration = finalDuration(input);
    const inserts: MotionInsert[] = [
      { id: "hook-card", type: "hook", startTime: 0, duration: 1.8, text: hook },
      ...usefulKeys.slice(0, 2).map((phrase, index) => ({
        id: `key-card-${index}`,
        type: "key_point" as const,
        startTime: boundedInsertStart(5 + index * 10, outputDuration, 1.6),
        duration: 1.6,
        text: phrase
      })),
      { id: "cta-card", type: "cta", startTime: boundedInsertStart(sourceTimeToOutputTime(input, lastKeptSourceEnd(input)) - 2, outputDuration, 1.8), duration: 1.8, text: cta }
    ];

    return {
      hook,
      keyPhrases: usefulKeys,
      titleSuggestions: buildTitles(hook, usefulKeys),
      description: text ? `${hook}\n\n${text.slice(0, 400)}` : hook,
      hashtags: hashtagsFor(input.platform, input.transcript.language),
      motionInserts: inserts
    };
  }
}

function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?！？])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function buildTitles(hook: string, keys: string[]) {
  const base = [hook, ...keys].filter(Boolean).slice(0, 5);
  while (base.length < 5) {
    base.push(["Почему это важно", "Как сделать лучше", "Главная ошибка", "Сохрани эту мысль", "Коротко о главном"][base.length]);
  }
  return base.map((title) => title.slice(0, 90));
}

function hashtagsFor(platform: string, language: string) {
  const ru = ["#reels", "#shorts", "#личныйбренд", "#контент", "#экспертность"];
  const en = ["#reels", "#shorts", "#creator", "#content", "#videomarketing"];
  const tags = language === "en" ? en : ru;
  return platform === "tiktok" ? ["#tiktok", ...tags.slice(1)] : tags;
}

function lastKeptSourceEnd(input: ContentPlanInput) {
  return input.edl.keptRanges.at(-1)?.sourceEnd ?? 0;
}

function finalDuration(input: ContentPlanInput) {
  return input.edl.keptRanges.reduce((total, range) => total + Math.max(0, range.sourceEnd - range.sourceStart), 0);
}

function sourceTimeToOutputTime(input: ContentPlanInput, sourceTime: number) {
  let outputTime = 0;

  for (const range of input.edl.keptRanges) {
    if (sourceTime <= range.sourceStart) return outputTime;
    if (sourceTime <= range.sourceEnd) {
      return outputTime + sourceTime - range.sourceStart;
    }
    outputTime += Math.max(0, range.sourceEnd - range.sourceStart);
  }

  return outputTime;
}

function boundedInsertStart(startTime: number, outputDuration: number, insertDuration: number) {
  return Math.max(0, Math.min(startTime, Math.max(0, outputDuration - insertDuration)));
}
