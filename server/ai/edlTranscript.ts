import type { EditDecisionList, TranscriptJson, TranscriptSegment, TranscriptWord } from "@/lib/types";

const GAP_REASONS = new Set(["pause", "silence", "long_pause", "non_silent_gap", "noisy_pause", "vad_pause"]);

export function transcriptWithoutSemanticRemovals(transcript: TranscriptJson, edl: EditDecisionList): TranscriptJson {
  const semanticRemoved = edl.removedRanges.filter((range) => !GAP_REASONS.has(range.reason));
  const words = wordsFromTranscript(transcript).filter((word) => {
    const midpoint = (word.start + word.end) / 2;
    return !semanticRemoved.some((range) => midpoint >= range.sourceStart && midpoint <= range.sourceEnd);
  });

  if (words.length === 0) {
    return { ...transcript, segments: [] };
  }

  return {
    ...transcript,
    segments: [segmentFromWords(0, words)],
  };
}

export function wordsKeptByEdl(transcript: TranscriptJson, edl: EditDecisionList): TranscriptWord[] {
  const sourceWords = wordsFromTranscript(transcript);

  return sourceWords.filter((word) => {
    const midpoint = (word.start + word.end) / 2;
    return edl.keptRanges.some((range) => midpoint >= range.sourceStart && midpoint <= range.sourceEnd);
  });
}

function wordsFromTranscript(transcript: TranscriptJson): TranscriptWord[] {
  return transcript.segments.flatMap((segment) => {
    if (segment.words?.length) return segment.words;
    const words = segment.text.split(/\s+/).filter(Boolean);
    return words.map((word, index) => {
      const part = (segment.end - segment.start) / Math.max(words.length, 1);
      return {
        word,
        start: segment.start + part * index,
        end: segment.start + part * (index + 1),
      };
    });
  });
}

function segmentFromWords(id: number, words: TranscriptWord[]): TranscriptSegment {
  return {
    id,
    start: words[0].start,
    end: words.at(-1)?.end ?? words[0].end,
    text: words.map((word) => word.word).join(" "),
    words,
  };
}
