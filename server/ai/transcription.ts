import path from "node:path";
import { mkdir } from "node:fs/promises";
import { statSync } from "node:fs";
import { runCommand } from "@/server/video/ffmpeg";
import type { TranscriptionInput, TranscriptionProvider, TranscriptJson } from "@/lib/types";
import { storageRoot } from "@/lib/storage";

const DEFAULT_INITIAL_PROMPT =
  "Это русская разговорная речь для короткого видео. Сохраняй междометия, паузы, слова-паразиты и вокализации: эээ, эм, ммм, ааа, ну, короче.";

export class LocalWhisperTranscriptionProvider implements TranscriptionProvider {
  async transcribe(input: TranscriptionInput): Promise<TranscriptJson> {
    const python = process.env.WHISPER_PYTHON ?? defaultPython();
    const provider = process.env.TRANSCRIPTION_PROVIDER ?? "whisperx";
    const language = input.language === "auto" ? "ru" : input.language;
    const initialPrompt = process.env.WHISPER_INITIAL_PROMPT ?? DEFAULT_INITIAL_PROMPT;
    const modelCacheDir = path.join(storageRoot(), "models", "huggingface");
    const modelName = process.env.WHISPER_MODEL ?? "medium";
    const baseEnv = {
      HF_HOME: modelCacheDir,
      HUGGINGFACE_HUB_CACHE: path.join(modelCacheDir, "hub"),
      XDG_CACHE_HOME: path.join(storageRoot(), "models", ".cache"),
      MPLCONFIGDIR: path.join(storageRoot(), "models", ".cache", "matplotlib"),
      TORCH_HOME: path.join(storageRoot(), "models", "torch"),
      PYANNOTE_CACHE: path.join(storageRoot(), "models", "pyannote"),
      NLTK_DATA: path.join(storageRoot(), "models", "nltk_data"),
    };

    try {
      await mkdir(modelCacheDir, { recursive: true });
      await mkdir(path.join(storageRoot(), "models", "nltk_data"), { recursive: true });
      const { stdout } = await runTranscriptionCommand({
        python,
        provider,
        input,
        language,
        initialPrompt,
        modelName,
        modelCacheDir,
        baseEnv,
      });
      return parseJsonFromStdout(stdout);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `${provider} transcription failed. Verify Python dependencies from requirements.txt, local model cache under storage/models, and Hugging Face connectivity when cache is incomplete. Details: ${detail}`
      );
    }
  }
}

interface RunTranscriptionOptions {
  python: string;
  provider: "whisperx" | "faster-whisper" | "crisper-whisper" | "stable-ts" | string;
  input: TranscriptionInput;
  language: string;
  initialPrompt: string;
  modelName: string;
  modelCacheDir: string;
  baseEnv: Record<string, string>;
}

async function runTranscriptionCommand(options: RunTranscriptionOptions) {
  const { python, provider, modelCacheDir, baseEnv, modelName, language } = options;

  try {
    return await runCommand(python, buildArgs(provider, options), { env: baseEnv });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (provider !== "whisperx" || !isHuggingFaceNetworkFailure(detail)) {
      throw error;
    }

    if (canRunWhisperxOffline(modelCacheDir, baseEnv.PYANNOTE_CACHE, modelName, language)) {
      return runCommand(python, buildArgs(provider, options), {
        env: {
          ...baseEnv,
          HF_HUB_OFFLINE: "1",
          TRANSFORMERS_OFFLINE: "1",
        },
      });
    }

    throw error;
  }
}

