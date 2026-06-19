import { pathToFileURL } from "node:url";

export function buildBrowserFrameRendererHtml(input: {
  width: number;
  height: number;
  fontPath?: string;
}) {
  const fontUrl = input.fontPath ? pathToFileURL(input.fontPath).toString() : "";

  return `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      ${fontUrl ? `
      @font-face {
        font-family: "POCOnest";
        src: url("${fontUrl}") format("truetype");
        font-style: normal;
        font-weight: 700;
        font-display: block;
      }` : ""}
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
        font-family: ${fontUrl ? '"POCOnest",' : ""} "Arial Black", Arial, sans-serif;
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
      #caption-shell {
        position: absolute;
        left: 72px;
        right: 72px;
        bottom: 120px;
        display: flex;
        justify-content: center;
        pointer-events: none;
      }
      #caption-box {
        max-width: 100%;
        text-align: center;
        color: #fff;
        font-size: 74px;
        font-weight: 700;
        line-height: 1.04;
        letter-spacing: -0.04em;
        text-transform: uppercase;
        -webkit-text-stroke: 2px rgba(0, 0, 0, 0.9);
        text-shadow:
          0 4px 0 rgba(0, 0, 0, 0.42),
          0 14px 28px rgba(0, 0, 0, 0.38),
          0 0 24px rgba(0, 0, 0, 0.18);
        opacity: 0;
        transform: translate3d(0, 24px, 0) scale(0.94);
        will-change: transform, opacity;
      }
      #caption-box[data-style="bold-yellow"] {
        font-size: 74px;
        font-weight: 700;
        letter-spacing: -0.04em;
        text-transform: uppercase;
        -webkit-text-stroke: 2px rgba(0, 0, 0, 0.9);
        text-shadow:
          0 4px 0 rgba(0, 0, 0, 0.42),
          0 14px 28px rgba(0, 0, 0, 0.38),
          0 0 24px rgba(0, 0, 0, 0.18);
      }
      #caption-box[data-style="clean-white"] {
        font-size: 68px;
        font-weight: 700;
        letter-spacing: -0.03em;
        text-transform: none;
        -webkit-text-stroke: 0 transparent;
        text-shadow:
          0 6px 18px rgba(0, 0, 0, 0.42),
          0 0 18px rgba(0, 0, 0, 0.16);
      }
      #caption-box[data-style="premium-minimal"] {
        font-size: 60px;
        font-weight: 700;
        letter-spacing: -0.035em;
        text-transform: none;
        -webkit-text-stroke: 0 transparent;
        text-shadow:
          0 8px 24px rgba(0, 0, 0, 0.28);
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
      #caption-box[data-style="bold-yellow"] .caption-word.is-highlight {
        color: #111;
        background: #ffe44d;
        -webkit-text-stroke: 0 transparent;
        box-shadow:
          0 0 0 2px rgba(0, 0, 0, 0.18) inset,
          0 8px 24px rgba(255, 228, 77, 0.28);
        text-shadow: none;
      }
      #caption-box[data-style="clean-white"] .caption-word.is-highlight {
        color: #ffe44d;
      }
      #caption-box[data-style="premium-minimal"] .caption-word.is-highlight {
        color: #fff6d6;
        background: rgba(255, 255, 255, 0.12);
        box-shadow: 0 1px 0 rgba(255, 255, 255, 0.18) inset;
      }
    </style>
  </head>
  <body>
    <div id="frame-root">
      <div id="background-track">
        <img id="background-image" alt="" />
      </div>
      <div id="vignette"></div>
      <div id="caption-shell">
        <div id="caption-box"></div>
      </div>
    </div>
    <script>
      (() => {
        const image = document.getElementById("background-image");
        const backgroundTrack = document.getElementById("background-track");
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

        function buildCaptionHtml(caption, time) {
          if (!caption) return "";
          const highlightSet = new Set(Array.isArray(caption.highlightedWords) ? caption.highlightedWords : []);
          const lines = Array.isArray(caption.lines) && caption.lines.length ? caption.lines : [caption.text];

          return lines.map((line) => {
            const tokens = String(line).split(/\\s+/).filter(Boolean);
            const lineHtml = tokens.map((token) => {
              const safeText = String(token)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
              const word = (caption.words || []).find((entry) => entry.text === token && time >= entry.start && time <= entry.end)
                || (caption.words || []).find((entry) => entry.text === token);
              const active = Boolean(word && time >= word.start && time <= word.end);
              const emphasized = highlightSet.has(normalizeWord(token));
              return '<span class="caption-word' + ((active || emphasized) ? ' is-highlight' : '') + '">' + safeText + '</span>';
            }).join(" ");
            return '<span class="caption-line">' + lineHtml + '</span>';
          }).join("");
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
          const opacity = Math.min(1, easeOutBack(enter), 1 - easeInQuad(1 - exit));
          const scale = 0.92 + 0.08 * easeOutBack(enter);
          const translateY = (1 - enter) * 30 - (1 - exit) * 10;

          backgroundTrack.style.transform = camera
            ? 'translate3d(' + Math.round(camera.x * ${input.width}) + 'px,' + Math.round(camera.y * ${input.height}) + 'px,0) scale(' + camera.scale.toFixed(4) + ')'
            : 'translate3d(0,0,0) scale(1)';

          captionBox.innerHTML = buildCaptionHtml(caption, time);
          captionBox.dataset.style = frameData.captionStyle || "bold-yellow";
          captionBox.style.opacity = caption ? String(Math.max(0, opacity)) : "0";
          captionBox.style.transform = caption
            ? 'translate3d(0,' + translateY.toFixed(2) + 'px,0) scale(' + scale.toFixed(4) + ')'
            : 'translate3d(0,24px,0) scale(0.94)';
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
