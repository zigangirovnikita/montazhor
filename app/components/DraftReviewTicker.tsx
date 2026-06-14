"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { DEFAULT_TIMELINE_PX_PER_SECOND, DraftReviewRail } from "@/app/components/DraftReviewRail";
import type { DraftEditOperation, DraftEditRequest, ProjectPayload } from "@/app/components/projectFlowTypes";
import {
  actionHint,
  buildTextSegments,
  buildTimelinePieces,
  findActivePiece,
  findPieceBySourceTime,
  findSegmentBySourceTime,
  findSegmentForPiece,
  formatReviewTime,
  outputTimeToSourceTime,
  sourceTimeToOutputTime,
  timelineDuration,
  tokenTitle,
  type TimelinePiece
} from "@/app/components/draftReviewTimeline";

export function DraftReviewTicker({
  payload,
  compareMode,
  editBusy,
  onCompareModeChange,
  onDraftEdit,
  onContinue
}: {
  payload: ProjectPayload;
  compareMode: "after" | "before";
  editBusy: boolean;
  onCompareModeChange: (value: "after" | "before") => void;
  onDraftEdit: (request: DraftEditRequest) => void | Promise<void>;
  onContinue: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const textViewportRef = useRef<HTMLDivElement | null>(null);
  const segmentRefs = useRef(new Map<string, HTMLDivElement>());
  const piecesRef = useRef<TimelinePiece[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [scrubSourceTime, setScrubSourceTime] = useState<number | null>(null);
  const [selected, setSelected] = useState<TimelinePiece | null>(null);
  const [approvedCandidates, setApprovedCandidates] = useState<Set<string>>(() => new Set());
  const [editing, setEditing] = useState<TimelinePiece | null>(null);
  const [editText, setEditText] = useState("");
  const [pendingEdits, setPendingEdits] = useState<DraftEditOperation[]>([]);
  const [pxPerSecond, setPxPerSecond] = useState(DEFAULT_TIMELINE_PX_PER_SECOND);
  const pieces = useMemo(
    () => buildTimelinePieces(payload, approvedCandidates, pendingEdits, compareMode),
    [payload, approvedCandidates, pendingEdits, compareMode]
  );
  const segments = useMemo(() => buildTextSegments(pieces), [pieces]);
  const duration = useMemo(() => timelineDuration(payload, pieces), [payload, pieces]);
  const videoSrc = compareMode === "before" ? payload.originalUrl : payload.cleanPreviewUrl ?? payload.originalUrl;
  const keptRanges = payload.draft?.edl?.keptRanges ?? [];
  const activeSourceTime = scrubSourceTime ?? (compareMode === "before" ? currentTime : outputTimeToSourceTime(keptRanges, currentTime));
  const activePiece = scrubSourceTime !== null
    ? findPieceBySourceTime(pieces, scrubSourceTime)
    : findPieceBySourceTime(pieces, activeSourceTime) ?? findActivePiece(pieces, currentTime);
  const activeSegment = findSegmentBySourceTime(segments, activeSourceTime) ?? (activePiece ? findSegmentForPiece(segments, activePiece) : segments[0]);
  const displaySourceTime = scrubSourceTime ?? activeSourceTime;
  const hasPendingEdits = pendingEdits.length > 0;

  useEffect(() => {
    piecesRef.current = pieces;
  }, [pieces]);

  useEffect(() => {
    if (!activeSegment) return;
    const frame = window.requestAnimationFrame(() => {
      const node = segmentRefs.current.get(activeSegment.id);
      const viewport = textViewportRef.current;
      if (!node || !viewport) return;
      const nodeRect = node.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      const targetTop = viewport.scrollTop + (nodeRect.top + nodeRect.height / 2) - (viewportRect.top + viewportRect.height / 2);
      viewport.scrollTo({ top: Math.max(0, targetTop), behavior: videoRef.current?.paused ? "smooth" : "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeSegment?.id]);

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused && scrubSourceTime !== null) setScrubSourceTime(null);
    setCurrentTime(video.currentTime);
  }

  function handleVideoClick(event: MouseEvent<HTMLVideoElement>) {
    const video = videoRef.current;
    if (!video) return;
    const rect = video.getBoundingClientRect();
    if (event.clientY >= rect.bottom - 64) return;
    if (video.paused) {
      void startPlayback();
      return;
    }
    video.pause();
  }

  async function startPlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (scrubSourceTime !== null) {
      const targetPiece = findPieceBySourceTime(piecesRef.current, scrubSourceTime);
      const targetTime = Math.max(0, targetPiece?.playbackStart ?? sourceTimeToOutputTime(payload.draft?.edl?.keptRanges ?? [], scrubSourceTime));
      await seekVideo(video, targetTime);
      setScrubSourceTime(null);
    }
    await video.play();
  }

  async function seekVideo(video: HTMLVideoElement, targetTime: number) {
    if (Math.abs(video.currentTime - targetTime) <= 0.02) return;
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const timer = window.setTimeout(finish, 180);
      const onSeeked = () => {
        window.clearTimeout(timer);
        finish();
      };
      video.addEventListener("seeked", onSeeked, { once: true });
      video.currentTime = targetTime;
      setCurrentTime(targetTime);
    });
  }

  function scrubToSourceTime(sourceTime: number) {
    setScrubSourceTime(sourceTime);
    const targetPiece = findPieceBySourceTime(piecesRef.current, sourceTime);
    const targetPlayback = compareMode === "before" ? sourceTime : targetPiece?.playbackStart ?? sourceTimeToOutputTime(keptRanges, sourceTime);
    if (videoRef.current) {
      if (!videoRef.current.paused) videoRef.current.pause();
      videoRef.current.currentTime = Math.max(0, targetPlayback);
      setCurrentTime(Math.max(0, targetPlayback));
    }
  }

  function selectPiece(piece: TimelinePiece) {
    setSelected((current) => current?.id === piece.id ? null : piece);
    setEditing(null);
  }

  function deletePiece(piece: TimelinePiece) {
    queueEdit({
      action: piece.kind === "word" ? "delete_word" : "delete_range",
      sourceStart: Math.max(0, piece.sourceStart - 0.03),
      sourceEnd: piece.sourceEnd + 0.03
    });
    setSelected(null);
  }

  function keepPiece(piece: TimelinePiece) {
    if (piece.state === "candidate") {
      setApprovedCandidates((current) => new Set(current).add(piece.reviewIssueId ?? piece.id));
    } else if (piece.state === "removed") {
      queueEdit({
        action: "restore_removed_range",
        sourceStart: piece.sourceStart,
        sourceEnd: piece.sourceEnd
      });
    }
    setSelected(null);
  }

  function startEditing(piece: TimelinePiece) {
    if (piece.kind !== "word") return;
    setEditing(piece);
    setEditText(piece.text);
  }

  function submitTextEdit() {
    if (!editing || editing.kind !== "word") return;
    const text = editText.trim();
    if (!text || text === editing.text) {
      setEditing(null);
      return;
    }
    queueEdit({
      action: "edit_word_text",
      sourceStart: editing.sourceStart,
      sourceEnd: editing.sourceEnd,
      text
    });
    setEditing(null);
    setSelected(null);
  }

  function queueEdit(edit: DraftEditOperation) {
    setPendingEdits((current) => [...current, edit]);
  }

  async function applyPendingEdits() {
    if (pendingEdits.length === 0 || editBusy) return;
    const editsToApply = pendingEdits;
    await onDraftEdit({ action: "apply_review_edits", edits: editsToApply });
    setPendingEdits((current) => current === editsToApply ? [] : current);
    setSelected(null);
    setEditing(null);
  }

  return (
    <section className="review-timeline-card">
      <div className="review-player-shell">
        <div className="review-video-stack">
          <video
            key={videoSrc}
            ref={videoRef}
            src={videoSrc}
            controls
            playsInline
            onClick={handleVideoClick}
            onTimeUpdate={handleTimeUpdate}
            onSeeked={handleTimeUpdate}
          />
          <button
            aria-label="Переключить воспроизведение"
            className="video-tap-surface"
            type="button"
            onClick={() => {
              const video = videoRef.current;
              if (!video) return;
              if (video.paused) {
                void startPlayback();
                return;
              }
              video.pause();
            }}
          />
        </div>
        <div className="segmented-control" aria-label="Сравнение до и после">
          <button className={compareMode === "after" ? "active" : ""} type="button" onClick={() => onCompareModeChange("after")}>
            После
          </button>
          <button className={compareMode === "before" ? "active" : ""} type="button" onClick={() => onCompareModeChange("before")}>
            До
          </button>
        </div>
      </div>

      <DraftReviewRail
        activeLabel={activeSegment ? `${formatReviewTime(activeSegment.start)}-${formatReviewTime(activeSegment.end)}` : ""}
        duration={duration}
        pieces={pieces}
        pxPerSecond={pxPerSecond}
        sourceTime={displaySourceTime}
        onScrub={scrubToSourceTime}
        onZoomChange={setPxPerSecond}
      />

      <div className="review-text-viewport" ref={textViewportRef}>
        {segments.length > 0 ? segments.map((segment) => (
          <div
            className={`review-text-segment ${activeSegment?.id === segment.id ? "active" : ""}`}
            key={segment.id}
            ref={(node) => {
              if (node) segmentRefs.current.set(segment.id, node);
              else segmentRefs.current.delete(segment.id);
            }}
          >
            <div className="segment-time start">{formatReviewTime(segment.start)}</div>
            <div className="segment-body">
              <span className="segment-connector" aria-hidden="true">✦</span>
              <p>
                {segment.pieces.map((piece) => (
                  <Fragment key={piece.id}>
                    <button
                      className={textTokenClass(piece, selected?.id === piece.id)}
                      type="button"
                      disabled={editBusy}
                      title={tokenTitle(piece)}
                      onClick={() => selectPiece(piece)}
                    >
                      {piece.text}
                    </button>{" "}
                  </Fragment>
                ))}
              </p>
            </div>
            <div className="segment-time end">{formatReviewTime(segment.end)}</div>
          </div>
        )) : <p className="ticker-empty">Текст черновика пока недоступен.</p>}
      </div>

      {selected ? (
        <div className="word-popover">
          <div>
            <strong>{selected.text}</strong>
            <span>{actionHint(selected)}</span>
          </div>
          <div className="word-popover-actions">
            {selected.state !== "removed" ? (
              <button type="button" disabled={editBusy} onClick={() => deletePiece(selected)}>Удалить</button>
            ) : null}
            {selected.state !== "kept" ? (
              <button type="button" disabled={editBusy} onClick={() => keepPiece(selected)}>Оставить</button>
            ) : null}
            {selected.kind === "word" ? (
              <button type="button" disabled={editBusy} onClick={() => startEditing(selected)}>Редактировать</button>
            ) : null}
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="word-edit-panel">
          <input
            autoFocus
            value={editText}
            maxLength={80}
            onChange={(event) => setEditText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitTextEdit();
              if (event.key === "Escape") setEditing(null);
            }}
          />
          <button className="cta-button compact" type="button" disabled={editBusy} onClick={submitTextEdit}>
            Готово
          </button>
        </div>
      ) : null}

      <div className="review-action-row">
        <button className="small-ghost" type="button" disabled={editBusy} onClick={() => onDraftEdit({ action: "reset_draft" })}>
          Вернуть всё
        </button>
        <button
          className={hasPendingEdits ? "cta-button compact apply-review-edits" : "small-ghost no-review-edits"}
          type="button"
          disabled={editBusy || !hasPendingEdits}
          onClick={() => void applyPendingEdits()}
        >
          {hasPendingEdits ? `Применить изменения (${pendingEdits.length})` : "Нет изменений"}
        </button>
        <button
          className={hasPendingEdits ? "cta-button compact approve-review-blocked" : "cta-button compact"}
          type="button"
          disabled={editBusy || hasPendingEdits}
          onClick={onContinue}
        >
          {hasPendingEdits ? "Сначала применить изменения" : "Утвердить монтаж"}
        </button>
      </div>
    </section>
  );
}

function textTokenClass(piece: TimelinePiece, selected: boolean) {
  return ["review-word-token", piece.state, piece.kind === "range" ? "range" : "", selected ? "selected" : ""].filter(Boolean).join(" ");
}
