import type { ContentPlan, SemanticBlock, SemanticBlockType, SubtitleDraft, TranscriptWord } from "@/lib/types";

const CTA_RE = /\b(подпиш|сохрани|переходи|забирай|пиши|скачай|subscribe|follow|save|download|join)\b/i;
const TIMELINE_RE = /\b(сначала|потом|затем|после|этап|шаг|first|then|next|finally|year|год|лет)\b/i;
const WARNING_RE = /\b(опасно|ошибка|нельзя|стоп|миф|wrong|mistake|risk|danger|warning)\b/i;
const DEFINITION_RE = /\b(это|значит|называется|по сути|is|means|definition)\b/i;
const LIST_RE = /\b(первое|второе|третье|шаг|пункт|список|причин|first|second|third|step)\b/i;
const COMPARE_RE = /\b(или|против|vs|versus|вместо|до|после|better|хуже|лучше|с одной стороны|с другой)\b/i;
const PROOF_RE = /\b(\d+[.,]?\d*%?|\$|₽|x|раз|пример|результат|кейс|case|цифр|статистика)\b/i;
const TRANSITION_RE = /\b(дальше|теперь|тогда|переходим|короче дальше|next|now|moving on)\b/i;
const THESIS_RE = /\b(главное|суть|итог|поэтому|вывод|main point|bottom line)\b/i;

interface BlockWord extends TranscriptWord {
  sourceIndex: number;
}

export function buildSemanticBlocks(subtitles: SubtitleDraft[], contentPlan: ContentPlan, duration: number): SemanticBlock[] {
  const words = collectWords(subtitles);
  if (words.length === 0) return [];

  const blocks: SemanticBlock[] = [];
  let startIndex = 0;

  while (startIndex < words.length) {
    let endIndex = startIndex;
    while (endIndex + 1 < words.length && shouldExtendBlock(words, startIndex, endIndex + 1)) {
      endIndex += 1;
    }
    const blockWords = words.slice(startIndex, endIndex + 1);
    const text = normalizeText(blockWords.map((word) => word.word).join(" "));
    if (text) {
      const type = inferBlockType(text, blocks.length, contentPlan);
      blocks.push({
        id: `block-${String(blocks.length + 1).padStart(3, "0")}`,
        type,
        start: round(blockWords[0]!.start),
        end: round(Math.min(duration, blockWords.at(-1)!.end)),
        text,
        summary: summarizeBlock(text),
        words: blockWords.map(({ sourceIndex, ...word }) => word),
        transcriptWordRange: {
          startIndex: blockWords[0]!.sourceIndex,
          endIndex: blockWords.at(-1)!.sourceIndex
        },
        wordCount: blockWords.length,
        contextBefore: blocks.at(-1)?.summary,
        contextAfter: undefined
      });
    }
    startIndex = endIndex + 1;
  }

  return blocks.map((block, index) => ({
    ...block,
    contextAfter: blocks[index + 1]?.summary
  }));
}

function collectWords(subtitles: SubtitleDraft[]) {
  const result: BlockWord[] = [];
  for (const subtitle of subtitles) {
    for (const word of subtitle.words) {
      if (typeof word.start !== "number" || typeof word.end !== "number" || word.end <= word.start) continue;
      if (!word.word.trim()) continue;
      result.push({ ...word, sourceIndex: result.length });
    }
  }
  return dedupeWords(result);
}

function dedupeWords(words: BlockWord[]) {
  return words.filter((word, index) => {
    const previous = words[index - 1];
    if (!previous) return true;
    return !(previous.word === word.word && Math.abs(previous.start - word.start) < 0.01 && Math.abs(previous.end - word.end) < 0.01);
  });
}

function shouldExtendBlock(words: BlockWord[], startIndex: number, nextIndex: number) {
  const first = words[startIndex]!;
  const previous = words[nextIndex - 1]!;
  const next = words[nextIndex]!;
  const duration = next.end - first.start;
  const gap = next.start - previous.end;
  const count = nextIndex - startIndex + 1;

  if (duration > 6.5) return false;
  if (count >= 32) return false;
  if (gap > 0.55) return false;
  if (gap > 0.35 && /[.!?]$/.test(previous.word)) return false;
  if (count >= 18 && /[,:;]$/.test(previous.word)) return false;
  if (duration > 3.6 && /[.!?]$/.test(previous.word)) return false;
  return true;
}

function inferBlockType(text: string, index: number, contentPlan: ContentPlan): SemanticBlockType {
  if (index === 0) return "hook";
  if (CTA_RE.test(text)) return "cta";
  if (TRANSITION_RE.test(text)) return "transition";
  if (TIMELINE_RE.test(text)) return "timeline";
  if (WARNING_RE.test(text) && COMPARE_RE.test(text)) return "myth_vs_truth";
  if (THESIS_RE.test(text)) return "thesis";
  if (COMPARE_RE.test(text)) return "comparison";
  if (LIST_RE.test(text)) return "list";
  if (WARNING_RE.test(text)) return "warning";
  if (DEFINITION_RE.test(text)) return "definition";
  if (PROOF_RE.test(text)) return "proof";
  if (contentPlan.hook && normalizeText(contentPlan.hook) === normalizeText(text)) return "thesis";
  if (text.includes(":") || text.split(" ").length > 16) return "explanation";
  if (/[«"”]/.test(text)) return "example";
  return "explanation";
}

function summarizeBlock(text: string) {
  const words = normalizeText(text).split(" ").filter(Boolean);
  return words.slice(0, 10).join(" ");
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
