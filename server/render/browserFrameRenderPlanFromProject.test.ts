import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SubtitleDraft, TranscriptWord } from "@/lib/types";
import type { BrowserFrameWord } from "./browserFrameRendererPlan";
import {
  buildBrowserFrameRenderPlanFromProject,
  buildCameraMoves,
  buildCaptionsForBrowserPlan,
  chunkSubtitleWords,
  selectHighlightedWords,
  splitCaptionLines
} from "./browserFrameRenderPlanFromProject";

const { probeVideoMock } = vi.hoisted(() => ({
  probeVideoMock: vi.fn(async () => ({
    duration: 14.2,
    width: 1080,
    height: 1920,
    fps: 25,
    hasAudio: true
  }))
}));

const { detectActiveVideoBoxMock } = vi.hoisted(() => ({
  detectActiveVideoBoxMock: vi.fn(async (): Promise<{
    activeVideoBox: {
      detected: boolean;
      x: number;
      y: number;
      width: number;
      height: number;
      source: "frame_black_bar_detection" | "full_frame_fallback";
    };
    captionSafeArea: {
      x: number;
      y: number;
      width: number;
      height: number;
      marginX: number;
      marginBottom: number;
    };
  }> => ({
    activeVideoBox: {
      detected: false,
      x: 0,
      y: 0,
      width: 1080,
      height: 1920,
      source: "full_frame_fallback" as const
    },
    captionSafeArea: {
      x: 49,
      y: 0,
      width: 982,
      height: 1780,
      marginX: 49,
      marginBottom: 140
    }
  }))
}));

vi.mock("../video/metadata", () => ({
  probeVideo: probeVideoMock
}));

