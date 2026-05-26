import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { EditRange, TranscriptJson } from "../lib/types";
import { buildEditDecisionListFromKeepSegments, normalizeRemovalRanges, planCuts } from "../server/pipeline/steps/planCuts";
import { detectUntranscribedVoiceRemovals } from "../server/pipeline/steps/untranscribedVoice";
import { validateScriptSelectionPlan } from "../server/ai/scriptSelector";
import { normalizeTranscriptTimings } from "../server/ai/transcriptTiming";
import { detectRefinedWordGapRemovals } from "../server/ai/cutBoundaryRefiner";

const transcript: TranscriptJson = {
  language: "ru",
  segments: [
    {
      id: 0,
      start: 0,
      end: 13.4,
      text: "привет короче важная мысль первый второй финал",
      words: [
        { word: "привет", start: 2.4, end: 2.8 },
        { word: "короче", start: 3.0, end: 3.42 },
        { word: "важная", start: 5.0, end: 5.4 },
        { word: "мысль", start: 6.5, end: 6.9 },
        { word: "первый", start: 10.0, end: 10.4 },
        { word: "второй", start: 12.0, end: 12.4 },
        { word: "Короче,", start: 13.0, end: 13.4 },
        { word: "финал", start: 13.7, end: 14.1 },
      ],
    },
  ],
};

function assertRange(range: EditRange, start: number, end: number) {
  assert.equal(Number(range.sourceStart.toFixed(2)), start);
  assert.equal(Number(range.sourceEnd.toFixed(2)), end);
}

