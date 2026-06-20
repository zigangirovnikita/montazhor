"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { ProjectPayload } from "@/app/components/projectFlowTypes";
import type { CleanupMode } from "@/lib/types";

export const processingSteps = [
  ["extracting_audio", "Распознаем звук"],
  ["transcribing", "Распознаем речь"],
  ["planning", "Ищем паузы, запинки и повторы"],
  ["rendering_clean_video", "Собираем черновик"],
  ["rendering_preview", "Накладываем оформление"],
  ["rendering_final", "Готовим финальный MP4"]
];

export function CleanupModeScreen({
  busy,
  error,
  onStart
}: {
  busy: boolean;
  error: string;
  onStart: (mode: CleanupMode) => void;
}) {
  return (
    <div className="flow-stack">
      <header className="screen-head">
        <p className="screen-step">Что сделать?</p>
        <h1>Выбери, что убрать</h1>
        <p>Без уровней жесткости. Каждый вариант делает только тот тип чистки, который ты выбрал.</p>
      </header>
      <div className="mode-card-list">
        <ModeCard title="Убрать только паузы" text="Режем только промежутки между словами. Сами слова и речевые связки не трогаем." onClick={() => onStart("pauses_only")} disabled={busy} />
        <ModeCard title="Убрать паузы и запинки" text="Режем паузы, эээ/мэээ/нууу, нераспознанный голосовой мусор между словами и явные слова-паразиты." featured onClick={() => onStart("pauses_and_fillers")} disabled={busy} />
        <ModeCard title="Убрать лишнее по смыслу" text="AI собирает финальный монолог по смыслу, а затем автоматически чистятся паузы и речевой мусор." onClick={() => onStart("semantic_cleanup")} disabled={busy} />
      </div>
      <div className="checklist-panel">
        {["паузы режутся по точным границам слов", "внутри мысли остается по 0.1с после слова и до следующего", "естественные связки вроде «ну/вот/короче» сохраняются, если несут смысл", "спорные смысловые куски можно потом проверить в тексте", "субтитры и черновик собираются сразу"].map((item) => (
          <label key={item}><input type="checkbox" defaultChecked /> {item}</label>
        ))}
      </div>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}

export function ProcessingScreen({ payload, status }: { payload: ProjectPayload; status: string }) {
  const removedCount = payload.draft?.edl?.removedRanges.length ?? 0;
  const currentIndex = Math.max(0, processingSteps.findIndex(([step]) => step === status));
  return (
    <div className="flow-stack center-processing">
      <div className="loader-ring" />
      <header className="screen-head">
        <p className="screen-step">Обработка</p>
        <h1>{processingTitle(status)}</h1>
      </header>
      <div className="processing-list">
        {processingSteps.slice(0, 5).map(([, label], index) => (
          <div className={index <= currentIndex ? "active" : ""} key={label}>
            <span>{index < currentIndex ? "✓" : index === currentIndex ? "…" : ""}</span>
            <p>{label}</p>
          </div>
        ))}
      </div>
      <div className="value-card">
        <strong>{removedCount || "—"}</strong>
        <span>найденных удалений появятся здесь после анализа</span>
      </div>
    </div>
  );
}

export function FinalPreview({
  payload,
  busy,
  onApprove,
  onStyle,
  onText,
  onSubtitledRender
}: {
  payload: ProjectPayload;
  busy: boolean;
  onApprove: () => void;
  onStyle: () => void;
  onText: () => void;
  onSubtitledRender: () => void;
}) {
  return (
    <div className="flow-stack">
      <header className="screen-head">
        <p className="screen-step">Финальный предпросмотр</p>
        <h1>Оцени ролик перед экспортом</h1>
      </header>
      <div className="compare-player">
        <video src={payload.reviewUrl ?? payload.cleanPreviewUrl ?? payload.originalUrl} controls playsInline />
      </div>
      <div className="review-button-grid">
        <button className="cta-button" type="button" onClick={onApprove}>Утвердить</button>
        <button className="mode-button secondary-action" type="button" disabled={busy} onClick={onSubtitledRender}>
          {payload.subtitledVideoActive ? "Собираю видео с субтитрами..." : "Скачать видео с субтитрами"}
        </button>
        {payload.subtitledVideoUrl ? <a className="mode-button secondary-action" href={payload.subtitledVideoUrl}>Скачать MP4 с субтитрами</a> : null}
        <button className="mode-button secondary-action" type="button" onClick={onStyle}>Выбрать другой шаблон</button>
        <button className="mode-button secondary-action" type="button" onClick={onText}>Вернуться к тексту</button>
      </div>
    </div>
  );
}

export function ExportScreen({ busy, onBack, onExport }: { busy: boolean; onBack: () => void; onExport: () => void }) {
  return (
    <div className="flow-stack">
      <header className="screen-head">
        <p className="screen-step">Экспорт</p>
        <h1>Собрать видео</h1>
      </header>
      <section className="export-panel">
        <h2>Формат</h2>
        <div className="choice-pills"><button className="active">Reels / Shorts</button><button>VK Клипы</button><button>Telegram</button></div>
        <h2>Качество</h2>
        <div className="choice-pills"><button>Быстрое</button><button className="active">Высокое</button></div>
      </section>
      <div className="split-actions">
        <button className="mode-button secondary-action" type="button" onClick={onBack}>Назад</button>
        <button className="cta-button" type="button" disabled={busy} onClick={onExport}>{busy ? "Собираю..." : "Собрать видео"}</button>
      </div>
    </div>
  );
}

export function DoneScreen({ payload }: { payload: ProjectPayload }) {
  return (
    <div className="flow-stack">
      <header className="screen-head">
        <p className="screen-step">Готово</p>
        <h1>Видео собрано</h1>
      </header>
      <div className="compare-player">
        <video src={payload.downloadUrl ?? payload.reviewUrl ?? payload.cleanPreviewUrl ?? payload.originalUrl} controls playsInline />
      </div>
      <div className="review-button-grid">
        {payload.downloadUrl ? <a className="cta-button" href={payload.downloadUrl}>Скачать</a> : null}
        {payload.subtitledVideoUrl ? <a className="mode-button secondary-action" href={payload.subtitledVideoUrl}>Скачать видео с субтитрами</a> : null}
        <button className="mode-button secondary-action" type="button" disabled>Поделиться</button>
        <Link className="mode-button secondary-action" href="/">Сделать еще версию</Link>
        <Link className="mode-button secondary-action" href="/">Вернуться в меню</Link>
      </div>
    </div>
  );
}

export function LoadingScreen({ title, text }: { title: string; text: string }) {
  return <div className="center-flow"><div className="loader-ring" /><h1>{title}</h1><p>{text}</p></div>;
}

export function ProjectShell({ children }: { children: ReactNode }) {
  return <main className="mobile-stage"><section className="phone-shell">{children}</section></main>;
}

function ModeCard({ title, text, featured = false, disabled, onClick }: { title: string; text: string; featured?: boolean; disabled: boolean; onClick: () => void }) {
  return <button className={`mode-card ${featured ? "featured" : ""}`} type="button" disabled={disabled} onClick={onClick}><strong>{title}</strong><span>{text}</span></button>;
}

function processingTitle(status: string) {
  if (status === "rendering_preview") return "Оформляем ролик";
  if (status === "rendering_final") return "Готовим экспорт";
  return "Собираем черновик";
}
