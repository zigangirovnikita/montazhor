"use client";

import type { VisualPresetPack } from "@/lib/types";
import { visualPresets } from "@/server/hyperframes/visualRegistry";

const templateLabels: Record<string, string> = {
  kinetic_text: "Фраза",
  big_number: "Цифра",
  bullet_cards: "Карточки",
  keyword_slam: "Акцент",
  checklist: "Чеклист",
  metric_chart: "График",
  cta_plate: "CTA"
};

const previewSamples: Record<string, { primary: string; secondary: string }> = {
  kinetic_text: { primary: "Главная мысль", secondary: "короткая фраза" },
  big_number: { primary: "42%", secondary: "рост удержания" },
  bullet_cards: { primary: "МИФ / ФАКТ", secondary: "2 карточки" },
  keyword_slam: { primary: "ОШИБКА", secondary: "не делай так" },
  checklist: { primary: "3 шага", secondary: "короткий план" },
  metric_chart: { primary: "60 / 80 / 95", secondary: "динамика" },
  cta_plate: { primary: "Сохрани", secondary: "следующий шаг" }
};

export function StylePresetGallery({ presetPack }: { presetPack: VisualPresetPack }) {
  const presets = visualPresets.filter((preset) => preset.pack === presetPack || (presetPack !== "minimal" && preset.pack === "balanced"));
  return (
    <section className="style-gallery">
      <div className="style-catalog-head">
        <div>
          <p className="screen-step">Доступные пресеты</p>
          <h2>Что может выбрать planner внутри пакета</h2>
        </div>
      </div>
      <div className="gallery-grid">
        {presets.map((preset) => {
          const sample = previewSamples[preset.templateId];
          return (
            <article className={`gallery-card template-${preset.templateId}`} key={preset.id}>
              <span className="gallery-type">{templateLabels[preset.templateId] ?? preset.templateId}</span>
              <strong>{preset.label}</strong>
              <div className="gallery-preview">
                <span>{sample?.primary ?? preset.label}</span>
                <small>{sample?.secondary ?? `${preset.maxTextChars} chars`}</small>
              </div>
              <p>{preset.momentTypes.join(" · ")}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
