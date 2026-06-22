import { describe, expect, it } from "vitest";
import { computeLivePreviewScale, resolvePreviewFontSize, scaleCssPxString, scalePreviewPx } from "./livePreviewSizing";

describe("livePreviewSizing", () => {
  it("scales canonical pixels by rendered preview size", () => {
    expect(computeLivePreviewScale({
      frameWidth: 1080,
      frameHeight: 1920,
      stageWidth: 270,
      stageHeight: 480
    })).toBeCloseTo(0.25);
    expect(scalePreviewPx(72, 0.25)).toBeCloseTo(18);
  });

  it("resolves clamp font sizes against the canonical frame instead of browser viewport", () => {
    expect(resolvePreviewFontSize("clamp(1.9rem, 4vw, 3.8rem)", 1080, 0.5)).toBe("21.6px");
    expect(resolvePreviewFontSize("clamp(2rem, 4.4vw, 4.2rem)", 1920, 0.25)).toBe("16.8px");
  });

  it("scales px values embedded inside css strings", () => {
    expect(scaleCssPxString("0 24px 48px rgba(0,0,0,0.22)", 0.5)).toBe("0 12px 24px rgba(0,0,0,0.22)");
    expect(scaleCssPxString("blur(16px)", 0.25)).toBe("blur(4px)");
  });
});
