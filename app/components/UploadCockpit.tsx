"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type StartScreen = "home" | "soon" | "upload" | "confirm" | "uploading";

export function UploadCockpit() {
  const router = useRouter();
  const [screen, setScreen] = useState<StartScreen>("home");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileDurationHint, setFileDurationHint] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setScreen("uploading");

    try {
      const formData = new FormData(event.currentTarget);
      formData.set("stylePreset", "clean_expert");
      formData.set("platform", "instagram_reels");
      formData.set("language", "ru");

      const response = await fetch("/api/projects/upload", { method: "POST", body: formData });
      const payload = (await parseApiResponse(response)) as { projectId?: string; error?: string };
      if (!response.ok || !payload.projectId) {
        setError(payload.error ?? "Не получилось загрузить видео.");
        setScreen("upload");
        return;
      }
      router.push(`/project/${payload.projectId}`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Не получилось загрузить видео.");
      setScreen("upload");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mobile-stage">
      <section className="phone-shell">
        {screen === "home" ? (
          <div className="home-flow">
            <HeroPreview />
            <div className="home-copy">
              <h1>Загрузи видео. Монтаж сделаем за тебя.</h1>
              <p>Для talking-head: уберем паузы, повторы, запинки, соберем черновик и дадим поправить текстом.</p>
            </div>
            <button className="cta-button" type="button" onClick={() => setScreen("upload")}>
              Начать монтаж
            </button>
            <div className="scenario-grid">
              <ScenarioCard title="Очистить talking-head" text="Главный сценарий MVP" active />
              <ScenarioCard title="Сделать клипы" text="Скоро" />
              <ScenarioCard title="Только субтитры" text="Скоро" />
            </div>
            <div className="library-links">
              {["Мои работы", "Мои пресеты", "База футажей"].map((item) => (
                <button key={item} type="button" onClick={() => setScreen("soon")}>{item}</button>
              ))}
            </div>
          </div>
        ) : null}

        {screen === "soon" ? (
          <div className="center-flow">
            <Mascot mood="blink" />
            <h2>Раздел появится позже</h2>
            <p>Сейчас главный маршрут: загрузить исходник, получить черновик, поправить текстом и оформить ролик.</p>
            <button className="cta-button" type="button" onClick={() => setScreen("home")}>В меню</button>
          </div>
        ) : null}

        {screen === "upload" || screen === "confirm" ? (
          <form className="upload-flow" onSubmit={onSubmit}>
            <div className="screen-head">
              <p className="screen-step">Загрузка видео</p>
              <h1>Добавь исходник</h1>
              <p>Лучше всего работает с видео, где вы говорите в камеру.</p>
            </div>
            <label className="upload-dropzone">
              <input
                name="file"
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                required
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  setFileName(file?.name ?? "");
                  setFileDurationHint(file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : "");
                  setScreen(file ? "confirm" : "upload");
                }}
              />
              <span>{fileName || "Загрузить видео"}</span>
              <small>Галерея или файлы · mp4, mov, webm</small>
            </label>
            <div className="upload-options">
              <button type="button" disabled>Вставить ссылку</button>
              <button type="button" disabled>Записать сейчас</button>
            </div>
            {screen === "confirm" ? (
              <div className="confirm-card">
                <strong>Видео загружено</strong>
                <span>{fileDurationHint || "Готово к обработке"}</span>
                <p>Дальше выберем, что именно убрать из речи.</p>
              </div>
            ) : null}
            {error ? <p className="error">{error}</p> : null}
            <div className="sticky-actions">
              <button className="cta-button" disabled={busy || !fileName} type="submit">
                {busy ? "Загружаю..." : "Что сделать?"}
              </button>
            </div>
          </form>
        ) : null}

        {screen === "uploading" ? (
          <div className="center-flow">
            <Mascot />
            <div className="loader-ring" aria-label="Загрузка видео" />
            <h2>Загружаю видео</h2>
            <p>После загрузки откроется выбор типа чистки.</p>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function HeroPreview() {
  return (
    <div className="hero-preview" aria-hidden="true">
      <div className="phone-video before">
        <span>до</span>
        <i />
      </div>
      <div className="phone-video after">
        <span>после</span>
        <b>СИЛЬНАЯ МЫСЛЬ</b>
      </div>
    </div>
  );
}

function ScenarioCard({ title, text, active = false }: { title: string; text: string; active?: boolean }) {
  return (
    <button className={`scenario-card ${active ? "active" : ""}`} type="button" disabled={!active}>
      <strong>{title}</strong>
      <span>{text}</span>
    </button>
  );
}

export function Mascot({ size = "normal", mood = "normal" }: { size?: "normal" | "large"; mood?: "normal" | "blink" }) {
  return (
    <div className={`mascot mascot-${size} mascot-${mood}`} aria-hidden="true">
      <span className="mascot-eye left" />
      <span className="mascot-eye right" />
    </div>
  );
}

async function parseApiResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as unknown;
  }

  const raw = await response.text();
  const htmlTitle = raw.match(/<title>(.*?)<\/title>/i)?.[1]?.trim();
  return {
    error: htmlTitle ? `Сервер вернул HTML вместо JSON: ${htmlTitle}` : "Сервер вернул неожиданный ответ."
  };
}
