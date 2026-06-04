"use client";

import type { MotionIntensity, PresentationMode, StylePreset, VisualDensity, VisualPresetPack, VisualTemplateId } from "@/lib/types";
import type { StyleDraftOptions } from "@/app/components/PresentationConfigurator";
import { StyleStudioCatalog } from "@/app/components/StyleStudioCatalog";
import { StylePresetGallery } from "@/app/components/StylePresetGallery";
import type { ProjectPayload, StyleState } from "@/app/components/projectFlowTypes";

const presetCards: Array<{ id: StylePreset; title: string; note: string; sample: string; pack: VisualPresetPack; density: VisualDensity; motion: MotionIntensity }> = [
  { id: "clean_expert", title: "Экспертный", note: "Чистые фразы, учебные акценты.", sample: "Главная мысль", pack: "educational", density: "medium", motion: "medium" },
  { id: "dynamic_viral", title: "Динамичный", note: "Плотный ритм, slams и цифры.", sample: "ВАЖНО", pack: "viral", density: "high", motion: "active" },
  { id: "premium_calm", title: "Премиальный", note: "Мягкие карточки и спокойные входы.", sample: "Вывод", pack: "premium", density: "low", motion: "calm" }
];

const templateControls: Array<{ id: VisualTemplateId; label: string }> = [
  { id: "big_number", label: "Большие цифры" },
  { id: "keyword_slam", label: "Крупные слова" },
  { id: "checklist", label: "Чеклисты" },
  { id: "bullet_cards", label: "Карточки" },
  { id: "metric_chart", label: "Мини-графики" },
  { id: "cta_plate", label: "Финальная плашка" }
];

export function StyleStudio({
  payload,
  styleState,
  pending,
  advancedOpen,
  onStyleChange,
  onAdvancedToggle,
  onRenderPreview
}: {
  payload: ProjectPayload;
  styleState: StyleState;
  pending: boolean;
  advancedOpen: boolean;
  onStyleChange: (next: StyleState) => void;
  onAdvancedToggle: () => void;
  onRenderPreview: () => void;
}) {
  const options = styleState.styleOptions;
  return (
    <div className="flow-stack">
      <header className="screen-head">
        <p className="screen-step">Оформление ролика</p>
        <h1>Выбери пресет. Детали спрятаны ниже.</h1>
      </header>

      <div className="compare-player">
        <video src={payload.cleanPreviewUrl ?? payload.originalUrl} controls playsInline />
      </div>

      <section className="preset-grid">
        {presetCards.map((card) => (
          <button
            className={`preset-card ${styleState.stylePreset === card.id ? "active" : ""}`}
            key={card.id}
            type="button"
            onClick={() => onStyleChange({
              ...styleState,
              stylePreset: card.id,
              styleOptions: {
                ...options,
                presetPack: card.pack,
                visualDensity: card.density,
                motionIntensity: card.motion
              }
            })}
          >
            <span className={`subtitle-sample sample-${card.id}`}>{card.sample}</span>
            <strong>{card.title}</strong>
            <small>{card.note}</small>
          </button>
        ))}
      </section>

      <section className="toggle-panel">
        <ToggleRow
          label="Субтитры"
          checked
          disabled
          onToggle={() => undefined}
        />
        <ToggleRow
          label="Выделять ключевые слова"
          checked={options.subtitleStyle !== "clean"}
          onToggle={() => onStyleChange({
            ...styleState,
            styleOptions: { ...options, subtitleStyle: options.subtitleStyle === "clean" ? "active_word" : "clean" }
          })}
        />
        <ToggleRow
          label="Плашки с главными мыслями"
          checked={styleState.presentationMode === "subtitles_infographics"}
          onToggle={() => onStyleChange({
            ...styleState,
            presentationMode: styleState.presentationMode === "subtitles_infographics" ? "subtitles_only" : "subtitles_infographics"
          })}
        />
        <ToggleRow
          label="Инфографика"
          checked={styleState.presentationMode === "subtitles_infographics"}
          onToggle={() => onStyleChange({
            ...styleState,
            presentationMode: styleState.presentationMode === "subtitles_infographics" ? "subtitles_only" : "subtitles_infographics"
          })}
        />
        <ToggleRow
          label="Автозум на склейках"
          checked
          disabled
          onToggle={() => undefined}
        />
      </section>

      <button className="small-ghost full" type="button" onClick={onAdvancedToggle}>
        {advancedOpen ? "Скрыть настройку стиля" : "Настроить стиль"}
      </button>

      {advancedOpen ? (
        <AdvancedStyle
          styleState={styleState}
          onStyleChange={onStyleChange}
        />
      ) : null}

      <StyleStudioCatalog
        presetPack={options.presetPack ?? "balanced"}
        visualDensity={options.visualDensity ?? "medium"}
        motionIntensity={options.motionIntensity ?? "medium"}
        disabledTemplates={options.disabledTemplates ?? []}
      />

      <StylePresetGallery presetPack={options.presetPack ?? "balanced"} />

      <div className="sticky-actions">
        <button className="cta-button" type="button" disabled={pending} onClick={onRenderPreview}>
          {pending ? "Применяю стиль..." : "Применить стиль"}
        </button>
      </div>
    </div>
  );
}

