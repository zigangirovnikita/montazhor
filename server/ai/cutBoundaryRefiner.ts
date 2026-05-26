import { readFile } from "node:fs/promises";
import type { EditRange, TranscriptJson, TranscriptWord } from "@/lib/types";
import type { SpeechRange, VoiceActivityMap } from "@/server/ai/voiceActivity";
import { isReliableWordBoundary } from "@/server/ai/wordBoundaries";

interface TimedTranscriptWord extends TranscriptWord {
  segmentIndex: number;
}

interface PcmAudio {
  sampleRate: number;
  samples: Float32Array;
}

interface RmsFrame {
  start: number;
  end: number;
  rms: number;
}

const WORD_GAP_REMOVAL_THRESHOLD = 0.4;
const WORD_GAP_KEEP_HANDLE = 0.2;
const END_LOOKBACK = 0.18;
const END_LOOKAHEAD = 0.38;
const START_LOOKBACK = 0.38;
const START_LOOKAHEAD = 0.18;
const END_SAFETY_TAIL = 0.04;
const START_ATTACK_GUARD = 0.025;
const FRAME_SECONDS = 0.025;
const HOP_SECONDS = 0.01;
const MIN_REMOVABLE_CENTER = 0.06;

export async function detectRefinedWordGapRemovals(
  transcript: TranscriptJson,
  audioPath: string,
  duration: number,
  vad?: VoiceActivityMap
): Promise<EditRange[]> {
  const audio = await readPcm16Wav(audioPath);
  const words = collectTimedWords(transcript);
  const removals: EditRange[] = [];

  for (let index = 1; index < words.length; index += 1) {
    const previous = words[index - 1];
    const next = words[index];
    if (!isReliableWordBoundary(previous) || !isReliableWordBoundary(next)) continue;

    const roughGap = next.start - previous.end;
    if (roughGap < WORD_GAP_REMOVAL_THRESHOLD) continue;

    const refinedEnd = refinePreviousWordEnd(audio, previous, next, vad?.speechRanges, duration);
    const refinedStart = refineNextWordStart(audio, previous, next, vad?.speechRanges, duration);
    const refinedGap = refinedStart - refinedEnd;
    const removableCenter = refinedGap - WORD_GAP_KEEP_HANDLE * 2;

    if (refinedGap < WORD_GAP_REMOVAL_THRESHOLD || removableCenter < MIN_REMOVABLE_CENTER) continue;

    removals.push({
      sourceStart: roundTime(refinedEnd),
      sourceEnd: roundTime(refinedStart),
      reason: "pause",
      text: `${previous.word} ... ${next.word}`,
    });
  }

  return removals;
}

function refinePreviousWordEnd(
  audio: PcmAudio,
  previous: TimedTranscriptWord,
  next: TimedTranscriptWord,
  speechRanges: SpeechRange[] | undefined,
  duration: number
): number {
  const min = Math.max(previous.start, previous.end - END_LOOKBACK);
  const max = Math.min(duration, next.start, previous.end + END_LOOKAHEAD);
  const audioEdge = findLastActiveEdge(audio, min, max) ?? previous.end;
  const speechEdge = nearestSpeechRangeEnd(previous.end, speechRanges, max);
  const refined = Math.max(previous.end, audioEdge, speechEdge ?? Number.NEGATIVE_INFINITY) + END_SAFETY_TAIL;
  return clamp(refined, previous.end, max);
}

function refineNextWordStart(
  audio: PcmAudio,
  previous: TimedTranscriptWord,
  next: TimedTranscriptWord,
  speechRanges: SpeechRange[] | undefined,
  duration: number
): number {
  const min = Math.max(0, previous.end, next.start - START_LOOKBACK);
  const max = Math.min(duration, next.end, next.start + START_LOOKAHEAD);
  const audioEdge = findFirstActiveEdge(audio, min, max) ?? next.start;
  const speechEdge = nearestSpeechRangeStart(next.start, speechRanges, min);
  const edge = Math.min(next.start, audioEdge, speechEdge ?? Number.POSITIVE_INFINITY);
  const refined = edge - START_ATTACK_GUARD;
  return clamp(refined, min, next.start);
}

function findLastActiveEdge(audio: PcmAudio, start: number, end: number): number | undefined {
  const frames = rmsFrames(audio, start, end);
  const threshold = activeThreshold(frames);
  const active = frames.filter((frame) => frame.rms >= threshold);
  return active.at(-1)?.end;
}

