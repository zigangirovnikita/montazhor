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
import { ElementAdjustments, parseStyleOptions, resolvePresentationMode, resolveStylePreset, StyleStudio } from "@/app/components/StyleStudio";
import type { DraftEditRequest, ProjectPayload, StyleState } from "@/app/components/projectFlowTypes";
import type { CleanupMode } from "@/lib/types";

type LocalView = "main" | "text" | "precision" | "style" | "advanced_style" | "elements" | "export";
type CompareMode = "after" | "before";

export function ProjectCockpit({ projectId }: { projectId: string }) {
  const [payload, setPayload] = useState<ProjectPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [view, setView] = useState<LocalView>("main");
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

  async function renderPreview() {
    if (!styleState || busy || isProcessing) return;
    setBusy(true);
    setError("");
    try {
      await apiPatch(projectId, {
        presentationMode: styleState.presentationMode,
        stylePreset: styleState.stylePreset,
        styleOptionsJson: styleState.styleOptions
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

    if (view === "style" || view === "advanced_style") {
      return (
        <ProjectShell>
          <StyleStudio
            payload={payload}
            styleState={styleState}
            pending={busy}
            advancedOpen={view === "advanced_style"}
            onStyleChange={setStyleState}
            onAdvancedToggle={() => setView(view === "advanced_style" ? "style" : "advanced_style")}
            onRenderPreview={renderPreview}
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
        />
        {error ? <p className="error floating-error">{error}</p> : null}
        <div className="sticky-actions">
          <button className="cta-button" type="button" onClick={() => setView("style")}>Монтаж принят</button>
        </div>
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
          />
          {error ? <p className="error floating-error">{error}</p> : null}
          <div className="sticky-actions">
            <button className="cta-button" type="button" onClick={() => setView("style")}>Вернуться к оформлению</button>
          </div>
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

    if (view === "elements") {
      return (
        <ProjectShell>
          <ElementAdjustments
            payload={payload}
            styleState={styleState}
            pending={busy}
            onStyleChange={setStyleState}
            onRenderPreview={renderPreview}
            onBack={() => setView("main")}
          />
          {error ? <p className="error floating-error">{error}</p> : null}
        </ProjectShell>
      );
    }

    if (view === "style" || view === "advanced_style") {
      return (
        <ProjectShell>
          <StyleStudio
            payload={payload}
            styleState={styleState}
            pending={busy}
            advancedOpen={view === "advanced_style"}
            onStyleChange={setStyleState}
            onAdvancedToggle={() => setView(view === "advanced_style" ? "style" : "advanced_style")}
            onRenderPreview={renderPreview}
          />
        </ProjectShell>
      );
    }

    if (view === "export") {
      return <ProjectShell><ExportScreen busy={busy} onBack={() => setView("main")} onExport={finalizeExport} /></ProjectShell>;
    }

    return (
      <ProjectShell>
        <FinalPreview payload={payload} onApprove={() => setView("export")} onElements={() => setView("elements")} onStyle={() => setView("style")} onText={() => setView("text")} />
      </ProjectShell>
    );
  }

  return (
    <ProjectShell>
      <DoneScreen payload={payload} />
    </ProjectShell>
  );
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
