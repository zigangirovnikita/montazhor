"use client";

import { useState } from "react";
import type { DraftEditRequest, ProjectPayload } from "@/app/components/projectFlowTypes";
import type { TranscriptWord } from "@/lib/types";

type TextPiece =
  | { kind: "removed"; id: string; sourceStart: number; sourceEnd: number; text: string; reason: string }
  | { kind: "word"; id: string; sourceStart: number; sourceEnd: number; text: string };

const GAP_REASONS = new Set(["pause", "silence", "long_pause", "non_silent_gap", "noisy_pause", "vad_pause", "untranscribed_voice"]);
const MIN_WORD_REMOVAL_OVERLAP_RATIO = 0.55;

export function DraftReview({
  payload,
  compareMode,
  editBusy,
  onCompareModeChange,
  onDraftEdit,
  onOpenPrecision
}: {
  payload: ProjectPayload;
  compareMode: "after" | "before";
  editBusy: boolean;
  onCompareModeChange: (value: "after" | "before") => void;
  onDraftEdit: (request: DraftEditRequest) => void;
  onOpenPrecision: () => void;
}) {
  const [selectedWords, setSelectedWords] = useState<TextPiece[]>([]);
  const [selectedRemoved, setSelectedRemoved] = useState<TextPiece | null>(null);
  const summary = summarizeDraft(payload);
  const phrases = buildTextReview(payload);
  const videoSrc = compareMode === "before" ? payload.originalUrl : payload.cleanPreviewUrl ?? payload.originalUrl;
  const selectionRange = rangeFromPieces(selectedWords);

  function selectWord(piece: TextPiece) {
    if (piece.kind !== "word") return;
    setSelectedRemoved(null);
    setSelectedWords((current) => togglePieceSelection(current, piece));
  }

  function selectRemoved(piece: TextPiece) {
    if (piece.kind !== "removed") return;
    setSelectedWords([]);
    setSelectedRemoved((current) => current?.id === piece.id ? null : piece);
  }

  function clearSelection() {
    setSelectedWords([]);
    setSelectedRemoved(null);
  }

  function submitSelection() {
    if (selectedRemoved) {
      onDraftEdit({
        action: "restore_removed_range",
        sourceStart: selectedRemoved.sourceStart,
        sourceEnd: selectedRemoved.sourceEnd
      });
      clearSelection();
      return;
    }

    if (!selectionRange) return;
    onDraftEdit({
      action: "delete_range",
      sourceStart: Math.max(0, selectionRange.sourceStart - 0.03),
      sourceEnd: selectionRange.sourceEnd + 0.03
    });
    clearSelection();
  }

  return (
    <div className="flow-stack">
      <header className="screen-head">
        <p className="screen-step">Проверка черновика</p>
        <h1>Посмотри результат. Правь текстом, не таймлайном.</h1>
      </header>

      <div className="compare-player">
        <video src={videoSrc} controls playsInline />
        <div className="segmented-control" aria-label="Сравнение до и после">
          <button className={compareMode === "after" ? "active" : ""} type="button" onClick={() => onCompareModeChange("after")}>
            После
          </button>
          <button className={compareMode === "before" ? "active" : ""} type="button" onClick={() => onCompareModeChange("before")}>
            До
          </button>
        </div>
      </div>

      <section className="summary-grid">
        <Metric label="Удалено" value={`${summary.removedCount}`} />
        <Metric label="Сокращено" value={formatSeconds(summary.savedSeconds)} />
        <Metric label="Склеек" value={`${summary.cuts}`} />
      </section>

      <section className="text-review-card">
        <div className="section-title-row">
          <div>
            <h2>Текст монтажа</h2>
            <p>Нажми на одно или несколько слов, потом выбери действие. Перемонтаж начнется только после подтверждения.</p>
          </div>
          <button
            className="small-ghost"
            type="button"
            disabled={editBusy}
            onClick={() => onDraftEdit({ action: "reset_draft" })}
          >
            Вернуть всё
          </button>
        </div>
        <div className="phrase-list">
          {phrases.length > 0 ? phrases.map((phrase) => (
            <p className="review-phrase" key={phrase.id}>
              {phrase.pieces.map((piece) => piece.kind === "removed" ? (
                <button
                  className={`removed-token ${selectedRemoved?.id === piece.id ? "selected" : ""}`}
                  key={piece.id}
                  type="button"
                  disabled={editBusy}
                  title="Выбрать удаленный фрагмент"
                  onClick={() => selectRemoved(piece)}
                >
                  {piece.text || `пауза ${formatSeconds(piece.sourceEnd - piece.sourceStart)}`}
                </button>
              ) : (
                <button
                  className={`word-token ${isSelected(selectedWords, piece) ? "selected" : ""}`}
                  key={piece.id}
                  type="button"
                  disabled={editBusy}
                  title="Выбрать слово"
                  onClick={() => selectWord(piece)}
                >
                  {piece.text}
                </button>
              ))}
            </p>
          )) : <p className="empty-state">Текст черновика пока недоступен. Можно смотреть видео и перейти к оформлению.</p>}
        </div>
      </section>

      {selectedWords.length > 0 || selectedRemoved ? (
        <div className="selection-toolbar">
          <div>
            <strong>{selectedRemoved ? "Удаленный фрагмент выбран" : `Выбрано слов: ${selectedWords.length}`}</strong>
            <span>{selectedRemoved ? "Можно вернуть его в монтаж." : "Можно удалить выбранный фрагмент одним действием."}</span>
          </div>
          <div className="selection-actions">
            <button className="small-ghost" type="button" onClick={clearSelection} disabled={editBusy}>
              Снять
            </button>
            <button className="cta-button compact" type="button" onClick={submitSelection} disabled={editBusy}>
              {selectedRemoved ? "Вернуть" : "Удалить и перемонтировать"}
            </button>
          </div>
        </div>
      ) : null}

      <button className="mode-button secondary-action" type="button" onClick={onOpenPrecision}>
        Точная настройка
      </button>
    </div>
  );
}

