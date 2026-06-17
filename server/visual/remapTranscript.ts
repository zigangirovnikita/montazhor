import type { EditDecisionList, TranscriptJson, EditRange } from "@/lib/types";
import type { RemappedTranscript, RemappedWord, OutputRange } from "./types";

export function sourceToOutputTime(sourceTime: number, keptRanges: EditRange[]): number | null {
  let outputCursor = 0;
  for (const range of keptRanges) {
    if (sourceTime >= range.sourceStart && sourceTime <= range.sourceEnd) {
      return outputCursor + (sourceTime - range.sourceStart);
    }
    outputCursor += (range.sourceEnd - range.sourceStart);
  }
  return null;
}

export function sourceRangeToOutputRange(sourceStart: number, sourceEnd: number, keptRanges: EditRange[]): OutputRange[] {
  const outputRanges: OutputRange[] = [];
  let outputCursor = 0;

  for (const range of keptRanges) {
    const overlapStart = Math.max(sourceStart, range.sourceStart);
    const overlapEnd = Math.min(sourceEnd, range.sourceEnd);

    if (overlapStart < overlapEnd) {
      const outputStart = outputCursor + (overlapStart - range.sourceStart);
      const outputEnd = outputCursor + (overlapEnd - range.sourceStart);
      outputRanges.push({ outputStart, outputEnd });
    }
    
    outputCursor += Math.max(0, range.sourceEnd - range.sourceStart);
  }

  return outputRanges;
}

export function remapTranscriptToOutputTimeline(transcript: TranscriptJson, edl: EditDecisionList): RemappedTranscript {
  const remappedWords: RemappedWord[] = [];
  let totalOutputDuration = 0;
  for (const range of edl.keptRanges) {
    totalOutputDuration += Math.max(0, range.sourceEnd - range.sourceStart);
  }

  let wordIndex = 0;
    for (const segment of transcript.segments) {
      if (!segment.words) continue;
      for (const word of segment.words) {
        const outRanges = sourceRangeToOutputRange(word.start, word.end, edl.keptRanges);
        if (outRanges.length > 0) {
          if (outRanges.length > 1) {
            console.warn(`[remapTranscript] Warning: Word "${word.word}" (source: ${word.start}-${word.end}) spans across an EDL cut. Splitting is not fully supported yet. Keeping only the first mapped piece to avoid silent gaps.`);
          }
          const outputStart = outRanges[0].outputStart;
          const outputEnd = outRanges[0].outputEnd;

          remappedWords.push({
            id: `w${String(wordIndex).padStart(4, '0')}`,
            text: word.word,
            sourceStart: word.start,
            sourceEnd: word.end,
            outputStart,
            outputEnd
          });
          wordIndex++;
        }
      }
    }

  return {
    language: transcript.language || "ru",
    durationOutput: totalOutputDuration,
    words: remappedWords
  };
}
