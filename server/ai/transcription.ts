import path from "node:path";
import { mkdir } from "node:fs/promises";
import { runCommand } from "@/server/video/ffmpeg";
import type { TranscriptionInput, TranscriptionProvider, TranscriptJson } from "@/lib/types";
import { storageRoot } from "@/lib/storage";

const DEFAULT_INITIAL_PROMPT =
  "Это русская разговорная речь для короткого видео. Сохраняй междометия, паузы, слова-паразиты и вокализации: эээ, эм, ммм, ааа, ну, короче.";

export class LocalWhisperTranscriptionProvider implements TranscriptionProvider {
  async transcribe(input: TranscriptionInput): Promise<TranscriptJson> {
    const python = process.env.WHISPER_PYTHON ?? defaultPython();
    const provider = process.env.TRANSCRIPTION_PROVIDER ?? "whisperx";
    const scriptPath = path.join(
      process.cwd(),
      "scripts",
      provider === "faster-whisper" ? "transcribe_faster_whisper.py" : "transcribe_whisperx.py"
    );
    const language = input.language === "auto" ? "ru" : input.language;
    const initialPrompt = process.env.WHISPER_INITIAL_PROMPT ?? DEFAULT_INITIAL_PROMPT;
    const modelCacheDir = path.join(storageRoot(), "models", "huggingface");
    const args = [
      scriptPath,
      "--audio",
      input.audioPath,
      "--model",
      process.env.WHISPER_MODEL ?? "medium",
      "--device",
      process.env.WHISPER_DEVICE ?? "cpu",
      "--compute-type",
      process.env.WHISPER_COMPUTE_TYPE ?? "int8",
      "--language",
      language,
      "--download-root",
      modelCacheDir,
      "--initial-prompt",
      initialPrompt
    ];

    if (provider === "faster-whisper") {
      args.push("--vad-filter", process.env.WHISPER_VAD_FILTER ?? "false");
    } else {
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
    }

    try {
      await mkdir(modelCacheDir, { recursive: true });
      await mkdir(path.join(storageRoot(), "models", "nltk_data"), { recursive: true });
      const { stdout } = await runCommand(python, args, {
        env: {
          HF_HOME: modelCacheDir,
          HUGGINGFACE_HUB_CACHE: path.join(modelCacheDir, "hub"),
          XDG_CACHE_HOME: path.join(storageRoot(), "models", ".cache"),
          MPLCONFIGDIR: path.join(storageRoot(), "models", ".cache", "matplotlib"),
          TORCH_HOME: path.join(storageRoot(), "models", "torch"),
          PYANNOTE_CACHE: path.join(storageRoot(), "models", "pyannote"),
          NLTK_DATA: path.join(storageRoot(), "models", "nltk_data"),
        }
      });
      return parseJsonFromStdout(stdout);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `${provider} transcription failed. Install Python dependencies from requirements.txt and make sure the project storage folder is writable. Details: ${detail}`
      );
    }
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
