import type { VisualOverlayPlan, VisualStyleProfile } from "@/lib/types";
import { hyperframesLocalFontsCss, hyperframesLocalGsapScript } from "@/server/hyperframes/assets";
import type { VideoProfile } from "@/server/video/profile";
import { spacingScale, radiusScale, strokePolicies, shadows, safeAreaInsets, motionCurves, motionDurations, linePolicies, typographyScale } from "@/server/hyperframes/designTokens";

export function semanticOverlayTemplate(
  plan: VisualOverlayPlan,
  style: VisualStyleProfile,
  profile: VideoProfile,
  duration: number,
  renderMode: "alpha" | "chroma" = "chroma"
) {
  const payload = JSON.stringify(plan.beats);
  const safeDuration = Math.max(1, duration);
  const orientationClass = profile.orientation === "portrait" ? "orientation-portrait" : "orientation-landscape";
  const background = renderMode === "alpha" ? "transparent" : "#00ff00";

  return `<!doctype html>
<html>
  <head>
    <style>${hyperframesLocalFontsCss()}</style>
  </head>
  <body>
    <div
      id="semantic-overlay"
      class="${orientationClass}"
      data-composition-id="semantic-overlay"
      data-start="0"
      data-duration="${safeDuration.toFixed(3)}"
      data-width="${profile.width}"
      data-height="${profile.height}"
    >
      <div class="stage-scrim"></div>
      <main id="visual-stage"></main>
      <style>
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          width: ${profile.width}px;
          height: ${profile.height}px;
          overflow: hidden;
          background: ${background};
        }
        #semantic-overlay {
          position: relative;
          width: ${profile.width}px;
          height: ${profile.height}px;
          overflow: hidden;
          background: ${background};
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
          z-index: 2;
          padding: ${safeAreaInsets.portrait.top}px ${safeAreaInsets.portrait.left}px ${safeAreaInsets.portrait.bottom}px;
        }
        .stage-scrim {
          display: none;
          position: absolute;
          pointer-events: none;
          opacity: 0.95;
          z-index: 1;
        }
        .orientation-landscape .stage-scrim {
          inset: 0 auto 0 0;
          width: 48%;
          background:
            radial-gradient(circle at 30% 30%, rgba(115, 200, 255, 0.16), transparent 44%),
            linear-gradient(90deg, rgba(2, 8, 22, 0.92), rgba(2, 8, 22, 0.58) 62%, transparent 100%);
        }
        .orientation-portrait .stage-scrim {
          inset: auto 0 0 0;
          height: 42%;
          background:
            radial-gradient(circle at 50% 0%, rgba(115, 200, 255, 0.18), transparent 40%),
            linear-gradient(180deg, transparent 0%, rgba(2, 8, 22, 0.72) 24%, rgba(2, 8, 22, 0.94) 100%);
        }
        .beat {
          position: absolute;
          opacity: 0;
          transform-origin: 50% 50%;
          color: var(--text);
          font-family: ${style.typography.body};
          max-height: 74%;
          overflow: hidden;
          overflow-wrap: anywhere;
          text-wrap: balance;
          contain: layout paint;
        }
        .orientation-landscape .layout-left,
        .orientation-landscape .layout-full_frame {
          left: 4.2%;
          top: 8.4%;
          width: 42%;
        }
        .orientation-landscape .layout-right {
          right: 4.2%;
          top: 8.4%;
          width: 42%;
        }
        .orientation-landscape .layout-center {
          left: 27%;
          top: 50%;
          width: 46%;
          transform: translate(-50%, -50%);
          text-align: left;
        }
        .orientation-landscape .layout-lower_third {
          left: 4.2%;
          bottom: 8%;
          width: 42%;
        }
        .orientation-portrait .layout-left,
        .orientation-portrait .layout-right,
        .orientation-portrait .layout-center,
        .orientation-portrait .layout-lower_third,
        .orientation-portrait .layout-full_frame {
          left: 5.5%;
          right: 5.5%;
          width: auto;
        }
        .orientation-portrait .layout-left,
        .orientation-portrait .layout-right,
        .orientation-portrait .layout-full_frame {
          bottom: 10%;
        }
        .orientation-portrait .layout-center {
          bottom: 14%;
          text-align: left;
        }
        .orientation-portrait .layout-lower_third {
          bottom: 7.5%;
        }
        .glass-card,
        .bullet-shell,
        .checklist-card,
        .chart-card,
        .cta-card {
          border: 1px solid var(--border);
          border-radius: ${radiusScale.lg}px;
          background: #0d1f36;
          box-shadow:
            0 24px 70px rgba(0, 0, 0, 0.36),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
          overflow: hidden;
        }
        .phrase-card {
          display: inline-flex;
          flex-wrap: wrap;
          align-items: center;
          gap: ${spacingScale.sm}px ${spacingScale.md}px;
          max-width: 100%;
          padding: 22px 26px 24px;
          border-radius: ${radiusScale.lg}px;
          background: #0d1f36;
          border: 1px solid var(--border);
          box-shadow:
            0 20px 64px rgba(0, 0, 0, 0.38),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }
        .phrase-word {
          display: inline-block;
          font-family: ${style.typography.heading};
          font-size: ${typographyScale.xl}px;
          font-weight: 900;
          line-height: 0.98;
          letter-spacing: 0;
          color: var(--text);
          -webkit-text-stroke: ${strokePolicies.standard} #03101d;
          paint-order: stroke fill;
        }
        .phrase-word.is-emphasis {
          color: var(--accent);
        }
        .phrase-word.is-muted {
          color: #dbe7f6;
        }
        .big-number {
          padding: 32px 34px;
        }
        .number-value {
          display: block;
          font-family: ${style.typography.number};
          font-size: ${typographyScale.mega}px;
          font-weight: 950;
          line-height: 0.88;
          color: var(--accent);
          letter-spacing: 0;
          overflow-wrap: anywhere;
          -webkit-text-stroke: ${strokePolicies.heavy} #03101d;
          paint-order: stroke fill;
        }
        .number-label,
        .subtext,
        .eyebrow {
          color: var(--muted);
          font-size: 22px;
          line-height: 1.2;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .keyword-stack {
          display: grid;
          gap: 14px;
        }
        .keyword {
          font-family: ${style.typography.heading};
          font-size: ${typographyScale.hero}px;
          font-weight: 950;
          line-height: 0.92;
          color: var(--text);
          text-transform: uppercase;
          letter-spacing: 0;
          -webkit-text-stroke: ${strokePolicies.heavy} #03101d;
          paint-order: stroke fill;
          overflow-wrap: anywhere;
        }
        .keyword-line {
          display: inline-block;
          position: relative;
          padding-right: 12px;
        }
        .keyword-line::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0.08em;
          height: 0.12em;
          background: var(--warning);
        }
        .keyword-muted {
          color: #6f7f95;
        }
        .bullet-shell {
          padding: 26px;
        }
        .bullet-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }
        .orientation-portrait .bullet-grid {
          grid-template-columns: 1fr;
        }
        .bullet-card {
          min-height: 230px;
          padding: ${spacingScale.lg}px ${spacingScale.lg}px 22px;
          display: grid;
          gap: ${spacingScale.md}px;
          border-radius: ${radiusScale.lg}px;
          background: linear-gradient(180deg, #0f2139, #0b1a2d);
          border: 1px solid #244761;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }
        .orientation-portrait .bullet-card {
          min-height: 170px;
        }
        .bullet-index {
          color: var(--accent);
          font-family: ${style.typography.number};
          font-size: 24px;
          font-weight: 900;
          letter-spacing: 0.14em;
        }
        .bullet-title,
        .checklist-title,
        .chart-title,
        .cta-text {
          font-family: ${style.typography.heading};
          font-size: ${typographyScale.xl + 8}px;
          font-weight: 950;
          line-height: 0.98;
          letter-spacing: 0;
          text-transform: uppercase;
          overflow-wrap: anywhere;
        }
        .bullet-text,
        .check-item,
        .chart-label,
        .cta-copy {
          color: var(--muted);
          font-size: 24px;
          line-height: 1.18;
          overflow-wrap: anywhere;
        }
        .checklist-card,
        .chart-card,
        .cta-card {
          padding: 34px 36px;
        }
        .check-list {
          display: grid;
          gap: 14px;
          margin: 22px 0 0;
          padding: 0;
          list-style: none;
        }
        .check-item {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .check-dot {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--accent);
          flex: 0 0 auto;
        }
        .chart-head {
          display: grid;
          gap: 8px;
          margin-bottom: 18px;
        }
        .chart-bars {
          display: flex;
          align-items: end;
          gap: 16px;
          height: 190px;
        }
        .bar-wrap {
          flex: 1;
          min-width: 44px;
          display: grid;
          gap: 10px;
          align-items: end;
        }
        .bar-value {
          font-family: ${style.typography.number};
          font-size: 22px;
          color: var(--accent);
        }
        .bar {
          height: 40%;
          border-radius: 16px 16px 8px 8px;
          background: linear-gradient(180deg, var(--accent), var(--accent-2));
          transform-origin: 50% 100%;
        }
        .cta-card {
          background: #122e4e;
        }
        .cta-copy {
          margin-top: 14px;
        }
        .variant-compact .phrase-word { font-size: 38px; }
        .variant-compact .bullet-title,
        .variant-compact .checklist-title,
        .variant-compact .chart-title,
        .variant-compact .cta-text { font-size: 42px; }
        .variant-compact .bullet-text,
        .variant-compact .check-item,
        .variant-compact .chart-label,
        .variant-compact .cta-copy { font-size: 21px; }
        .variant-safe {
          left: 6% !important;
          right: 6% !important;
          bottom: 7% !important;
          top: auto !important;
          width: auto !important;
        }
        .variant-safe .phrase-card { width: 100%; }
        .preset-kinetic_phrase_slam .phrase-card,
        .preset-keyword_viral_slam .keyword-stack,
        .preset-big_number_viral .glass-card {
          border-color: rgba(255, 229, 77, 0.64);
          background: #101010;
        }
        .preset-kinetic_phrase_slam .phrase-word,
        .preset-keyword_viral_slam .keyword,
        .preset-big_number_viral .number-value {
          color: var(--accent-2);
        }
        .preset-kinetic_phrase_glass .phrase-card,
        .preset-bullet_cards_premium .bullet-shell,
        .preset-metric_chart_premium .chart-card,
        .preset-cta_finish_premium .cta-card {
          background: #241f18;
          border-color: rgba(216, 197, 161, 0.42);
        }
        .preset-checklist_steps .check-dot,
        .preset-checklist_compact .check-dot {
          border-radius: 6px;
        }
        .preset-keyword_warning_strip .keyword-line::after,
        .preset-myth_vs_truth .keyword-line::after {
          height: 0.18em;
          background: var(--warning);
        }
      </style>
      ${hyperframesLocalGsapScript()}
      <script>
        (() => {
          window.__timelines = window.__timelines || {};
          const BEATS = ${payload};
          const stage = document.getElementById("visual-stage");
          const tl = gsap.timeline({ paused: true });

          BEATS.forEach((beat) => {
            const node = renderBeat(beat);
            stage.appendChild(node);
            fitBeat(node);
            const enter = enterVars(beat.motionId);
            const start = Math.max(0, beat.start);
            const end = start + beat.duration;

            tl.fromTo(node, enter.from, { ...enter.to, duration: enter.duration, ease: enter.ease }, start);
            animateChildren(tl, node, beat, start);
            tl.to(node, { opacity: 0, y: "-=18", duration: ${motionDurations.exit.medium}, ease: "${motionCurves.exit}" }, Math.max(start + 0.9, end - 0.24));
          });

          tl.seek(0);
          window.__timelines["semantic-overlay"] = tl;

          function renderBeat(beat) {
            const wrap = document.createElement("section");
            wrap.className = "beat layout-" + beat.layout + " template-" + beat.templateId + " preset-" + safeClass(beat.presetId || beat.templateId) + " variant-" + (beat.variant || "standard");
            wrap.id = beat.id;

            if (beat.templateId === "kinetic_text") {
              const words = splitWords(String(beat.payload.text || ""));
              const emphasis = normalizeWord(String(beat.payload.emphasis || ""));
              const html = words.map((word, index) => {
                const normalized = normalizeWord(word);
                const cls = normalized && normalized === emphasis ? "phrase-word is-emphasis" : index > 8 ? "phrase-word is-muted" : "phrase-word";
                return '<span class="' + cls + '">' + esc(word) + '</span>';
              }).join("");
              wrap.innerHTML = '<div class="phrase-card">' + html + '</div>';
              return wrap;
            }

            if (beat.templateId === "big_number") {
              wrap.innerHTML = '<div class="glass-card big-number"><span class="number-value">' + esc(String(beat.payload.value || "1")) + '</span><p class="number-label">' + esc(String(beat.payload.label || "")) + '</p></div>';
              return wrap;
            }

            if (beat.templateId === "keyword_slam") {
              const lines = splitKeyword(String(beat.payload.text || ""));
              wrap.innerHTML =
                '<div class="keyword-stack">'
                + '<div class="eyebrow">' + esc(String(beat.payload.eyebrow || "myth")) + '</div>'
                + '<div class="keyword-line keyword">' + esc(lines[0] || "") + '</div>'
                + (lines[1] ? '<div class="keyword keyword-muted">' + esc(lines[1]) + '</div>' : '')
                + '<p class="subtext">' + esc(String(beat.payload.subtext || "")) + '</p>'
                + '</div>';
              return wrap;
            }

            if (beat.templateId === "checklist") {
              const items = list(beat.payload.items).map((item) => '<li class="check-item"><span class="check-dot"></span><span>' + esc(item) + '</span></li>').join("");
              wrap.innerHTML = '<div class="checklist-card"><div class="eyebrow">what to show</div><div class="checklist-title">' + esc(String(beat.payload.title || "Key points")) + '</div><ul class="check-list">' + items + '</ul></div>';
              return wrap;
            }

            if (beat.templateId === "metric_chart") {
              const values = list(beat.payload.values).slice(0, 3);
              const heights = ["40%", "68%", "88%"];
              const bars = [0, 1, 2].map((index) => {
                const label = esc(values[index] || "");
                return '<div class="bar-wrap"><span class="bar-value">' + label + '</span><span class="bar" style="height:' + heights[index] + '"></span></div>';
              }).join("");
              wrap.innerHTML = '<div class="chart-card"><div class="chart-head"><div class="eyebrow">deterministic split</div><div class="chart-title">' + esc(String(beat.payload.title || "60%")) + '</div><p class="chart-label">' + esc(String(beat.payload.label || "")) + '</p></div><div class="chart-bars">' + bars + '</div></div>';
              return wrap;
            }

            if (beat.templateId === "cta_plate") {
              wrap.innerHTML = '<div class="cta-card"><p class="eyebrow">' + esc(String(beat.payload.label || "next step")) + '</p><div class="cta-text">' + esc(String(beat.payload.text || "")) + '</div><p class="cta-copy">' + esc(String(beat.payload.copy || "Смысл зафиксирован, можно идти дальше.")) + '</p></div>';
              return wrap;
            }

            const bulletItems = list(beat.payload.items).slice(0, 3);
            const cards = bulletItems.map((item, index) =>
              '<article class="bullet-card">'
              + '<span class="bullet-index">' + String(index + 1).padStart(2, "0") + '</span>'
              + '<div><h2 class="bullet-title">' + esc(shortTitle(item)) + '</h2><p class="bullet-text">' + esc(item) + '</p></div>'
              + '</article>'
            ).join("");
            wrap.innerHTML = '<div class="bullet-shell"><div class="eyebrow">' + esc(String(beat.payload.eyebrow || "lesson")) + '</div><div class="bullet-grid">' + cards + '</div></div>';
            return wrap;
          }

          function fitBeat(node) {
            const targets = node.querySelectorAll(".phrase-word, .keyword, .number-value, .bullet-title, .checklist-title, .chart-title, .cta-text, .bullet-text, .check-item, .chart-label, .cta-copy");
            if (!targets.length) return;
            const minSize = node.classList.contains("template-kinetic_text") ? ${linePolicies.kinetic_text.minFontSize} : ${linePolicies.checklist.minFontSize};
            for (let step = 0; step < 14 && isOverflowing(node); step++) {
              targets.forEach((target) => {
                const current = Number.parseFloat(window.getComputedStyle(target).fontSize);
                if (current > minSize) target.style.fontSize = Math.max(minSize, current - 3) + "px";
              });
            }
            if (isOverflowing(node)) {
              node.classList.add("variant-safe");
              targets.forEach((target) => {
                const current = Number.parseFloat(window.getComputedStyle(target).fontSize);
                target.style.fontSize = Math.max(minSize, Math.min(current, 34)) + "px";
              });
            }
          }

          function isOverflowing(node) {
            const box = node.getBoundingClientRect();
            const stageBox = stage.getBoundingClientRect();
            const horizontalOverflow = box.left < stageBox.left + 10 || box.right > stageBox.right - 10;
            const verticalOverflow = box.top < stageBox.top + 10 || box.bottom > stageBox.bottom - 10;
            return horizontalOverflow || verticalOverflow || node.scrollHeight > node.clientHeight + 2 || node.scrollWidth > node.clientWidth + 2;
          }

          function animateChildren(timeline, node, beat, start) {
            const children = node.querySelectorAll(".bullet-card, .check-item, .bar-wrap, .keyword-line, .keyword-muted");
            if (!children.length) return;
            if (beat.templateId === "metric_chart") {
              timeline.fromTo(
                node.querySelectorAll(".bar"),
                { scaleY: 0.12 },
                { scaleY: 1, duration: 0.48, stagger: 0.08, ease: "${motionCurves.active}" },
                start + 0.2
              );
            }
            timeline.fromTo(children, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.32, stagger: ${motionDurations.stagger.medium}, ease: "${motionCurves.calm}" }, start + 0.16);
          }

          function enterVars(motionId) {
            if (motionId === "word_slam") return { from: { opacity: 0, scale: 1.06 }, to: { opacity: 1, scale: 1 }, duration: ${motionDurations.enter.fast}, ease: "${motionCurves.slam}" };
            if (motionId === "depth_zoom") return { from: { opacity: 0, scale: 0.96, y: 24 }, to: { opacity: 1, scale: 1, y: 0 }, duration: ${motionDurations.enter.medium}, ease: "${motionCurves.zoom}" };
            if (motionId === "calm_fade") return { from: { opacity: 0, y: 18 }, to: { opacity: 1, y: 0 }, duration: ${motionDurations.enter.calm}, ease: "${motionCurves.calm}" };
            return { from: { opacity: 0, y: 28, scale: 0.98 }, to: { opacity: 1, y: 0, scale: 1 }, duration: ${motionDurations.enter.medium}, ease: "${motionCurves.active}" };
          }

          function list(value) {
            return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
          }

          function splitWords(value) {
            return String(value || "").split(/\\s+/).filter(Boolean).slice(0, 16);
          }

          function shortTitle(value) {
            return String(value || "").split(/\\s+/).filter(Boolean).slice(0, 2).join(" ").toUpperCase();
          }

          function splitKeyword(value) {
            const words = String(value || "").split(/\\s+/).filter(Boolean);
            if (words.length <= 2) return [words.join(" "), ""];
            return [words.slice(0, 2).join(" "), words.slice(2).join(" ")];
          }

          function normalizeWord(value) {
            return String(value || "").toLowerCase().replace(/[^\\p{L}\\p{N}%$₽-]+/gu, "");
          }

          function esc(value) {
            return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
          }

          function safeClass(value) {
            return String(value || "").replace(/[^a-zA-Z0-9_-]+/g, "-");
          }
        })();
      </script>
    </div>
  </body>
</html>`;
}
