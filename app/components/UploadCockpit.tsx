"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type StartScreen = "home" | "soon" | "upload" | "uploading";

export function UploadCockpit() {
  const router = useRouter();
  const [screen, setScreen] = useState<StartScreen>("home");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setScreen("uploading");

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
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
    <main className="gosha-stage">
      <section className="wizard-card">
        {screen === "home" ? (
          <>
            <Mascot size="large" />
            <div className="wizard-copy">
              <h1>Привет! Я Гоша</h1>
              <p>Загрузи talking-head видео. Сначала соберем чистый черновик, а оформление выберем уже после монтажа.</p>
            </div>
            <div className="wizard-actions">
              <button className="mode-button ghost" type="button" onClick={() => setScreen("soon")}>
                Мой банк фото/видео
              </button>
              <button className="mode-button ghost" type="button" onClick={() => setScreen("soon")}>
                Мои шаблоны
              </button>
              <button className="cta-button" type="button" onClick={() => setScreen("upload")}>
                Загрузить видео
              </button>
            </div>
          </>
        ) : null}

        {screen === "soon" ? (
          <>
            <Mascot mood="blink" />
            <div className="wizard-copy">
              <h2>Скоро будет готово</h2>
              <p>Этот раздел уже заложен в новый flow, но пока активен основной сценарий: загрузка → чистка → оформление → предпросмотр → скачивание.</p>
            </div>
            <button className="cta-button" type="button" onClick={() => setScreen("home")}>
              Назад
            </button>
          </>
        ) : null}

        {screen === "upload" ? (
          <form className="upload-wizard" onSubmit={onSubmit}>
            <Mascot />
            <div className="wizard-copy">
              <h2>Добавь исходник</h2>
              <p>После загрузки я сначала спрошу, как именно чистить речь, а уже потом предложу оформление.</p>
            </div>

            <label className="video-drop">
              <input
                name="file"
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                required
                onChange={(event) => setFileName(event.currentTarget.files?.[0]?.name ?? "")}
              />
              <span>{fileName || "Добавить видео с устройства"}</span>
            </label>

            {error ? <p className="error">{error}</p> : null}
            <button className="cta-button" disabled={busy} type="submit">
              {busy ? "Загружаю..." : "Видео принято"}
            </button>
          </form>
        ) : null}

        {screen === "uploading" ? (
          <>
            <Mascot />
            <div className="loader-ring" aria-label="Загрузка видео" />
            <div className="wizard-copy">
              <h2>Загружаю видео</h2>
              <p>Видео загружается, дальше перейдем к выбору режима чистки.</p>
            </div>
          </>
        ) : null}
      </section>
    </main>
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
