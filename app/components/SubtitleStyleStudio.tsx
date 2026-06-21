"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type {
  CaptionPosition,
  CaptionSize,
  StyleDraftOptions,
  SubtitleFontId,
  SubtitleTextCase
} from "@/app/components/PresentationConfigurator";
import {
  applyStylePresetOptions,
  captionPositionLabels,
  captionSizeLabels,
  fontLabelMap,
  subtitleStylePresets,
  textCaseLabels,
  withTemplateToggles
} from "@/app/components/subtitleStylePresets";
import type { StyleState } from "@/app/components/projectFlowTypes";

const filterLabels = [
  { id: "all", label: "Все" },
  { id: "clean", label: "Чисто" },
  { id: "viral", label: "Вирусно" },
  { id: "premium", label: "Премиум" },
  { id: "story", label: "Сторителлинг" }
] as const;

const colorSwatches = ["#ffffff", "#fff7e7", "#ffd84d", "#ff8b38", "#73c8ff", "#b9ff5c", "#66f2ff", "#d7b47f"];

const insertToggles: Array<{ id: keyof Pick<StyleDraftOptions, "emojiEnabled" | "autoLists" | "autoComparisons" | "autoCharts" | "autoCta" | "autoStrike">; label: string }> = [
  { id: "emojiEnabled", label: "Эмодзи" },
  { id: "autoLists", label: "Списки" },
  { id: "autoComparisons", label: "Сравнения" },
  { id: "autoCharts", label: "Графики" },
  { id: "autoCta", label: "CTA" },
  { id: "autoStrike", label: "Зачёркивания" }
];

