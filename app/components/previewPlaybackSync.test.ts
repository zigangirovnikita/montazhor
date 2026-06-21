import { describe, expect, it, vi } from "vitest";
import { createPreviewTimeReporter, PREVIEW_TIME_PARENT_UPDATE_MS } from "./previewPlaybackSync";
import { shouldPollProject } from "./projectPolling";

describe("previewPlaybackSync", () => {
  it("throttles parent time updates while keeping local preview time exact", () => {
    const localUpdates: number[] = [];
    const parentUpdates: number[] = [];
    const timestamps = [0, 16, 32, PREVIEW_TIME_PARENT_UPDATE_MS + 32];
    const now = vi.fn(() => timestamps.shift() ?? PREVIEW_TIME_PARENT_UPDATE_MS + 32);

    const reporter = createPreviewTimeReporter(
      (value) => localUpdates.push(value),
      (value) => parentUpdates.push(value),
      { now }
    );

    reporter.sync(0);
    reporter.sync(0.016);
    reporter.sync(0.032);
    reporter.sync(0.160);

    expect(localUpdates).toEqual([0, 0.016, 0.032, 0.16]);
    expect(parentUpdates).toEqual([0, 0.16]);
  });

  it("flushes the latest time on pause or seek", () => {
    const parentUpdates: number[] = [];
    const reporter = createPreviewTimeReporter(
      () => undefined,
      (value) => parentUpdates.push(value),
      { now: () => 0 }
    );

    reporter.sync(0);
    reporter.flush(0.41);

    expect(parentUpdates).toEqual([0, 0.41]);
  });
});

describe("projectPolling", () => {
  it("stops background polling for stable editor states", () => {
    expect(shouldPollProject("draft_ready", false, false)).toBe(false);
    expect(shouldPollProject("review_ready", false, false)).toBe(false);
    expect(shouldPollProject("done", false, false)).toBe(false);
  });

  it("keeps polling during active work", () => {
    expect(shouldPollProject("processing", false, false)).toBe(true);
    expect(shouldPollProject("draft_ready", true, false)).toBe(true);
    expect(shouldPollProject("draft_ready", false, true)).toBe(true);
  });
});
