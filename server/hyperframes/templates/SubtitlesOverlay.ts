import type { SubtitleDraft } from "@/lib/types";
import { hyperframesLocalFontsCss, hyperframesLocalGsapScript } from "@/server/hyperframes/assets";
import type { VideoProfile, VideoRegion } from "@/server/video/profile";

export function subtitlesOverlayTemplate(
  subtitles: SubtitleDraft[],
  preset: string,
  profile: VideoProfile,
  mode: "alpha" | "chroma" = "chroma",
  captionRegion?: VideoRegion
) {
  const config = styleConfigForPreset(preset, profile, captionRegion);
  const captionWidth = captionRegion?.width ?? profile.width;
  const captionCenterX = captionRegion ? captionRegion.x + captionRegion.width / 2 : profile.width / 2;
  const maxPillWidth = Math.min(Math.round(captionWidth * 0.85), 920);
  const payload = JSON.stringify(
    subtitles.map((subtitle) => ({
      id: subtitle.id,
      start: subtitle.start,
      end: subtitle.end,
      text: subtitle.text,
      highlightedWords: subtitle.highlightedWords,
      words: subtitle.words.map((word) => ({
        text: word.word,
        start: word.start,
        end: word.end
      }))
    }))
  );

  const backgroundCss = mode === "alpha" ? "transparent" : "#00ff00";

  return `<!doctype html>
<html>
  <head>
    <style>${hyperframesLocalFontsCss()}</style>
  </head>
  <body>
    <div
      id="subtitles-overlay"
      data-composition-id="subtitles-overlay"
      data-start="0"
      data-width="${profile.width}"
      data-height="${profile.height}"
      data-preset="${config.variant}"
    >
      <main id="caption-stage" class="scene"></main>
      <style>
        :root {
          --caption-size: ${config.fontSize};
          --caption-bottom: ${config.bottomOffset};
          --caption-side-padding: ${config.sidePadding};
          --caption-gap: ${config.wordGap};
          --caption-text: ${config.textColor};
          --caption-inactive: ${config.inactiveColor};
          --caption-active: ${config.activeColor};
          --caption-accent: ${config.accentColor};
          --caption-shadow: ${config.shadow};
          --caption-pill-bg: ${config.pillBackground};
          --caption-pill-radius: ${config.pillRadius};
          --caption-center-x: ${captionCenterX}px;
          --caption-region-width: ${captionWidth}px;
          --caption-outline: ${config.outlineColor};
        }
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          width: ${profile.width}px;
          height: ${profile.height}px;
          overflow: hidden;
          background: ${backgroundCss};
        }
        #subtitles-overlay {
          position: relative;
          width: ${profile.width}px;
          height: ${profile.height}px;
          overflow: hidden;
          background: ${backgroundCss};
        }
        .scene {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }
        .caption-group {
          position: absolute;
          left: var(--caption-center-x);
          bottom: var(--caption-bottom);
          width: calc(var(--caption-region-width) - (var(--caption-side-padding) * 2));
          transform: translateX(-50%);
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          justify-content: center;
          gap: var(--caption-gap);
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }
        .caption-group.pill {
          width: min(${maxPillWidth}px, calc(var(--caption-region-width) - (var(--caption-side-padding) * 2)));
          padding: 18px 28px 22px;
          border-radius: var(--caption-pill-radius);
          background: var(--caption-pill-bg);
          border: 1px solid color-mix(in srgb, var(--caption-accent) 22%, white 8%);
          box-shadow: 0 18px 54px rgba(0, 0, 0, 0.22);
          backdrop-filter: blur(18px);
        }
        .caption-word {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: ${config.fontFamily};
          font-size: var(--caption-size);
          font-weight: 800;
          line-height: 1.08;
          letter-spacing: -0.02em;
          color: var(--caption-inactive);
          text-shadow: var(--caption-shadow);
          -webkit-text-stroke: 1px transparent;
          transform-origin: 50% 50%;
          will-change: transform, color, filter;
        }
        .caption-group.highlight .caption-word {
          color: var(--caption-text);
          padding: 6px 12px 8px;
          text-transform: uppercase;
          -webkit-text-stroke: 1px var(--caption-outline);
        }
        .caption-group.pill .caption-word {
          color: var(--caption-inactive);
        }
        .caption-word-bg {
          position: absolute;
          inset: 0;
          opacity: 0;
          transform: scaleX(0);
          transform-origin: 0% 50%;
          z-index: -1;
        }
        .caption-group.highlight .caption-word-bg {
          background: linear-gradient(135deg, var(--caption-accent) 0%, color-mix(in srgb, var(--caption-accent) 78%, black) 100%);
          border-radius: 12px;
          box-shadow: 0 12px 28px color-mix(in srgb, var(--caption-accent) 35%, transparent);
        }
        .caption-group.pill .caption-word-bg {
          background: color-mix(in srgb, var(--caption-accent) 18%, transparent);
          border-radius: 10px;
        }
        .caption-group.pill::after {
          content: "";
          position: absolute;
          left: 22px;
          right: 22px;
          bottom: 12px;
          height: 4px;
          border-radius: 999px;
          background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--caption-accent) 72%, white 10%), transparent);
          opacity: 0.85;
        }
      </style>
      ${hyperframesLocalGsapScript()}
      <script>
        (() => {
          window.__timelines = window.__timelines || {};
          const SUBTITLES = ${payload};
          const stage = document.getElementById("caption-stage");
          const variant = ${JSON.stringify(config.variant)};
          const tl = gsap.timeline({ paused: true });

          for (const subtitle of SUBTITLES) {
            const group = renderSubtitleGroup(subtitle, variant);
            stage.appendChild(group);

            tl.set(group, { visibility: "visible" }, subtitle.start);
            tl.to(group, { opacity: 1, duration: 0.12, ease: "power2.out" }, subtitle.start);

            const words = subtitle.words?.length ? subtitle.words : fallbackWords(subtitle);
            const elements = Array.from(group.querySelectorAll(".caption-word"));
            elements.forEach((element, index) => {
              const timing = words[index] || subtitle;
              const bg = element.querySelector(".caption-word-bg");
              const important = element.dataset.important === "true";

              if (variant === "highlight") {
                tl.to(bg, { opacity: important ? 1 : 0.92, scaleX: 1, duration: 0.12, ease: "power2.out" }, timing.start);
                tl.to(element, { scale: important ? 1.06 : 1.03, duration: 0.09, ease: "power2.out" }, timing.start);
                tl.to(element, { scale: 1, duration: 0.16, ease: "power2.out" }, timing.start + 0.09);
                tl.to(bg, { opacity: 0, duration: 0.1, ease: "power2.in" }, timing.end);
                tl.set(bg, { scaleX: 0 }, timing.end + 0.04);
              } else {
                tl.to(bg, { opacity: important ? 0.92 : 0.62, scaleX: 1, duration: 0.1, ease: "power2.out" }, timing.start);
                tl.to(element, { color: "var(--caption-active)", duration: 0.08, ease: "none" }, timing.start);
                tl.to(element, { color: "var(--caption-inactive)", duration: 0.1, ease: "none" }, timing.end + 0.02);
                tl.to(bg, { opacity: 0, duration: 0.1, ease: "power2.in" }, timing.end + 0.02);
                tl.set(bg, { scaleX: 0 }, timing.end + 0.08);
              }
            });

            tl.to(group, { opacity: 0, duration: 0.1, ease: "power2.in" }, Math.max(subtitle.start, subtitle.end - 0.1));
            tl.set(group, { opacity: 0, visibility: "hidden" }, subtitle.end + 0.02);
          }

          tl.seek(0);
          window.__timelines["subtitles-overlay"] = tl;

          function renderSubtitleGroup(subtitle, currentVariant) {
            const group = document.createElement("div");
            group.className = "caption-group " + currentVariant;
            group.id = subtitle.id;

            const words = subtitle.words?.length ? subtitle.words : fallbackWords(subtitle);
            for (const word of words) {
              const normalized = normalizeWord(word.text);
              const span = document.createElement("span");
              span.className = "caption-word";
              span.dataset.important = subtitle.highlightedWords.includes(normalized) ? "true" : "false";

              const bg = document.createElement("span");
              bg.className = "caption-word-bg";
              span.appendChild(bg);
              span.appendChild(document.createTextNode(word.text));

              group.appendChild(span);
            }

            return group;
          }

          function fallbackWords(subtitle) {
            const parts = String(subtitle.text || "").split(/\\s+/).filter(Boolean);
            const duration = Math.max(0.08, subtitle.end - subtitle.start);
            const step = duration / Math.max(parts.length, 1);
            return parts.map((text, index) => ({
              text,
              start: subtitle.start + step * index,
              end: subtitle.start + step * (index + 1)
            }));
          }

          function normalizeWord(value) {
            return String(value || "").toLowerCase().replace(/[^\\p{L}\\p{N}]+/gu, "");
          }
        })();
      </script>
    </div>
  </body>
</html>`;
}

