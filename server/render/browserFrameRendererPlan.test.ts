import { describe, expect, it } from "vitest";
import {
  buildDemoBrowserFrameRenderPlan,
  parseBrowserFrameRenderPlan
} from "./browserFrameRendererPlan";

describe("browserFrameRendererPlan", () => {
  it("rejects plan durations above poc limit", () => {
    expect(() =>
      parseBrowserFrameRenderPlan({
        fps: 20,
        width: 1080,
        height: 1920,
        duration: 18,
        captions: [],
        cameraMoves: []
      })
    ).toThrow(/15/);
  });

  it("rejects caption words outside caption bounds", () => {
    expect(() =>
      parseBrowserFrameRenderPlan({
        fps: 20,
        width: 1080,
        height: 1920,
        duration: 8,
        captions: [
          {
            id: "cap-1",
            start: 0,
            end: 2,
            text: "hello world",
            words: [{ text: "hello", start: 0, end: 2.2 }]
          }
        ],
        cameraMoves: []
      })
    ).toThrow(/caption bounds/i);
  });

  it("builds a valid demo plan", () => {
    const plan = buildDemoBrowserFrameRenderPlan({
      width: 1080,
      height: 1920,
      duration: 12
    });

    expect(plan.fps).toBe(20);
    expect(plan.duration).toBe(12);
    expect(plan.captions.length).toBeGreaterThan(0);
    expect(plan.cameraMoves.length).toBe(1);
  });
});
