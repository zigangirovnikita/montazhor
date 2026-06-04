"use client";

import type { MotionIntensity, VisualDensity, VisualPresetPack, VisualTemplateId } from "@/lib/types";

const packCatalog: Array<{
  id: VisualPresetPack;
  title: string;
  note: string;
  sample: string;
  templates: VisualTemplateId[];
}> = [
  { id: "balanced", title: "Баланс", note: "Ровный mix текста, цифр и карточек без перегруза.", sample: "Главная мысль", templates: ["kinetic_text", "big_number", "bullet_cards", "cta_plate"] },
  { id: "educational", title: "Обучение", note: "Чеклисты, определения и аккуратные metric-вставки.", sample: "3 шага", templates: ["kinetic_text", "checklist", "metric_chart", "bullet_cards"] },
  { id: "premium", title: "Премиум", note: "Спокойные glass/cards и мягкий CTA.", sample: "Вывод", templates: ["kinetic_text", "bullet_cards", "metric_chart", "cta_plate"] },
  { id: "viral", title: "Viral", note: "Жестче акценты, slam-слова и цифры в лоб.", sample: "ВАЖНО", templates: ["kinetic_text", "keyword_slam", "big_number", "checklist"] },
  { id: "minimal", title: "Минимум", note: "Safe kinetic без тяжелых карточек.", sample: "Короткая фраза", templates: ["kinetic_text"] }
];

const templateLabels: Record<VisualTemplateId, string> = {
  kinetic_text: "Фразы",
  big_number: "Цифры",
  bullet_cards: "Карточки",
  keyword_slam: "Ключевые слова",
  checklist: "Чеклисты",
  metric_chart: "Мини-графики",
  cta_plate: "Финал"
};

const densityLabels: Record<VisualDensity, string> = {
  low: "Редко",
  medium: "Средне",
  high: "Плотно"
};

const motionLabels: Record<MotionIntensity, string> = {
  calm: "Спокойно",
  medium: "Живо",
  active: "Активно"
};

export function StyleStudioCatalog({
  presetPack,
  visualDensity,
  motionIntensity,
  disabledTemplates
}: {
  presetPack: VisualPresetPack;
  visualDensity: VisualDensity;
  motionIntensity: MotionIntensity;
  disabledTemplates: VisualTemplateId[];
}) {
  const activePack = packCatalog.find((pack) => pack.id === presetPack) ?? packCatalog[0];
  const enabledTemplates = activePack.templates.filter((templateId) => !disabledTemplates.includes(templateId));
  const disabledFromPack = activePack.templates.filter((templateId) => disabledTemplates.includes(templateId));

  return (
    <section className="style-catalog">
      <div className="style-catalog-head">
        <div>
          <p className="screen-step">Что реально соберется</p>
          <h2>Пак пресетов и состав оверлеев</h2>
        </div>
        <div className="style-state-pills">
          <span>{densityLabels[visualDensity]}</span>
          <span>{motionLabels[motionIntensity]}</span>
          <span>{activePack.title}</span>
        </div>
      </div>

      <div className="catalog-pack-grid">
        {packCatalog.map((pack) => {
          const selected = pack.id === activePack.id;
          return (
            <article className={`catalog-pack-card ${selected ? "active" : ""}`} key={pack.id}>
              <span className={`catalog-pack-sample pack-${pack.id}`}>{pack.sample}</span>
              <strong>{pack.title}</strong>
              <p>{pack.note}</p>
              <div className="catalog-pack-tags">
                {pack.templates.map((templateId) => (
                  <span key={templateId}>{templateLabels[templateId]}</span>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      <div className="catalog-template-summary">
        <div>
          <h3>Включено сейчас</h3>
          <div className="catalog-pack-tags">
            {enabledTemplates.length ? enabledTemplates.map((templateId) => <span key={templateId}>{templateLabels[templateId]}</span>) : <span>Остались только safe-фразы</span>}
          </div>
        </div>
        {disabledFromPack.length ? (
          <div>
            <h3>Отключено вручную</h3>
            <div className="catalog-pack-tags muted">
              {disabledFromPack.map((templateId) => <span key={templateId}>{templateLabels[templateId]}</span>)}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
