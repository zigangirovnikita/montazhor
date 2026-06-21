"use client";

import type { ReactNode } from "react";
import type { MotionIntensity, PresentationMode, StylePreset, VisualDensity, VisualPresetPack, VisualTemplateId } from "@/lib/types";

export type SubtitleFontId = "manrope" | "onest" | "unbounded" | "montserrat" | "golos";
export type SubtitleTextCase = "sentence" | "upper";
export type CaptionPosition = "lower" | "middle";
export type CaptionSize = "sm" | "md" | "lg";

export type StyleDraftOptions = {
  styleRecipeId?: string;
  subtitleFont: SubtitleFontId;
  accentFont?: SubtitleFontId;
  subtitleStyle: "clean" | "active_word" | "marker";
  subtitleBackdrop: "none" | "glass" | "solid";
  subtitleColor?: string;
  accentColor?: string;
  textCase?: SubtitleTextCase;
  captionPosition?: CaptionPosition;
  captionSize?: CaptionSize;
  infographicTone: "glass" | "dark" | "bright";
  infographicAccent: "mint" | "orange" | "cream";
  emojiEnabled?: boolean;
  autoLists?: boolean;
  autoComparisons?: boolean;
  autoCharts?: boolean;
  autoCta?: boolean;
  autoStrike?: boolean;
  visualDensity?: VisualDensity;
  motionIntensity?: MotionIntensity;
  presetPack?: VisualPresetPack;
  disabledTemplates?: VisualTemplateId[];
  visualTemplateId?: string;
  visualTemplate?: unknown;
};

type OverlayProps = {
  presentationMode: PresentationMode;
  pending: boolean;
  onPresentationModeChange: (value: PresentationMode) => void;
  onNext: () => void;
};

type StylingProps = {
  presentationMode: PresentationMode;
  stylePreset: StylePreset;
  styleOptions: StyleDraftOptions;
  pending: boolean;
  onBack: () => void;
  onStylePresetChange: (value: StylePreset) => void;
  onStyleOptionsChange: (value: StyleDraftOptions) => void;
  onRenderPreview: () => void;
};

const overlayCards = [
  {
    id: "subtitles_only",
    title: "Browser-renderer MVP",
    description: "Канонический путь: clean cut, субтитры и шаблонное оформление без scene-based веток.",
    preview: "subtitles"
  }
] as const;

const stylePresets = [
  { id: "clean_expert", title: "Экспертно", note: "Чисто, спокойно, строго." },
  { id: "premium_calm", title: "Премиально", note: "Мягче плашки и спокойнее акценты." },
  { id: "dynamic_viral", title: "Динамично", note: "Заметнее акценты и активнее ритм." }
] as const;

const subtitleFonts = [
  { id: "manrope", title: "Manrope" },
  { id: "onest", title: "Onest" },
  { id: "unbounded", title: "Unbounded" },
  { id: "montserrat", title: "Montserrat" },
  { id: "golos", title: "Golos Text" }
] as const;

const subtitleStyles = [
  { id: "clean", title: "Спокойный показ" },
  { id: "active_word", title: "Выделять текущее слово" },
  { id: "marker", title: "Маркерный акцент" }
] as const;

const subtitleBackdrops = [
  { id: "none", title: "Без подложки" },
  { id: "glass", title: "Полупрозрачная" },
  { id: "solid", title: "Плотная" }
] as const;

const infographicTones = [
  { id: "glass", title: "Стеклянная" },
  { id: "dark", title: "Темная" },
  { id: "bright", title: "Светлая" }
] as const;

const infographicAccents = [
  { id: "mint", title: "Мятный" },
  { id: "orange", title: "Оранжевый" },
  { id: "cream", title: "Кремовый" }
] as const;

export function OverlayModeChooser({
  presentationMode,
  pending,
  onPresentationModeChange,
  onNext
}: OverlayProps) {
  return (
    <div className="style-wizard">
      <div className="visual-grid visual-grid-overlay">
        {overlayCards.map((card) => {
          const selected = presentationMode === card.id;
          return (
            <button
              className={`visual-card visual-card-wide${selected ? " selected" : ""}`}
              key={card.id}
              type="button"
              onClick={() => onPresentationModeChange(card.id as PresentationMode)}
              disabled={pending}
            >
              <VisualPreview kind={card.preview} />
              <div className="visual-copy">
                <strong>{card.title}</strong>
                <span>{card.description}</span>
              </div>
            </button>
          );
        })}
      </div>

      <button className="cta-button" type="button" onClick={onNext} disabled={pending}>
        Дальше к настройкам
      </button>
    </div>
  );
}

