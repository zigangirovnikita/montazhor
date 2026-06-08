import type { ContentPlan } from "@/lib/types";
import { hyperframesLocalFontsCss, hyperframesLocalGsapScript, motionSvg } from "@/server/hyperframes/assets";
import { infographicPanelRuntime } from "@/server/hyperframes/templates/infographicPanelRuntime";
import { infographicPanelStyles } from "@/server/hyperframes/templates/infographicPanelTheme";
import type { VideoRegion } from "@/server/video/profile";

type PanelCard = {
  kind: "signal" | "checklist" | "warning";
  eyebrow: string;
  title: string;
  points: string[];
  metricValue: string;
  metricLabel: string;
  callout: string;
  icon: "trending-up" | "badge-check" | "message-square-more" | "triangle-alert";
};

export function infographicPanelTemplate(contentPlan: ContentPlan, region: VideoRegion, duration: number) {
  const cards = buildCards(contentPlan);
  const payload = JSON.stringify(cards);
  const icons = JSON.stringify({
    trendingUp: motionSvg("trending-up"),
    badgeCheck: motionSvg("badge-check"),
    messageSquareMore: motionSvg("message-square-more"),
    triangleAlert: motionSvg("triangle-alert"),
    arrowRight: motionSvg("arrow-right")
  });
  const safeDuration = Math.max(1, duration);

  return `<!doctype html>
<html>
  <head>
    <style>${hyperframesLocalFontsCss()}</style>
  </head>
  <body>
    <div
      id="infographic-panel"
      data-composition-id="infographic-panel"
      data-start="0"
      data-duration="${safeDuration.toFixed(3)}"
      data-width="${region.width}"
      data-height="${region.height}"
    >
      <main class="stage">
        <div class="ambient ambient-a"></div>
        <div class="ambient ambient-b"></div>
        <div class="grid-bg"></div>
        <div class="flash"></div>
        <section class="frame" data-kind="signal">
          <div class="frame-top">
            <div class="eyebrow-wrap">
              <span class="icon-badge" id="eyebrow-icon"></span>
              <p class="eyebrow" id="eyebrow"></p>
            </div>
            <div class="metric-card">
              <span class="metric-value" id="metric-value"></span>
              <span class="metric-label" id="metric-label"></span>
            </div>
          </div>
          <h1 id="title"></h1>
          <div class="content-grid">
            <ul id="points"></ul>
            <aside class="visual-panel">
              <div class="visual visual-chart">
                <div class="mini-chart">
                  <span class="bar bar-a"></span>
                  <span class="bar bar-b"></span>
                  <span class="bar bar-c"></span>
                </div>
                <div class="trend-line">
                  <svg viewBox="0 0 280 160" preserveAspectRatio="none" aria-hidden="true">
                    <path class="trend-path" d="M20 130 C65 116, 70 82, 116 78 S178 50, 220 42 S250 26, 260 20"></path>
                    <path class="trend-glow" d="M20 130 C65 116, 70 82, 116 78 S178 50, 220 42 S250 26, 260 20"></path>
                  </svg>
                </div>
              </div>
              <div class="connector">
                <span class="connector-line"></span>
                <span class="connector-arrow" id="connector-arrow"></span>
              </div>
              <div class="callout-card">
                <div class="callout-icon" id="callout-icon"></div>
                <p id="callout"></p>
              </div>
            </aside>
          </div>
        </section>
      </main>
      <style>
${infographicPanelStyles(region)}
      </style>
      ${hyperframesLocalGsapScript()}
      <script>
${infographicPanelRuntime(payload, icons, safeDuration)}
      </script>
    </div>
  </body>
</html>`;
}

function buildCards(contentPlan: ContentPlan): PanelCard[] {
  const phrases = contentPlan.keyPhrases.length ? contentPlan.keyPhrases : [contentPlan.description || contentPlan.hook];
  const firstPoints = phrases.slice(0, 3).map((phrase) => trimText(phrase, 70));
  const secondPoints = (phrases.slice(1, 4).length ? phrases.slice(1, 4) : phrases.slice(0, 3)).map((phrase) =>
    trimText(phrase, 70)
  );

  return [
    {
      kind: "signal",
      eyebrow: "Ключевая мысль",
      title: trimText(contentPlan.hook || "Главный сигнал", 64),
      points: firstPoints.length ? firstPoints : ["Смотри до конца"],
      metricValue: String(Math.max(1, Math.min(phrases.length, 9))).padStart(2, "0"),
      metricLabel: "ключевых тезиса",
      callout: trimText(contentPlan.titleSuggestions[0] || "Сохрани главный вывод", 58),
      icon: "trending-up"
    },
    {
      kind: "checklist",
      eyebrow: "Что запомнить",
      title: "Короткий чеклист",
      points: secondPoints.length ? secondPoints : ["Оставь суть и убери лишнее"],
      metricValue: "OK",
      metricLabel: "понятная структура",
      callout: trimText(contentPlan.description || "Оставляем только то, что усиливает мысль.", 58),
      icon: "badge-check"
    },
    {
      kind: "warning",
      eyebrow: "Не пропусти",
      title: trimText(contentPlan.titleSuggestions[0] || contentPlan.hook || "Главный вывод", 64),
      points: [
        trimText(phrases[0] || contentPlan.description || "Сохрани эту мысль", 70),
        trimText(phrases[1] || "Повтори главный тезис в одной сильной фразе.", 70),
        trimText(phrases[2] || "Используй это как готовый вывод для ролика.", 70)
      ],
      metricValue: "CTA",
      metricLabel: "финальный акцент",
      callout: "Этот блок можно превратить в призыв или вывод.",
      icon: "triangle-alert"
    }
  ];
}

function trimText(value: string, maxLength: number) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLength) return trimmed;
  const words = trimmed.split(/\s+/);
  const accepted: string[] = [];
  for (const word of words) {
    const next = accepted.length ? `${accepted.join(" ")} ${word}` : word;
    if (next.length > maxLength) break;
    accepted.push(word);
  }
  return accepted.join(" ") || words[0] || trimmed;
}