vi.mock("./browserFrameActiveBox", () => ({
  detectActiveVideoBox: detectActiveVideoBoxMock
}));

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("browserFrameRenderPlanFromProject", () => {
  it("builds render plan from mock project artifacts", async () => {
    probeVideoMock.mockResolvedValueOnce({
      duration: 14.2,
      width: 1080,
      height: 1920,
      fps: 25,
      hasAudio: true
    });
    const projectDir = await mkdtemp(path.join(os.tmpdir(), "montazhor-browser-plan-"));
    tempDirs.push(projectDir);
    await mkdir(projectDir, { recursive: true });
    await writeFile(path.join(projectDir, "clean.mp4"), "");
    await writeFile(path.join(projectDir, "transcript.json"), JSON.stringify(makeTranscript(), null, 2));
    await writeFile(path.join(projectDir, "edl.json"), JSON.stringify(makeEdl(), null, 2));
    await writeFile(path.join(projectDir, "subtitles-draft.json"), JSON.stringify(makeSubtitles(), null, 2));

    const result = await buildBrowserFrameRenderPlanFromProject({
      projectDir,
      captionStyle: "clean-white"
    });

    expect(result.artifacts.cleanVideoPath).toContain("clean.mp4");
    expect(result.plan.captionStyle).toBe("clean-white");
    expect(result.plan.duration).toBe(14.2);
    expect(result.plan.captions.length).toBeGreaterThanOrEqual(2);
    expect(result.plan.cameraMoves).toHaveLength(0);
    expect(result.plan.diagnostics.captionSource).toBe("transcript_edl_clean_time");
    expect(result.plan.diagnostics.edlApplied).toBe(true);
    expect(result.plan.diagnostics.subtitlesDraftUsed).toBe(false);
    expect(result.plan.diagnostics.activeVideoBox.detected).toBe(false);
    expect(result.plan.diagnostics.captionSafeArea.width).toBeGreaterThan(0);
    expect(result.planPath).toBe(path.join(projectDir, "browser-render-plan.json"));
  });

  it("preserves vertical video dimensions", async () => {
    probeVideoMock.mockResolvedValueOnce({
      duration: 10,
      width: 1080,
      height: 1920,
      fps: 25,
      hasAudio: true
    });
    const projectDir = await makeProjectFixture();
    const result = await buildBrowserFrameRenderPlanFromProject({ projectDir });
    expect(result.plan.width).toBe(1080);
    expect(result.plan.height).toBe(1920);
    expect(result.plan.diagnostics.output.width).toBe(1080);
    expect(result.plan.diagnostics.output.height).toBe(1920);
  });

  it("preserves horizontal video dimensions", async () => {
    detectActiveVideoBoxMock.mockResolvedValueOnce({
      activeVideoBox: {
        detected: false,
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        source: "full_frame_fallback"
      },
      captionSafeArea: {
        x: 72,
        y: 0,
        width: 1776,
        height: 940,
        marginX: 72,
        marginBottom: 140
      }
    });
    probeVideoMock.mockResolvedValueOnce({
      duration: 10,
      width: 1920,
      height: 1080,
      fps: 25,
      hasAudio: true
    });
    const projectDir = await makeProjectFixture();
    const result = await buildBrowserFrameRenderPlanFromProject({ projectDir });
    expect(result.plan.width).toBe(1920);
    expect(result.plan.height).toBe(1080);
  });

  it("uses caption safe area from detected active box", async () => {
    detectActiveVideoBoxMock.mockResolvedValueOnce({
      activeVideoBox: {
        detected: true,
        x: 420,
        y: 0,
        width: 1080,
        height: 1080,
        source: "frame_black_bar_detection"
      },
      captionSafeArea: {
        x: 468,
        y: 0,
        width: 984,
        height: 960,
        marginX: 48,
        marginBottom: 120
      }
    });
    probeVideoMock.mockResolvedValueOnce({
      duration: 10,
      width: 1920,
      height: 1080,
      fps: 25,
      hasAudio: true
    });
    const projectDir = await makeProjectFixture();
    const result = await buildBrowserFrameRenderPlanFromProject({ projectDir });

    expect(result.plan.diagnostics.activeVideoBox.detected).toBe(true);
    expect(result.plan.diagnostics.activeVideoBox.x).toBe(420);
    expect(result.plan.diagnostics.captionSafeArea.x).toBe(468);
    expect(result.plan.diagnostics.captionSafeArea.width).toBe(984);
  });

  it("chunks long subtitle words into smaller browser captions", () => {
    const chunks = chunkSubtitleWords([
      word("Это", 0, 0.3),
      word("одна", 0.31, 0.6),
      word("очень", 0.61, 0.9),
      word("длинная", 0.91, 1.25),
      word("фраза", 1.26, 1.6),
      word("про", 1.61, 1.82),
      word("систему", 1.83, 2.1),
      word("и", 2.11, 2.2),
      word("деньги", 2.21, 2.55)
    ]);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 7)).toBe(true);
  });

  it("splits caption text into at most two balanced lines", () => {
    const lines = splitCaptionLines(["Это", "важная", "система", "которая", "экономит", "деньги"]);
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(lines[0]?.length ?? 0).toBeLessThanOrEqual(34);
    expect(lines[1]?.length ?? 0).toBeLessThanOrEqual(34);
  });

  it("selects highlight words by priority", () => {
    const result = selectHighlightedWords([
      word("10%", 0, 0.2),
      word("система", 0.2, 0.5),
      word("важно", 0.5, 0.8),
      word("текст", 0.8, 1)
    ]);

    expect(result).toEqual(["10%", "важно"]);
  });

  it("builds calm camera move sequence across duration", () => {
    const moves = buildCameraMoves(12);
    expect(moves.length).toBeGreaterThanOrEqual(4);
    expect(moves[0]?.scaleTo ?? 0).toBeGreaterThan(1);
    expect(moves.at(-1)?.end).toBe(12);
  });

  it("builds browser captions with highlight words preserved", () => {
    const result = buildCaptionsForBrowserPlan(makeSubtitles(), 8);
    expect(result.captions.length).toBeGreaterThan(1);
    expect(result.captions.some((caption) => caption.highlightedWords.length > 0)).toBe(true);
    expect(result.captions.some((caption) => caption.highlightedWords.includes("10%") || caption.highlightedWords.includes("результат"))).toBe(true);
  });

  it("skips filler-only chunks", () => {
    const result = buildCaptionsForBrowserPlan([
      {
        id: "sub-filler",
        start: 0,
        end: 1,
        text: "Ааа",
        words: [transcriptWord("Ааа", 0, 0.5)],
        highlightedWords: []
      }
    ], 2);

    expect(result.captions).toHaveLength(0);
  });

  it("camera moves can be enabled explicitly", async () => {
    probeVideoMock.mockResolvedValueOnce({
      duration: 10,
      width: 1080,
      height: 1920,
      fps: 25,
      hasAudio: true
    });
    const projectDir = await makeProjectFixture();
    const result = await buildBrowserFrameRenderPlanFromProject({ projectDir, enableCameraMoves: true });
    expect(result.plan.cameraMoves.length).toBeGreaterThan(0);
    expect(result.plan.diagnostics.cameraMovesEnabled).toBe(true);
  });

  it("subtitles draft is fallback only when transcript or edl is missing", async () => {
    probeVideoMock.mockResolvedValueOnce({
      duration: 10,
      width: 1080,
      height: 1920,
      fps: 25,
      hasAudio: true
    });
    const projectDir = await mkdtemp(path.join(os.tmpdir(), "montazhor-browser-plan-"));
    tempDirs.push(projectDir);
    await mkdir(projectDir, { recursive: true });
    await writeFile(path.join(projectDir, "clean.mp4"), "");
    await writeFile(path.join(projectDir, "subtitles-draft.json"), JSON.stringify(makeSubtitles(), null, 2));

    const result = await buildBrowserFrameRenderPlanFromProject({ projectDir });
    expect(result.plan.diagnostics.captionSource).toBe("subtitles_draft_fallback");
    expect(result.plan.diagnostics.edlApplied).toBe(false);
    expect(result.plan.diagnostics.subtitlesDraftUsed).toBe(true);
    expect(result.plan.diagnostics.warnings).toContain("subtitles_draft_fallback_used");
  });
});

