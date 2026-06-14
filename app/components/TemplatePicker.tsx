"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { templateToVisualPlanOptions, type StoredTemplate } from "@/lib/templateBuilder";

export function TemplatePicker({
  projectId,
  selectedTemplateId,
  pending,
  onSelectTemplate
}: {
  projectId: string;
  selectedTemplateId?: string;
  pending: boolean;
  onSelectTemplate: (template: StoredTemplate) => void;
}) {
  const [templates, setTemplates] = useState<StoredTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const returnTo = `/project/${projectId}?step=templates`;

  useEffect(() => {
    let cancelled = false;
    async function loadTemplates() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/templates", { cache: "no-store" });
        if (!response.ok) throw new Error("Не получилось загрузить шаблоны.");
        const payload = await response.json() as { templates?: StoredTemplate[] };
        if (!cancelled) setTemplates(Array.isArray(payload.templates) ? payload.templates : []);
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Не получилось загрузить шаблоны.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadTemplates();
    return () => {
      cancelled = true;
    };
  }, []);

  const createHref = useMemo(() => `/templates/new?returnTo=${encodeURIComponent(returnTo)}`, [returnTo]);

  return (
    <div className="flow-stack">
      <header className="screen-head">
        <p className="screen-step">Шаблон ролика</p>
        <h1>Выбери готовый шаблон</h1>
        <p>Шаблон задает внешний вид текста, плашек, акцентов и motion. После выбора сразу начнется сборка preview через HyperFrames.</p>
      </header>

      {loading ? <div className="empty-state">Загружаю шаблоны...</div> : null}
      {error ? <p className="error">{error}</p> : null}

      <section className="template-picker-grid">
        <Link className="template-create-card" href={createHref}>
          <span aria-hidden="true">+</span>
          <strong>Создать шаблон</strong>
          <small>Открыть конструктор и вернуться к выбору</small>
        </Link>

        {templates.map((template) => (
          <button
            className={`template-choice-card ${selectedTemplateId === template.id ? "active" : ""}`}
            key={template.id}
            type="button"
            disabled={pending}
            onClick={() => onSelectTemplate(template)}
          >
            <TemplatePreview template={template} />
            <strong>{template.name}</strong>
            <small>{template.isPreset ? "Готовый пресет" : template.isDefault ? "Ваш шаблон по умолчанию" : "Ваш шаблон"}</small>
          </button>
        ))}
      </section>

      {templates.length === 0 && !loading ? (
        <div className="empty-state">Пока нет шаблонов. Создай первый или проверь подключение к базе.</div>
      ) : null}
    </div>
  );
}

function TemplatePreview({ template }: { template: StoredTemplate }) {
  const data = template.data;
  const options = templateToVisualPlanOptions(data);
  const subtitle = data.blocks.subtitle;
  const headline = data.blocks.headline;
  const stat = data.blocks.stat;
  const swatches = [data.theme.colorText, data.theme.colorPrimary, data.theme.colorBackground];

  return (
    <div
      className={`template-preview-mini surface-${data.theme.defaultSurface}`}
      style={{
        background: `linear-gradient(145deg, ${data.theme.colorBackground}, #101010)`
      }}
    >
      <div className="template-preview-swatches">
        {swatches.map((color, index) => <i key={`${color}-${index}`} style={{ backgroundColor: color }} />)}
      </div>
      {headline.enabled ? (
        <div
          className="template-preview-headline"
          style={{
            color: String(headline.colorText || data.theme.colorText),
            borderColor: String(headline.borderColor || data.theme.colorPrimary)
          }}
        >
          Главная мысль
        </div>
      ) : null}
      {subtitle.enabled ? (
        <div
          className="template-preview-subtitle"
          style={{
            color: String(subtitle.colorText || data.theme.colorText),
            backgroundColor: subtitle.surface === "none" ? "transparent" : hexWithAlpha(String(subtitle.colorBackground || data.theme.colorBackground), subtitle.surfaceOpacity)
          }}
        >
          текст с акцентом
        </div>
      ) : null}
      {stat.enabled ? (
        <div className="template-preview-stat" style={{ color: String(stat.colorAccent || data.theme.colorPrimary) }}>
          42%
        </div>
      ) : null}
      <div className="template-preview-meta">
        <span>{data.theme.font}</span>
        <span>{options.presetPack ?? "balanced"}</span>
      </div>
    </div>
  );
}

function hexWithAlpha(color: string, alpha: unknown) {
  const opacity = typeof alpha === "number" ? Math.max(0, Math.min(1, alpha)) : 0.72;
  if (!/^#[0-9a-f]{6}$/i.test(color)) return `rgba(255, 255, 255, ${opacity * 0.16})`;
  const value = Number.parseInt(color.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
