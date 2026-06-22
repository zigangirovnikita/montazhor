import { describe, expect, it } from "vitest";
import { buildCaptionDesignFromLegacyStyle } from "../../lib/captionDesign";
import {
  buildFrameTimeline,
  frameIndexToTimestamp,
  resolveCameraStateAtTime,
  resolveVisualBeatAtTime,
  secondsToFrameCount
} from "./browserFrameRendererTiming";
import type { BrowserFrameRenderPlan } from "./browserFrameRendererPlan";

describe("browserFrameRendererTiming", () => {
  it("maps duration to frame count at 20 fps", () => {
    expect(secondsToFrameCount(10, 20)).toBe(200);
    expect(secondsToFrameCount(10.01, 20)).toBe(200);
  });

  it("converts frame index to timestamp", () => {
    expect(frameIndexToTimestamp(0, 20, 10)).toBe(0);
    expect(frameIndexToTimestamp(199, 20, 10)).toBe(9.95);
    expect(frameIndexToTimestamp(250, 20, 10)).toBe(10);
  });

  it("interpolates camera move state", () => {
    const state = resolveCameraStateAtTime([
      {
        id: "cam-1",
        start: 0,
        end: 10,
        motionProfile: "steady",
        scaleFrom: 1,
        scaleTo: 1.1,
        xFrom: 0,
        xTo: 0.1,
        yFrom: 0,
        yTo: -0.1
      }
    ], 5);

    expect(state).not.toBeNull();
    expect(state?.scale ?? 0).toBeGreaterThan(1);
    expect(state?.x ?? 0).toBeGreaterThan(0);
    expect(state?.y ?? 0).toBeLessThan(0);
  });

  it("delays motion for late punch profile", () => {
    const early = resolveCameraStateAtTime([
      {
        id: "cam-late",
        start: 0,
        end: 10,
        motionProfile: "late_punch",
        scaleFrom: 1.03,
        scaleTo: 1.14,
        xFrom: 0,
        xTo: 0.04,
        yFrom: 0,
        yTo: -0.02
      }
    ], 3);
    const late = resolveCameraStateAtTime([
      {
        id: "cam-late",
        start: 0,
        end: 10,
        motionProfile: "late_punch",
        scaleFrom: 1.03,
        scaleTo: 1.14,
        xFrom: 0,
        xTo: 0.04,
        yFrom: 0,
        yTo: -0.02
      }
    ], 8.5);

    expect(early?.scale).toBeLessThan(1.05);
    expect(late?.scale ?? 0).toBeGreaterThan(1.1);
    expect((late?.x ?? 0)).toBeGreaterThan((early?.x ?? 0));
  });

  it("resolves active visual beat by time", () => {
    const beat = resolveVisualBeatAtTime([
      {
        id: "v1",
        start: 1,
        end: 2.4,
        templateId: "big_number",
        layout: "right",
        payload: { value: "25%", label: "рост" },
        priority: 2
      }
    ], 1.5);

    expect(beat?.templateId).toBe("big_number");
  });

  it("builds timeline with stable frame count", () => {
    const plan: BrowserFrameRenderPlan = {
      fps: 20,
      width: 1080,
      height: 1920,
      duration: 2,
      captionStyle: "bold-yellow",
      captionDesign: buildCaptionDesignFromLegacyStyle("bold-yellow"),
      captions: [],
      visualBeats: [],
      cameraMoves: [],
      diagnostics: {
        sourceVideo: { width: 1080, height: 1920, duration: 2 },
        output: { width: 1080, height: 1920, fps: 20 },
        captionSource: "demo",
        edlApplied: false,
        subtitlesDraftUsed: false,
        cameraMovesEnabled: false,
        warnings: [],
        activeVideoBox: {
          detected: false,
          x: 0,
          y: 0,
          width: 1080,
          height: 1920,
          source: "full_frame_fallback"
        },
        captionSafeArea: {
          x: 49,
          y: 0,
          width: 982,
          height: 1780,
          marginX: 49,
          marginBottom: 140
        }
      }
    };

    const timeline = buildFrameTimeline(plan);
    expect(timeline).toHaveLength(40);
    expect(timeline[0]?.time).toBe(0);
    expect(timeline.at(-1)?.time).toBe(1.95);
  });
});
