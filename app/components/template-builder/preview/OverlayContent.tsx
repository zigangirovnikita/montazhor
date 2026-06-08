import { splitTextToSpans } from "./splitTextToSpans";

export function OverlayContent({ kind, accentColor, fontSize, weight, block, theme }: {
  kind: string;
  accentColor: string;
  fontSize: number;
  weight: number;
  block: any;
  theme: any;
}) {
  const titleStyle = { fontSize, fontWeight: weight };
  const preset = block.layoutPreset ?? "";

  if (kind === "title") {
    if (preset === "lesson_title_cinematic") {
      return (
        <div className="lesson-card cinematic" style={{ padding: "10px 12px", textAlign: "center" }}>
          <div className="eyebrow" style={{ fontSize: "9px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.2em" }}>CHAPTER I</div>
          <div className="lesson-title" style={{ fontSize: `${fontSize * 0.75}px`, fontWeight: 300, color: "#ffffff", fontFamily: "Georgia, serif", fontStyle: "italic", marginTop: "4px" }}>Глубина резкости</div>
        </div>
      );
    }
    return (
      <div className="lesson-card" style={{ padding: "14px 16px", display: "grid", gap: "2px" }}>
        <div className="eyebrow" style={{ fontSize: "10px", color: accentColor, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 900 }}>УРОК 01</div>
        <div className="lesson-title" style={{ fontSize: `${fontSize * 0.8}px`, fontWeight: 950, textTransform: "uppercase", color: "#ffffff" }}>Сначала система</div>
        <p className="lesson-subtext" style={{ fontSize: "13px", color: "var(--muted)", margin: "4px 0 0" }}>построим понятный и масштабируемый процесс</p>
      </div>
    );
  }

  if (kind === "number") {
    if (preset === "hud_ratio_panel") {
      return (
        <div className="stat-card" style={{ padding: "12px", display: "grid", gap: "6px" }}>
          <div className="eyebrow" style={{ fontSize: "9px", color: "var(--muted)", textTransform: "uppercase" }}>показатели</div>
          <div className="stat-list" style={{ display: "grid", gap: "6px" }}>
            <div className="stat-row" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 10px", borderRadius: "8px", background: "rgba(10,30,50,0.6)", border: "1px solid rgba(115,200,255,0.12)" }}>
              <span className="stat-value" style={{ fontSize: "18px", fontWeight: 900, color: accentColor }}>84%</span>
              <span className="stat-label" style={{ fontSize: "12px", color: "#f0f5ff" }}>Продуктивность</span>
            </div>
            <div className="stat-row" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 10px", borderRadius: "8px", background: "rgba(10,30,50,0.6)", border: "1px solid rgba(115,200,255,0.12)" }}>
              <span className="stat-value" style={{ fontSize: "18px", fontWeight: 900, color: accentColor }}>12x</span>
              <span className="stat-label" style={{ fontSize: "12px", color: "#f0f5ff" }}>Рендеринг</span>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="glass-card big-number" style={{ padding: "12px 14px" }}>
        <span className="number-value" style={{ fontSize: `${fontSize * 1.15}px`, color: accentColor, fontWeight: 950, display: "block" }}>70%</span>
        <p className="number-label" style={{ margin: "2px 0 0", color: "var(--muted)", textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.06em" }}>меньше рутины</p>
      </div>
    );
  }

  if (kind === "chart") {
    return (
      <div className="chart-card" style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginBottom: "8px" }}>
          <span className="eyebrow" style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase" }}>рост</span>
          <div className="chart-title" style={{ fontSize: `${fontSize * 0.7}px`, fontWeight: 900 }}>+140%</div>
        </div>
        <div className="chart-bars" style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "50px" }}>
          <div className="bar-wrap" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span className="bar" style={{ display: "block", width: "10px", height: "20px", background: `linear-gradient(180deg, ${accentColor}, rgba(255,255,255,0.06))`, borderRadius: "3px 3px 0 0", transformOrigin: "bottom center" }} />
          </div>
          <div className="bar-wrap" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span className="bar" style={{ display: "block", width: "10px", height: "35px", background: `linear-gradient(180deg, ${accentColor}, rgba(255,255,255,0.06))`, borderRadius: "3px 3px 0 0", transformOrigin: "bottom center" }} />
          </div>
          <div className="bar-wrap" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span className="bar" style={{ display: "block", width: "10px", height: "48px", background: `linear-gradient(180deg, ${accentColor}, rgba(255,255,255,0.06))`, borderRadius: "3px 3px 0 0", transformOrigin: "bottom center" }} />
          </div>
        </div>
      </div>
    );
  }

  if (kind === "list") {
    if (preset === "bullet_cards_lesson" || preset === "bullet_cards_premium") {
      return (
        <div className="bullet-shell" style={{ padding: "12px", display: "grid", gap: "6px" }}>
          <div className="eyebrow" style={{ fontSize: "9px", color: "var(--muted)", textTransform: "uppercase" }}>структура</div>
          <div className="bullet-grid" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <article className="bullet-card" style={{ padding: "8px 10px", display: "flex", gap: "8px", borderRadius: "10px", background: "rgba(15,33,57,0.72)", border: "1px solid rgba(36,71,97,0.48)" }}>
              <span className="bullet-index" style={{ color: accentColor, fontWeight: 900, fontSize: "13px" }}>01</span>
              <p className="bullet-text" style={{ fontSize: "13px", margin: 0 }}>Настройка процессов</p>
            </article>
            <article className="bullet-card" style={{ padding: "8px 10px", display: "flex", gap: "8px", borderRadius: "10px", background: "rgba(15,33,57,0.72)", border: "1px solid rgba(36,71,97,0.48)" }}>
              <span className="bullet-index" style={{ color: accentColor, fontWeight: 900, fontSize: "13px" }}>02</span>
              <p className="bullet-text" style={{ fontSize: "13px", margin: 0 }}>Автоматизация сборки</p>
            </article>
          </div>
        </div>
      );
    }
    return (
      <div className="checklist-card" style={{ padding: "12px 14px" }}>
        <div className="checklist-title" style={{ fontSize: `${fontSize * 0.6}px`, fontWeight: 900, marginBottom: "6px", textTransform: "uppercase" }}>3 правила</div>
        <ul className="check-list" style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
          <li className="check-item" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
            <span className="check-dot" style={{ width: "6px", height: "6px", borderRadius: preset === "checklist_steps" ? "2px" : "50%", backgroundColor: accentColor }} />
            <span>Порядок</span>
          </li>
          <li className="check-item" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
            <span className="check-dot" style={{ width: "6px", height: "6px", borderRadius: preset === "checklist_steps" ? "2px" : "50%", backgroundColor: accentColor }} />
            <span>Процесс</span>
          </li>
          <li className="check-item" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
            <span className="check-dot" style={{ width: "6px", height: "6px", borderRadius: preset === "checklist_steps" ? "2px" : "50%", backgroundColor: accentColor }} />
            <span>Автоматизация</span>
          </li>
        </ul>
      </div>
    );
  }

  if (kind === "accent") {
    if (preset === "myth_strike_redline") {
      return (
        <div className="myth-card" style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <div className="eyebrow" style={{ fontSize: "9px", color: "var(--muted)", textTransform: "uppercase" }}>сравнение</div>
          <div className="myth-word" style={{ fontSize: `${fontSize * 0.7}px`, fontWeight: 900, textTransform: "uppercase", color: "rgba(255,255,255,0.48)", position: "relative", alignSelf: "flex-start", display: "inline-block" }}>
            МИФ
            <span className="strike-line" style={{ position: "absolute", left: "-2%", right: "-2%", top: "48%", height: "3px", backgroundColor: "#ff5d4d", transform: "scaleX(var(--strike-scale, 0))", transformOrigin: "left center", borderRadius: "1px" }} />
          </div>
          <div className="truth-word" style={{ fontSize: `${fontSize * 0.7}px`, fontWeight: 900, textTransform: "uppercase", color: accentColor }}>ФАКТ</div>
        </div>
      );
    }

    if (preset === "compare_before_after") {
      return (
        <div className="myth-card compare" style={{ padding: "12px 14px", display: "flex", gap: "10px" }}>
          <div style={{ flex: 1, padding: "6px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", textAlign: "center" }}>
            <div style={{ fontSize: "8px", color: "var(--muted)" }}>ДО</div>
            <div className="myth-word" style={{ fontSize: "14px", fontWeight: 900, position: "relative", display: "inline-block" }}>
              Хаос
              <span className="strike-line" style={{ position: "absolute", left: "-2%", right: "-2%", top: "48%", height: "2px", backgroundColor: "#ff5d4d", transform: "scaleX(var(--strike-scale, 0))", transformOrigin: "left center" }} />
            </div>
          </div>
          <div style={{ flex: 1, padding: "6px", borderRadius: "8px", border: "1px solid rgba(115,200,255,0.22)", background: "rgba(115,200,255,0.06)", textAlign: "center" }}>
            <div style={{ fontSize: "8px", color: accentColor }}>ПОСЛЕ</div>
            <div className="truth-word" style={{ fontSize: "14px", fontWeight: 900, color: accentColor }}>Порядок</div>
          </div>
        </div>
      );
    }

    if (preset === "concept_orbit_map") {
      return (
        <div className="concept-card" style={{ padding: "12px", display: "grid", gap: "8px" }}>
          <div className="eyebrow" style={{ fontSize: "9px", color: "var(--muted)", textTransform: "uppercase" }}>схема</div>
          <div className="concept-grid" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div className="concept-node" style={{ flex: 1, padding: "4px", fontSize: "10px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", background: "rgba(0,0,0,0.2)", textAlign: "center" }}>Вход</div>
            <div className="concept-center" style={{ width: "32px", height: "32px", display: "grid", placeItems: "center", borderRadius: "50%", background: accentColor, color: "#000", fontWeight: 900, fontSize: "10px", boxShadow: `0 0 10px ${accentColor}` }}>AI</div>
            <div className="concept-node" style={{ flex: 1, padding: "4px", fontSize: "10px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", background: "rgba(0,0,0,0.2)", textAlign: "center" }}>Выход</div>
          </div>
        </div>
      );
    }

    return (
      <div className="accent-card" style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "4px" }}>
        <div className="eyebrow" style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase" }}>
          {preset === "keyword_warning_strip" ? "⚠️ Внимание" : preset === "quote_emphasis" ? "Цитата" : "акцент"}
        </div>
        <strong style={titleStyle} className="keyword">Сначала система</strong>
        <span className="subtext" style={{ fontSize: "13px", color: "var(--muted)" }}>потом масштаб</span>
      </div>
    );
  }

  if (kind === "cta") {
    if (preset === "cta_finish_premium") {
      return (
        <div className="cta-card premium" style={{ padding: "12px", border: "1px solid rgba(216,197,161,0.24)", background: "#241f18", textAlign: "center" }}>
          <strong style={{ ...titleStyle, color: accentColor }}>Подпишись</strong>
          <small style={{ fontSize: "11px", color: "#c9bda8", display: "block", marginTop: "2px" }}>и получай лучшие разборы процессов</small>
        </div>
      );
    }
    if (preset === "cta_finish_viral") {
      return (
        <div className="cta-card viral" style={{ padding: "12px", background: "#11", border: "1px solid rgba(255,64,64,0.24)", textAlign: "center" }}>
          <strong style={{ ...titleStyle, color: "#ff4040" }}>ЗАБЕРИ СВОЕ</strong>
          <small style={{ fontSize: "11px", color: "var(--muted)", display: "block", marginTop: "2px" }}>ссылка в описании профиля</small>
        </div>
      );
    }
    return (
      <div className="cta-card" style={{ padding: "12px 14px", textAlign: "center", display: "flex", flexDirection: "column", gap: "4px" }}>
        <strong style={titleStyle}>Сохрани</strong>
        <small style={{ fontSize: "12px", color: "var(--muted)", display: "block" }}>и проверь один процесс сегодня</small>
      </div>
    );
  }

  if (kind === "text") {
    return (
      <div className="phrase-card" style={{ display: "flex", flexWrap: "wrap", gap: "4px 6px", padding: "10px 12px", fontSize: `${fontSize}px`, fontWeight: weight }}>
        {splitTextToSpans("Не улучшайте все сразу", "сразу", preset, accentColor, block.colorText ?? theme.colorText)}
      </div>
    );
  }

  if (kind === "surface") {
    return (
      <div className="phrase-card" style={{ display: "flex", flexWrap: "wrap", gap: "4px 6px", padding: "10px 12px", fontSize: `${fontSize}px`, fontWeight: weight }}>
        {splitTextToSpans("Глобальный стиль шаблона", "шаблона", preset, accentColor, block.colorText ?? theme.colorText)}
      </div>
    );
  }

  return (
    <div className="phrase-card" style={{ display: "flex", flexWrap: "wrap", gap: "4px 6px", padding: "10px 12px", fontSize: `${fontSize}px`, fontWeight: weight }}>
      {splitTextToSpans("Главный инсайт ролика", "инсайт", preset, accentColor, block.colorText ?? theme.colorText)}
    </div>
  );
}
