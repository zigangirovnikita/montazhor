import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { logProject } from "@/lib/logger";
import { pathsForProject, writeJsonFile } from "@/lib/storage";
import type { CleanupMode, ContentPlan, StylePreset } from "@/lib/types";
import type { VoiceCommandInput, VoiceCommandResult } from "@/lib/types";
import { LocalWhisperTranscriptionProvider } from "@/server/ai/transcription";

export class DeterministicVoiceCommandProcessor {
  async process(input: VoiceCommandInput): Promise<VoiceCommandResult> {
    const provider = new LocalWhisperTranscriptionProvider();
    const transcript = await provider.transcribe({ audioPath: input.audioPath, language: "auto" });
    const text = transcript.segments.map((segment) => segment.text).join(" ").trim();
    const normalized = text.toLowerCase();

    if (mentionsNoCards(normalized)) {
      const paths = pathsForProject(input.projectId);
      const contentPlan = JSON.parse(await readFile(paths.contentPlan, "utf8")) as ContentPlan;
      const nextPlan = { ...contentPlan, motionInserts: [] };
      await writeJsonFile(paths.contentPlan, nextPlan);
      await prisma.project.update({
        where: { id: input.projectId },
        data: { contentPlanJson: JSON.stringify(nextPlan) }
      });
      await logProject(input.projectId, "info", `Voice command applied: removed HyperFrames cards. Text: ${text}`);
      return { transcriptText: text, applied: true, message: "Все карточки HyperFrames убраны из черновика." };
    }

    const stylePreset = parseStylePreset(normalized);
    if (stylePreset) {
      await prisma.project.update({
        where: { id: input.projectId },
        data: { stylePreset }
      });
      await logProject(input.projectId, "info", `Voice command applied: style preset set to ${stylePreset}. Text: ${text}`);
      return { transcriptText: text, applied: true, message: `Стиль изменен на ${styleLabel(stylePreset)}.` };
    }

    const cleanupMode = parseCleanupMode(normalized);
    if (cleanupMode) {
      await prisma.project.update({
        where: { id: input.projectId },
        data: { cleanupMode }
      });
      await logProject(input.projectId, "info", `Voice command applied: cleanup mode set to ${cleanupMode}. Text: ${text}`);
      return {
        transcriptText: text,
        applied: true,
        message: `Режим чистки изменен: ${cleanupModeLabel(cleanupMode)}. Запусти анализ заново, чтобы пересобрать черновик.`
      };
    }

    return {
      transcriptText: text,
      applied: false,
      message:
        "Голосовая команда распознана, но такую правку пока небезопасно применять автоматически. Используй текст как подсказку для ручной корректировки."
    };
  }
}

function mentionsNoCards(text: string) {
  return (
    text.includes("убери встав") ||
    text.includes("без встав") ||
    text.includes("убери карточ") ||
    text.includes("без карточ") ||
    text.includes("remove cards") ||
    text.includes("no cards") ||
    text.includes("without cards")
  );
}

function parseStylePreset(text: string): StylePreset | null {
  if (text.includes("viral") || text.includes("вирал") || text.includes("динамич")) return "dynamic_viral";
  if (text.includes("premium") || text.includes("преми") || text.includes("спокой")) return "premium_calm";
  if (text.includes("clean") || text.includes("эксперт") || text.includes("чист")) return "clean_expert";
  return null;
}

function parseCleanupMode(text: string): CleanupMode | null {
  if (text.includes("только пауз")) return "pauses_only";
  if (text.includes("паузы и запин") || text.includes("речевой мусор")) return "pauses_and_fillers";
  if (text.includes("по смыслу") || text.includes("оставить только суть")) return "semantic_cleanup";
  return null;
}

function styleLabel(stylePreset: StylePreset) {
  if (stylePreset === "dynamic_viral") return "динамичный viral";
  if (stylePreset === "premium_calm") return "спокойный premium";
  return "чистый экспертный";
}

function cleanupModeLabel(cleanupMode: CleanupMode) {
  if (cleanupMode === "pauses_only") return "убрать только паузы";
  if (cleanupMode === "pauses_and_fillers") return "убрать паузы и запинки";
  return "убрать лишнее по смыслу";
}
