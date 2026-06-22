import { describe, expect, it } from "vitest";
import {
  buildDemoBrowserFrameRenderPlan,
  parseBrowserFrameRenderPlan
} from "./browserFrameRendererPlan";

describe("browserFrameRendererPlan", () => {
  it("rejects plan durations above renderer hard limit", () => {
    expect(() =>
      parseBrowserFrameRenderPlan({
        fps: 20,
        width: 1080,
        height: 1920,
        duration: 4000,
        captions: [],
        cameraMoves: [],
        diagnostics: {
          sourceVideo: { width: 1080, height: 1920, duration: 4000 },
          output: { width: 1080, height: 1920, fps: 20 },
          captionSource: "demo",
          edlApplied: false,
          subtitlesDraftUsed: false,
          cameraMovesEnabled: false,
          warnings: []
        }
      })
    ).toThrow(/3600/);
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
            lines: ["hello world"],
            words: [{ text: "hello", start: 0, end: 2.2 }]
          }
        ],
        cameraMoves: [],
        diagnostics: {
          sourceVideo: { width: 1080, height: 1920, duration: 8 },
          output: { width: 1080, height: 1920, fps: 20 },
          captionSource: "demo",
          edlApplied: false,
          subtitlesDraftUsed: false,
          cameraMovesEnabled: false,
          warnings: []
        }
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
    expect(plan.captionStyle).toBe("bold-yellow");
    expect(plan.captionDesign.variant).toBe("viral");
    expect(plan.captions.length).toBeGreaterThan(0);
    expect(plan.cameraMoves.length).toBe(1);
    expect(plan.diagnostics.activeVideoBox.source).toBe("full_frame_fallback");
    expect(plan.diagnostics.captionSafeArea.width).toBeGreaterThan(0);
  });
});
