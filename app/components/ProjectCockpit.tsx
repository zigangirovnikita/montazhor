"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Mascot } from "@/app/components/UploadCockpit";
import {
  OverlayModeChooser,
  PresentationConfigurator,
  type StyleDraftOptions
} from "@/app/components/PresentationConfigurator";
import { StyleFlowModal } from "@/app/components/StyleFlowModal";
import type { PresentationMode, StylePreset } from "@/lib/types";

interface ProjectPayload {
  project: {
    id: string;
    status: string;
    originalFilename: string;
    cleanupMode?: string | null;
    presentationMode?: string | null;
    stylePreset?: string | null;
    styleOptionsJson?: string | null;
    errorMessage?: string | null;
    logs: Array<{ id: string; level: string; message: string; createdAt: string }>;
    aiUsages?: Array<{
      id: string;
      source: string;
      phase: string;
      provider: string;
      model?: string | null;
      responseId?: string | null;
      promptTokens?: number | null;
      completionTokens?: number | null;
      totalTokens?: number | null;
      reasoningTokens?: number | null;
      cachedTokens?: number | null;
      cacheWriteTokens?: number | null;
      audioTokens?: number | null;
      cost?: number | null;
      upstreamCost?: number | null;
      createdAt: string;
    }>;
  };
  draft?: {
    edl?: {
      removedRanges: Array<{ sourceStart: number; sourceEnd: number; reason: string; text?: string }>;
    };
    subtitles?: Array<{ id: string; start: number; end: number; text: string }>;
    contentPlan?: { hook: string; description: string; hashtags: string[] };
  } | null;
  originalUrl: string;
  cleanPreviewUrl: string | null;
  reviewUrl: string | null;
  downloadUrl: string | null;
}

const statusCopy: Record<string, { title: string; text: string }> = {
  extracting_audio: {
    title: "Слушаю видео",
    text: "Достаю звук, чтобы понять где речь, паузы и лишние куски."
  },
  transcribing: {
    title: "Расшифровываю речь",
    text: "Перевожу слова в текст с таймкодами."
  },
  planning: {
    title: "Думаю над обрезкой",
    text: "Смотрю, что можно убрать без потери смысла."
  },
  rendering_clean_video: {
    title: "Собираю черновой монтаж",
    text: "Готовлю clean draft без оформления."
  },
  rendering_preview: {
    title: "Оформляю предпросмотр",
    text: "Накладываю субтитры и собираю review-версию."
  },
  rendering_final: {
    title: "Подготавливаю к скачиванию",
    text: "Фиксирую подтвержденную версию в итоговый файл."
  }
};

