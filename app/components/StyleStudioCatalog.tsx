"use client";

import type { MotionIntensity, VisualDensity, VisualPresetPack, VisualTemplateId } from "@/lib/types";

const packCatalog: Array<{
  id: VisualPresetPack;
  title: string;
  note: string;
  sample: string;
  templates: VisualTemplateId[];
}> = [
  { id: "balanced", title: "Баланс", note: "Ровный mix текста, цифр и карточек без перегруза.", sample: "Главная мысль", templates: ["kinetic_text", "big_number", "bullet_cards", "stat_panel", "cta_plate"] },
  { id: "educational", title: "Обучение", note: "Чеклисты, определения и аккуратные metric-вставки.", sample: "3 шага", templates: ["kinetic_text", "lesson_title", "checklist", "concept_map", "stat_panel"] },
  { id: "premium", title: "Премиум", note: "Спокойные glass/cards и мягкий CTA.", sample: "Вывод", templates: ["kinetic_text", "lesson_title", "bullet_cards", "concept_map", "cta_plate"] },
  { id: "viral", title: "Viral", note: "Жестче акценты, slam-слова и цифры в лоб.", sample: "ВАЖНО", templates: ["kinetic_text", "keyword_slam", "myth_strike", "big_number", "stat_panel"] },
  { id: "minimal", title: "Минимум", note: "Safe kinetic без тяжелых карточек.", sample: "Короткая фраза", templates: ["kinetic_text"] }
];

const templateLabels: Record<VisualTemplateId, string> = {
  kinetic_text: "Фразы",
  big_number: "Цифры",
  bullet_cards: "Карточки",
  keyword_slam: "Ключевые слова",
  checklist: "Чеклисты",
  metric_chart: "Мини-графики",
  lesson_title: "Lesson-кадры",
  myth_strike: "Миф/зачеркнуть",
  stat_panel: "HUD-метрики",
  concept_map: "Схемы",
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

const cinematicScenes = [
  { id: "lesson", title: "Lesson title", note: "Крупный заголовок + HUD-сетка", sample: "THE GOLDEN RATIO" },
  { id: "ratio", title: "Ratio stack", note: "60/30/10, доли, проценты", sample: "60%" },
  { id: "myth", title: "Myth strike", note: "Миф, ошибка, красное зачеркивание", sample: "MAGIC" },
  { id: "map", title: "Trust map", note: "Схема с центром и двумя источниками", sample: "TRUST" },
  { id: "cards", title: "Three cards", note: "WHEN / HOW / CHARGE", sample: "03" },
  { id: "pip", title: "PIP slide", note: "Full-screen слайд + автор в углу", sample: "AIS" }
];

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

      <div className="cinematic-gallery">
        <div className="style-catalog-head compact">
          <div>
            <p className="screen-step">Cinematic scenes</p>
            <h3>Режиссерские сцены нового режима</h3>
          </div>
        </div>
        <div className="cinematic-gallery-grid">
          {cinematicScenes.map((scene) => (
            <article className={`cinematic-scene-card scene-${scene.id}`} key={scene.id}>
              <span>{scene.sample}</span>
              <strong>{scene.title}</strong>
              <p>{scene.note}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
