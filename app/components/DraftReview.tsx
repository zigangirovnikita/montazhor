"use client";

import type { DraftEditRequest, ProjectPayload } from "@/app/components/projectFlowTypes";
import { DraftReviewTicker } from "@/app/components/DraftReviewTicker";

export function DraftReview({
  payload,
  compareMode,
  editBusy,
  onCompareModeChange,
  onDraftEdit,
  onOpenPrecision,
  onContinue
}: {
  payload: ProjectPayload;
  compareMode: "after" | "before";
  editBusy: boolean;
  onCompareModeChange: (value: "after" | "before") => void;
  onDraftEdit: (request: DraftEditRequest) => void | Promise<void>;
  onOpenPrecision: () => void;
  onContinue?: () => void;
}) {
  const summary = summarizeDraft(payload);

  return (
    <div className="flow-stack">
      <header className="screen-head">
        <p className="screen-step">Проверка черновика</p>
        <h1>Посмотри результат. Правь текстом, не таймлайном.</h1>
      </header>

      <section className="summary-grid">
        <Metric label="Удалено" value={`${summary.removedCount}`} />
        <Metric label="Сокращено" value={formatSeconds(summary.savedSeconds)} />
        <Metric label="Склеек" value={`${summary.cuts}`} />
      </section>

      <DraftReviewTicker
        payload={payload}
        compareMode={compareMode}
        editBusy={editBusy}
        onCompareModeChange={onCompareModeChange}
        onDraftEdit={onDraftEdit}
        onContinue={onContinue ?? (() => undefined)}
      />

      <button className="mode-button secondary-action" type="button" onClick={onOpenPrecision}>
        Точная настройка
      </button>
    </div>
  );
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
  onDraftEdit: (request: DraftEditRequest) => void | Promise<void>;
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

function formatSeconds(value: number) {
  if (value < 1) return `${value.toFixed(2)} сек`;
  if (value < 10) return `${value.toFixed(1)} сек`;
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
