import { readFile, unlink } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { logProject, updateProjectStatus } from "@/lib/logger";
import { ensureProjectStorage, pathsForProject, writeJsonFile } from "@/lib/storage";
import { resolveCleanupMode } from "@/lib/types";
import type { LanguageSetting, Platform, StylePreset } from "@/lib/types";
import { LocalWhisperTranscriptionProvider } from "@/server/ai/transcription";
import { HeuristicContentPlanner } from "@/server/ai/contentPlanner";
import { selectivelyRealignTranscriptWithMfa } from "@/server/ai/mfaAlignment";
import { logProjectAiUsageSummary } from "@/server/ai/usage";
import { detectVoiceActivity, mergeVoiceActivityMaps, voiceActivityFromTranscript } from "@/server/ai/voiceActivity";
import { formatTranscriptTimingStats, normalizeTranscriptTimings } from "@/server/ai/transcriptTiming";
import { assertFfmpegAvailable } from "@/server/video/ffmpeg";
import { extractWhisperAudio } from "@/server/video/audio";
import { probeVideo } from "@/server/video/metadata";
import { resolveVideoProfile } from "@/server/video/profile";

import { buildSubtitleDraft } from "@/server/video/subtitles";
import { renderCleanCut } from "@/server/video/cutting";
import { planCuts } from "@/server/pipeline/steps/planCuts";

export async function processProjectAnalyze(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const paths = await ensureProjectStorage(projectId);
  await logProject(projectId, "info", "Analysis started.");
  await assertFfmpegAvailable();

  // Clean up stale records from previous analysis runs
  await prisma.transcript.deleteMany({ where: { projectId } });
  await prisma.editDecision.deleteMany({ where: { projectId } });
  await prisma.renderAsset.deleteMany({ where: { projectId } });
  await safeUnlink(paths.cleanVideo);
  await safeUnlink(paths.reviewVideo);
  await prisma.project.update({
    where: { id: projectId },
    data: {
      reviewVideoPath: null,
      durationFinal: null
    }
  });

  await updateProjectStatus(projectId, "extracting_audio");
  const metadata = await probeVideo(project.originalPath);
  const profile = resolveVideoProfile(metadata);
  if (!metadata.hasAudio) {
    throw new Error("Uploaded video has no audio track. Montazhor requires a video with speech to process.");
  }
  await writeJsonFile(paths.metadata, metadata);
  await prisma.project.update({ where: { id: projectId }, data: { durationOriginal: metadata.duration } });
  await extractWhisperAudio(project.originalPath, paths.audio);
  await logProject(projectId, "info", "Audio extracted as WAV 16 kHz mono.");

  await updateProjectStatus(projectId, "transcribing");
  const provider = new LocalWhisperTranscriptionProvider();
  const rawTranscript = await provider.transcribe({
    audioPath: paths.audio,
    language: project.language as LanguageSetting
  });
  const mfaRefinedTranscript = await selectivelyRealignTranscriptWithMfa(
    rawTranscript,
    paths.audio,
    metadata.duration,
    (message) => logProject(projectId, "info", message)
  );
  const transcriptVad = voiceActivityFromTranscript(mfaRefinedTranscript);
  if (transcriptVad?.mainSpeakerId) {
    await logProject(projectId, "info", `Diarization: main speaker ${transcriptVad.mainSpeakerId}, ${transcriptVad.speechRanges.length} speech ranges from WhisperX/pyannote.`);
  }
  const sileroVad = await detectVadForTimingNormalization(paths.audio, projectId);
  const vad = mergeVoiceActivityMaps(transcriptVad, sileroVad);
  const { transcript, stats: timingStats } = normalizeTranscriptTimings(mfaRefinedTranscript, {
    duration: metadata.duration,
    speechRanges: vad?.speechRanges,
  });
  await logProject(projectId, "info", formatTranscriptTimingStats(timingStats));
  await writeJsonFile(paths.transcript, transcript);
  await prisma.transcript.create({
    data: {
      projectId,
      language: transcript.language,
      jsonPath: paths.transcript,
      text: transcript.segments.map((segment) => segment.text).join(" ")
    }
  });
  await logProject(projectId, "info", "Transcript generated.");

  await updateProjectStatus(projectId, "planning");
  const cleanupMode = resolveCleanupMode(project.cleanupMode);
  await logProject(projectId, "info", `Cleanup mode: ${cleanupMode}.`);
  const edl = await planCuts(
    transcript,
    metadata.duration,
    cleanupMode,
    (msg) => logProject(projectId, "info", msg),
    paths.audio,
    vad,
    sileroVad,
    projectId
  );
  await writeJsonFile(paths.edl, edl);
  await prisma.editDecision.create({ data: { projectId, jsonPath: paths.edl } });

  await updateProjectStatus(projectId, "rendering_clean_video");
  await renderCleanCut(project.originalPath, edl, paths.cleanVideo, profile);
  await prisma.renderAsset.create({ data: { projectId, type: "clean_preview", path: paths.cleanVideo } });
  await logProject(projectId, "info", "Clean cut preview is ready.");

  const subtitles = buildSubtitleDraft(transcript);
  await writeJsonFile(paths.subtitlesDraft, subtitles);

  const planner = new HeuristicContentPlanner();
  const contentPlan = await planner.plan({
    transcript,
    edl,
    platform: project.platform as Platform,
    stylePreset: project.stylePreset as StylePreset
  });
  await writeJsonFile(paths.contentPlan, contentPlan);
  await prisma.project.update({
    where: { id: projectId },
    data: { contentPlanJson: JSON.stringify(contentPlan), status: "draft_ready" }
  });
  await logProjectAiUsageSummary(projectId);
  await logProject(projectId, "info", "Draft proposal is ready for review.");
}

async function detectVadForTimingNormalization(audioPath: string, projectId: string) {
  try {
    return await detectVoiceActivity(audioPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logProject(projectId, "info", `Transcript timing normalization: diarization/VAD unavailable, using transcript segment boundaries only. Reason: ${message}`);
    return undefined;
  }
}

export async function readDraftProposal(projectId: string) {
  const paths = pathsForProject(projectId);
  const [transcript, edl, subtitles, contentPlan, visualPlan] = await Promise.all([
    readJson(paths.transcript),
    readJson(paths.edl),
    readJson(paths.subtitlesDraft),
    readJson(paths.contentPlan),
    readJson(paths.visualPlan).catch(() => null)
  ]);
  return { projectId, transcript, edl, subtitles, contentPlan, visualPlan };
}

async function readJson(filePath: string) {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

async function safeUnlink(filePath: string) {
  try {
    await unlink(filePath);
  } catch {
    // File may not exist yet — that's fine
  }
}
