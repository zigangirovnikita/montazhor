"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { LiveCaptionPreview } from "@/app/components/LiveCaptionPreview";
import { DraftReview } from "@/app/components/DraftReview";
import type { DraftEditRequest, ProjectPayload, StyleState } from "@/app/components/projectFlowTypes";
import type { StyleDraftOptions } from "@/app/components/PresentationConfigurator";
import { outputTimeToSourceTime, sourceTimeToOutputTime } from "@/app/components/draftReviewTimeline";
import type { StylePreset } from "@/lib/types";

export type EditorTab = "transcript" | "style" | "enrichments" | "publish";

interface ProjectEditorProps {
  payload: ProjectPayload;
  activeTab: EditorTab;
  compareMode: "after" | "before";
  busy: boolean;
  editBusy: boolean;
  styleSaving: boolean;
  styleDirtyAfterExport: boolean;
  error: string;
  styleState: StyleState;
  onTabChange: (tab: EditorTab) => void;
  onCompareModeChange: (value: "after" | "before") => void;
  onDraftEdit: (request: DraftEditRequest) => void | Promise<void>;
  onOpenPrecision: () => void;
  onStyleChange: (next: StyleState) => void | Promise<void>;
  onExport: () => void | Promise<void>;
  onSubtitledRender: () => void | Promise<void>;
}

const editorTabs: Array<{ id: EditorTab; label: string }> = [
  { id: "transcript", label: "Текст и чистка" },
  { id: "style", label: "Стили субтитров" },
  { id: "enrichments", label: "Эффекты" },
  { id: "publish", label: "Постинг" }
];

const subtitlePresets: Array<{
  id: string;
  title: string;
  note: string;
  sample: string;
  stylePreset: StylePreset;
  options: Partial<StyleDraftOptions>;
}> = [
  { id: "bold-yellow", title: "Желтый акцент", note: "Крупный активный акцент", sample: "ВАЖНАЯ МЫСЛЬ", stylePreset: "dynamic_viral", options: { subtitleFont: "manrope", subtitleStyle: "active_word", subtitleBackdrop: "solid", presetPack: "viral", motionIntensity: "active" } },
  { id: "clean-white", title: "Чистый белый", note: "Белый текст без шума", sample: "Чистая фраза", stylePreset: "clean_expert", options: { subtitleFont: "onest", subtitleStyle: "clean", subtitleBackdrop: "none", presetPack: "minimal", motionIntensity: "calm" } },
  { id: "premium-minimal", title: "Премиум минимум", note: "Спокойный экспертный вид", sample: "Главный вывод", stylePreset: "premium_calm", options: { subtitleFont: "golos", subtitleStyle: "active_word", subtitleBackdrop: "glass", presetPack: "premium", motionIntensity: "calm" } },
  { id: "coral-pop", title: "Оранжевый маркер", note: "Маркерный акцент", sample: "новый ракурс", stylePreset: "clean_expert", options: { subtitleFont: "montserrat", subtitleStyle: "marker", subtitleBackdrop: "glass", infographicAccent: "orange", presetPack: "educational" } },
  { id: "purple-glow", title: "Темное свечение", note: "Контраст для динамики", sample: "быстрый рост", stylePreset: "dynamic_viral", options: { subtitleFont: "unbounded", subtitleStyle: "active_word", subtitleBackdrop: "glass", presetPack: "viral", visualDensity: "high" } },
  { id: "dark-neon", title: "Темный неон", note: "Контраст для коротких роликов", sample: "НЕ ПРОПУСТИ", stylePreset: "viral_kinetic", options: { subtitleFont: "manrope", subtitleStyle: "active_word", subtitleBackdrop: "solid", presetPack: "viral", motionIntensity: "active" } }
];

const templateCombos = [
  ["Экспертная чистка", "clean-white", "Текст + спокойный акцент"],
  ["Вирусный хук", "bold-yellow", "Крупный первый экран"],
  ["Премиальный разговор", "premium-minimal", "Мягкое оформление"],
  ["Неоновый ролик", "dark-neon", "Контрастный вид"]
];

