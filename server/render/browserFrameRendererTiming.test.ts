import { describe, expect, it } from "vitest";
import {
  buildFrameTimeline,
  frameIndexToTimestamp,
  resolveCameraStateAtTime,
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

  it("builds timeline with stable frame count", () => {
    const plan: BrowserFrameRenderPlan = {
      fps: 20,
      width: 1080,
      height: 1920,
      duration: 2,
      captionStyle: "bold-yellow",
      captions: [],
      cameraMoves: []
    };

    const timeline = buildFrameTimeline(plan);
    expect(timeline).toHaveLength(40);
    expect(timeline[0]?.time).toBe(0);
    expect(timeline.at(-1)?.time).toBe(1.95);
  });
});