async function makeProjectFixture() {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), "montazhor-browser-plan-"));
  tempDirs.push(projectDir);
  await mkdir(projectDir, { recursive: true });
  await writeFile(path.join(projectDir, "clean.mp4"), "");
  await writeFile(path.join(projectDir, "transcript.json"), JSON.stringify(makeTranscript(), null, 2));
  await writeFile(path.join(projectDir, "edl.json"), JSON.stringify(makeEdl(), null, 2));
  return projectDir;
}

function makeSubtitles(): SubtitleDraft[] {
  return [
    {
      id: "sub-0",
      start: 0,
      end: 2.8,
      text: "Это важная система экономит деньги быстро",
      words: [
        transcriptWord("Это", 0, 0.3),
        transcriptWord("важная", 0.31, 0.7),
        transcriptWord("система", 0.71, 1.1),
        transcriptWord("экономит", 1.11, 1.5),
        transcriptWord("деньги", 1.51, 1.85),
        transcriptWord("быстро", 1.86, 2.2)
      ],
      highlightedWords: []
    },
    {
      id: "sub-1",
      start: 2.9,
      end: 5.5,
      text: "Результат десять процентов ошибок меньше",
      words: [
        transcriptWord("Результат", 2.9, 3.3),
        transcriptWord("10%", 3.31, 3.6),
        transcriptWord("ошибок", 3.61, 4.1),
        transcriptWord("меньше", 4.11, 4.5)
      ],
      highlightedWords: []
    }
  ];
}

function word(text: string, start: number, end: number): BrowserFrameWord {
  return { text, start, end };
}

function transcriptWord(word: string, start: number, end: number): TranscriptWord {
  return { word, start, end };
}

function makeTranscript() {
  return {
    language: "ru",
    segments: [
      {
        id: 0,
        start: 0,
        end: 5.5,
        text: "Это важная система экономит деньги быстро Результат десять процентов ошибок меньше",
        words: [
          transcriptWord("Это", 0, 0.3),
          transcriptWord("важная", 0.31, 0.7),
          transcriptWord("система", 0.71, 1.1),
          transcriptWord("экономит", 1.11, 1.5),
          transcriptWord("деньги", 1.51, 1.85),
          transcriptWord("быстро", 1.86, 2.2),
          transcriptWord("Результат", 2.9, 3.3),
          transcriptWord("10%", 3.31, 3.6),
          transcriptWord("ошибок", 3.61, 4.1),
          transcriptWord("меньше", 4.11, 4.5)
        ]
      }
    ]
  };
}

function makeEdl() {
  return {
    keptRanges: [
      { sourceStart: 0, sourceEnd: 2.2, reason: "speech" },
      { sourceStart: 2.9, sourceEnd: 4.5, reason: "speech" }
    ],
    removedRanges: []
  };
}
