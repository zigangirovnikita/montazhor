"use client";

export const PREVIEW_TIME_PARENT_UPDATE_MS = 120;

export function createPreviewTimeReporter(
  setInternalCurrentTime: (value: number) => void,
  onTimeChange?: (time: number) => void,
  options?: {
    now?: () => number;
    minIntervalMs?: number;
  }
) {
  const now = options?.now ?? (() => performance.now());
  const minIntervalMs = options?.minIntervalMs ?? PREVIEW_TIME_PARENT_UPDATE_MS;
  let lastReportedAt = Number.NEGATIVE_INFINITY;
  let lastReportedValue = Number.NaN;

  const reportToParent = (value: number, timestamp: number) => {
    lastReportedAt = timestamp;
    lastReportedValue = value;
    onTimeChange?.(value);
  };

  return {
    sync(value: number) {
      setInternalCurrentTime(value);
      if (!onTimeChange) return;

      const timestamp = now();
      if (timestamp - lastReportedAt >= minIntervalMs || Math.abs(value - lastReportedValue) >= 0.24) {
        reportToParent(value, timestamp);
      }
    },
    flush(value: number) {
      setInternalCurrentTime(value);
      if (!onTimeChange) return;
      if (value !== lastReportedValue) reportToParent(value, now());
    }
  };
}
