"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, MutableRefObject } from "react";
import type { DraftEditOperation, DraftEditRequest, ProjectPayload } from "@/app/components/projectFlowTypes";
import { buildDraftReviewCandidates } from "@/lib/draftReviewCandidates";
import type { TranscriptWord } from "@/lib/types";

type TimelinePiece =
  | {
    kind: "word";
    id: string;
    sourceStart: number;
    sourceEnd: number;
    playbackStart: number;
    playbackEnd: number;
    text: string;
    state: "kept" | "removed" | "candidate";
    reason?: string;
  }
  | {
    kind: "range";
    id: string;
    sourceStart: number;
    sourceEnd: number;
    playbackStart: number;
    playbackEnd: number;
    text: string;
    state: "kept" | "removed" | "candidate";
    reason: string;
  };

const GAP_REASONS = new Set(["pause", "silence", "long_pause", "non_silent_gap", "noisy_pause", "vad_pause", "untranscribed_voice"]);

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
  onDraftEdit: (request: DraftEditRequest) => void;
  onContinue: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const tokenRefs = useRef(new Map<string, HTMLButtonElement>());
  const piecesRef = useRef<TimelinePiece[]>([]);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const releaseScrubTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programmaticScrollRef = useRef(false);
  const userScrubbingRef = useRef(false);
  const pendingScrubSeekRef = useRef<number | null>(null);
  const manualScrubSelectionRef = useRef(false);
  const controlledPlayRef = useRef(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [centeredPiece, setCenteredPiece] = useState<TimelinePiece | null>(null);
  const [selected, setSelected] = useState<TimelinePiece | null>(null);
  const [approvedCandidates, setApprovedCandidates] = useState<Set<string>>(() => new Set());
  const [editing, setEditing] = useState<TimelinePiece | null>(null);
  const [editText, setEditText] = useState("");
  const [pendingEdits, setPendingEdits] = useState<DraftEditOperation[]>([]);
  const pieces = useMemo(
    () => buildTimelinePieces(payload, approvedCandidates, pendingEdits, compareMode),
    [payload, approvedCandidates, pendingEdits, compareMode]
  );
  const videoSrc = compareMode === "before" ? payload.originalUrl : payload.cleanPreviewUrl ?? payload.originalUrl;
  const resolvedCenteredPiece = centeredPiece && pieces.some((piece) => piece.id === centeredPiece.id)
    ? centeredPiece
    : null;
  const activePiece = resolvedCenteredPiece ?? findActivePiece(pieces, currentTime);
  const activePieceId = activePiece?.id;
  const displayTime = resolvedCenteredPiece ? resolvedCenteredPiece.sourceStart : activePiece?.sourceStart ?? currentTime;

  useEffect(() => {
    piecesRef.current = pieces;
  }, [pieces]);

  useEffect(() => {
    if (!activePieceId) return;
    if (userScrubbingRef.current) return;
    centerPieceInRail(activePieceId, videoRef.current?.paused ? "smooth" : "auto", railRef.current, tokenRefs.current, programmaticScrollRef);
  }, [activePieceId]);

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      if (releaseScrubTimerRef.current) clearTimeout(releaseScrubTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const onScroll = () => {
      if (programmaticScrollRef.current) return;
      userScrubbingRef.current = true;
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      if (releaseScrubTimerRef.current) clearTimeout(releaseScrubTimerRef.current);
      scrollTimerRef.current = setTimeout(() => {
        const target = pieceNearestRailCenter(railRef.current, piecesRef.current, tokenRefs.current);
        const video = videoRef.current;
        if (!target || !video) return;
        const time = Math.max(0, target.playbackStart);
        setCenteredPiece(target);
        manualScrubSelectionRef.current = true;
        pendingScrubSeekRef.current = time;
        video.currentTime = time;
        setCurrentTime(time);
      }, 30);
      releaseScrubTimerRef.current = setTimeout(() => {
        userScrubbingRef.current = false;
      }, 140);
    };

    const onScrubStart = () => {
      userScrubbingRef.current = true;
    };

    const onScrubEnd = () => {
      if (releaseScrubTimerRef.current) clearTimeout(releaseScrubTimerRef.current);
      releaseScrubTimerRef.current = setTimeout(() => {
        userScrubbingRef.current = false;
      }, 140);
    };

    rail.addEventListener("scroll", onScroll, { passive: true });
    rail.addEventListener("pointerdown", onScrubStart, { passive: true });
    rail.addEventListener("pointerup", onScrubEnd, { passive: true });
    rail.addEventListener("pointercancel", onScrubEnd, { passive: true });
    rail.addEventListener("wheel", onScrubStart, { passive: true });
    return () => {
      rail.removeEventListener("scroll", onScroll);
      rail.removeEventListener("pointerdown", onScrubStart);
      rail.removeEventListener("pointerup", onScrubEnd);
      rail.removeEventListener("pointercancel", onScrubEnd);
      rail.removeEventListener("wheel", onScrubStart);
    };
  }, []);

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) {
      setCenteredPiece(null);
      manualScrubSelectionRef.current = false;
      pendingScrubSeekRef.current = null;
    }
    setCurrentTime(video.currentTime);
  }

  function getPendingScrubTargetTime() {
    if (!manualScrubSelectionRef.current) return null;
    if (pendingScrubSeekRef.current !== null) return pendingScrubSeekRef.current;
    const centeredTarget = centeredPiece ?? pieceNearestRailCenter(railRef.current, piecesRef.current, tokenRefs.current);
    return centeredTarget ? Math.max(0, centeredTarget.playbackStart) : null;
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
      const timer = window.setTimeout(finish, 160);
      const onSeeked = () => {
        window.clearTimeout(timer);
        finish();
      };
      video.addEventListener("seeked", onSeeked, { once: true });
      video.currentTime = targetTime;
      setCurrentTime(targetTime);
    });
  }

  async function startPlayback() {
    const video = videoRef.current;
    if (!video) return;
    const targetTime = getPendingScrubTargetTime();
    if (targetTime !== null) {
      await seekVideo(video, targetTime);
      manualScrubSelectionRef.current = false;
      pendingScrubSeekRef.current = null;
    }
    setCenteredPiece(null);
    controlledPlayRef.current = true;
    try {
      await video.play();
    } finally {
      controlledPlayRef.current = false;
    }
  }

  function handleVideoPlay() {
    const video = videoRef.current;
    if (!video) return;
    if (controlledPlayRef.current) return;
    const targetTime = getPendingScrubTargetTime();
    if (targetTime === null || Math.abs(video.currentTime - targetTime) <= 0.02) {
      manualScrubSelectionRef.current = false;
      pendingScrubSeekRef.current = null;
      setCenteredPiece(null);
      return;
    }
    video.pause();
    void startPlayback();
  }

  function handleVideoClick(event: MouseEvent<HTMLVideoElement>) {
    const video = videoRef.current;
    if (!video) return;
    const rect = video.getBoundingClientRect();
    if (event.clientY >= rect.bottom - 64) return;
    if (video.paused) {
      startPlayback();
      return;
    }
    video.pause();
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

  function restorePiece(piece: TimelinePiece) {
    queueEdit({
      action: "restore_removed_range",
      sourceStart: piece.sourceStart,
      sourceEnd: piece.sourceEnd
    });
    setSelected(null);
  }

  function approveCandidate(piece: TimelinePiece) {
    setApprovedCandidates((current) => new Set(current).add(piece.id));
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

  function applyPendingEdits() {
    if (pendingEdits.length === 0 || editBusy) return;
    onDraftEdit({ action: "apply_review_edits", edits: pendingEdits });
    setPendingEdits([]);
    setSelected(null);
    setEditing(null);
  }

  return (
    <section className="review-ticker-card">
      <div className="review-player-shell">
        <div className="review-video-stack">
          <video
            key={videoSrc}
            ref={videoRef}
            src={videoSrc}
            controls
            playsInline
            onClick={handleVideoClick}
            onPlay={handleVideoPlay}
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
                startPlayback();
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

      <div className="ticker-time-row">
        <strong>{formatTime(displayTime)}</strong>
        <span>{activePiece?.text ?? "Поставь видео на нужный момент"}</span>
      </div>

      <div className="ticker-viewport" ref={railRef}>
        <div className="ticker-center-line" aria-hidden="true" />
        <div className="ticker-track">
          {pieces.length > 0 ? pieces.map((piece) => (
            <button
              className={tickerTokenClass(piece, selected?.id === piece.id, activePiece?.id === piece.id)}
              key={piece.id}
              ref={(node) => {
                if (node) tokenRefs.current.set(piece.id, node);
                else tokenRefs.current.delete(piece.id);
              }}
              type="button"
              disabled={editBusy}
              title={tokenTitle(piece)}
              onClick={() => selectPiece(piece)}
            >
              {piece.text}
            </button>
          )) : <span className="ticker-empty">Текст черновика пока недоступен.</span>}
        </div>
      </div>

      {selected ? (
        <div className="word-popover">
          <div>
            <strong>{selected.text}</strong>
            <span>{actionHint(selected)}</span>
          </div>
          <div className="word-popover-actions">
            {selected.state === "kept" ? (
              <button type="button" disabled={editBusy} onClick={() => deletePiece(selected)}>Удалить</button>
            ) : null}
            {selected.state === "candidate" ? (
              <>
                <button type="button" disabled={editBusy} onClick={() => approveCandidate(selected)}>Утвердить</button>
                <button type="button" disabled={editBusy} onClick={() => deletePiece(selected)}>Удалить</button>
              </>
            ) : null}
            {selected.state === "removed" ? (
              <button type="button" disabled={editBusy} onClick={() => restorePiece(selected)}>Восстановить</button>
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
        <button className="small-ghost" type="button" disabled={editBusy || pendingEdits.length === 0} onClick={applyPendingEdits}>
          {pendingEdits.length > 0 ? `Применить изменения (${pendingEdits.length})` : "Нет изменений"}
        </button>
        <button className="cta-button compact" type="button" disabled={pendingEdits.length > 0 || editBusy} onClick={onContinue}>
          {pendingEdits.length > 0 ? "Сначала применить" : "Утвердить монтаж"}
        </button>
      </div>
    </section>
  );
}

function buildTimelinePieces(
  payload: ProjectPayload,
  approvedCandidates: Set<string>,
  pendingEdits: DraftEditOperation[],
  compareMode: "after" | "before"
): TimelinePiece[] {
  const transcript = payload.draft?.transcript ?? { language: "ru", segments: [] };
  const removed = payload.draft?.edl?.removedRanges ?? [];
  const keptRanges = payload.draft?.edl?.keptRanges ?? [];
  const mapPlaybackTime = compareMode === "before"
    ? (time: number) => time
    : (time: number) => sourceTimeToOutputTime(keptRanges, time);
  const candidates = buildDraftReviewCandidates(transcript, removed);
  const issues = [
    ...removed.map((range, index) => ({ ...range, state: "removed" as const, id: `removed-${index}-${range.sourceStart}-${range.sourceEnd}` })),
    ...candidates.map((range, index) => ({ ...range, state: "candidate" as const, id: `candidate-${index}-${range.sourceStart}-${range.sourceEnd}` }))
  ].sort((a, b) => a.sourceStart - b.sourceStart);
  const words = transcript.segments
    .flatMap((segment) => (segment.words ?? wordsFromSegmentText(segment.text, segment.start, segment.end)).map((word, index) => ({ ...word, segmentId: segment.id, index })))
    .sort((a, b) => a.start - b.start);
  const pieces: TimelinePiece[] = [];

  for (const [wordIndex, word] of words.entries()) {
    const wordIssue = issues.find((issue) => wordBelongsToRange(word, issue.sourceStart, issue.sourceEnd) && !approvedCandidates.has(issue.id));
    const wordPiece = applyPendingToPiece({
      kind: "word",
      id: `word-${word.segmentId}-${word.index}-${word.start}-${word.end}-${word.word}`,
      sourceStart: word.start,
      sourceEnd: word.end,
      playbackStart: mapPlaybackTime(word.start),
      playbackEnd: mapPlaybackTime(word.end),
      text: word.word,
      state: wordIssue?.state ?? "kept",
      reason: wordIssue?.reason
    }, pendingEdits);
    pieces.push(wordPiece);

    const nextWord = words[wordIndex + 1];
    const gapEnd = nextWord?.start ?? word.end;
    for (const issue of issues) {
      if (approvedCandidates.has(issue.id)) continue;
      const overlapsWord = words.some((item) => wordBelongsToRange(item, issue.sourceStart, issue.sourceEnd));
      if (overlapsWord) continue;
      if (issue.sourceStart < word.end - 0.02 || issue.sourceStart > gapEnd + 0.02) continue;
      const rangePiece = applyPendingToPiece({
        kind: "range",
        id: issue.id,
        sourceStart: issue.sourceStart,
        sourceEnd: issue.sourceEnd,
        playbackStart: mapPlaybackTime(issue.sourceStart),
        playbackEnd: mapPlaybackTime(issue.sourceEnd),
        text: displayRangeLabel(issue.reason, issue.sourceEnd - issue.sourceStart, issue.state) ?? issue.text ?? fallbackRangeText(issue.reason, issue.sourceEnd - issue.sourceStart),
        state: issue.state,
        reason: issue.reason
      }, pendingEdits);
      if (rangePiece.state !== "kept") pieces.push(rangePiece as TimelinePiece);
    }
  }

  return pieces.sort((a, b) => a.sourceStart - b.sourceStart);
}

function applyPendingToPiece(piece: TimelinePiece, pendingEdits: DraftEditOperation[]): TimelinePiece {
  return pendingEdits.reduce<TimelinePiece>((current, edit) => {
    if (edit.action === "edit_word_text" && current.kind === "word" && sameWord(current, edit)) {
      return { ...current, text: edit.text?.trim() || current.text };
    }
    if (edit.action === "delete_word") {
      return current.kind === "word" && sameWord(current, edit) ? { ...current, state: "removed", reason: "manual_word" } : current;
    }
    if (!rangesTouch(current.sourceStart, current.sourceEnd, edit.sourceStart, edit.sourceEnd)) return current;
    if (edit.action === "restore_removed_range") return { ...current, state: "kept" };
    if (edit.action === "delete_range") return { ...current, state: "removed", reason: "manual_text" };
    return current;
  }, piece);
}

function wordsFromSegmentText(text: string, start: number, end: number): TranscriptWord[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  const duration = Math.max(0.1, end - start);
  return tokens.map((word, index) => ({
    word,
    start: start + (duration * index) / tokens.length,
    end: start + (duration * (index + 1)) / tokens.length
  }));
}

function wordBelongsToRange(word: TranscriptWord, start: number, end: number) {
  const overlap = Math.max(0, Math.min(word.end, end) - Math.max(word.start, start));
  const share = overlap / Math.max(0.05, word.end - word.start);
  const midpoint = (word.start + word.end) / 2;
  return share >= 0.45 || (midpoint >= start && midpoint <= end);
}

function findActivePiece(pieces: TimelinePiece[], time: number) {
  return pieces.find((piece) => piece.playbackEnd - piece.playbackStart > 0.02 && time >= piece.playbackStart && time <= piece.playbackEnd)
    ?? pieces.find((piece) => piece.playbackStart >= time && piece.playbackEnd - piece.playbackStart > 0.02)
    ?? pieces.find((piece) => piece.playbackEnd - piece.playbackStart > 0.02)
    ?? pieces.at(-1);
}

function sourceTimeToOutputTime(
  keptRanges: Array<{ sourceStart: number; sourceEnd: number }>,
  sourceTime: number
) {
  let outputTime = 0;

  for (const range of keptRanges) {
    if (sourceTime <= range.sourceStart) return outputTime;
    if (sourceTime <= range.sourceEnd) {
      return outputTime + sourceTime - range.sourceStart;
    }
    outputTime += Math.max(0, range.sourceEnd - range.sourceStart);
  }

  return outputTime;
}

function pieceNearestRailCenter(rail: HTMLDivElement | null, pieces: TimelinePiece[], refs: Map<string, HTMLButtonElement>) {
  if (!rail || pieces.length === 0) return null;
  const railRect = rail.getBoundingClientRect();
  const center = railRect.left + railRect.width / 2;
  let best: { piece: TimelinePiece; distance: number } | null = null;
  for (const piece of pieces) {
    const node = refs.get(piece.id);
    if (!node) continue;
    const rect = node.getBoundingClientRect();
    const distance = Math.abs(rect.left + rect.width / 2 - center);
    if (!best || distance < best.distance) best = { piece, distance };
  }
  return best?.piece ?? null;
}

function centerPieceInRail(
  pieceId: string,
  behavior: ScrollBehavior,
  rail: HTMLDivElement | null,
  refs: Map<string, HTMLButtonElement>,
  programmaticScrollRef: MutableRefObject<boolean>
) {
  const node = refs.get(pieceId);
  if (!node || !rail) return;
  const targetLeft = Math.max(0, node.offsetLeft - rail.clientWidth / 2 + node.clientWidth / 2);
  programmaticScrollRef.current = true;
  rail.scrollTo({ left: targetLeft, behavior });
  window.setTimeout(() => {
    programmaticScrollRef.current = false;
  }, behavior === "smooth" ? 260 : 80);
}

function sameWord(piece: TimelinePiece, edit: DraftEditOperation) {
  return Math.abs(piece.sourceStart - edit.sourceStart) < 0.015 && Math.abs(piece.sourceEnd - edit.sourceEnd) < 0.015;
}

function rangesTouch(start: number, end: number, targetStart: number, targetEnd: number) {
  return Math.min(end, targetEnd) - Math.max(start, targetStart) > 0.02;
}

function tickerTokenClass(piece: TimelinePiece, selected: boolean, active: boolean) {
  return ["ticker-token", piece.state, piece.kind === "range" ? "range" : "", selected ? "selected" : "", active ? "active" : ""].filter(Boolean).join(" ");
}

function tokenTitle(piece: TimelinePiece) {
  if (piece.state === "removed") return "Восстановить или отредактировать";
  if (piece.state === "candidate") return "Утвердить, удалить или отредактировать";
  return "Удалить или отредактировать";
}

function actionHint(piece: TimelinePiece) {
  if (piece.state === "removed") return "Этот фрагмент уже удален из черновика.";
  if (piece.state === "candidate") return "Спорный фрагмент: можно оставить или удалить.";
  return "Обычное слово: можно удалить или исправить текст для субтитров.";
}

function formatTime(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatSeconds(value: number) {
  if (value < 1) return `${value.toFixed(2)} сек`;
  if (value < 10) return `${value.toFixed(1)} сек`;
  return `${Math.round(value)} сек`;
}

function fallbackRangeText(reason: string, duration: number) {
  if (reason === "potential_pause") return `пауза/звук ${formatSeconds(duration)}`;
  if (reason === "potential_filler") return `кандидат ${formatSeconds(duration)}`;
  return `пауза ${formatSeconds(duration)}`;
}

function displayRangeLabel(reason: string, duration: number, kind: "removed" | "candidate") {
  if (kind === "candidate") {
    if (reason === "potential_pause") return `Спорная пауза ${formatSeconds(duration)}`;
    if (reason === "potential_filler") return "Спорное слово";
    return "Спорный фрагмент";
  }
  if (reason === "untranscribed_voice") return `Лишний звук ${formatSeconds(duration)}`;
  if (reason === "hesitation") return "Запинка";
  if (reason === "filler_word") return "Слово-паразит";
  if (reason === "profanity") return "Лишний фрагмент";
  if (GAP_REASONS.has(reason)) return `Пауза ${formatSeconds(duration)}`;
  return "Удалено";
}