function findFirstActiveEdge(audio: PcmAudio, start: number, end: number): number | undefined {
  const frames = rmsFrames(audio, start, end);
  const threshold = activeThreshold(frames);
  return frames.find((frame) => frame.rms >= threshold)?.start;
}

function activeThreshold(frames: RmsFrame[]): number {
  if (frames.length === 0) return Number.POSITIVE_INFINITY;
  const values = frames.map((frame) => frame.rms).sort((a, b) => a - b);
  const noise = percentile(values, 0.2);
  const speech = percentile(values, 0.85);
  return Math.max(0.006, noise * 2.2, noise + (speech - noise) * 0.3);
}

function rmsFrames(audio: PcmAudio, start: number, end: number): RmsFrame[] {
  const frames: RmsFrame[] = [];
  const frameSize = Math.max(1, Math.round(FRAME_SECONDS * audio.sampleRate));
  const hopSize = Math.max(1, Math.round(HOP_SECONDS * audio.sampleRate));
  const startSample = Math.max(0, Math.floor(start * audio.sampleRate));
  const endSample = Math.min(audio.samples.length, Math.ceil(end * audio.sampleRate));

  for (let cursor = startSample; cursor + frameSize <= endSample; cursor += hopSize) {
    let sumSquares = 0;
    for (let index = cursor; index < cursor + frameSize; index += 1) {
      const sample = audio.samples[index] ?? 0;
      sumSquares += sample * sample;
    }
    frames.push({
      start: cursor / audio.sampleRate,
      end: (cursor + frameSize) / audio.sampleRate,
      rms: Math.sqrt(sumSquares / frameSize),
    });
  }

  return frames;
}

async function readPcm16Wav(filePath: string): Promise<PcmAudio> {
  const buffer = await readFile(filePath);
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Boundary refinement requires a WAV audio file.");
  }

  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let audioFormat = 0;
  let dataStart = -1;
  let dataSize = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;

    if (chunkId === "fmt ") {
      audioFormat = buffer.readUInt16LE(chunkStart);
      channels = buffer.readUInt16LE(chunkStart + 2);
      sampleRate = buffer.readUInt32LE(chunkStart + 4);
      bitsPerSample = buffer.readUInt16LE(chunkStart + 14);
    } else if (chunkId === "data") {
      dataStart = chunkStart;
      dataSize = chunkSize;
    }

    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  if (audioFormat !== 1 || bitsPerSample !== 16 || sampleRate <= 0 || channels <= 0 || dataStart < 0) {
    throw new Error("Boundary refinement supports PCM 16-bit WAV audio only.");
  }

  const frameCount = Math.floor(dataSize / 2 / channels);
  const samples = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) {
    let mixed = 0;
    for (let channel = 0; channel < channels; channel += 1) {
      const sampleOffset = dataStart + (frame * channels + channel) * 2;
      mixed += buffer.readInt16LE(sampleOffset) / 32768;
    }
    samples[frame] = mixed / channels;
  }

  return { sampleRate, samples };
}

function collectTimedWords(transcript: TranscriptJson): TimedTranscriptWord[] {
  const words: TimedTranscriptWord[] = [];
  for (const [segmentIndex, segment] of transcript.segments.entries()) {
    for (const word of segment.words ?? []) {
      words.push({ ...word, segmentIndex });
    }
  }
  return words.sort((a, b) => a.start - b.start);
}

function nearestSpeechRangeEnd(time: number, ranges: SpeechRange[] | undefined, max: number): number | undefined {
  return ranges
    ?.filter((range) => range.start <= time + 0.12 && range.end >= time - 0.12 && range.end <= max)
    .sort((a, b) => Math.abs(a.end - time) - Math.abs(b.end - time))[0]?.end;
}

function nearestSpeechRangeStart(time: number, ranges: SpeechRange[] | undefined, min: number): number | undefined {
  return ranges
    ?.filter((range) => range.start <= time + 0.12 && range.end >= time - 0.12 && range.start >= min)
    .sort((a, b) => Math.abs(a.start - time) - Math.abs(b.start - time))[0]?.start;
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const index = Math.max(0, Math.min(values.length - 1, Math.floor((values.length - 1) * percentileValue)));
  return values[index];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function roundTime(value: number): number {
  return Math.round(value * 1000) / 1000;
}