async function main() {
  {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "montazhor-boundary-"));
    const audioPath = path.join(tempDir, "speech.wav");
    try {
      await writeFile(audioPath, makeTestWav(2.0, [
        { start: 0.2, end: 0.62 },
        { start: 1.38, end: 1.8 },
      ]));

      const boundaryTranscript: TranscriptJson = {
        language: "ru",
        segments: [
          {
            id: 0,
            start: 0,
            end: 2,
            text: "первое второе",
            words: [
              { word: "первое", start: 0.2, end: 0.5 },
              { word: "второе", start: 1.5, end: 1.8 },
            ],
          },
        ],
      };

      const [gap] = await detectRefinedWordGapRemovals(boundaryTranscript, audioPath, 2, {
        provider: "silero-vad",
        speechRanges: [
          { start: 0.2, end: 0.62 },
          { start: 1.38, end: 1.8 },
        ],
      });

      assert(gap, "refined word-gap detector should keep removable pause after boundary repair");
      assert(gap.sourceStart > 0.5, "previous word end should move right when speech continues after Whisper end");
      assert(gap.sourceEnd < 1.5, "next word start should move left when speech starts before Whisper start");
      assert(gap.sourceEnd - gap.sourceStart > 0.4, "refined gap should remain removable only when it is still longer than threshold");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  {
    const keepFirstTranscript: TranscriptJson = {
      language: "ru",
      segments: [
        {
          id: 0,
          start: 0,
          end: 9,
          text: "Никогда бы не подумал хотя нет по-другому Никогда бы не подумал что получится. Я всегда пытаюсь сделать наработки.",
          words: [
            { word: "Никогда", start: 0.1, end: 0.45 },
            { word: "бы", start: 0.45, end: 0.6 },
            { word: "не", start: 0.6, end: 0.75 },
            { word: "подумал", start: 0.75, end: 1.15 },
            { word: "хотя", start: 1.2, end: 1.45 },
            { word: "нет", start: 1.45, end: 1.65 },
            { word: "по-другому", start: 1.65, end: 2.1 },
            { word: "Никогда", start: 3.5, end: 3.85 },
            { word: "бы", start: 3.85, end: 4.0 },
            { word: "не", start: 4.0, end: 4.15 },
            { word: "подумал", start: 4.15, end: 4.55 },
            { word: "что", start: 4.55, end: 4.75 },
            { word: "получится.", start: 4.75, end: 5.0 },
            { word: "Я", start: 6.0, end: 6.1 },
            { word: "всегда", start: 6.1, end: 6.45 },
            { word: "пытаюсь", start: 6.45, end: 6.85 },
            { word: "сделать", start: 6.85, end: 7.25 },
            { word: "наработки.", start: 7.25, end: 7.8 },
          ],
        },
      ],
    };
    const edl = buildEditDecisionListFromKeepSegments(
      keepFirstTranscript,
      [
        {
          sourceStart: 3.5,
          sourceEnd: 5.0,
          text: "Никогда бы не подумал что получится.",
          role: "final_script",
          reason: "последняя полная версия мысли",
          confidence: 0.95,
        },
        {
          sourceStart: 6.0,
          sourceEnd: 7.8,
          text: "Я всегда пытаюсь сделать наработки.",
          role: "final_script",
          reason: "финальное продолжение",
          confidence: 0.95,
        },
      ],
      [{ sourceStart: 5.0, sourceEnd: 6.0, reason: "vad_pause" }],
      9
    );

    assertRange(edl.keptRanges[0], 3.2, 5.2);
    assertRange(edl.keptRanges[1], 5.8, 8.1);
    assert(edl.removedRanges.some((range) => range.reason === "not_selected" && range.sourceEnd <= 3.2), "earlier failed take should be outside the selected final script");
    assert(edl.removedRanges.some((range) => range.reason === "mixed" && range.sourceStart <= 5.2 && range.sourceEnd >= 5.8), "pause cleanup should run after final text selection with 0.2s handles");
  }

  {
    const keepPlan = validateScriptSelectionPlan(
      {
        reasoning: "Оставляем последнюю версию повторяющейся мысли.",
        keepSegments: [
          {
            sourceStart: 4.95,
            sourceEnd: 6.95,
            text: "важная мысль",
            role: "final_script",
            reason: "последняя полная версия мысли",
            confidence: 0.9,
          },
        ],
        rejectedTakes: [],
      },
      transcript,
      14
    );
    assert.equal(keepPlan.keepSegments.length, 1, "script selector should keep validated word-snapped segments");
    assertRange(
      {
        sourceStart: keepPlan.keepSegments[0].sourceStart,
        sourceEnd: keepPlan.keepSegments[0].sourceEnd,
        reason: "final_script",
      },
      5.0,
      6.9
    );
  }

  {
    const [range] = normalizeRemovalRanges(
      transcript,
      [{ sourceStart: 10, sourceEnd: 12, reason: "pause" }],
      14
    );
    assertRange(range, 10.2, 11.8);
  }

  {
    const [range] = normalizeRemovalRanges(
      transcript,
      [{ sourceStart: 21.27, sourceEnd: 22.11, reason: "pause" }],
      30
    );
    assertRange(range, 21.47, 21.91);
  }

  {
    const [range] = normalizeRemovalRanges(
      transcript,
      [{ sourceStart: 27.07, sourceEnd: 27.51, reason: "pause" }],
      30
    );
    assertRange(range, 27.27, 27.31);
  }

  {
    const [range] = normalizeRemovalRanges(
      transcript,
      [{ sourceStart: 3.0, sourceEnd: 3.42, reason: "filler_word", text: "короче" }],
      14
    );
    assert(range.sourceStart <= 3.0);
    assert(range.sourceEnd >= 3.42);
    assert(range.sourceStart >= 2.8);
    assert(range.sourceEnd <= 5.0);
  }

  {
    const [range] = normalizeRemovalRanges(
      transcript,
      [{ sourceStart: 5.1, sourceEnd: 6.8, reason: "hesitation" }],
      14
    );
    assert(range.sourceStart <= 5.0);
    assert(range.sourceEnd >= 6.9);
    assert(range.sourceStart >= 3.42);
    assert(range.sourceEnd <= 10.0);
  }

  {
    const ranges = normalizeRemovalRanges(
      transcript,
      [{ sourceStart: 8.0, sourceEnd: 9.0, reason: "off_narrative" }],
      14
    );
    assert.deepEqual(ranges, []);
  }

  {
    const [range] = normalizeRemovalRanges(
      transcript,
      [{ sourceStart: 10, sourceEnd: 12, reason: "non_silent_gap" }],
      14
    );
    assertRange(range, 10.2, 11.8);
  }

  {
    process.env.OPENROUTER_API_KEY = "";
    const edl = await planCuts(transcript, 14, "medium");
    const removedFiller = edl.removedRanges.find(
      (range) => range.sourceStart <= 3.0 && range.sourceEnd >= 3.42
    );
    const removedGap = edl.removedRanges.find(
      (range) => range.reason === "pause" && range.sourceStart > 10
    );

    assert(removedFiller, "short filler word should be removed as a complete word");
    assert(removedGap, "word-to-word transcript gap should be removed deterministically");
    assert(removedGap.sourceStart > 10.0);
    assert(removedGap.sourceEnd < 12.0);
  }

  {
    process.env.OPENROUTER_API_KEY = "";
    const edl = await planCuts(transcript, 14, "high");
    const shortGap = edl.removedRanges.find(
      (range) => range.reason === "pause" && range.sourceStart > 12.4
    );
    const removedConnector = edl.removedRanges.find(
      (range) => range.sourceStart <= 13.0 && range.sourceEnd >= 13.4
    );

    assert(shortGap, "high aggressiveness should remove short transcript gaps");
    assertRange(shortGap, 12.6, 12.8);
    assert.equal(removedConnector, undefined, "contextual 'Короче' should be kept before an authored statement");
  }

  {
    const ranges = normalizeRemovalRanges(
      transcript,
      [{ sourceStart: 9.8, sourceEnd: 12.2, reason: "vad_pause" }],
      14
    );
    assert(
      ranges.every((range) => range.sourceEnd <= 10.0 || range.sourceStart >= 10.4),
      "VAD gaps must not cut across transcript words"
    );
    assert(
      ranges.every((range) => range.sourceEnd <= 12.0 || range.sourceStart >= 12.4),
      "VAD gaps must protect words even near the right edge"
    );
  }

  {
    const removals = detectUntranscribedVoiceRemovals(
      transcript,
      {
        provider: "silero-vad",
        speechRanges: [
          { start: 8.0, end: 9.0 },
          { start: 10.0, end: 10.4 },
        ],
      },
      "high",
      () => {}
    );
    assert.equal(removals.length, 1, "high mode should remove voice-like VAD islands without words");
    assertRange(removals[0], 8.0, 9.0);
  }

  {
    const removals = detectUntranscribedVoiceRemovals(
      transcript,
      {
        provider: "silero-vad",
        speechRanges: [{ start: 5.0, end: 8.0 }],
      },
      "high",
      () => {}
    );
    assert.equal(removals.length, 2, "high mode should remove wordless gaps inside a VAD speech range");
    assertRange(removals[1], 6.9, 8.0);
  }

  {
    const brokenWhisperTranscript: TranscriptJson = {
      language: "ru",
      segments: [
        {
          id: 0,
          start: 0,
          end: 10,
          text: "сегодня хочу рассказать историю",
          words: [
            { word: "сегодня", start: 0, end: 0.8 },
            { word: "хочу", start: 3.48, end: 3.48 },
            { word: "рассказать", start: 3.48, end: 8.46 },
            { word: "историю", start: 8.8, end: 9.4 },
          ],
        },
      ],
    };
    const [range] = normalizeRemovalRanges(
      brokenWhisperTranscript,
      [{ sourceStart: 2.6, sourceEnd: 8.0, reason: "vad_pause" }],
      10
    );
    assertRange(range, 2.8, 7.8);
  }

  {
    const brokenWhisperTranscript: TranscriptJson = {
      language: "ru",
      segments: [
        {
          id: 0,
          start: 0,
          end: 2,
          text: "привет я здесь",
          words: [
            { word: "привет", start: -0.2, end: 0.04 },
            { word: "я", start: 0.04, end: 0.04 },
            { word: "здесь", start: 0.05, end: 0.08 },
          ],
        },
      ],
    };
    const { transcript: normalized, stats } = normalizeTranscriptTimings(brokenWhisperTranscript, {
      duration: 2,
      speechRanges: [{ start: 0.12, end: 1.2 }],
    });
    const words = normalized.segments[0].words ?? [];

    assert.equal(stats.repairedWords, 3, "negative, zero, and implausibly short word timings should be repaired");
    assert(words[0].start >= 0.12, "repaired words should prefer the VAD speech segment start");
    assert(words.every((word) => word.end > word.start), "all repaired words must have positive duration");
    assert(words.every((word, index) => index === 0 || word.start >= words[index - 1].end), "repaired words must stay monotonic");
  }

  {
    const stretchedWhisperTranscript: TranscriptJson = {
      language: "ru",
      segments: [
        {
          id: 0,
          start: 0,
          end: 5,
          text: "очень хочется сделать такую",
          words: [
            { word: "очень", start: 0.2, end: 0.7 },
            { word: "хочется", start: 0.7, end: 2.0 },
            { word: "сделать", start: 2.0, end: 3.35 },
            { word: "такую", start: 3.35, end: 3.7 },
          ],
        },
      ],
    };
    const [range] = normalizeRemovalRanges(
      stretchedWhisperTranscript,
      [{ sourceStart: 1.55, sourceEnd: 2.85, reason: "vad_pause" }],
      5
    );
    assertRange(range, 1.75, 2.65);
  }

  {
    process.env.OPENROUTER_API_KEY = "";
    const profanityTranscript: TranscriptJson = {
      language: "ru",
      segments: [
        {
          id: 0,
          start: 0,
          end: 1.4,
          text: "это блять важно",
          words: [
            { word: "это", start: 0.1, end: 0.25 },
            { word: "блять", start: 0.3, end: 0.6 },
            { word: "важно", start: 0.7, end: 1.1 },
          ],
        },
      ],
    };
    const edl = await planCuts(profanityTranscript, 1.4, "high");
    const fullSegmentRemoval = edl.removedRanges.find(
      (range) => range.sourceStart <= 0.1 && range.sourceEnd >= 1.1
    );
    const profanityWordRemoval = edl.removedRanges.find(
      (range) => range.sourceStart <= 0.3 && range.sourceEnd >= 0.6
    );
    assert.equal(fullSegmentRemoval, undefined, "single profanity word must not remove the whole useful phrase");
    assert(profanityWordRemoval, "high mode should still remove the profanity word");
  }

  console.log("cut normalization tests passed");
}

function makeTestWav(duration: number, speechRanges: { start: number; end: number }[]): Buffer {
  const sampleRate = 16000;
  const frameCount = Math.round(duration * sampleRate);
  const dataSize = frameCount * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < frameCount; index += 1) {
    const time = index / sampleRate;
    const isSpeech = speechRanges.some((range) => time >= range.start && time <= range.end);
    const sample = isSpeech ? Math.round(Math.sin(time * 2 * Math.PI * 220) * 9000) : 0;
    buffer.writeInt16LE(sample, 44 + index * 2);
  }

  return buffer;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