export function ProjectCockpit({ projectId }: { projectId: string }) {
  const [payload, setPayload] = useState<ProjectPayload | null>(null);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [finalizeLoading, setFinalizeLoading] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [styleFlowOpen, setStyleFlowOpen] = useState(false);
  const [styleFlowStep, setStyleFlowStep] = useState<"overlay_choice" | "style_choice">("overlay_choice");
  const [presentationDraft, setPresentationDraft] = useState<PresentationMode | null>(null);
  const [styleDraft, setStyleDraft] = useState<StylePreset | null>(null);
  const [styleOptionsDraft, setStyleOptionsDraft] = useState<StyleDraftOptions | null>(null);

  const isProcessing = payload
    ? !["uploaded", "draft_ready", "review_ready", "done", "error"].includes(payload.project.status)
    : false;
  const presentationMode = presentationDraft ?? ((payload?.project.presentationMode as PresentationMode) || "subtitles_only");
  const stylePreset = styleDraft ?? ((payload?.project.stylePreset as StylePreset) || "clean_expert");
  const styleOptions = styleOptionsDraft ?? parseStyleOptions(payload?.project.styleOptionsJson);

  function syncLoadingFlags(status: string) {
    if (["draft_ready", "error"].includes(status)) setAnalyzeLoading(false);
    if (["review_ready", "error"].includes(status)) setPreviewLoading(false);
    if (["done", "error"].includes(status)) setFinalizeLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    async function refreshProject() {
      try {
        const response = await fetch(`/api/projects/${projectId}`, { cache: "no-store" });
        if (!response.ok) return;
        const nextPayload = (await response.json()) as ProjectPayload;
        if (cancelled) return;
        setPayload(nextPayload);
        if (nextPayload.project.status !== "draft_ready" && nextPayload.project.status !== "review_ready") {
          setPresentationDraft(null);
          setStyleDraft(null);
          setStyleOptionsDraft(null);
          setStyleFlowOpen(false);
          setStyleFlowStep("overlay_choice");
        }
        syncLoadingFlags(nextPayload.project.status);
      } catch {
        // Dev-сервер иногда перезапускается, интерфейс просто попробует снова.
      }
    }

    void refreshProject();
    const timer = setInterval(() => void refreshProject(), 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [projectId]);

  async function refresh() {
    const response = await fetch(`/api/projects/${projectId}`, { cache: "no-store" });
    const nextPayload = (await response.json()) as ProjectPayload;
    setPayload(nextPayload);
    if (nextPayload.project.status !== "draft_ready" && nextPayload.project.status !== "review_ready") {
      setPresentationDraft(null);
      setStyleDraft(null);
      setStyleOptionsDraft(null);
      setStyleFlowOpen(false);
      setStyleFlowStep("overlay_choice");
    }
    syncLoadingFlags(nextPayload.project.status);
  }

  async function startAnalyze(cleanupMode: "pauses_only" | "semantic_cleanup") {
    if (analyzeLoading || isProcessing) return;
    setAnalyzeLoading(true);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cleanupMode })
      });
      await fetch(`/api/projects/${projectId}/process`, { method: "POST" });
      await refresh();
    } catch {
      setAnalyzeLoading(false);
    }
  }

  async function renderPreview() {
    if (previewLoading || isProcessing) return;
    setPreviewLoading(true);
    try {
      setStyleFlowOpen(false);
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presentationMode,
          stylePreset,
          styleOptionsJson: styleOptions
        })
      });
      await fetch(`/api/projects/${projectId}/render`, { method: "POST" });
      await refresh();
    } catch {
      setPreviewLoading(false);
    }
  }

  async function finalizeExport() {
    if (finalizeLoading || isProcessing) return;
    setFinalizeLoading(true);
    try {
      setStyleFlowOpen(false);
      await fetch(`/api/projects/${projectId}/finalize`, { method: "POST" });
      await refresh();
    } catch {
      setFinalizeLoading(false);
    }
  }

  const savedSeconds = useMemo(() => {
    const removed = payload?.draft?.edl?.removedRanges ?? [];
    return removed.reduce((sum, range) => sum + Math.max(0, range.sourceEnd - range.sourceStart), 0);
  }, [payload]);

  if (!payload) {
    return (
      <main className="gosha-stage">
        <section className="wizard-card">
          <Mascot />
          <div className="loader-ring" />
          <p>Открываю проект...</p>
        </section>
      </main>
    );
  }

  if (payload.project.status === "error") {
    return (
      <ProjectShell>
        <Mascot mood="blink" />
        <div className="wizard-copy">
          <h2>Что-то пошло не так</h2>
          <p>{payload.project.errorMessage ?? "Ошибка обработки. Подробности можно посмотреть ниже."}</p>
        </div>
        <Link className="cta-button" href="/">
          Начать заново
        </Link>
        <TechnicalDetails payload={payload} open={detailsOpen} onToggle={() => setDetailsOpen((next) => !next)} />
      </ProjectShell>
    );
  }

  if (payload.project.status === "uploaded") {
    return (
      <ProjectShell>
        <Mascot />
        <div className="wizard-copy">
          <h2>Видео принято</h2>
          <p>Сначала решим, как чистить исходную речь. Оформление выберем уже после чернового монтажа.</p>
        </div>
        <div className="cut-choice-list">
          <button className="mode-button" type="button" onClick={() => startAnalyze("pauses_only")} disabled={analyzeLoading}>
            <strong>Только убрать паузы</strong>
            <span>Оставлю твои формулировки, но уберу длинные молчания и повисшие куски.</span>
          </button>
          <button className="mode-button" type="button" onClick={() => startAnalyze("semantic_cleanup")} disabled={analyzeLoading}>
            <strong>Паузы + почистить по смыслу</strong>
            <span>Уберу паузы, слабые дубли и лишние фразы, чтобы мысль шла плотнее.</span>
          </button>
        </div>
      </ProjectShell>
    );
  }

  if (isProcessing) {
    const copy = statusCopy[payload.project.status] ?? {
      title: "Работаю над видео",
      text: "Я обновлю экран, когда следующий шаг будет готов."
    };

    return (
      <ProjectShell>
        <Mascot />
        <div className="loader-ring" />
        <div className="wizard-copy">
          <h2>{copy.title}</h2>
          <p>{copy.text}</p>
        </div>
      </ProjectShell>
    );
  }

  if (payload.project.status === "draft_ready") {
    return (
      <ProjectShell wide>
        <div className="preview-heading">Черновой монтаж готов</div>
        <VideoPanel src={payload.cleanPreviewUrl ?? payload.originalUrl} label="Очищенный draft без субтитров и инфографики" />
        <div className="result-note">
          <Mascot size="normal" />
          <span>Я убрал примерно {savedSeconds.toFixed(1)} сек. Следующий шаг — выбрать, как оформить этот черновик.</span>
        </div>
        <AssistantCorrection
          title="Будущие правки после обрезки"
          text="Здесь позже появятся текстовые и голосовые команды вроде “чуть расширь этот кусок” или “убери паузу тут”. Пока этап только заложен."
        />
        <button
          className="cta-button"
          type="button"
          onClick={() => {
            setStyleFlowOpen(true);
            setStyleFlowStep("overlay_choice");
          }}
        >
          Монтаж устраивает
        </button>
        <TechnicalDetails payload={payload} open={detailsOpen} onToggle={() => setDetailsOpen((next) => !next)} />
        {styleFlowOpen ? renderStyleModal() : null}
      </ProjectShell>
    );
  }

  if (payload.project.status === "review_ready") {
    return (
      <ProjectShell wide>
        <div className="preview-heading">Предпросмотр оформления готов</div>
        <VideoPanel src={payload.reviewUrl ?? payload.cleanPreviewUrl ?? payload.originalUrl} label="Review-версия с выбранным оформлением" />
        <AssistantCorrection
          title="Будущие правки после наложения"
          text="Здесь позже появятся команды вроде “сделай сабы меньше”, “инфографику спокойнее” или “убери этот акцент”. Пока экран уже заложен, но команды еще не активированы."
        />
        <div className="review-actions">
          <button
            className="mode-button"
            type="button"
            onClick={() => {
              setStyleFlowOpen(true);
              setStyleFlowStep("overlay_choice");
            }}
          >
            Поменять оформление
          </button>
          <button className="cta-button" type="button" onClick={finalizeExport} disabled={finalizeLoading}>
            {finalizeLoading ? "Готовлю файл..." : "Все ок, подготовь к скачиванию"}
          </button>
        </div>
        <TechnicalDetails payload={payload} open={detailsOpen} onToggle={() => setDetailsOpen((next) => !next)} />
        {styleFlowOpen ? renderStyleModal() : null}
      </ProjectShell>
    );
  }

  return (
    <ProjectShell wide>
      <div className="final-badge">
        <Mascot size="normal" />
        <span>Готово. Это уже итоговая версия, подготовленная к скачиванию.</span>
      </div>
      <VideoPanel src={payload.downloadUrl ?? payload.reviewUrl ?? payload.cleanPreviewUrl ?? payload.originalUrl} label="Итоговое видео" />
      {payload.downloadUrl ? (
        <a className="cta-button" href={payload.downloadUrl}>
          Скачать видео
        </a>
      ) : null}
      <Link className="mode-button back-home" href="/">
        Начать новый монтаж
      </Link>
    </ProjectShell>
  );

  function renderStyleModal() {
    const title = styleFlowStep === "overlay_choice" ? "Что наложить?" : "Как это будет выглядеть?";
    const text = styleFlowStep === "overlay_choice"
      ? "Выбери состав оформления. Следующим окном я покажу только те настройки, которые относятся к выбранному варианту."
      : "Выбирай карточками. Активный вариант в каждой категории остается выбранным, пока ты сам не нажмешь другой.";

    return (
      <StyleFlowModal title={title} text={text}>
        {styleFlowStep === "overlay_choice" ? (
          <OverlayModeChooser
            presentationMode={presentationMode}
            pending={previewLoading}
            onPresentationModeChange={setPresentationDraft}
            onNext={() => setStyleFlowStep("style_choice")}
          />
        ) : (
          <PresentationConfigurator
            presentationMode={presentationMode}
            stylePreset={stylePreset}
            styleOptions={styleOptions}
            pending={previewLoading}
            onBack={() => setStyleFlowStep("overlay_choice")}
            onStylePresetChange={setStyleDraft}
            onStyleOptionsChange={setStyleOptionsDraft}
            onRenderPreview={renderPreview}
          />
        )}
      </StyleFlowModal>
    );
  }
}