export function ElementAdjustments({
  payload,
  styleState,
  pending,
  onStyleChange,
  onRenderPreview,
  onBack
}: {
  payload: ProjectPayload;
  styleState: StyleState;
  pending: boolean;
  onStyleChange: (next: StyleState) => void;
  onRenderPreview: () => void;
  onBack: () => void;
}) {
  const options = styleState.styleOptions;
  return (
    <div className="flow-stack">
      <header className="screen-head">
        <p className="screen-step">Корректировка</p>
        <h1>Элементы ролика</h1>
        <p>Без многослойного таймлайна: только включить, выключить или изменить подачу.</p>
      </header>
      <div className="compare-player">
        <video src={payload.reviewUrl ?? payload.cleanPreviewUrl ?? payload.originalUrl} controls playsInline />
      </div>
      <section className="element-list">
        <ToggleRow label="Субтитры" checked disabled onToggle={() => undefined} />
        <ToggleRow
          label="Выделение слов"
          checked={options.subtitleStyle !== "clean"}
          onToggle={() => onStyleChange({
            ...styleState,
            styleOptions: { ...options, subtitleStyle: options.subtitleStyle === "clean" ? "active_word" : "clean" }
          })}
        />
        <ToggleRow
          label="Плашки / инфографика"
          checked={styleState.presentationMode === "subtitles_infographics"}
          onToggle={() => onStyleChange({
            ...styleState,
            presentationMode: styleState.presentationMode === "subtitles_infographics" ? "subtitles_only" : "subtitles_infographics"
          })}
        />
      </section>
      <div className="split-actions">
        <button className="mode-button secondary-action" type="button" onClick={onBack}>Назад</button>
        <button className="cta-button" type="button" disabled={pending} onClick={onRenderPreview}>
          {pending ? "Обновляю..." : "Обновить preview"}
        </button>
      </div>
    </div>
  );
}

function AdvancedStyle({
  styleState,
  onStyleChange
}: {
  styleState: StyleState;
  onStyleChange: (next: StyleState) => void;
}) {
  const options = styleState.styleOptions;
  return (
    <section className="advanced-style">
      <ChoiceGroup
        title="Плотность"
        value={options.visualDensity ?? "medium"}
        items={[["low", "Редко"], ["medium", "Средне"], ["high", "Плотно"]]}
        onSelect={(visualDensity) => onStyleChange({
          ...styleState,
          styleOptions: { ...options, visualDensity: visualDensity as VisualDensity }
        })}
      />
      <ChoiceGroup
        title="Характер motion"
        value={options.motionIntensity ?? "medium"}
        items={[["calm", "Спокойно"], ["medium", "Живо"], ["active", "Активно"]]}
        onSelect={(motionIntensity) => onStyleChange({
          ...styleState,
          styleOptions: { ...options, motionIntensity: motionIntensity as MotionIntensity }
        })}
      />
      <ChoiceGroup
        title="Набор пресетов"
        value={options.presetPack ?? "balanced"}
        items={[["balanced", "Баланс"], ["educational", "Обучение"], ["premium", "Премиум"], ["viral", "Viral"], ["minimal", "Минимум"]]}
        onSelect={(presetPack) => onStyleChange({
          ...styleState,
          styleOptions: { ...options, presetPack: presetPack as VisualPresetPack }
        })}
      />
      <TemplateToggles
        disabledTemplates={options.disabledTemplates ?? []}
        onChange={(disabledTemplates) => onStyleChange({
          ...styleState,
          styleOptions: { ...options, disabledTemplates }
        })}
      />
      <ChoiceGroup
        title="Шрифт"
        value={options.subtitleFont}
        items={[
          ["manrope", "Manrope"],
          ["onest", "Onest"],
          ["unbounded", "Unbounded"],
          ["montserrat", "Montserrat"],
          ["golos", "Golos"]
        ]}
        onSelect={(subtitleFont) => onStyleChange({
          ...styleState,
          styleOptions: { ...options, subtitleFont: subtitleFont as StyleDraftOptions["subtitleFont"] }
        })}
      />
      <ChoiceGroup
        title="Подложка"
        value={options.subtitleBackdrop}
        items={[["glass", "Стекло"], ["solid", "Плотная"], ["none", "Без подложки"]]}
        onSelect={(subtitleBackdrop) => onStyleChange({
          ...styleState,
          styleOptions: { ...options, subtitleBackdrop: subtitleBackdrop as StyleDraftOptions["subtitleBackdrop"] }
        })}
      />
      <ChoiceGroup
        title="Цвет инфографики"
        value={options.infographicAccent}
        items={[["mint", "Мята"], ["orange", "Оранжевый"], ["cream", "Кремовый"]]}
        onSelect={(infographicAccent) => onStyleChange({
          ...styleState,
          styleOptions: { ...options, infographicAccent: infographicAccent as StyleDraftOptions["infographicAccent"] }
        })}
      />
    </section>
  );
}

