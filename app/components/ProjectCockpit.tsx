"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { PrecisionTune } from "@/app/components/DraftReview";
import { AppSection, AppShell } from "@/app/components/AppShell";
import { shouldPollProject } from "@/app/components/projectPolling";
import { EditorTab, ProjectEditor } from "@/app/components/ProjectEditor";
import {
  CleanupModeScreen,
  DoneScreen,
  LoadingScreen,
  ProcessingScreen,
} from "@/app/components/ProjectScreens";
import { parseStyleOptions, resolvePresentationMode, resolveStylePreset } from "@/app/components/styleState";
import type { DraftEditRequest, ProjectPayload, StyleState } from "@/app/components/projectFlowTypes";
import type { CleanupMode } from "@/lib/types";

type LocalView = EditorTab | "precision";
type InitialView = LocalView | "main";
type CompareMode = "after" | "before";

export function ProjectCockpit({ projectId, initialView = "main" }: { projectId: string; initialView?: InitialView }) {
  const [payload, setPayload] = useState<ProjectPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [styleSaving, setStyleSaving] = useState(false);
  const [view, setView] = useState<LocalView>(initialView === "main" ? "transcript" : initialView);
  const [compareMode, setCompareMode] = useState<CompareMode>("after");
  const [error, setError] = useState("");
  const [styleState, setStyleState] = useState<StyleState | null>(null);
  const [styleDirtyAfterExport, setStyleDirtyAfterExport] = useState(false);
  const styleSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingStyleStateRef = useRef<StyleState | null>(null);
  const styleSaveRequestRef = useRef<Promise<void> | null>(null);

  const status = payload?.project.status ?? "";
  const isProcessing = payload ? !["uploaded", "draft_ready", "review_ready", "done", "error"].includes(status) : false;
  const pollingEnabled = shouldPollProject(status, busy, editBusy);

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
    if (!pollingEnabled) {
      return () => {
        cancelled = true;
      };
    }

    const timer = setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pollingEnabled, projectId]);

  useEffect(() => () => {
    if (styleSaveTimeoutRef.current) clearTimeout(styleSaveTimeoutRef.current);
  }, []);

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

  async function saveStyleState(nextStyleState: StyleState) {
    if (isProcessing) return;
    setStyleState(nextStyleState);
    if (payload?.downloadUrl) setStyleDirtyAfterExport(true);
    setError("");
    scheduleStyleSave(nextStyleState);
  }

  async function finalizeExport() {
    if (busy || isProcessing) return;
    setBusy(true);
    setError("");
    try {
      await flushPendingStyleSave();
      await apiPost(`/api/projects/${projectId}/finalize`);
      setStyleDirtyAfterExport(false);
      setView("transcript");
      await refresh();
    } catch (requestError) {
      setBusy(false);
      setError(messageFromError(requestError));
    }
  }

  async function renderSubtitledVideo() {
    if (busy || isProcessing || payload?.subtitledVideoActive) return;
    setBusy(true);
    setError("");
    try {
      await flushPendingStyleSave();
      await apiPost(`/api/projects/${projectId}/render-subtitled`);
      await refresh();
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setBusy(false);
    }
  }

  if (!payload || !styleState) {
    return <ProjectAppShell activeSection="projects"><LoadingScreen title="Открываю проект" text="Подгружаю видео, текст и статус обработки." /></ProjectAppShell>;
  }

  if (status === "error") {
    return (
      <ProjectAppShell activeSection="projects">
        <div className="center-flow">
          <h1>Что-то пошло не так</h1>
          <p>{payload.project.errorMessage ?? "Ошибка обработки. Подробности доступны в логах проекта."}</p>
          <Link className="cta-button" href="/">Начать заново</Link>
        </div>
      </ProjectAppShell>
    );
  }

  if (status === "uploaded") {
    return (
      <ProjectAppShell activeSection="projects">
        <CleanupModeScreen busy={busy} error={error} onStart={startAnalyze} />
      </ProjectAppShell>
    );
  }

  if (isProcessing) {
    return (
      <ProjectAppShell activeSection="projects">
        <ProcessingScreen payload={payload} status={status} />
      </ProjectAppShell>
    );
  }

  if (status === "draft_ready" || status === "review_ready") {
    if (view === "precision") {
      return (
        <ProjectAppShell activeSection="timeline" onNavigate={handleShellNavigate}>
          <PrecisionTune payload={payload} editBusy={editBusy} onBack={() => setView("transcript")} onDraftEdit={applyDraftEdit} />
          {error ? <p className="error floating-error">{error}</p> : null}
        </ProjectAppShell>
      );
    }

    return (
      <ProjectAppShell activeSection={sectionForView(view)} onNavigate={handleShellNavigate}>
        <ProjectEditor
          payload={payload}
          activeTab={view}
          compareMode={compareMode}
          busy={busy}
          editBusy={editBusy}
          styleSaving={styleSaving}
          styleDirtyAfterExport={styleDirtyAfterExport}
          error={error}
          styleState={styleState}
          onTabChange={setView}
          onCompareModeChange={setCompareMode}
          onDraftEdit={applyDraftEdit}
          onOpenPrecision={() => setView("precision")}
          onStyleChange={saveStyleState}
          onExport={finalizeExport}
          onSubtitledRender={renderSubtitledVideo}
        />
      </ProjectAppShell>
    );
  }

  return (
    <ProjectAppShell activeSection="projects">
      <DoneScreen payload={payload} />
    </ProjectAppShell>
  );

  function handleShellNavigate(section: AppSection) {
    if (section === "home" || section === "projects") return;
    if (section === "style") setView("style");
    if (section === "transcript") setView("transcript");
    if (section === "timeline") setView("transcript");
  }

  function scheduleStyleSave(nextStyleState: StyleState) {
    pendingStyleStateRef.current = nextStyleState;
    setStyleSaving(true);
    if (styleSaveTimeoutRef.current) clearTimeout(styleSaveTimeoutRef.current);
    styleSaveTimeoutRef.current = setTimeout(() => {
      styleSaveTimeoutRef.current = null;
      styleSaveRequestRef.current = persistPendingStyleSave();
    }, 350);
  }

  async function flushPendingStyleSave() {
    if (styleSaveTimeoutRef.current) {
      clearTimeout(styleSaveTimeoutRef.current);
      styleSaveTimeoutRef.current = null;
      styleSaveRequestRef.current = persistPendingStyleSave();
    }

    await styleSaveRequestRef.current;
  }

  async function persistPendingStyleSave() {
    const pendingStyleState = pendingStyleStateRef.current;
    if (!pendingStyleState) {
      setStyleSaving(false);
      return;
    }

    try {
      await apiPatch(projectId, {
        presentationMode: pendingStyleState.presentationMode,
        stylePreset: pendingStyleState.stylePreset,
        styleOptionsJson: pendingStyleState.styleOptions
      });

      setPayload((current) => {
        if (!current) return current;
        return {
          ...current,
          project: {
            ...current.project,
            presentationMode: pendingStyleState.presentationMode,
            stylePreset: pendingStyleState.stylePreset,
            styleOptionsJson: JSON.stringify(pendingStyleState.styleOptions)
          }
        };
      });
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      if (pendingStyleStateRef.current === pendingStyleState) {
        pendingStyleStateRef.current = null;
        setStyleSaving(false);
      } else {
        const nextPendingStyleState = pendingStyleStateRef.current;
        if (nextPendingStyleState) scheduleStyleSave(nextPendingStyleState);
      }
      styleSaveRequestRef.current = null;
    }
  }
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

function ProjectAppShell({
  activeSection,
  children,
  onNavigate
}: {
  activeSection: AppSection;
  children: ReactNode;
  onNavigate?: (section: AppSection) => void;
}) {
  return (
    <AppShell
      activeSection={activeSection}
      title="Редактор проекта"
      subtitle="Чистка текста, стили субтитров, предпросмотр и экспорт в одном рабочем столе."
      action={<Link className="topbar-primary" href="/">Новая загрузка</Link>}
      onNavigate={onNavigate}
    >
      {children}
    </AppShell>
  );
}

function sectionForView(view: LocalView): AppSection {
  if (view === "style") return "style";
  if (view === "transcript") return "transcript";
  if (view === "precision") return "timeline";
  return "projects";
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