function parseStyleOptions(raw: string | null | undefined): StyleDraftOptions {
  const fallback: StyleDraftOptions = {
    subtitleFont: "manrope",
    subtitleStyle: "active_word",
    subtitleBackdrop: "glass",
    infographicTone: "glass",
    infographicAccent: "mint"
  };

  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<StyleDraftOptions>;
    return {
      subtitleFont: parsed.subtitleFont ?? fallback.subtitleFont,
      subtitleStyle: parsed.subtitleStyle ?? fallback.subtitleStyle,
      subtitleBackdrop: parsed.subtitleBackdrop ?? fallback.subtitleBackdrop,
      infographicTone: parsed.infographicTone ?? fallback.infographicTone,
      infographicAccent: parsed.infographicAccent ?? fallback.infographicAccent
    };
  } catch {
    return fallback;
  }
}

function ProjectShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <main className="gosha-stage">
      <section className={wide ? "wizard-card wizard-card-wide" : "wizard-card"}>{children}</section>
    </main>
  );
}

function VideoPanel({ src, label }: { src: string; label: string }) {
  return (
    <div className="video-preview-box">
      <video src={src} controls playsInline />
      <span>{label}</span>
    </div>
  );
}

function AssistantCorrection({ title, text }: { title: string; text: string }) {
  return (
    <div className="future-edit-box">
      <strong>{title}</strong>
      <p>{text}</p>
      <div className="correction-box" aria-disabled="true">
        <textarea disabled placeholder="Напиши или наговори правку" />
        <button type="button" disabled>
          Голосом
        </button>
        <button type="button" disabled>
          →
        </button>
      </div>
    </div>
  );
}

function TechnicalDetails({
  payload,
  open,
  onToggle
}: {
  payload: ProjectPayload;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="technical-details">
      <button type="button" onClick={onToggle}>
        {open ? "Скрыть технические детали" : "Технические детали"}
      </button>
      {open ? <pre>{JSON.stringify({ project: payload.project, draft: payload.draft, logs: payload.project.logs }, null, 2)}</pre> : null}
    </div>
  );
}