export function SubtitleStyleStudio({
  styleState,
  styleSaving,
  onStyleChange
}: {
  styleState: StyleState;
  styleSaving: boolean;
  onStyleChange: (next: StyleState) => void | Promise<void>;
}) {
  const [activeFilter, setActiveFilter] = useState<(typeof filterLabels)[number]["id"]>("all");
  const [builderOpen, setBuilderOpen] = useState(false);
  const options = styleState.styleOptions;

  const visiblePresets = useMemo(
    () => activeFilter === "all"
      ? subtitleStylePresets
      : subtitleStylePresets.filter((preset) => preset.category === activeFilter),
    [activeFilter]
  );

  return (
    <div className="subtitle-style-studio">
      <section className="style-studio-hero">
        <div>
          <span className="style-kicker">Стили субтитров</span>
          <h2>Выбираешь шаблон, включаешь нужные вставки, и всё сразу видно на превью.</h2>
          <p>Для тонкой кастомизации открывается конструктор, где обычный текст и акцентные слова настраиваются отдельно.</p>
        </div>
        <div className="style-hero-actions">
          <div className="style-filter-row" role="tablist" aria-label="Фильтр шаблонов">
            {filterLabels.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={activeFilter === filter.id ? "active" : ""}
                onClick={() => setActiveFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <button className="style-builder-toggle" type="button" onClick={() => setBuilderOpen((value) => !value)}>
            {builderOpen ? "Скрыть конструктор" : "Создать шаблон"}
          </button>
        </div>
      </section>

      <section className="style-preset-showcase">
        {visiblePresets.map((preset) => {
          const selected = options.styleRecipeId === preset.id;
          const preview = applyStylePresetOptions(options, preset);
          return (
            <button
              key={preset.id}
              type="button"
              className={`style-template-card ${selected ? "active" : ""}`}
              onClick={() => void onStyleChange({
                presentationMode: "subtitles_only",
                stylePreset: preset.stylePreset,
                styleOptions: preview
              })}
            >
              <div className={`style-template-preview backdrop-${preview.subtitleBackdrop} case-${preview.textCase ?? "sentence"}`}>
                <div
                  className={`style-template-line font-${preview.subtitleFont} size-${preview.captionSize ?? "md"}`}
                  style={{ color: preview.subtitleColor ?? "#ffffff" }}
                >
                  <span>{preset.normalSample}</span>{" "}
                  <span
                    className={`accent accent-${preview.subtitleStyle} font-${preview.accentFont ?? preview.subtitleFont}`}
                    style={{ ["--accent-color" as string]: preview.accentColor ?? "#ffd84d" }}
                  >
                    {preset.accentSample}
                  </span>
                </div>
              </div>
              <div className="style-template-copy">
                <div>
                  <strong>{preset.title}</strong>
                  <small>{preset.note}</small>
                </div>
                <div className="style-template-tags">
                  {preset.chips.map((chip) => <span key={chip}>{chip}</span>)}
                </div>
              </div>
            </button>
          );
        })}
      </section>

      <section className="insert-toggle-strip">
        {insertToggles.map((toggle) => (
          <button
            key={toggle.id}
            type="button"
            className={options[toggle.id] === false ? "" : "active"}
            onClick={() => updateStyle(styleState, onStyleChange, {
              [toggle.id]: options[toggle.id] === false
            })}
          >
            {toggle.label}
          </button>
        ))}
      </section>

      <section className="mini-insert-gallery">
        <article className="insert-mini-card steps">
          <span>1</span>
          <span>2</span>
          <span>3</span>
          <strong>Список по шагам</strong>
        </article>
        <article className="insert-mini-card compare">
          <span className="wrong">Ошибка</span>
          <span className="right">Норма</span>
          <strong>Сравнение</strong>
        </article>
        <article className="insert-mini-card chart">
          <i />
          <i />
          <i />
          <strong>Мини-график</strong>
        </article>
        <article className="insert-mini-card cta">
          <span>Подписаться</span>
          <strong>CTA</strong>
        </article>
      </section>

      {builderOpen ? (
        <section className="style-builder-panel">
          <BuilderSection title="Обычный текст">
            <ChoiceRow
              items={Object.entries(fontLabelMap) as Array<[SubtitleFontId, string]>}
              value={options.subtitleFont}
              onSelect={(subtitleFont) => updateStyle(styleState, onStyleChange, { subtitleFont })}
            />
            <SwatchRow
              value={options.subtitleColor ?? "#ffffff"}
              onSelect={(subtitleColor) => updateStyle(styleState, onStyleChange, { subtitleColor })}
            />
            <ChoiceRow
              items={textCaseLabels.map((item) => [item.id, item.label] as [SubtitleTextCase, string])}
              value={options.textCase ?? "sentence"}
              onSelect={(textCase) => updateStyle(styleState, onStyleChange, { textCase })}
            />
          </BuilderSection>

          <BuilderSection title="Акцентные слова">
            <ChoiceRow
              items={Object.entries(fontLabelMap) as Array<[SubtitleFontId, string]>}
              value={options.accentFont ?? options.subtitleFont}
              onSelect={(accentFont) => updateStyle(styleState, onStyleChange, { accentFont })}
            />
            <SwatchRow
              value={options.accentColor ?? "#ffd84d"}
              onSelect={(accentColor) => updateStyle(styleState, onStyleChange, { accentColor })}
            />
          </BuilderSection>

          <BuilderSection title="Анимация и подача">
            <ChoiceRow
              items={[
                ["clean", "Без акцента"],
                ["active_word", "Активное слово"],
                ["marker", "Маркер"]
              ]}
              value={options.subtitleStyle}
              onSelect={(subtitleStyle) => updateStyle(styleState, onStyleChange, { subtitleStyle })}
            />
          </BuilderSection>

          <BuilderSection title="Позиция">
            <ChoiceRow
              items={[
                ["none", "Без плашки"],
                ["glass", "Glass"],
                ["solid", "Плотная"]
              ]}
              value={options.subtitleBackdrop}
              onSelect={(subtitleBackdrop) => updateStyle(styleState, onStyleChange, { subtitleBackdrop })}
            />
            <ChoiceRow
              items={captionSizeLabels.map((item) => [item.id, item.label] as [CaptionSize, string])}
              value={options.captionSize ?? "md"}
              onSelect={(captionSize) => updateStyle(styleState, onStyleChange, { captionSize })}
            />
            <ChoiceRow
              items={captionPositionLabels.map((item) => [item.id, item.label] as [CaptionPosition, string])}
              value={options.captionPosition ?? "lower"}
              onSelect={(captionPosition) => updateStyle(styleState, onStyleChange, { captionPosition })}
            />
          </BuilderSection>
        </section>
      ) : null}

      <div className="style-footer-note">
        <span>{styleSaving ? "Сохраняю шаблон…" : "Preview меняется сразу в браузере, тяжёлый рендер нужен только на экспорт."}</span>
      </div>
    </div>
  );
}

function BuilderSection({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="builder-section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function ChoiceRow<T extends string>({
  items,
  value,
  onSelect
}: {
  items: Array<[T, string]>;
  value: T;
  onSelect: (value: T) => void;
}) {
  return (
    <div className="choice-pill-row">
      {items.map(([id, label]) => (
        <button key={id} type="button" className={value === id ? "active" : ""} onClick={() => onSelect(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function SwatchRow({
  value,
  onSelect
}: {
  value: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="swatch-row">
      {colorSwatches.map((swatch) => (
        <button
          key={swatch}
          type="button"
          className={value === swatch ? "active" : ""}
          style={{ background: swatch }}
          onClick={() => onSelect(swatch)}
          aria-label={swatch}
        />
      ))}
    </div>
  );
}

function updateStyle(
  styleState: StyleState,
  onStyleChange: (next: StyleState) => void | Promise<void>,
  patch: Partial<StyleDraftOptions>
) {
  void onStyleChange({
    presentationMode: "subtitles_only",
    stylePreset: styleState.stylePreset,
    styleOptions: withTemplateToggles({
      ...styleState.styleOptions,
      ...patch,
      styleRecipeId: undefined
    })
  });
}