export function ProjectEditor({
  payload,
  activeTab,
  compareMode,
  busy,
  editBusy,
  styleSaving,
  styleDirtyAfterExport,
  error,
  styleState,
  onTabChange,
  onCompareModeChange,
  onDraftEdit,
  onOpenPrecision,
  onStyleChange,
  onExport,
  onSubtitledRender
}: ProjectEditorProps) {
  const keptRanges = payload.draft?.edl?.keptRanges ?? [];
  const [previewTime, setPreviewTime] = useState(0);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [seekRequest, setSeekRequest] = useState<{ id: number; time: number } | null>(null);
  const previousCompareModeRef = useRef(compareMode);
  const seekRequestIdRef = useRef(0);
  const activeVideoUrl = compareMode === "before"
    ? payload.originalUrl
    : payload.cleanPreviewUrl ?? payload.reviewUrl ?? payload.originalUrl;
  const showPreviewSubtitles = activeTab !== "transcript" && compareMode === "after";
  const queueSeek = useEffectEvent((time: number) => {
    seekRequestIdRef.current += 1;
    setSeekRequest({ id: seekRequestIdRef.current, time });
  });

  useEffect(() => {
    const previousMode = previousCompareModeRef.current;
    if (previousMode === compareMode) return;
    previousCompareModeRef.current = compareMode;
    const sourceTime = previousMode === "before"
      ? previewTime
      : outputTimeToSourceTime(keptRanges, previewTime);
    const nextPlaybackTime = compareMode === "before"
      ? sourceTime
      : sourceTimeToOutputTime(keptRanges, sourceTime);
    queueSeek(nextPlaybackTime);
    setPreviewTime(nextPlaybackTime);
  }, [compareMode, keptRanges, previewTime]);

  useEffect(() => {
    setPreviewTime(0);
    queueSeek(0);
  }, [activeVideoUrl]);

  return (
    <div className="project-editor">
      <section className="editor-work-panel">
        <div className="project-toolbar">
          <div>
            <span>{projectStatusLabel(payload.project.status)}</span>
            <h2>{payload.project.originalFilename}</h2>
          </div>
          <div className="editor-tabs" role="tablist">
            {editorTabs.map((tab) => (
              <button className={activeTab === tab.id ? "active" : ""} key={tab.id} type="button" onClick={() => onTabChange(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "transcript" ? (
          <DraftReview
            payload={payload}
            compareMode={compareMode}
            editBusy={editBusy}
            onDraftEdit={onDraftEdit}
            onOpenPrecision={onOpenPrecision}
            playbackTime={previewTime}
            playbackActive={previewPlaying}
            onSeekPlaybackTime={(time) => {
              queueSeek(time);
              setPreviewTime(time);
            }}
            onContinue={() => onTabChange("style")}
          />
        ) : null}

        {activeTab === "style" ? (
          <StyleStudioPanel styleState={styleState} styleSaving={styleSaving} onStyleChange={onStyleChange} />
        ) : null}

        {activeTab === "enrichments" ? <EnrichmentsPanel payload={payload} /> : null}
        {activeTab === "publish" ? <PublishPanel payload={payload} /> : null}

        {error ? <p className="error floating-error">{error}</p> : null}
      </section>

      <aside className="editor-preview-panel">
        <div className="preview-panel-head">
          <div>
            <span>Живой предпросмотр</span>
            <h2>{activeTab === "transcript" ? "Видео без субтитров" : "Видео с субтитрами"}</h2>
          </div>
        </div>
        <div className="segmented-control preview-compare-control" aria-label="Сравнение исходника и версии после обрезки">
          <button className={compareMode === "before" ? "active" : ""} type="button" onClick={() => onCompareModeChange("before")}>
            Исходник
          </button>
          <button className={compareMode === "after" ? "active" : ""} type="button" onClick={() => onCompareModeChange("after")}>
            После обрезки
          </button>
        </div>
        <LiveCaptionPreview
          videoUrl={activeVideoUrl}
          plan={payload.livePreviewPlan}
          stylePreset={styleState.stylePreset}
          styleOptions={styleState.styleOptions}
          showSubtitles={showPreviewSubtitles}
          currentTime={previewTime}
          onTimeChange={setPreviewTime}
          onPlayingChange={setPreviewPlaying}
          seekRequest={seekRequest}
        />
        {activeTab === "publish" ? (
          <section className="export-card">
            <div>
              <h2>Экспорт</h2>
              <p>{styleDirtyAfterExport ? "Стиль изменился после последнего экспорта. Нужен повторный экспорт." : "Предпросмотр не запускает тяжелый рендер. MP4 собирается только здесь."}</p>
            </div>
            <button className="small-ghost full" type="button" disabled={busy} onClick={() => void onSubtitledRender()}>
              {payload.subtitledVideoActive ? "Собираю предпросмотр..." : "Собрать MP4 с субтитрами"}
            </button>
            {payload.downloadUrl && !styleDirtyAfterExport ? (
              <a className="cta-button compact" href={payload.downloadUrl}>Скачать MP4</a>
            ) : (
              <button className="cta-button compact" type="button" disabled={busy} onClick={() => void onExport()}>
                {busy ? "Экспорт..." : "Экспортировать MP4"}
              </button>
            )}
            {payload.subtitledVideoUrl ? <a className="small-ghost full" href={payload.subtitledVideoUrl}>Скачать предпросмотр MP4 с субтитрами</a> : null}
          </section>
        ) : null}
      </aside>
    </div>
  );
}

function StyleStudioPanel({
  styleState,
  styleSaving,
  onStyleChange
}: {
  styleState: StyleState;
  styleSaving: boolean;
  onStyleChange: (next: StyleState) => void | Promise<void>;
}) {
  return (
    <div className="style-studio-desktop">
      <section className="template-combos">
        <div className="section-row-title">
          <h2>Комбинации / шаблоны</h2>
          <span>{styleSaving ? "Сохраняю..." : "мгновенный предпросмотр"}</span>
        </div>
        <div className="template-combo-grid">
          {templateCombos.map(([title, presetId, note]) => (
            <button key={title} type="button" onClick={() => applyPreset(presetId, styleState, onStyleChange)}>
              <strong>{title}</strong>
              <span>{note}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="subtitle-preset-grid">
        {subtitlePresets.map((preset) => {
          const selected = isPresetSelected(preset, styleState);
          return (
            <button
              className={`subtitle-style-card ${selected ? "active" : ""} preset-${preset.id}`}
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id, styleState, onStyleChange)}
            >
              <span className="style-sample">{preset.sample}</span>
              <strong>{preset.title}</strong>
              <small>{preset.note}</small>
            </button>
          );
        })}
      </section>
    </div>
  );
}

function EnrichmentsPanel({ payload }: { payload: ProjectPayload }) {
  const fragments = payload.draft?.subtitles?.slice(0, 8) ?? [];
  return (
    <div className="effects-panel">
      <div className="placeholder-inline">
        <strong>Сделаем позже</strong>
        <span>Смайлики, звуки, стикеры, картинки и видео-вставки пока показаны как каркас без тяжелой медиа-логики.</span>
      </div>
      {fragments.length > 0 ? fragments.map((fragment) => (
        <div className="effect-row" key={fragment.id}>
          <div><strong>{formatTime(fragment.start)}-{formatTime(fragment.end)}</strong><span>{fragment.text}</span></div>
          <button disabled>Добавить смайл</button>
          <button disabled>Добавить звук</button>
          <button disabled>Добавить картинку</button>
          <button disabled>Добавить видео</button>
        </div>
      )) : <p className="empty-state">Фрагменты субтитров пока недоступны.</p>}
    </div>
  );
}

function PublishPanel({ payload }: { payload: ProjectPayload }) {
  const plan = payload.draft?.contentPlan;
  return (
    <div className="publish-panel">
      <label>Заголовок<input readOnly value={plan?.hook ?? ""} placeholder="Сгенерируем позже" /></label>
      <label>Описание<textarea readOnly value={plan?.description ?? ""} placeholder="Описание для ролика появится здесь позже." /></label>
      <label>Хештеги<input readOnly value={plan?.hashtags?.join(" ") ?? ""} placeholder="#монтаж #ролики" /></label>
      <button className="mode-button secondary-action" type="button" disabled>Сгенерировать позже</button>
    </div>
  );
}

function applyPreset(id: string, styleState: StyleState, onStyleChange: (next: StyleState) => void | Promise<void>) {
  const preset = subtitlePresets.find((item) => item.id === id);
  if (!preset) return;
  void onStyleChange({
    presentationMode: "subtitles_only",
    stylePreset: preset.stylePreset,
    styleOptions: {
      ...styleState.styleOptions,
      ...preset.options
    }
  });
}

function isPresetSelected(
  preset: (typeof subtitlePresets)[number],
  styleState: StyleState
) {
  return styleState.stylePreset === preset.stylePreset &&
    Object.entries(preset.options).every(([key, value]) => styleState.styleOptions[key as keyof StyleDraftOptions] === value);
}

function formatTime(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function projectStatusLabel(status: string) {
  if (status === "draft_ready") return "Черновик готов";
  if (status === "review_ready") return "Предпросмотр готов";
  if (status === "done") return "Экспорт готов";
  return "В работе";
}