function togglePieceSelection(current: TextPiece[], piece: TextPiece): TextPiece[] {
  if (current.some((item) => item.id === piece.id)) {
    return current.filter((item) => item.id !== piece.id);
  }
  return [...current, piece].sort((a, b) => a.sourceStart - b.sourceStart);
}

function isSelected(selected: TextPiece[], piece: TextPiece) {
  return selected.some((item) => item.id === piece.id);
}

function rangeFromPieces(pieces: TextPiece[]) {
  if (pieces.length === 0) return null;
  return {
    sourceStart: Math.min(...pieces.map((piece) => piece.sourceStart)),
    sourceEnd: Math.max(...pieces.map((piece) => piece.sourceEnd))
  };
}

export function PrecisionTune({
  payload,
  editBusy,
  onBack,
  onDraftEdit
}: {
  payload: ProjectPayload;
  editBusy: boolean;
  onBack: () => void;
  onDraftEdit: (request: DraftEditRequest) => void;
}) {
  const ranges = payload.draft?.edl?.removedRanges ?? [];
  return (
    <div className="flow-stack">
      <header className="screen-head">
        <p className="screen-step">Дополнительно</p>
        <h1>Точная настройка</h1>
        <p>Это не основной путь. Здесь можно вернуть конкретные удаленные зоны.</p>
      </header>
      <div className="compare-player">
        <video src={payload.cleanPreviewUrl ?? payload.originalUrl} controls playsInline />
      </div>
      <div className="range-rail">
        {ranges.length > 0 ? ranges.map((range, index) => (
          <button
            className="range-chip"
            key={`${range.sourceStart}-${range.sourceEnd}-${index}`}
            type="button"
            disabled={editBusy}
            onClick={() => onDraftEdit({
              action: "restore_removed_range",
              sourceStart: range.sourceStart,
              sourceEnd: range.sourceEnd
            })}
          >
            <strong>{formatTime(range.sourceStart)}-{formatTime(range.sourceEnd)}</strong>
            <span>{range.text || range.reason || "удалено"}</span>
          </button>
        )) : <p className="empty-state">Удаленных зон нет.</p>}
      </div>
      <button className="cta-button" type="button" onClick={onBack}>
        Готово
      </button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function summarizeDraft(payload: ProjectPayload) {
  const removed = payload.draft?.edl?.removedRanges ?? [];
  const savedSeconds = removed.reduce((sum, range) => sum + Math.max(0, range.sourceEnd - range.sourceStart), 0);
  return {
    removedCount: removed.length,
    savedSeconds,
    cuts: Math.max(0, removed.length)
  };
}

function buildTextReview(payload: ProjectPayload) {
  const segments = payload.draft?.transcript?.segments ?? [];
  const removed = payload.draft?.edl?.removedRanges ?? [];
  const visibleRemoved = removed.filter((range) => shouldShowRemovedRange(range));

  return segments.map((segment) => {
    const words = segment.words ?? wordsFromSegmentText(segment.text, segment.start, segment.end);
    const pieces: TextPiece[] = [];

    for (const word of words) {
      const removedRange = visibleRemoved.find((range) => shouldMarkWordRemoved(word, range));
      if (removedRange) {
        const previous = pieces.at(-1);
        if (previous?.kind === "removed" && Math.abs(previous.sourceEnd - removedRange.sourceEnd) < 0.001) {
          previous.text = [previous.text, word.word].filter(Boolean).join(" ");
        } else {
          pieces.push({
            kind: "removed",
            id: `removed-${segment.id}-${removedRange.sourceStart}-${pieces.length}`,
            sourceStart: removedRange.sourceStart,
            sourceEnd: removedRange.sourceEnd,
            reason: removedRange.reason,
            text: removedRange.text || word.word
          });
        }
      } else {
        pieces.push({
          kind: "word",
          id: `word-${segment.id}-${word.start}-${word.end}-${word.word}`,
          sourceStart: word.start,
          sourceEnd: word.end,
          text: word.word
        });
      }
    }

    for (const range of visibleRemoved.filter((item) => item.sourceStart >= segment.start && item.sourceEnd <= segment.end)) {
      if (!pieces.some((piece) => piece.kind === "removed" && Math.abs(piece.sourceStart - range.sourceStart) < 0.001)) {
        pieces.push({
          kind: "removed",
          id: `pause-${segment.id}-${range.sourceStart}-${range.sourceEnd}`,
          sourceStart: range.sourceStart,
          sourceEnd: range.sourceEnd,
          reason: range.reason,
          text: range.text ?? ""
        });
      }
    }

    return { id: `phrase-${segment.id}`, pieces: [...pieces].sort((a, b) => a.sourceStart - b.sourceStart) };
  }).filter((phrase) => phrase.pieces.length > 0);
}

function shouldShowRemovedRange(range: { sourceStart: number; sourceEnd: number; reason: string; text?: string }) {
  if (!GAP_REASONS.has(range.reason)) return true;
  return true;
}

function shouldMarkWordRemoved(
  word: TranscriptWord,
  range: { sourceStart: number; sourceEnd: number; reason: string }
) {
  const overlap = overlapDuration(word.start, word.end, range.sourceStart, range.sourceEnd);
  if (overlap <= 0.02) return false;

  const wordDuration = Math.max(0.04, word.end - word.start);
  if (GAP_REASONS.has(range.reason)) {
    return overlap / wordDuration >= MIN_WORD_REMOVAL_OVERLAP_RATIO;
  }

  return true;
}

function wordsFromSegmentText(text: string, start: number, end: number): TranscriptWord[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  const duration = Math.max(0.1, end - start);
  return tokens.map((word, index) => {
    const wordStart = start + (duration * index) / tokens.length;
    const wordEnd = start + (duration * (index + 1)) / tokens.length;
    return { word, start: wordStart, end: wordEnd };
  });
}

function overlapDuration(start: number, end: number, targetStart: number, targetEnd: number) {
  return Math.max(0, Math.min(end, targetEnd) - Math.max(start, targetStart));
}

function formatSeconds(value: number) {
  if (value < 60) return `${Math.round(value)} сек`;
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatTime(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
