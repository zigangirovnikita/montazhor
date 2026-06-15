"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DraftReview, PrecisionTune } from "@/app/components/DraftReview";
import {
  CleanupModeScreen,
  DoneScreen,
  ExportScreen,
  FinalPreview,
  LoadingScreen,
  ProcessingScreen,
  ProjectShell
} from "@/app/components/ProjectScreens";
import { parseStyleOptions, resolvePresentationMode, resolveStylePreset } from "@/app/components/StyleStudio";
import { TemplatePicker } from "@/app/components/TemplatePicker";
import type { DraftEditRequest, ProjectPayload, StyleState } from "@/app/components/projectFlowTypes";
import type { CleanupMode, ScreenCopyPayload, SceneRecipeId } from "@/lib/types";
import { templateToVisualPlanOptions, type StoredTemplate } from "@/lib/templateBuilder";

type LocalView = "main" | "text" | "precision" | "templates" | "export";
type CompareMode = "after" | "before";

export function ProjectCockpit({ projectId, initialView = "main" }: { projectId: string; initialView?: LocalView }) {
  const [payload, setPayload] = useState<ProjectPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [view, setView] = useState<LocalView>(initialView);
  const [compareMode, setCompareMode] = useState<CompareMode>("after");
  const [error, setError] = useState("");
  const [styleState, setStyleState] = useState<StyleState | null>(null);

  const status = payload?.project.status ?? "";
  const isProcessing = payload ? !["uploaded", "draft_ready", "review_ready", "done", "error"].includes(status) : false;

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      const next = await fetchProject(projectId).catch(() => null);
      if (!next || cancelled) return;
      setPayload(next);
      setStyleState((current) => current ?? styleStateFromPayload(next));
      if (["draft_ready", "review_ready", "done", "error"].includes(next.project.status)) setBusy(false);
    }

    void tick();
    const timer = setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [projectId]);

  async function refresh() {
    const next = await fetchProject(projectId);
    setPayload(next);
    setStyleState(styleStateFromPayload(next));
    if (["draft_ready", "review_ready", "done", "error"].includes(next.project.status)) setBusy(false);
  }

  async function startAnalyze(cleanupMode: CleanupMode) {
    if (busy || isProcessing) return;
    setBusy(true);
    setError("");
    try {
      await apiPatch(projectId, { cleanupMode });
      await apiPost(`/api/projects/${projectId}/process`);
      await refresh();
    } catch (requestError) {
      setBusy(false);
      setError(messageFromError(requestError));
    }
  }

  async function applyDraftEdit(request: DraftEditRequest) {
    if (editBusy || isProcessing) return;
    setEditBusy(true);
    setError("");
    try {
      await apiPost(`/api/projects/${projectId}/draft-edits`, request);
      setCompareMode("after");
      await refresh();
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setEditBusy(false);
    }
  }

  async function renderPreview(template: StoredTemplate) {
    if (busy || isProcessing) return;
    setBusy(true);
    setError("");
    const nextStyleState = styleStateForTemplate(template);
    setStyleState(nextStyleState);
    try {
      await apiPatch(projectId, {
        presentationMode: nextStyleState.presentationMode,
        stylePreset: nextStyleState.stylePreset,
        styleOptionsJson: nextStyleState.styleOptions
      });
      await apiPost(`/api/projects/${projectId}/render`);
      setView("main");
      await refresh();
    } catch (requestError) {
      setBusy(false);
      setError(messageFromError(requestError));
    }
  }

  async function finalizeExport() {
    if (busy || isProcessing) return;
    setBusy(true);
    setError("");
    try {
      await apiPost(`/api/projects/${projectId}/finalize`);
      setView("main");
      await refresh();
    } catch (requestError) {
      setBusy(false);
      setError(messageFromError(requestError));
    }
  }

  async function applySceneBlockAction(body: { blockId: string; action: "regenerate_block" | "change_scene" | "simplify_scene" | "make_stronger" | "disable_layer" | "bring_speaker_back" | "hide_speaker_for_block" | "switch_to_safe_mode" | "disable_insert" | "edit_copy"; recipeId?: SceneRecipeId; layerId?: string; copyPatch?: Partial<ScreenCopyPayload> }) {
    if (busy || isProcessing) return;
    setBusy(true);
    setError("");
    try {
      await apiPost(`/api/projects/${projectId}/scene-blocks`, body);
      await apiPost(`/api/projects/${projectId}/render`);
      await refresh();
    } catch (requestError) {
      setBusy(false);
      setError(messageFromError(requestError));
    }
  }

  if (!payload || !styleState) {
    return <ProjectShell><LoadingScreen title="Открываю проект" text="Подгружаю видео, текст и статус обработки." /></ProjectShell>;
  }

  if (status === "error") {
    return (
      <ProjectShell>
        <div className="center-flow">
          <h1>Что-то пошло не так</h1>
          <p>{payload.project.errorMessage ?? "Ошибка обработки. Подробности доступны в логах проекта."}</p>
          <Link className="cta-button" href="/">Начать заново</Link>
        </div>
      </ProjectShell>
    );
  }

  if (status === "uploaded") {
    return (
      <ProjectShell>
        <CleanupModeScreen busy={busy} error={error} onStart={startAnalyze} />
      </ProjectShell>
    );
  }

  if (isProcessing) {
    return (
      <ProjectShell>
        <ProcessingScreen payload={payload} status={status} />
      </ProjectShell>
    );
  }

  if (status === "draft_ready") {
    if (view === "precision") {
      return (
        <ProjectShell>
          <PrecisionTune payload={payload} editBusy={editBusy} onBack={() => setView("main")} onDraftEdit={applyDraftEdit} />
          {error ? <p className="error floating-error">{error}</p> : null}
        </ProjectShell>
      );
    }

    if (view === "templates") {
      return (
        <ProjectShell>
          <TemplatePicker
            projectId={projectId}
            selectedTemplateId={styleState.styleOptions.visualTemplateId}
            pending={busy}
            onSelectTemplate={renderPreview}
          />
          {error ? <p className="error floating-error">{error}</p> : null}
        </ProjectShell>
      );
    }

    return (
      <ProjectShell>
        <DraftReview
          payload={payload}
          compareMode={compareMode}
          editBusy={editBusy}
          onCompareModeChange={setCompareMode}
          onDraftEdit={applyDraftEdit}
          onOpenPrecision={() => setView("precision")}
          onContinue={() => setView("templates")}
        />
        {error ? <p className="error floating-error">{error}</p> : null}
      </ProjectShell>
    );
  }

  if (status === "review_ready") {
    if (view === "text") {
      return (
        <ProjectShell>
          <DraftReview
            payload={payload}
            compareMode={compareMode}
            editBusy={editBusy}
            onCompareModeChange={setCompareMode}
            onDraftEdit={applyDraftEdit}
            onOpenPrecision={() => setView("precision")}
            onContinue={() => setView("templates")}
          />
          {error ? <p className="error floating-error">{error}</p> : null}
        </ProjectShell>
      );
    }

    if (view === "precision") {
      return (
        <ProjectShell>
          <PrecisionTune payload={payload} editBusy={editBusy} onBack={() => setView("main")} onDraftEdit={applyDraftEdit} />
          {error ? <p className="error floating-error">{error}</p> : null}
        </ProjectShell>
      );
    }

    if (view === "templates") {
      return (
        <ProjectShell>
          <TemplatePicker
            projectId={projectId}
            selectedTemplateId={styleState.styleOptions.visualTemplateId}
            pending={busy}
            onSelectTemplate={renderPreview}
          />
          {error ? <p className="error floating-error">{error}</p> : null}
        </ProjectShell>
      );
    }

    if (view === "export") {
      return <ProjectShell><ExportScreen busy={busy} onBack={() => setView("main")} onExport={finalizeExport} /></ProjectShell>;
    }

    return (
      <ProjectShell>
        <FinalPreview
          payload={payload}
          busy={busy}
          onApprove={() => setView("export")}
          onStyle={() => setView("templates")}
          onText={() => setView("text")}
          onSceneAction={applySceneBlockAction}
        />
      </ProjectShell>
    );
  }

  return (
    <ProjectShell>
      <DoneScreen payload={payload} />
    </ProjectShell>
  );
}

