import type { VisualOverlayPlan, VisualStyleProfile } from "@/lib/types";
import { hyperframesLocalFontsCss } from "@/server/hyperframes/assets";
import type { VideoProfile } from "@/server/video/profile";

export function semanticOverlayTemplate(plan: VisualOverlayPlan, style: VisualStyleProfile, profile: VideoProfile, duration: number) {
  const payload = JSON.stringify(plan.beats);
  const theme = JSON.stringify(style);
  const safeDuration = Math.max(1, duration);

  return `<!doctype html>
<html>
  <head>
    <style>${hyperframesLocalFontsCss()}</style>
  </head>
  <body>
    <div
      id="semantic-overlay"
      data-composition-id="semantic-overlay"
      data-start="0"
      data-duration="${safeDuration.toFixed(3)}"
      data-width="${profile.width}"
      data-height="${profile.height}"
    >
      <main id="visual-stage"></main>
      <style>
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          width: ${profile.width}px;
          height: ${profile.height}px;
          overflow: hidden;
          background: #00ff00;
        }
        #semantic-overlay {
          position: relative;
          width: ${profile.width}px;
          height: ${profile.height}px;
          overflow: hidden;
          background: #00ff00;
          --bg: ${style.colors.background};
          --surface: ${style.colors.surface};
          --surface-strong: ${style.colors.surfaceStrong};
          --text: ${style.colors.text};
          --muted: ${style.colors.muted};
          --accent: ${style.colors.accent};
          --accent-2: ${style.colors.accent2};
          --warning: ${style.colors.warning};
          --border: ${style.colors.border};
          --heading-font: ${style.typography.heading};
          --body-font: ${style.typography.body};
          --number-font: ${style.typography.number};
        }
        #visual-stage {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .beat {
          position: absolute;
          opacity: 0;
          transform-origin: 50% 50%;
          color: var(--text);
          font-family: var(--body-font);
          filter: drop-shadow(0 18px 42px rgba(0, 0, 0, 0.35));
        }
        .layout-left { left: 72px; top: 50%; transform: translateY(-50%); width: min(520px, 45%); }
        .layout-right { right: 72px; top: 50%; transform: translateY(-50%); width: min(520px, 45%); }
        .layout-center { left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(760px, 78%); text-align: center; }
        .layout-lower_third { left: 50%; bottom: 220px; transform: translateX(-50%); width: min(820px, 82%); text-align: center; }
        .layout-full_frame { left: 6%; right: 6%; top: 18%; }
        .glass-card,
        .bullet-card,
        .checklist-card,
        .chart-card,
        .cta-card {
          border: 1px solid var(--border);
          border-radius: 28px;
          background: var(--surface);
          box-shadow: 0 28px 90px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(18px);
        }
        .big-number {
          padding: 32px 36px;
        }
        .number-value {
          display: block;
          font-family: var(--number-font);
          font-size: clamp(84px, 12vw, 172px);
          font-weight: 950;
          line-height: 0.88;
          color: var(--accent);
          letter-spacing: 0;
        }
        .number-label,
        .subtext,
        .eyebrow {
          color: var(--muted);
          font-size: 26px;
          line-height: 1.18;
        }
        .keyword {
          font-family: var(--heading-font);
          font-size: clamp(72px, 10vw, 150px);
          font-weight: 950;
          line-height: 0.92;
          color: var(--text);
          text-transform: uppercase;
          letter-spacing: 0;
          -webkit-text-stroke: 1px color-mix(in srgb, var(--accent) 40%, transparent);
        }
        .keyword .accent {
          color: var(--warning);
          text-shadow: 0 0 32px color-mix(in srgb, var(--warning) 42%, transparent);
        }
        .bullet-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 22px;
        }
        .bullet-card {
          min-height: 360px;
          padding: 28px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .bullet-index {
          color: var(--accent);
          font-family: var(--number-font);
          font-size: 28px;
          font-weight: 900;
        }
        .bullet-title,
        .checklist-title,
        .chart-title,
        .cta-text {
          font-family: var(--heading-font);
          font-size: clamp(42px, 5vw, 78px);
          font-weight: 950;
          line-height: 0.98;
          letter-spacing: 0;
        }
        .bullet-text,
        .check-item,
        .chart-label {
          color: var(--muted);
          font-size: 28px;
          line-height: 1.16;
        }
        .checklist-card,
        .chart-card,
        .cta-card {
          padding: 34px 40px;
        }
        .check-list {
          display: grid;
          gap: 16px;
          margin: 24px 0 0;
          padding: 0;
          list-style: none;
        }
        .check-item {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .check-dot {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--accent);
          box-shadow: 0 0 28px color-mix(in srgb, var(--accent) 50%, transparent);
          flex: 0 0 auto;
        }
        .chart-bars {
          display: flex;
          align-items: end;
          gap: 18px;
          height: 210px;
          margin-top: 28px;
        }
        .bar {
          flex: 1;
          min-width: 44px;
          border-radius: 16px 16px 8px 8px;
          background: linear-gradient(180deg, var(--accent), var(--accent-2));
          transform-origin: 50% 100%;
        }
        .bar-a { height: 42%; }
        .bar-b { height: 68%; }
        .bar-c { height: 88%; }
        .cta-card {
          background: var(--surface-strong);
        }
        @media (max-width: 900px) {
          .layout-left, .layout-right { left: 42px; right: 42px; width: auto; }
          .bullet-grid { grid-template-columns: 1fr; }
          .bullet-card { min-height: 180px; }
        }
      </style>
      <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
      <script>
        (() => {
          window.__timelines = window.__timelines || {};
          const BEATS = ${payload};
          const THEME = ${theme};
          const stage = document.getElementById("visual-stage");
          const tl = gsap.timeline({ paused: true });

          BEATS.forEach((beat) => {
            const node = renderBeat(beat);
            stage.appendChild(node);
            const enter = enterVars(beat.motionId);
            const start = Math.max(0, beat.start);
            const end = start + beat.duration;

            tl.fromTo(node, enter.from, { ...enter.to, duration: enter.duration, ease: enter.ease }, start);
            animateChildren(tl, node, beat, start);
            tl.to(node, { opacity: 0, y: "-=18", duration: 0.18, ease: "power2.in" }, Math.max(start + 0.7, end - 0.2));
          });

          tl.seek(0);
          window.__timelines["semantic-overlay"] = tl;

          function renderBeat(beat) {
            const wrap = document.createElement("section");
            wrap.className = "beat layout-" + beat.layout + " template-" + beat.templateId;
            wrap.id = beat.id;

            if (beat.templateId === "big_number") {
              wrap.innerHTML = '<div class="glass-card big-number"><span class="number-value">' + esc(String(beat.payload.value || "1")) + '</span><p class="number-label">' + esc(String(beat.payload.label || "")) + '</p></div>';
              return wrap;
            }
            if (beat.templateId === "keyword_slam") {
              wrap.innerHTML = '<div class="keyword"><span class="accent">' + esc(String(beat.payload.text || "")) + '</span></div><p class="subtext">' + esc(String(beat.payload.subtext || "")) + '</p>';
              return wrap;
            }
            if (beat.templateId === "checklist") {
              const items = list(beat.payload.items).map((item) => '<li class="check-item"><span class="check-dot"></span><span>' + esc(item) + '</span></li>').join("");
              wrap.innerHTML = '<div class="checklist-card"><div class="checklist-title">' + esc(String(beat.payload.title || "Что важно")) + '</div><ul class="check-list">' + items + '</ul></div>';
              return wrap;
            }
            if (beat.templateId === "metric_chart") {
              wrap.innerHTML = '<div class="chart-card"><div class="chart-title">' + esc(String(beat.payload.title || "Динамика")) + '</div><p class="chart-label">' + esc(String(beat.payload.label || "")) + '</p><div class="chart-bars"><span class="bar bar-a"></span><span class="bar bar-b"></span><span class="bar bar-c"></span></div></div>';
              return wrap;
            }
            if (beat.templateId === "cta_plate") {
              wrap.innerHTML = '<div class="cta-card"><p class="eyebrow">' + esc(String(beat.payload.label || "следующий шаг")) + '</p><div class="cta-text">' + esc(String(beat.payload.text || "")) + '</div></div>';
              return wrap;
            }

            const bulletItems = list(beat.payload.items).slice(0, 3);
            const cards = bulletItems.map((item, index) => '<article class="bullet-card"><span class="bullet-index">' + String(index + 1).padStart(2, "0") + '</span><div><h2 class="bullet-title">' + esc(shortTitle(item)) + '</h2><p class="bullet-text">' + esc(item) + '</p></div></article>').join("");
            wrap.innerHTML = '<div class="bullet-grid">' + cards + '</div>';
            return wrap;
          }

          function animateChildren(timeline, node, beat, start) {
            const children = node.querySelectorAll(".bullet-card, .check-item, .bar");
            if (!children.length) return;
            if (beat.templateId === "metric_chart") {
              timeline.fromTo(children, { scaleY: 0.16 }, { scaleY: 1, duration: 0.48, stagger: 0.08, ease: "power3.out" }, start + 0.16);
              return;
            }
            timeline.fromTo(children, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.32, stagger: 0.09, ease: "power2.out" }, start + 0.16);
          }

          function enterVars(motionId) {
            if (motionId === "word_slam") return { from: { opacity: 0, scale: 1.35, filter: "blur(8px)" }, to: { opacity: 1, scale: 1, filter: "blur(0px)" }, duration: 0.2, ease: "back.out(1.7)" };
            if (motionId === "depth_zoom") return { from: { opacity: 0, scale: 2.2, y: 30, filter: "blur(10px)" }, to: { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }, duration: 0.42, ease: "expo.out" };
            if (motionId === "calm_fade") return { from: { opacity: 0, y: 18 }, to: { opacity: 1, y: 0 }, duration: 0.5, ease: "power2.out" };
            return { from: { opacity: 0, y: 34, scale: 0.98 }, to: { opacity: 1, y: 0, scale: 1 }, duration: 0.38, ease: "power3.out" };
          }

          function list(value) {
            return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
          }

          function shortTitle(value) {
            const parts = String(value || "").split(/\\s+/).filter(Boolean);
            return parts.slice(0, 2).join(" ").toUpperCase();
          }

          function esc(value) {
            return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
          }
        })();
      </script>
    </div>
  </body>
</html>`;
}
