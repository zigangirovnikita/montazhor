import { hyperframesLocalFontsCss } from "@/server/hyperframes/assets";

export function buildBrowserFrameRendererHtml(input: {
  width: number;
  height: number;
  captionSafeArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}) {
  return `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      ${hyperframesLocalFontsCss()}
      :root {
        color-scheme: only light;
      }
      * {
        box-sizing: border-box;
      }
      html, body {
        margin: 0;
        width: ${input.width}px;
        height: ${input.height}px;
        overflow: hidden;
        background: #000;
      }
      body {
        font-family: "HF Manrope", Arial, sans-serif;
      }
      #frame-root {
        position: relative;
        width: ${input.width}px;
        height: ${input.height}px;
        overflow: hidden;
        isolation: isolate;
        background:
          radial-gradient(circle at 20% 20%, rgba(255, 221, 87, 0.14), transparent 30%),
          radial-gradient(circle at 80% 0%, rgba(255, 255, 255, 0.14), transparent 35%),
          #000;
      }
      #background-track {
        position: absolute;
        inset: -6%;
        transform-origin: center center;
        will-change: transform;
      }
      #background-image {
        width: 112%;
        height: 112%;
        object-fit: cover;
        display: block;
        filter: saturate(1.06) contrast(1.04);
      }
      #vignette {
        position: absolute;
        inset: 0;
        background:
          linear-gradient(180deg, rgba(0, 0, 0, 0.08) 0%, rgba(0, 0, 0, 0.32) 100%),
          radial-gradient(circle at center, transparent 35%, rgba(0, 0, 0, 0.18) 100%);
        pointer-events: none;
      }
      #visual-layer {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 1;
      }
      .visual-card {
        position: absolute;
        display: grid;
        gap: 10px;
        padding: 18px 20px;
        border-radius: 22px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        background: rgba(9, 13, 20, 0.58);
        backdrop-filter: blur(16px);
        color: #fff8ef;
        box-shadow: 0 24px 48px rgba(0, 0, 0, 0.22);
        width: min(42%, 320px);
      }
      .visual-card.layout-left { left: 6%; top: 11%; }
      .visual-card.layout-right { right: 6%; top: 11%; }
      .visual-card.layout-top { left: 50%; top: 8%; width: min(58%, 420px); transform: translateX(-50%); }
      .visual-card.layout-center { left: 50%; top: 13%; width: min(56%, 380px); transform: translateX(-50%); }
      .visual-eyebrow {
        font-size: 14px;
        letter-spacing: 0.14em;
        opacity: 0.78;
      }
      .visual-number {
        font-size: clamp(44px, 6vw, 68px);
        line-height: 0.95;
        font-weight: 800;
      }
      .visual-subtle {
        font-size: 16px;
        opacity: 0.86;
        line-height: 1.2;
      }
      .visual-grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        font-size: 18px;
      }
      .visual-list {
        display: grid;
        gap: 8px;
      }
      .visual-list-item {
        display: grid;
        grid-template-columns: 18px 1fr;
        gap: 8px;
      }
      .visual-timeline-item {
        grid-template-columns: 52px 1fr;
        align-items: start;
      }
      .visual-chip {
        display: inline-flex;
        justify-content: center;
        padding: 4px 8px;
        border-radius: 999px;
        background: rgba(115, 200, 255, 0.18);
        color: #9fe5ff;
        font-size: 13px;
        font-weight: 700;
      }
      .visual-chart-list {
        display: grid;
        gap: 10px;
      }
      .visual-table {
        display: grid;
        gap: 2px;
      }
      .visual-table-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      .visual-branch-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .visual-branch-chip {
        display: inline-flex;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(115, 200, 255, 0.14);
        border: 1px solid rgba(115, 200, 255, 0.18);
        font-size: 14px;
      }
      .visual-chart-bar {
        height: 7px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.12);
        overflow: hidden;
      }
      .visual-chart-fill {
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, #73c8ff 0%, #ffe24f 100%);
      }
      #caption-shell {
        position: absolute;
        left: ${input.captionSafeArea.x}px;
        top: ${input.captionSafeArea.y}px;
        width: ${input.captionSafeArea.width}px;
        height: ${input.captionSafeArea.height}px;
        display: flex;
        justify-content: center;
        pointer-events: none;
      }
      #caption-box {
        max-width: 100%;
        text-align: center;
        color: #fff;
        opacity: 0;
        transform: translate3d(0, 24px, 0) scale(0.94);
        will-change: transform, opacity;
        padding: 0.16em 0.22em;
        border-radius: 0.34em;
      }
      .caption-line {
        display: block;
      }
      .caption-word {
        display: inline-block;
        margin: 0 0.12em 0.08em 0;
        padding: 0.02em 0.06em;
        border-radius: 0.12em;
      }
      .caption-word.is-emphasis {
        font-family: var(--caption-accent-font, inherit);
      }
      #caption-box[data-highlight-mode="fill"] .caption-word.is-emphasis,
      #caption-box[data-highlight-mode="fill"] .caption-word.is-active {
        color: #111;
        background: var(--caption-accent-color, #ffe44d);
        -webkit-text-stroke: 0 transparent;
        text-shadow: none;
        box-shadow:
          0 0 0 2px rgba(0, 0, 0, 0.18) inset,
          0 8px 24px rgba(255, 228, 77, 0.28);
      }
      #caption-box[data-highlight-mode="text"] .caption-word.is-emphasis,
      #caption-box[data-highlight-mode="text"] .caption-word.is-active {
        color: var(--caption-accent-color, #8fd4ff);
      }
      #caption-box[data-highlight-mode="marker"] .caption-word.is-emphasis,
      #caption-box[data-highlight-mode="marker"] .caption-word.is-active {
        color: #fff;
        background:
          linear-gradient(180deg, transparent 0 44%, color-mix(in srgb, var(--caption-accent-color, #ffe44d) 88%, white 12%) 44% 92%, transparent 92% 100%);
      }
      #caption-box[data-word-animation="pulse"] .caption-word.is-emphasis,
      #caption-box[data-word-animation="pulse"] .caption-word.is-active {
        color: var(--caption-accent-color, #ffe44d);
        transform: scale(1.06);
        text-shadow:
          0 0 22px color-mix(in srgb, var(--caption-accent-color, #ffe44d) 78%, white 22%);
      }
    </style>
  </head>
  <body>
    <div id="frame-root">
      <div id="background-track">
        <img id="background-image" alt="" />
      </div>
      <div id="vignette"></div>
      <div id="visual-layer"></div>
      <div id="caption-shell">
        <div id="caption-box"></div>
      </div>
    </div>
    <script>
      (() => {
        const image = document.getElementById("background-image");
        const backgroundTrack = document.getElementById("background-track");
        const visualLayer = document.getElementById("visual-layer");
        const captionShell = document.getElementById("caption-shell");
        const captionBox = document.getElementById("caption-box");
        let currentBackground = "";

        function clamp01(value) {
          return Math.max(0, Math.min(1, value));
        }

        function easeOutBack(value) {
          const c1 = 1.70158;
          const c3 = c1 + 1;
          return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
        }

        function easeInQuad(value) {
          return value * value;
        }

        function normalizeWord(value) {
          return String(value || "").toLowerCase().replace(/[^\\p{L}\\p{N}%$€₽-]+/gu, "");
        }

        function cssEscape(value) {
          return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        }

        function buildCaptionHtml(caption, time) {
          if (!caption) return "";
          const highlightSet = new Set(Array.isArray(caption.highlightedWords) ? caption.highlightedWords : []);
          const lines = Array.isArray(caption.lines) && caption.lines.length ? caption.lines : [caption.text];
          let sequentialIndex = 0;

          return lines.map((line, lineIndex) => {
            const tokens = String(line).split(/\\s+/).filter(Boolean);
            const lineHtml = tokens.map((token, tokenIndex) => {
              const wordIndex = sequentialIndex;
              sequentialIndex += 1;
              const word = (caption.words || [])[wordIndex];
              const active = Boolean(word && time >= word.start && time <= word.end);
              const emphasized = highlightSet.has(normalizeWord(token));
              const classes = [
                "caption-word",
                active ? "is-active" : "",
                (active || emphasized) ? "is-emphasis" : ""
              ].filter(Boolean).join(" ");
              return '<span class="' + classes + '">' + cssEscape(token) + (tokenIndex < tokens.length - 1 ? " " : "") + "</span>";
            }).join("");
            return '<span class="caption-line">' + lineHtml + "</span>";
          }).join("");
        }

        function applyCaptionDesign(design) {
          if (!design) return;

          captionShell.style.alignItems = design.position === "middle" ? "center" : "flex-end";
          captionBox.dataset.highlightMode = design.highlightMode || "text";
          captionBox.dataset.wordAnimation = design.wordAnimation || "text";
          captionBox.style.fontFamily = design.fontFamily;
          captionBox.style.color = design.textColor;
          captionBox.style.fontSize = design.fontSize;
          captionBox.style.fontWeight = String(design.fontWeight);
          captionBox.style.letterSpacing = design.letterSpacing;
          captionBox.style.textTransform = design.textTransform;
          captionBox.style.webkitTextStroke = (design.strokeWidth || 0) > 0
            ? design.strokeWidth + "px " + design.strokeColor
            : "0 transparent";
          captionBox.style.textShadow = design.textShadow;
          captionBox.style.setProperty("--caption-accent-font", design.accentFontFamily);
          captionBox.style.setProperty("--caption-accent-color", design.accentColor);

          if (design.backdrop === "solid") {
            captionBox.style.background = design.variant === "premium"
              ? "rgba(18, 18, 18, 0.7)"
              : "rgba(10, 10, 10, 0.76)";
            captionBox.style.border = "1px solid rgba(255, 255, 255, 0.08)";
            captionBox.style.boxShadow = "0 18px 36px rgba(0, 0, 0, 0.28)";
            captionBox.style.backdropFilter = "none";
          } else if (design.backdrop === "glass") {
            captionBox.style.background = design.variant === "premium"
              ? "rgba(255, 248, 234, 0.1)"
              : "rgba(12, 15, 20, 0.34)";
            captionBox.style.border = "1px solid rgba(255, 255, 255, 0.14)";
            captionBox.style.boxShadow = "0 16px 34px rgba(0, 0, 0, 0.16)";
            captionBox.style.backdropFilter = "blur(16px)";
          } else {
            captionBox.style.background = "transparent";
            captionBox.style.border = "1px solid transparent";
            captionBox.style.boxShadow = "none";
            captionBox.style.backdropFilter = "none";
          }
        }

        function renderVisualBeatHtml(beat) {
          if (!beat) return "";
          const payload = beat.payload || {};
          const layoutClass = "layout-" + (beat.layout || "right");

          if (beat.templateId === "big_number") {
            return '<div class="visual-card ' + layoutClass + '"><strong class="visual-number">' + cssEscape(payload.value || "") + '</strong><span class="visual-subtle">' + cssEscape(payload.label || "") + '</span></div>';
          }

          if (beat.templateId === "metric_chart") {
            if (payload.mode === "table" && Array.isArray(payload.rows)) {
              const rows = payload.rows.map((row, index) => {
                const label = row && typeof row.label === "string" ? row.label : "";
                const value = row && typeof row.value === "string" ? row.value : "";
                return '<div class="visual-table-row" style="' + (index === payload.rows.length - 1 ? "border-bottom:none" : "") + '"><span>' + cssEscape(label) + '</span><strong>' + cssEscape(value) + '</strong></div>';
              }).join("");
              return '<div class="visual-card ' + layoutClass + '"><span class="visual-eyebrow">' + cssEscape(payload.title || "") + '</span><div class="visual-table">' + rows + '</div></div>';
            }

            const values = Array.isArray(payload.values) ? payload.values : [];
            const list = values.map((value, index) => {
              const width = Math.max(20, 100 - index * 24);
              return '<div class="visual-chart-item"><strong>' + cssEscape(String(value)) + '</strong><div class="visual-chart-bar"><div class="visual-chart-fill" style="width:' + width + '%"></div></div></div>';
            }).join("");
            return '<div class="visual-card ' + layoutClass + '"><span class="visual-eyebrow">' + cssEscape(payload.title || "") + '</span><div class="visual-chart-list">' + list + '</div></div>';
          }

          if (beat.templateId === "checklist") {
            if (payload.mode === "timeline") {
              const items = Array.isArray(payload.items) ? payload.items : [];
              const list = items.map((item) => {
                const parts = String(item).split(/\\s+/);
                const lead = cssEscape(parts.shift() || "");
                const body = cssEscape(parts.join(" ") || String(item));
                return '<div class="visual-list-item visual-timeline-item"><span class="visual-chip">' + lead + '</span><span>' + body + '</span></div>';
              }).join("");
              return '<div class="visual-card ' + layoutClass + '"><span class="visual-eyebrow">' + cssEscape(payload.title || "") + '</span><div class="visual-list">' + list + '</div></div>';
            }

            const items = Array.isArray(payload.items) ? payload.items : [];
            const list = items.map((item) => '<div class="visual-list-item"><span style="color:#9df79d">✓</span><span>' + cssEscape(String(item)) + '</span></div>').join("");
            return '<div class="visual-card ' + layoutClass + '"><span class="visual-eyebrow">' + cssEscape(payload.title || "") + '</span><div class="visual-list">' + list + '</div></div>';
          }

          if (beat.templateId === "myth_strike") {
            return '<div class="visual-card ' + layoutClass + '"><span class="visual-eyebrow" style="color:#ffb284">' + cssEscape(payload.eyebrow || "") + '</span><span style="text-decoration:line-through;opacity:.72">' + cssEscape(payload.falseText || "") + '</span><strong style="color:#c4ff89">' + cssEscape(payload.trueText || "") + '</strong></div>';
          }

          if (beat.templateId === "cta_plate") {
            return '<div class="visual-card ' + layoutClass + '" style="background:rgba(28,18,10,.7)"><span class="visual-eyebrow" style="color:#ffe24f">' + cssEscape(payload.label || "") + '</span><strong style="font-size:30px;line-height:1.05">' + cssEscape(payload.text || "") + '</strong></div>';
          }

          if (payload.mode === "definition") {
            return '<div class="visual-card ' + layoutClass + '"><span class="visual-eyebrow">' + cssEscape(payload.eyebrow || "") + '</span><strong style="font-size:26px;line-height:1.05">' + cssEscape(payload.title || payload.center || "") + '</strong><div style="padding:12px 14px;border-radius:16px;background:rgba(255,255,255,.06);font-size:16px;line-height:1.3">' + cssEscape(payload.body || payload.caption || "") + '</div></div>';
          }

          if (payload.mode === "mindmap") {
            const branches = Array.isArray(payload.branches) ? payload.branches : [];
            const chips = branches.map((branch) => '<span class="visual-branch-chip">' + cssEscape(String(branch)) + '</span>').join("");
            return '<div class="visual-card ' + layoutClass + '"><span class="visual-eyebrow">' + cssEscape(payload.eyebrow || "") + '</span><strong style="font-size:26px;line-height:1.05">' + cssEscape(payload.center || payload.title || "") + '</strong><div class="visual-branch-list">' + chips + '</div><span class="visual-subtle">' + cssEscape(payload.caption || "") + '</span></div>';
          }

          return '<div class="visual-card ' + layoutClass + '"><span class="visual-eyebrow">' + cssEscape(payload.eyebrow || "") + '</span><strong style="font-size:26px;line-height:1.05">' + cssEscape(payload.center || payload.title || "") + '</strong><div class="visual-grid-2"><span>' + cssEscape(payload.left || "") + '</span><span>' + cssEscape(payload.right || "") + '</span></div><span class="visual-subtle">' + cssEscape(payload.caption || "") + '</span></div>';
        }

        async function ensureImage(url) {
          if (!url || currentBackground === url) return;
          currentBackground = url;
          image.src = url;
          if (typeof image.decode === "function") {
            await image.decode().catch(() => undefined);
          } else {
            await new Promise((resolve) => {
              image.onload = () => resolve();
              image.onerror = () => resolve();
            });
          }
        }

        window.renderFrame = async (time, frameData) => {
          await ensureImage(frameData.backgroundUrl);

          const caption = frameData.caption;
          const camera = frameData.camera;
          const captionDuration = caption ? Math.max(0.001, caption.end - caption.start) : 1;
          const rel = caption ? clamp01((time - caption.start) / captionDuration) : 0;
          const enter = clamp01(rel / 0.18);
          const exit = clamp01((1 - rel) / 0.14);
          const activeDesign = frameData.captionDesign || {};
          const opacity = activeDesign.enterAnimation === "fade"
            ? Math.min(1, enter, exit + 0.02)
            : Math.min(1, easeOutBack(enter), 1 - easeInQuad(1 - exit));
          const scale = activeDesign.enterAnimation === "pop"
            ? 0.9 + 0.12 * easeOutBack(enter)
            : activeDesign.enterAnimation === "fade"
              ? 1
              : 0.92 + 0.08 * easeOutBack(enter);
          const translateY = activeDesign.enterAnimation === "slide_up"
            ? (1 - enter) * 30 - (1 - exit) * 10
            : 0;

          backgroundTrack.style.transform = camera
            ? "translate3d(" + Math.round(camera.x * ${input.width}) + "px," + Math.round(camera.y * ${input.height}) + "px,0) scale(" + camera.scale.toFixed(4) + ")"
            : "translate3d(0,0,0) scale(1)";

          applyCaptionDesign(frameData.captionDesign);
          visualLayer.innerHTML = renderVisualBeatHtml(frameData.visualBeat);
          captionBox.innerHTML = buildCaptionHtml(caption, time);
          captionBox.style.opacity = caption ? String(Math.max(0, opacity)) : "0";
          captionBox.style.transform = caption
            ? "translate3d(0," + translateY.toFixed(2) + "px,0) scale(" + scale.toFixed(4) + ")"
            : "translate3d(0,24px,0) scale(0.94)";
        };

        document.fonts.ready
          .catch(() => undefined)
          .finally(() => {
            window.browserFrameRendererReady = true;
          });
      })();
    </script>
  </body>
</html>`;
}
