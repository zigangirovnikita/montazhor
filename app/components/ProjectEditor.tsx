"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LiveCaptionPreview } from "@/app/components/LiveCaptionPreview";
import { DraftReview } from "@/app/components/DraftReview";
import { SubtitleStyleStudio } from "@/app/components/SubtitleStyleStudio";
import { withTemplateToggles } from "@/app/components/subtitleStylePresets";
import type { DraftEditRequest, ProjectPayload, StyleState } from "@/app/components/projectFlowTypes";
import { outputTimeToSourceTime, sourceTimeToOutputTime } from "@/app/components/draftReviewTimeline";

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
  const keptRanges = useMemo(() => payload.draft?.edl?.keptRanges ?? [], [payload.draft?.edl?.keptRanges]);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [seekRequest, setSeekRequest] = useState<{ id: number; time: number } | null>(null);
  const previousCompareModeRef = useRef(compareMode);
  const previousAutoSeekRef = useRef<{ videoUrl: string; subtitlesVisible: boolean; firstCaptionStart: number } | null>(null);
  const seekRequestIdRef = useRef(0);
  const activeVideoUrl = compareMode === "before"
    ? payload.originalUrl
    : payload.cleanPreviewUrl ?? payload.reviewUrl ?? payload.originalUrl;
  const showPreviewSubtitles = activeTab !== "transcript" && compareMode === "after";
  const firstCaptionStart = payload.livePreviewPlan?.captions?.[0]?.start ?? 0;
  const queueSeek = (time: number) => {
    seekRequestIdRef.current += 1;
    setSeekRequest({ id: seekRequestIdRef.current, time });
  };

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
  }, [compareMode, keptRanges, previewTime]);

  useEffect(() => {
    const previous = previousAutoSeekRef.current;
    const videoChanged = previous?.videoUrl !== activeVideoUrl;
    const subtitlesJustBecameVisible = showPreviewSubtitles && previous?.subtitlesVisible !== true;
    const firstCaptionJustBecameAvailable = showPreviewSubtitles && (previous?.firstCaptionStart ?? 0) <= 0 && firstCaptionStart > 0;
    previousAutoSeekRef.current = { videoUrl: activeVideoUrl, subtitlesVisible: showPreviewSubtitles, firstCaptionStart };

    if (!videoChanged && !subtitlesJustBecameVisible && !firstCaptionJustBecameAvailable) return;
    queueSeek(showPreviewSubtitles ? firstCaptionStart : 0);
  }, [activeVideoUrl, firstCaptionStart, showPreviewSubtitles]);

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

        {activeTab === "enrichments" ? (
          <EnrichmentsPanel
            payload={payload}
            styleState={styleState}
            onStyleChange={onStyleChange}
          />
        ) : null}
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
          onTimeChange={activeTab === "transcript" ? setPreviewTime : undefined}
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
  return <SubtitleStyleStudio styleState={styleState} styleSaving={styleSaving} onStyleChange={onStyleChange} />;
}

function EnrichmentsPanel({
  payload,
  styleState,
  onStyleChange
}: {
  payload: ProjectPayload;
  styleState: StyleState;
  onStyleChange: (next: StyleState) => void | Promise<void>;
}) {
  const options = styleState.styleOptions;
  const beats = payload.livePreviewPlan?.visualBeats ?? [];

  const toggleInsert = (patch: Partial<StyleState["styleOptions"]>) => {
    void onStyleChange({
      presentationMode: styleState.presentationMode,
      stylePreset: styleState.stylePreset,
      styleOptions: withTemplateToggles({
        ...styleState.styleOptions,
        ...patch,
        styleRecipeId: undefined
      })
    });
  };

  return (
    <div className="effects-panel">
      <div className="placeholder-inline">
        <strong>Лёгкие авто-вставки уже работают</strong>
        <span>Эта вкладка управляет тем, что браузер может показать сразу в preview: цифры, списки, сравнения, зачёркивания и CTA.</span>
      </div>

      <section className="element-list">
        <ToggleRow label="Списки" checked={options.autoLists !== false} onToggle={() => toggleInsert({ autoLists: options.autoLists === false })} />
        <ToggleRow label="Сравнения / схемы" checked={options.autoComparisons !== false} onToggle={() => toggleInsert({ autoComparisons: options.autoComparisons === false })} />
        <ToggleRow label="Цифры / графики" checked={options.autoCharts !== false} onToggle={() => toggleInsert({ autoCharts: options.autoCharts === false })} />
        <ToggleRow label="CTA" checked={options.autoCta !== false} onToggle={() => toggleInsert({ autoCta: options.autoCta === false })} />
        <ToggleRow label="Зачёркивания" checked={options.autoStrike !== false} onToggle={() => toggleInsert({ autoStrike: options.autoStrike === false })} />
      </section>

      <section className="choice-group">
        <h3>Плотность вставок</h3>
        <div>
          {[
            ["low", "Редко"],
            ["medium", "Средне"],
            ["high", "Плотно"]
          ].map(([id, label]) => (
            <button
              className={(options.visualDensity ?? "medium") === id ? "active" : ""}
              key={id}
              type="button"
              onClick={() => toggleInsert({ visualDensity: id as "low" | "medium" | "high" })}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {beats.length > 0 ? (
        <div className="effect-list">
          {beats.map((beat) => (
            <div className="effect-row" key={beat.id}>
              <div>
                <strong>{formatTime(beat.start)}-{formatTime(beat.end)}</strong>
                <span>{beat.templateId}</span>
              </div>
              <span>{beatLabel(beat)}</span>
            </div>
          ))}
        </div>
      ) : <p className="empty-state">Сейчас auto-вставки не сгенерированы. Проверь тумблеры и плотность.</p>}
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

function formatTime(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function beatLabel(beat: NonNullable<ProjectPayload["livePreviewPlan"]>["visualBeats"][number]) {
  if (typeof beat.payload.value === "string") return beat.payload.value;
  if (typeof beat.payload.text === "string") return beat.payload.text;
  if (typeof beat.payload.title === "string") return beat.payload.title;
  if (typeof beat.payload.center === "string") return beat.payload.center;
  return beat.templateId;
}

function ToggleRow({
  label,
  checked,
  onToggle
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button className="toggle-row" type="button" onClick={onToggle}>
      <span>{label}</span>
      <i className={checked ? "on" : ""} aria-hidden="true" />
    </button>
  );
}

function projectStatusLabel(status: string) {
  if (status === "draft_ready") return "Черновик готов";
  if (status === "review_ready") return "Предпросмотр готов";
  if (status === "done") return "Экспорт готов";
  return "В работе";
}
