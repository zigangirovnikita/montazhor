import path from "node:path";
import type { SpeakerSpeechRange, TranscriptJson } from "@/lib/types";
import { storageRoot } from "@/lib/storage";
import { runCommand } from "@/server/video/ffmpeg";

export interface SpeechRange {
  start: number;
  end: number;
}

export interface VoiceActivityMap {
  provider: "pyannote-diarization" | "transcript-diarization" | "silero-vad";
  speechRanges: SpeechRange[];
  speakerRanges?: SpeakerSpeechRange[];
  mainSpeakerId?: string;
}

export async function detectVoiceActivity(audioPath: string): Promise<VoiceActivityMap> {
  const python = process.env.WHISPER_PYTHON ?? defaultPython();
  const provider = process.env.VOICE_ACTIVITY_PROVIDER ?? "silero";

  if (provider === "silero") {
    return detectSileroVoiceActivity(python, audioPath);
  }

  const scriptPath = path.join(process.cwd(), "scripts", "detect_pyannote_diarization.py");
  const hfToken = process.env.PYANNOTE_AUTH_TOKEN ?? process.env.HUGGINGFACE_TOKEN ?? process.env.HF_TOKEN;
  const args = [
    scriptPath,
    "--audio",
    audioPath,
    "--model",
    process.env.PYANNOTE_DIARIZATION_MODEL ?? "pyannote/speaker-diarization-3.1",
  ];
  if (hfToken) args.push("--hf-token", hfToken);
  if (process.env.PYANNOTE_MIN_SPEAKERS) args.push("--min-speakers", process.env.PYANNOTE_MIN_SPEAKERS);
  if (process.env.PYANNOTE_MAX_SPEAKERS) args.push("--max-speakers", process.env.PYANNOTE_MAX_SPEAKERS);

  const modelCacheDir = path.join(storageRoot(), "models", "huggingface");
  const { stdout } = await runCommand(python, args, {
    env: {
      HF_HOME: modelCacheDir,
      HUGGINGFACE_HUB_CACHE: path.join(modelCacheDir, "hub"),
      XDG_CACHE_HOME: path.join(storageRoot(), "models", ".cache"),
      MPLCONFIGDIR: path.join(storageRoot(), "models", ".cache", "matplotlib"),
      TORCH_HOME: path.join(storageRoot(), "models", "torch"),
      PYANNOTE_CACHE: path.join(storageRoot(), "models", "pyannote"),
      NLTK_DATA: path.join(storageRoot(), "models", "nltk_data"),
    },
  });
  const result = JSON.parse(stdout) as VoiceActivityMap;
  return {
    provider: "pyannote-diarization",
    mainSpeakerId: result.mainSpeakerId,
    speakerRanges: result.speakerRanges ?? [],
    speechRanges: mergeSpeechRanges(result.speechRanges ?? []),
  };
}

export function voiceActivityFromTranscript(transcript: TranscriptJson): VoiceActivityMap | undefined {
  const mainSpeakerId = transcript.mainSpeakerId;
  const speakerRanges = transcript.speakerRanges ?? [];
  if (!mainSpeakerId || speakerRanges.length === 0) return undefined;

  return {
    provider: "transcript-diarization",
    mainSpeakerId,
    speakerRanges,
    speechRanges: mergeSpeechRanges(
      speakerRanges
        .filter((range) => range.speaker === mainSpeakerId)
        .map((range) => ({ start: range.start, end: range.end }))
    ),
  };
}

async function detectSileroVoiceActivity(python: string, audioPath: string): Promise<VoiceActivityMap> {
  const scriptPath = path.join(process.cwd(), "scripts", "detect_silero_vad.py");
  const threshold = process.env.SILERO_VAD_THRESHOLD ?? "0.5";
  const minSpeechMs = process.env.SILERO_VAD_MIN_SPEECH_MS ?? "250";
  const minSilenceMs = process.env.SILERO_VAD_MIN_SILENCE_MS ?? "450";
  const speechPadMs = process.env.SILERO_VAD_SPEECH_PAD_MS ?? "80";
  const { stdout } = await runCommand(python, [
    scriptPath,
    "--audio",
    audioPath,
    "--threshold",
    threshold,
    "--min-speech-ms",
    minSpeechMs,
    "--min-silence-ms",
    minSilenceMs,
    "--speech-pad-ms",
    speechPadMs,
  ]);

  const result = JSON.parse(stdout) as VoiceActivityMap;
  return {
    provider: "silero-vad",
    speechRanges: mergeSpeechRanges(result.speechRanges ?? []),
  };
}

function defaultPython() {
  return "python3";
}

export function speechGapsFromVad(map: VoiceActivityMap, duration: number, minGap = 0.45): SpeechRange[] {
  const gaps: SpeechRange[] = [];
  let cursor = 0;

  for (const range of map.speechRanges) {
    if (range.start - cursor >= minGap) {
      gaps.push({ start: cursor, end: range.start });
    }
    cursor = Math.max(cursor, range.end);
  }

  if (duration - cursor >= minGap) {
    gaps.push({ start: cursor, end: duration });
  }

  return gaps;
}

function mergeSpeechRanges(ranges: SpeechRange[], gap = 0.18): SpeechRange[] {
  const sorted = ranges
    .filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end) && range.end > range.start)
    .sort((a, b) => a.start - b.start);
  const merged: SpeechRange[] = [];

  for (const range of sorted) {
    const previous = merged.at(-1);
    if (!previous || range.start - previous.end > gap) {
      merged.push({ ...range });
      continue;
    }
    previous.end = Math.max(previous.end, range.end);
  }

  return merged;
}