function buildArgs(provider: string, options: RunTranscriptionOptions) {
  const scriptPath = path.join(process.cwd(), "scripts", transcriptionScriptName(provider));
  const args = [scriptPath, "--audio", options.input.audioPath];

  if (provider === "faster-whisper") {
    args.push(
      "--model",
      options.modelName,
      "--device",
      process.env.WHISPER_DEVICE ?? "cpu",
      "--compute-type",
      process.env.WHISPER_COMPUTE_TYPE ?? "int8",
      "--language",
      options.language,
      "--download-root",
      options.modelCacheDir,
      "--initial-prompt",
      options.initialPrompt
    );
    args.push("--vad-filter", process.env.WHISPER_VAD_FILTER ?? "false");
    return args;
  }

  if (provider === "crisper-whisper") {
    args.push(
      "--model-id",
      process.env.CRISPER_MODEL_ID ?? "nyrahealth/CrisperWhisper",
      "--device",
      process.env.WHISPER_DEVICE ?? "cpu",
      "--language",
      options.language,
      "--download-root",
      options.modelCacheDir
    );
    if (process.env.CRISPER_BATCH_SIZE) {
      args.push("--batch-size", process.env.CRISPER_BATCH_SIZE);
    }
    if (process.env.CRISPER_CHUNK_LENGTH) {
      args.push("--chunk-length", process.env.CRISPER_CHUNK_LENGTH);
    }
    return args;
  }

  if (provider === "stable-ts") {
    args.push(
      "--model",
      options.modelName,
      "--device",
      process.env.WHISPER_DEVICE ?? "cpu",
      "--compute-type",
      process.env.WHISPER_COMPUTE_TYPE ?? "int8",
      "--language",
      options.language,
      "--download-root",
      options.modelCacheDir,
      "--initial-prompt",
      options.initialPrompt
    );
    args.push("--diarize", process.env.WHISPERX_DIARIZE ?? "true");
    const hfToken = process.env.PYANNOTE_AUTH_TOKEN ?? process.env.HUGGINGFACE_TOKEN ?? process.env.HF_TOKEN;
    if (hfToken) {
      args.push("--hf-token", hfToken);
    }
    if (process.env.PYANNOTE_MIN_SPEAKERS) {
      args.push("--min-speakers", process.env.PYANNOTE_MIN_SPEAKERS);
    }
    if (process.env.PYANNOTE_MAX_SPEAKERS) {
      args.push("--max-speakers", process.env.PYANNOTE_MAX_SPEAKERS);
    }
    return args;
  }

  args.push(
    "--model",
    options.modelName,
    "--device",
    process.env.WHISPER_DEVICE ?? "cpu",
    "--compute-type",
    process.env.WHISPER_COMPUTE_TYPE ?? "int8",
    "--language",
    options.language,
    "--download-root",
    options.modelCacheDir,
    "--initial-prompt",
    options.initialPrompt
  );

  args.push("--batch-size", process.env.WHISPERX_BATCH_SIZE ?? "8");
  args.push("--diarize", process.env.WHISPERX_DIARIZE ?? "true");
  const hfToken = process.env.PYANNOTE_AUTH_TOKEN ?? process.env.HUGGINGFACE_TOKEN ?? process.env.HF_TOKEN;
  if (hfToken) {
    args.push("--hf-token", hfToken);
  }
  if (process.env.PYANNOTE_MIN_SPEAKERS) {
    args.push("--min-speakers", process.env.PYANNOTE_MIN_SPEAKERS);
  }
  if (process.env.PYANNOTE_MAX_SPEAKERS) {
    args.push("--max-speakers", process.env.PYANNOTE_MAX_SPEAKERS);
  }
  return args;
}

function transcriptionScriptName(provider: string) {
  switch (provider) {
    case "faster-whisper":
      return "transcribe_faster_whisper.py";
    case "crisper-whisper":
      return "transcribe_crisper_whisper.py";
    case "stable-ts":
      return "transcribe_stable_ts.py";
    default:
      return "transcribe_whisperx.py";
  }
}

function isHuggingFaceNetworkFailure(detail: string) {
  const normalized = detail.toLowerCase();
  return (
    normalized.includes("huggingface.co") ||
    normalized.includes("httpsconnectionpool") ||
    normalized.includes("maxretryerror") ||
    normalized.includes("ssl") ||
    normalized.includes("unexpected_eof_while_reading") ||
    normalized.includes("certificate verify failed")
  );
}

function canRunWhisperxOffline(modelCacheDir: string, pyannoteCacheDir: string, modelName: string, language: string) {
  const required = [hasRequiredAsrCache(modelCacheDir, modelName), hasAlignmentCache(modelCacheDir, language)];
  const diarizeEnabled = (process.env.WHISPERX_DIARIZE ?? "true") === "true";
  if (diarizeEnabled) {
    required.push(hasPyannoteCache(modelCacheDir, pyannoteCacheDir));
  }
  return required.every(Boolean);
}

function hasRequiredAsrCache(modelCacheDir: string, modelName: string) {
  return hasModelCache(modelCacheDir, `Systran/faster-whisper-${modelName}`);
}

function hasAlignmentCache(modelCacheDir: string, language: string) {
  const alignRepo = whisperxAlignmentRepo(language);
  if (!alignRepo) return false;
  return hasModelCache(path.join(modelCacheDir, "hub"), alignRepo);
}

function hasPyannoteCache(modelCacheDir: string, pyannoteCacheDir: string) {
  return (
    hasModelCache(path.join(modelCacheDir, "hub"), "pyannote/speaker-diarization-3.1") ||
    hasModelCache(pyannoteCacheDir, "pyannote/speaker-diarization-3.1")
  );
}

function hasModelCache(rootDir: string, repoId: string) {
  const repoSlug = `models--${repoId.replaceAll("/", "--")}`;
  return hasDirectory(path.join(rootDir, repoSlug, "snapshots")) || hasDirectory(path.join(rootDir, repoSlug, "refs"));
}

function hasDirectory(dirPath: string) {
  try {
    return statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function whisperxAlignmentRepo(language: string) {
  switch (language) {
    case "ru":
      return "jonatasgrosman/wav2vec2-large-xlsr-53-russian";
    default:
      return undefined;
  }
}

function defaultPython() {
  return "python3";
}

/**
 * Extract JSON from stdout that may contain non-JSON text
 * (progress bars, tqdm output, warnings printed to stdout by Python libs).
 */
function parseJsonFromStdout(stdout: string): TranscriptJson {
  // Fast path: clean JSON
  const trimmed = stdout.trim();
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed) as TranscriptJson;
    } catch {
      // Fall through to extraction
    }
  }

  // Extract the JSON object from mixed output
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as TranscriptJson;
  }

  throw new Error(`Python script produced no valid JSON. Output starts with: ${trimmed.slice(0, 200)}`);
}
