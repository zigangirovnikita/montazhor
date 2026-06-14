"use client";

import { useEffect, useMemo, useRef } from "react";
import type { PointerEvent } from "react";
import { buildRailBlocks, formatReviewTime, type TimelinePiece } from "@/app/components/draftReviewTimeline";

const MIN_PX_PER_SECOND = 14;
const MAX_PX_PER_SECOND = 180;

export const DEFAULT_TIMELINE_PX_PER_SECOND = 52;

export function DraftReviewRail({
  duration,
  pieces,
  sourceTime,
  pxPerSecond,
  activeLabel,
  onZoomChange,
  onScrub
}: {
  duration: number;
  pieces: TimelinePiece[];
  sourceTime: number;
  pxPerSecond: number;
  activeLabel: string;
  onZoomChange: (value: number | ((current: number) => number)) => void;
  onScrub: (sourceTime: number) => void;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackWidth = Math.max(1, Math.ceil(duration * pxPerSecond));
  const playheadLeft = Math.max(0, Math.min(trackWidth, sourceTime * pxPerSecond));
  const timelineTicks = useMemo(() => buildTimelineTicks(duration, pxPerSecond), [duration, pxPerSecond]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const anchor = Math.min(viewport.clientWidth * 0.34, 220);
    viewport.scrollTo({ left: Math.max(0, playheadLeft - anchor), behavior: "auto" });
  }, [playheadLeft, pxPerSecond]);

  function handlePointer(clientX: number) {
    const viewport = viewportRef.current;
    if (!viewport || duration <= 0) return;
    const rect = viewport.getBoundingClientRect();
    const nextTime = Math.max(0, Math.min(duration, (viewport.scrollLeft + clientX - rect.left) / pxPerSecond));
    onScrub(nextTime);
  }

  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    handlePointer(event.clientX);
  }

  return (
    <div className="montage-rail-wrap">
      <div className="montage-rail-meta">
        <strong>{formatReviewTime(sourceTime)}</strong>
        <span>{activeLabel || "Текст черновика пока недоступен"}</span>
      </div>
      <div className="montage-zoom-controls" aria-label="Масштаб дорожки">
        <button type="button" onClick={() => onZoomChange((value) => Math.max(MIN_PX_PER_SECOND, Math.round(value / 1.35)))}>-</button>
        <span>{timelineZoomLabel(pxPerSecond)}</span>
        <button type="button" onClick={() => onZoomChange((value) => Math.min(MAX_PX_PER_SECOND, Math.round(value * 1.35)))}>+</button>
      </div>
      <div
        className="montage-rail-viewport"
        ref={viewportRef}
        role="slider"
        aria-label="Монтажная линия"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(sourceTime)}
        tabIndex={0}
        onPointerDown={beginDrag}
        onPointerMove={(event) => {
          if (event.buttons !== 1) return;
          handlePointer(event.clientX);
        }}
      >
        <div className="montage-track" style={{ width: `${trackWidth}px` }}>
          <div className="montage-waveform" aria-hidden="true" />
          {timelineTicks.map((tick) => (
            <span className={tick.major ? "montage-tick major" : "montage-tick"} data-label={tick.label} key={tick.time} style={{ left: `${tick.left}px` }} />
          ))}
          {buildRailBlocks(pieces, duration).map((block) => (
            <span
              aria-hidden="true"
              className={`montage-block ${block.state}`}
              key={block.id}
              style={{ left: `${(block.left / 100) * trackWidth}px`, width: `${Math.max(8, (block.width / 100) * trackWidth)}px` }}
            />
          ))}
        </div>
        <span className="montage-playhead" style={{ left: `${playheadLeft}px` }}>
          <i>{formatReviewTime(sourceTime)}</i>
        </span>
      </div>
    </div>
  );
}

function buildTimelineTicks(duration: number, pxPerSecond: number) {
  const majorStep = pxPerSecond >= 110 ? 1 : pxPerSecond >= 58 ? 5 : pxPerSecond >= 28 ? 10 : 30;
  const minorStep = majorStep / 2;
  const ticks: Array<{ time: number; left: number; label: string; major: boolean }> = [];
  for (let time = 0; time <= duration + 0.001; time += minorStep) {
    const rounded = Number(time.toFixed(3));
    const major = Math.abs(rounded / majorStep - Math.round(rounded / majorStep)) < 0.001;
    ticks.push({ time: rounded, left: rounded * pxPerSecond, label: formatTickLabel(rounded), major });
  }
  return ticks;
}

function formatTickLabel(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return minutes > 0 ? `${minutes}:${seconds}` : `0:${seconds}`;
}

function timelineZoomLabel(pxPerSecond: number) {
  if (pxPerSecond >= 110) return "1 сек";
  if (pxPerSecond >= 58) return "5 сек";
  if (pxPerSecond >= 28) return "10 сек";
  return "30 сек";
}
