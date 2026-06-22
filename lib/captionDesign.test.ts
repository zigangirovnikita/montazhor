import { describe, expect, it } from "vitest";
import { buildCaptionDesign } from "./captionDesign";

describe("captionDesign recipe defaults", () => {
  it("inherits caption design defaults from styleRecipeId", () => {
    const design = buildCaptionDesign("dynamic_viral", {
      styleRecipeId: "neon-pulse"
    });

    expect(design.fontFamily).toContain("HF Unbounded");
    expect(design.enterAnimation).toBe("pop");
    expect(design.wordAnimation).toBe("pulse");
    expect(design.accentColor).toBe("#b9ff5c");
    expect(design.position).toBe("middle");
  });
});