export function PresentationConfigurator({
  stylePreset,
  styleOptions,
  pending,
  onBack,
  onStylePresetChange,
  onStyleOptionsChange,
  onRenderPreview
}: StylingProps) {
  const withInfographic = false;

  return (
    <div className="style-wizard">
      <VisualCategory
        title="Общий стиль"
        selected={stylePreset}
        items={stylePresets.map((item) => ({
          id: item.id,
          title: item.title,
          subtitle: item.note,
          preview: <StylePresetPreview preset={item.id} />
        }))}
        onSelect={(id) => onStylePresetChange(id as StylePreset)}
      />

      <VisualCategory
        title="Шрифт субтитров"
        selected={styleOptions.subtitleFont}
        items={subtitleFonts.map((item) => ({
          id: item.id,
          title: item.title,
          preview: <SubtitleFontPreview font={item.id} />
        }))}
        onSelect={(id) => onStyleOptionsChange({ ...styleOptions, subtitleFont: id as StyleDraftOptions["subtitleFont"] })}
      />

      <VisualCategory
        title="Стиль показа субтитров"
        selected={styleOptions.subtitleStyle}
        items={subtitleStyles.map((item) => ({
          id: item.id,
          title: item.title,
          preview: <SubtitleStylePreview styleId={item.id} />
        }))}
        onSelect={(id) => onStyleOptionsChange({ ...styleOptions, subtitleStyle: id as StyleDraftOptions["subtitleStyle"] })}
      />

      <VisualCategory
        title="Подложка субтитров"
        selected={styleOptions.subtitleBackdrop}
        items={subtitleBackdrops.map((item) => ({
          id: item.id,
          title: item.title,
          preview: <SubtitleBackdropPreview backdrop={item.id} />
        }))}
        onSelect={(id) => onStyleOptionsChange({ ...styleOptions, subtitleBackdrop: id as StyleDraftOptions["subtitleBackdrop"] })}
      />

      {withInfographic ? (
        <>
          <VisualCategory
            title="Стилистика инфографики"
            selected={styleOptions.infographicTone}
            items={infographicTones.map((item) => ({
              id: item.id,
              title: item.title,
              preview: <InfographicTonePreview tone={item.id} />
            }))}
            onSelect={(id) => onStyleOptionsChange({ ...styleOptions, infographicTone: id as StyleDraftOptions["infographicTone"] })}
          />

          <VisualCategory
            title="Оттенок инфографики"
            selected={styleOptions.infographicAccent}
            items={infographicAccents.map((item) => ({
              id: item.id,
              title: item.title,
              preview: <InfographicAccentPreview accent={item.id} />
            }))}
            onSelect={(id) => onStyleOptionsChange({ ...styleOptions, infographicAccent: id as StyleDraftOptions["infographicAccent"] })}
          />
        </>
      ) : null}

      <div className="config-actions">
        <button className="mode-button" type="button" onClick={onBack} disabled={pending}>
          Назад
        </button>
        <button className="cta-button" type="button" onClick={onRenderPreview} disabled={pending}>
          {pending ? "Генерирую..." : "Собрать preview"}
        </button>
      </div>
    </div>
  );
}

function VisualCategory({
  title,
  items,
  selected,
  onSelect
}: {
  title: string;
  items: Array<{ id: string; title: string; subtitle?: string; preview: ReactNode }>;
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="style-section">
      <div className="section-lead">
        <h3>{title}</h3>
      </div>
      <div className="visual-grid">
        {items.map((item) => (
          <button
            className={`visual-card${selected === item.id ? " selected" : ""}`}
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
          >
            {item.preview}
            <div className="visual-copy compact">
              <strong>{item.title}</strong>
              {item.subtitle ? <span>{item.subtitle}</span> : null}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function VisualPreview({ kind }: { kind: "cinematic" | "subtitles" | "infographics" | "media" }) {
  if (kind === "cinematic") {
    return (
      <div className="mini-canvas overlay-cinematic">
        <div className="mini-hud-panel">
          <strong>60%</strong>
          <span>DETERMINISTIC</span>
        </div>
        <div className="mini-pip" />
        <div className="mini-gridline" />
      </div>
    );
  }

  return (
    <div className={`mini-canvas overlay-${kind}`}>
      <div className="mini-author" />
      {kind !== "subtitles" ? <div className="mini-side-panel" /> : null}
      {kind === "media" ? <div className="mini-media-chip" /> : null}
      <div className="mini-caption-row">
        <span className="mini-caption" />
        <span className="mini-caption short" />
      </div>
    </div>
  );
}

function StylePresetPreview({ preset }: { preset: string }) {
  return (
    <div className={`mini-canvas preset-${preset}`}>
      <div className="mini-caption-stack">
        <span className="mini-pill first" />
        <span className="mini-pill second" />
      </div>
    </div>
  );
}

function SubtitleFontPreview({ font }: { font: string }) {
  return (
    <div className={`mini-canvas font-${font}`}>
      <div className="mini-text-sample">Текст</div>
    </div>
  );
}

function SubtitleStylePreview({ styleId }: { styleId: string }) {
  return (
    <div className={`mini-canvas style-${styleId}`}>
      <div className="mini-text-line">
        <span />
        <span className="active" />
        <span />
      </div>
    </div>
  );
}

function SubtitleBackdropPreview({ backdrop }: { backdrop: string }) {
  return (
    <div className={`mini-canvas backdrop-${backdrop}`}>
      <div className="mini-backdrop-text">Сабы</div>
    </div>
  );
}

function InfographicTonePreview({ tone }: { tone: string }) {
  return (
    <div className={`mini-canvas tone-${tone}`}>
      <div className="mini-chart-box">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function InfographicAccentPreview({ accent }: { accent: string }) {
  return (
    <div className={`mini-canvas accent-${accent}`}>
      <div className="mini-accent-card">
        <span className="dot" />
        <span className="line" />
      </div>
    </div>
  );
}