function TemplateToggles({
  disabledTemplates,
  onChange
}: {
  disabledTemplates: VisualTemplateId[];
  onChange: (next: VisualTemplateId[]) => void;
}) {
  return (
    <div className="choice-group">
      <h3>Типы вставок</h3>
      <div>
        {templateControls.map((item) => {
          const enabled = !disabledTemplates.includes(item.id);
          return (
            <button
              className={enabled ? "active" : ""}
              key={item.id}
              type="button"
              onClick={() => onChange(enabled ? [...disabledTemplates, item.id] : disabledTemplates.filter((id) => id !== item.id))}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChoiceGroup({
  title,
  value,
  items,
  onSelect
}: {
  title: string;
  value: string;
  items: Array<[string, string]>;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="choice-group">
      <h3>{title}</h3>
      <div>
        {items.map(([id, label]) => (
          <button className={value === id ? "active" : ""} key={id} type="button" onClick={() => onSelect(id)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  disabled = false,
  onToggle
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button className="toggle-row" type="button" disabled={disabled} onClick={onToggle}>
      <span>{label}</span>
      <i className={checked ? "on" : ""} aria-hidden="true" />
    </button>
  );
}

export function parseStyleOptions(raw: string | null | undefined): StyleDraftOptions {
  const fallback: StyleDraftOptions = {
    subtitleFont: "manrope",
    subtitleStyle: "active_word",
    subtitleBackdrop: "glass",
    infographicTone: "glass",
    infographicAccent: "mint",
    visualDensity: "medium",
    motionIntensity: "medium",
    presetPack: "educational",
    disabledTemplates: []
  };

  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<StyleDraftOptions>;
    return {
      subtitleFont: parsed.subtitleFont ?? fallback.subtitleFont,
      subtitleStyle: parsed.subtitleStyle ?? fallback.subtitleStyle,
      subtitleBackdrop: parsed.subtitleBackdrop ?? fallback.subtitleBackdrop,
      infographicTone: parsed.infographicTone ?? fallback.infographicTone,
      infographicAccent: parsed.infographicAccent ?? fallback.infographicAccent,
      visualDensity: parsed.visualDensity ?? fallback.visualDensity,
      motionIntensity: parsed.motionIntensity ?? fallback.motionIntensity,
      presetPack: parsed.presetPack ?? fallback.presetPack,
      disabledTemplates: parsed.disabledTemplates ?? fallback.disabledTemplates
    };
  } catch {
    return fallback;
  }
}

export function resolvePresentationMode(value: string | null | undefined): PresentationMode {
  if (value === "subtitles_infographics" || value === "subtitles_infographics_media") return value;
  return "subtitles_only";
}

export function resolveStylePreset(value: string | null | undefined): StylePreset {
  if (value === "dynamic_viral" || value === "premium_calm") return value;
  return "clean_expert";
}
