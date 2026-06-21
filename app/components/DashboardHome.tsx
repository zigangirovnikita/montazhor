"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppSection, AppShell, ComingSoonPanel } from "@/app/components/AppShell";
import { Mascot } from "@/app/components/UploadCockpit";

type DashboardSection = AppSection;

interface RecentProject {
  id: string;
  originalFilename: string;
  status: string;
  durationOriginal: number | null;
  durationFinal: number | null;
  platform: string;
  stylePreset: string;
  previewUrl: string;
  updatedAt: string;
}

const actionCards = [
  ["Умная обрезка", "ИИ чистит паузы, запинки и лишние дубли.", "ИИ"],
  ["Субтитры", "Живой предпросмотр и быстрые стили.", "СС"],
  ["Формат рилс", "Сохраняем вертикальный профиль для публикации.", "9:16"],
  ["Видео-вставки", "Каркас готов, медиа-вставки позже.", "скоро"]
];

export function DashboardHome() {
  const router = useRouter();
  const [section, setSection] = useState<DashboardSection>("home");
  const [projects, setProjects] = useState<RecentProject[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("");
  const visibleProjects = useMemo(() => projects.slice(0, 5), [projects]);

  useEffect(() => {
    fetch("/api/projects", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { projects?: RecentProject[] } | null) => setProjects(payload?.projects ?? []))
      .catch(() => setProjects([]));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const formData = new FormData(event.currentTarget);
      formData.set("stylePreset", "clean_expert");
      formData.set("platform", "instagram_reels");
      formData.set("language", "ru");

      const response = await fetch("/api/projects/upload", { method: "POST", body: formData });
      const payload = (await parseApiResponse(response)) as { projectId?: string; error?: string };
      if (!response.ok || !payload.projectId) {
        setError(payload.error ?? "Не получилось загрузить видео.");
        return;
      }
      router.push(`/project/${payload.projectId}`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Не получилось загрузить видео.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      activeSection={section}
      title="Доброе утро, автор"
      subtitle="Монтаж разговорных видео без ручного таймлайна."
      action={<Link className="topbar-primary" href="#upload">Загрузить видео</Link>}
      onNavigate={(nextSection) => setSection(nextSection)}
    >
      {section !== "home" && section !== "projects" ? <ComingSoonPanel /> : (
        <div className="dashboard-grid">
          <section className="dashboard-main">
            <div className="feature-card-grid">
              {actionCards.map(([title, text, marker]) => (
                <button className="desktop-feature-card" key={title} type="button" disabled={marker === "скоро"}>
                  <span>{marker}</span>
                  <strong>{title}</strong>
                  <small>{text}</small>
                  <i>→</i>
                </button>
              ))}
            </div>

            <form className="desktop-upload-zone" id="upload" onSubmit={onSubmit}>
              {busy ? (
                <div className="desktop-upload-dropzone desktop-upload-loading" role="status" aria-live="polite">
                  <Mascot />
                  <div className="loader-ring" aria-label="Загрузка видео" />
                  <h2>Загружаю видео</h2>
                  <p>После загрузки откроется выбор типа чистки.</p>
                </div>
              ) : (
                <>
                  <label className="desktop-upload-dropzone">
                    <input
                      name="file"
                      type="file"
                      accept="video/mp4,video/quicktime,video/webm"
                      required
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        setFileName(file?.name ?? "");
                        setFileSize(file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : "");
                      }}
                    />
                    <span className="upload-cloud">⇧</span>
                    <strong>{fileName || "Перетащи видео сюда"}</strong>
                    <small>{fileSize || "mp4, mov или webm. После загрузки откроется выбор режима чистки."}</small>
                  </label>
                  {error ? <p className="error">{error}</p> : null}
                  <button className="cta-button desktop-cta" type="submit" disabled={!fileName}>
                    Загрузить видео
                  </button>
                </>
              )}
            </form>

            <section className="recent-projects">
              <div className="section-row-title">
                <h2>Последние проекты</h2>
                <button type="button" onClick={() => setSection("projects")}>Смотреть все</button>
              </div>
              <div className="recent-project-grid">
                {visibleProjects.length > 0 ? visibleProjects.map((project) => (
                  <Link className="recent-project-card" href={`/project/${project.id}`} key={project.id}>
                    <video src={project.previewUrl} preload="metadata" muted playsInline />
                    <strong>{project.originalFilename}</strong>
                    <span>{statusLabel(project.status)} · {formatDuration(project.durationFinal ?? project.durationOriginal)}</span>
                  </Link>
                )) : (
                  <div className="empty-dashboard-card">
                    <strong>Проектов пока нет</strong>
                    <span>Первое видео появится здесь после загрузки.</span>
                  </div>
                )}
              </div>
            </section>
          </section>

          <aside className="quick-actions-card">
            <h2>Быстрые действия</h2>
            <button type="button" onClick={() => document.querySelector<HTMLInputElement>("#upload input")?.click()}>Загрузить видео <span>›</span></button>
            <button type="button" disabled>Импорт из YouTube <span>скоро</span></button>
            <button type="button" onClick={() => document.querySelector<HTMLInputElement>("#upload input")?.click()}>Авточистка <span>›</span></button>
            <button type="button" disabled>Обрезать длинное видео <span>скоро</span></button>
          </aside>
        </div>
      )}
    </AppShell>
  );
}

function statusLabel(status: string) {
  if (status === "done") return "готово";
  if (status === "draft_ready" || status === "review_ready") return "черновик";
  if (status === "uploaded") return "загружено";
  if (status === "error") return "ошибка";
  return "обработка";
}

function formatDuration(value: number | null) {
  if (!value) return "длительность неизвестна";
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

async function parseApiResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return (await response.json()) as unknown;
  const raw = await response.text();
  const htmlTitle = raw.match(/<title>(.*?)<\/title>/i)?.[1]?.trim();
  return {
    error: htmlTitle ? `Сервер вернул HTML вместо JSON: ${htmlTitle}` : "Сервер вернул неожиданный ответ."
  };
}