function styleConfigForPreset(preset: string, profile: VideoProfile, captionRegion?: VideoRegion) {
  const landscape = profile.orientation === "landscape";
  const defaultBottom = landscape ? "92px" : "312px";
  const regionBottom = captionRegion
    ? `${Math.round(profile.height - captionRegion.y - captionRegion.height + Math.min(92, captionRegion.height * 0.1))}px`
    : defaultBottom;

  if (preset === "dynamic_viral") {
    return {
      variant: "highlight",
      fontFamily: '"HF Unbounded", "HF Montserrat", Arial, sans-serif',
      fontSize: landscape ? "54px" : "72px",
      bottomOffset: captionRegion ? regionBottom : (landscape ? "96px" : "320px"),
      sidePadding: "72px",
      wordGap: "10px",
      textColor: "#ffffff",
      inactiveColor: "#ffffff",
      activeColor: "#ffffff",
      accentColor: "#ff5a36",
      shadow: "0 8px 18px rgba(0, 0, 0, 0.45)",
      pillBackground: "rgba(16, 19, 18, 0.88)",
      pillRadius: "26px",
      outlineColor: "rgba(16, 19, 18, 0.9)"
    };
  }

  if (preset === "premium_calm") {
    return {
      variant: "pill",
      fontFamily: '"HF Onest", "HF Golos Text", Arial, sans-serif',
      fontSize: landscape ? "40px" : "58px",
      bottomOffset: captionRegion ? regionBottom : (landscape ? "88px" : "300px"),
      sidePadding: "80px",
      wordGap: "14px",
      textColor: "#f7f0e5",
      inactiveColor: "#938a7c",
      activeColor: "#1f1a16",
      accentColor: "#dfc7a2",
      shadow: "0 2px 12px rgba(0, 0, 0, 0.12)",
      pillBackground: "rgba(247, 240, 229, 0.9)",
      pillRadius: "28px",
      outlineColor: "rgba(34, 31, 27, 0.22)"
    };
  }

  return {
    variant: "pill",
    fontFamily: '"HF Manrope", "HF Onest", Arial, sans-serif',
    fontSize: landscape ? "44px" : "64px",
    bottomOffset: captionRegion ? regionBottom : defaultBottom,
    sidePadding: "72px",
    wordGap: "14px",
    textColor: "#ffffff",
    inactiveColor: "#b7bbb8",
    activeColor: "#f5efe4",
    accentColor: "#69d4c0",
    shadow: "0 4px 14px rgba(0, 0, 0, 0.18)",
    pillBackground: "rgba(20, 24, 23, 0.88)",
    pillRadius: "24px",
    outlineColor: "rgba(0, 0, 0, 0.18)"
  };
}
