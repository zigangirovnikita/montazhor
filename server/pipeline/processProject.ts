import { readFile, unlink } from "node:fs/promises";
import { auditProjectEvent } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { logProject, updateProjectStatus } from "@/lib/logger";
import { ensureProjectStorage, pathsForProject, writeJsonFile } from "@/lib/storage";
import { resolveCleanupMode } from "@/lib/types";
import type { LanguageSetting, Platform, StylePreset } from "@/lib/types";
import { ElevenLabsTranscriptionProvider } from "@/server/ai/elevenLabsTranscription";
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
  await safeUnlink(paths.reviewCandidates);
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
  await auditProjectEvent(projectId, {
    phase: "media",
    step: "probe_video",
    kind: "metadata",
    summary: `Video metadata: ${metadata.duration.toFixed(2)}s, audio ${metadata.hasAudio ? "present" : "missing"}.`,
    payload: metadata,
  });
  await prisma.project.update({ where: { id: projectId }, data: { durationOriginal: metadata.duration } });
  await extractWhisperAudio(project.originalPath, paths.audio);
  await logProject(projectId, "info", "Audio extracted as WAV 16 kHz mono.");
  await auditProjectEvent(projectId, {
    phase: "media",
    step: "extract_audio",
    kind: "artifact",
    summary: "Audio extracted as WAV 16 kHz mono.",
    metadata: { audioPath: paths.audio },
  });

  await updateProjectStatus(projectId, "transcribing");
  const transcriptionProvider = process.env.TRANSCRIPTION_PROVIDER ?? "elevenlabs";
  await logProject(projectId, "info", `Transcription provider: ${transcriptionProvider}.`);
  const provider = transcriptionProvider === "elevenlabs"
    ? new ElevenLabsTranscriptionProvider()
    : new LocalWhisperTranscriptionProvider();
  const rawTranscript = await provider.transcribe({
    audioPath: paths.audio,
    language: project.language as LanguageSetting,
    projectId,
  });
  await auditProjectEvent(projectId, {
    phase: "transcription",
    step: "provider",
    kind: "transcript_before_mfa",
    summary: summarizeTranscriptForAudit(rawTranscript),
    metadata: { provider: rawTranscript.provider ?? transcriptionProvider },
    payload: rawTranscript,
  });
  const mfaRefinedTranscript = rawTranscript.provider === "elevenlabs"
    ? rawTranscript
    : await selectivelyRealignTranscriptWithMfa(
      rawTranscript,
      paths.audio,
      metadata.duration,
      (message) => logProject(projectId, "info", message)
    );
  await auditProjectEvent(projectId, {
    phase: "transcription",
    step: "mfa_refinement",
    kind: rawTranscript === mfaRefinedTranscript ? "skipped" : "result",
    summary: rawTranscript === mfaRefinedTranscript ? "MFA refinement skipped for ElevenLabs transcript." : summarizeTranscriptForAudit(mfaRefinedTranscript),
    payload: rawTranscript === mfaRefinedTranscript ? { reason: "provider_is_elevenlabs" } : mfaRefinedTranscript,
  });
  const transcriptVad = voiceActivityFromTranscript(mfaRefinedTranscript);
  if (transcriptVad?.mainSpeakerId) {
    await logProject(projectId, "info", `Diarization: main speaker ${transcriptVad.mainSpeakerId}, ${transcriptVad.speechRanges.length} speech ranges from WhisperX/pyannote.`);
  }
  await auditProjectEvent(projectId, {
    phase: "voice_activity",
    step: "transcript_diarization",
    kind: transcriptVad ? "result" : "skipped",
    summary: transcriptVad ? `${transcriptVad.provider}: ${transcriptVad.speechRanges.length} speech ranges.` : "No speaker diarization ranges in transcript.",
    payload: transcriptVad ?? { reason: "no_main_speaker_ranges" },
  });
  const sileroVad = await detectVadForTimingNormalization(paths.audio, projectId);
  await auditProjectEvent(projectId, {
    phase: "voice_activity",
    step: "external_vad",
    kind: sileroVad ? "result" : "unavailable",
    summary: sileroVad ? `${sileroVad.provider}: ${sileroVad.speechRanges.length} speech ranges.` : "External VAD unavailable.",
    payload: sileroVad ?? { reason: "detectVoiceActivity_failed" },
  });
  const vad = mergeVoiceActivityMaps(transcriptVad, sileroVad);
  await auditProjectEvent(projectId, {
    phase: "voice_activity",
    step: "merge_vad",
    kind: vad ? "result" : "unavailable",
    summary: vad ? `Merged VAD source ${vad.provider}: ${vad.speechRanges.length} speech ranges.` : "No VAD map available after merge.",
    payload: vad ?? { reason: "no_transcript_or_external_vad" },
  });
  const { transcript, stats: timingStats } = normalizeTranscriptTimings(mfaRefinedTranscript, {
    duration: metadata.duration,
    speechRanges: vad?.speechRanges,
  });
  await logProject(projectId, "info", formatTranscriptTimingStats(timingStats));
  await auditProjectEvent(projectId, {
    phase: "transcript_timing",
    step: "normalize",
    kind: "input",
    summary: summarizeTranscriptForAudit(mfaRefinedTranscript),
    payload: mfaRefinedTranscript,
  });
  await auditProjectEvent(projectId, {
    phase: "transcript_timing",
    step: "normalize",
    kind: "result",
    summary: formatTranscriptTimingStats(timingStats),
    metadata: { stats: timingStats },
    payload: { stats: timingStats, transcript },
  });
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
  await auditProjectEvent(projectId, {
    phase: "transcription",
    step: "persist_transcript",
    kind: "artifact",
    summary: `Normalized transcript saved to ${paths.transcript}.`,
    metadata: { path: paths.transcript },
    payload: transcript,
  });

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
  await auditProjectEvent(projectId, {
    phase: "cutting",
    step: "persist_edl",
    kind: "artifact",
    summary: summarizeEdlForAudit(edl),
    metadata: { path: paths.edl },
    payload: edl,
  });

  await updateProjectStatus(projectId, "rendering_clean_video");
  await renderCleanCut(project.originalPath, edl, paths.cleanVideo, profile);
  await prisma.renderAsset.create({ data: { projectId, type: "clean_preview", path: paths.cleanVideo } });
  await logProject(projectId, "info", "Clean cut preview is ready.");

  const subtitles = buildSubtitleDraft(transcript);
  await writeJsonFile(paths.subtitlesDraft, subtitles);
  await auditProjectEvent(projectId, {
    phase: "subtitles",
    step: "draft",
    kind: "artifact",
    summary: `Subtitle draft saved: ${subtitles.length} cues.`,
    metadata: { path: paths.subtitlesDraft },
    payload: subtitles,
  });

  const planner = new HeuristicContentPlanner();
  const contentPlan = await planner.plan({
    transcript,
    edl,
    platform: project.platform as Platform,
    stylePreset: project.stylePreset as StylePreset
  });
  await writeJsonFile(paths.contentPlan, contentPlan);
  await auditProjectEvent(projectId, {
    phase: "content_plan",
    step: "heuristic_planner",
    kind: "result",
    summary: `Content plan generated: ${contentPlan.hook || "no hook"}.`,
    metadata: { path: paths.contentPlan },
    payload: contentPlan,
  });
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
    await auditProjectEvent(projectId, {
      phase: "voice_activity",
      step: "external_vad",
      kind: "failed",
      summary: `External VAD failed: ${message}`,
      payload: { error: message },
    });
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

function summarizeTranscriptForAudit(transcript: { segments: Array<{ words?: unknown[] }> }) {
  const words = transcript.segments.reduce((count, segment) => count + (segment.words?.length ?? 0), 0);
  return `Transcript: ${transcript.segments.length} segments, ${words} words.`;
}

function summarizeEdlForAudit(edl: { keptRanges: Array<{ sourceStart: number; sourceEnd: number }>; removedRanges: Array<{ sourceStart: number; sourceEnd: number }> }) {
  const keptSeconds = edl.keptRanges.reduce((sum, range) => sum + Math.max(0, range.sourceEnd - range.sourceStart), 0);
  const removedSeconds = edl.removedRanges.reduce((sum, range) => sum + Math.max(0, range.sourceEnd - range.sourceStart), 0);
  return `EDL: ${edl.keptRanges.length} kept (${keptSeconds.toFixed(2)}s), ${edl.removedRanges.length} removed (${removedSeconds.toFixed(2)}s).`;
}

async function safeUnlink(filePath: string) {
  try {
    await unlink(filePath);
  } catch {
    // File may not exist yet — that's fine
  }
}
