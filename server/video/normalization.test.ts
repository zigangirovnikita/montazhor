import { describe, expect, it } from "vitest";
import { buildCropFilter, resolveNormalizationPlan } from "./normalization";

describe("video normalization", () => {
  it("keeps native portrait metadata unchanged", () => {
    const plan = resolveNormalizationPlan({ width: 1080, height: 1920 });

    expect(plan.profile.orientation).toBe("portrait");
    expect(plan.crop).toBeUndefined();
    expect(plan.source).toBe("metadata");
  });

  it("detects pillarboxed portrait content inside landscape video", () => {
    const plan = resolveNormalizationPlan(
      { width: 1920, height: 1080 },
      {
        detected: true,
        x: 656,
        y: 0,
        width: 608,
        height: 1080,
        source: "frame_black_bar_detection"
      }
    );

    expect(plan.profile.orientation).toBe("portrait");
    expect(plan.crop).toEqual({
      x: 656,
      y: 0,
      width: 608,
      height: 1080
    });
    expect(plan.source).toBe("pillarboxed_portrait_active_box");
  });

  it("does not crop regular landscape video", () => {
    const plan = resolveNormalizationPlan(
      { width: 1920, height: 1080 },
      {
        detected: false,
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        source: "full_frame_fallback"
      }
    );

    expect(plan.profile.orientation).toBe("landscape");
    expect(plan.crop).toBeUndefined();
    expect(plan.source).toBe("metadata");
  });

  it("builds ffmpeg crop filter from detected active box", () => {
    expect(buildCropFilter({ x: 656, y: 0, width: 608, height: 1080 })).toBe("crop=608:1080:656:0");
  });
});