function styleStateForTemplate(template: StoredTemplate): StyleState {
  const templateOptions = templateToVisualPlanOptions(template.data);
  return {
    presentationMode: "subtitles_infographics",
    stylePreset: stylePresetForTemplate(templateOptions.presetPack),
    styleOptions: {
      subtitleFont: "manrope",
      subtitleStyle: "active_word",
      subtitleBackdrop: "glass",
      infographicTone: "glass",
      infographicAccent: "mint",
      visualDensity: templateOptions.visualDensity ?? "medium",
      motionIntensity: templateOptions.motionIntensity ?? "medium",
      presetPack: templateOptions.presetPack ?? "balanced",
      disabledTemplates: templateOptions.disabledTemplates ?? [],
      visualTemplateId: template.id,
      visualTemplate: template.data
    }
  };
}

function stylePresetForTemplate(presetPack: string | undefined) {
  if (presetPack === "viral") return "dynamic_viral";
  if (presetPack === "premium") return "premium_calm";
  return "clean_expert";
}

function styleStateFromPayload(payload: ProjectPayload): StyleState {
  return {
    presentationMode: resolvePresentationMode(payload.project.presentationMode),
    stylePreset: resolveStylePreset(payload.project.stylePreset),
    styleOptions: parseStyleOptions(payload.project.styleOptionsJson)
  };
}

async function fetchProject(projectId: string) {
  const response = await fetch(`/api/projects/${projectId}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Не получилось открыть проект.");
  return (await response.json()) as ProjectPayload;
}

async function apiPatch(projectId: string, body: unknown) {
  const response = await fetch(`/api/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(await readApiError(response));
}

async function apiPost(url: string, body?: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) throw new Error(await readApiError(response));
}

async function readApiError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return payload?.error ?? "Запрос не выполнен.";
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Не получилось выполнить действие.";
}
