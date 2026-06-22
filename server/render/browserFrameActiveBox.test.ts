import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCaptionSafeArea,
  detectActiveVideoBox,
  detectActiveBoxFromRgbFrame,
  parsePpm
} from "./browserFrameActiveBox";

vi.mock("../video/ffmpeg", () => ({
  ffmpegPath: () => "ffmpeg",
  runCommand: vi.fn(async () => ({ stdout: "", stderr: "" }))
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("browserFrameActiveBox", () => {
  it("detects vertical active box inside horizontal pillarbox", () => {
    const width = 1920;
    const height = 1080;
    const data = createFrame({
      width,
      height,
      background: [0, 0, 0],
      box: {
        x: 420,
        y: 0,
        width: 1080,
        height,
        color: [168, 156, 140]
      }
    });

    const box = detectActiveBoxFromRgbFrame({ width, height, data });
    expect(box.detected).toBe(true);
    expect(box.x).toBe(420);
    expect(box.y).toBe(0);
    expect(box.width).toBe(1080);
    expect(box.height).toBe(1080);
  });

  it("falls back to full frame when no black bars are present", () => {
    const width = 1080;
    const height = 1920;
    const data = createFrame({
      width,
      height,
      background: [160, 150, 140]
    });

    const box = detectActiveBoxFromRgbFrame({ width, height, data });
    expect(box.detected).toBe(false);
    expect(box.source).toBe("full_frame_fallback");
    expect(box.width).toBe(width);
    expect(box.height).toBe(height);
  });

  it("builds caption safe area inside detected active box", () => {
    const safeArea = buildCaptionSafeArea({
      detected: true,
      x: 420,
      y: 0,
      width: 1080,
      height: 1080,
      source: "frame_black_bar_detection"
    });

    expect(safeArea.x).toBeGreaterThan(420);
    expect(safeArea.x + safeArea.width).toBeLessThan(1501);
    expect(safeArea.y).toBeGreaterThan(0);
    expect(safeArea.height).toBeLessThan(1080);
    expect(safeArea.marginBottom).toBeGreaterThan(0);
  });

  it("parses binary PPM when first pixel bytes look like whitespace", () => {
    const header = Buffer.from("P6\n2 1\n255\n", "ascii");
    const pixels = Buffer.from([
      10, 32, 13,
      255, 128, 64
    ]);

    const frame = parsePpm(Buffer.concat([header, pixels]));

    expect(frame.width).toBe(2);
    expect(frame.height).toBe(1);
    expect([...frame.data.subarray(0, 6)]).toEqual([...pixels]);
  });

  it("falls back to full frame when ppm sample parsing fails", async () => {
    const result = await detectActiveVideoBox({
      videoPath: "/tmp/fake.mp4",
      width: 1080,
      height: 1920,
      duration: 4,
      sampleFractions: [0.5],
      readFrameFile: async () => Buffer.from("broken", "ascii")
    });

    expect(result.activeVideoBox.detected).toBe(false);
    expect(result.activeVideoBox.source).toBe("full_frame_fallback");
    expect(result.captionSafeArea.width).toBeGreaterThan(0);
  });
});

function createFrame(input: {
  width: number;
  height: number;
  background: [number, number, number];
  box?: {
    x: number;
    y: number;
    width: number;
    height: number;
    color: [number, number, number];
  };
}) {
  const data = new Uint8Array(input.width * input.height * 3);

  for (let y = 0; y < input.height; y += 1) {
    for (let x = 0; x < input.width; x += 1) {
      const offset = (y * input.width + x) * 3;
      const box = input.box;
      const inBox = !!box
        && x >= box.x
        && x < box.x + box.width
        && y >= box.y
        && y < box.y + box.height;
      const color = inBox && box ? box.color : input.background;
      data[offset] = color[0];
      data[offset + 1] = color[1];
      data[offset + 2] = color[2];
    }
  }

  return data;
}
