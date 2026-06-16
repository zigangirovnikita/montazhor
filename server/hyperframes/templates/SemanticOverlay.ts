import type { VisualOverlayPlan, VisualStyleProfile } from "@/lib/types";
import { hyperframesLocalFontsCss, hyperframesLocalGsapScript } from "@/server/hyperframes/assets";
import type { VideoProfile } from "@/server/video/profile";
import { spacingScale, radiusScale, strokePolicies, safeAreaInsets, motionCurves, motionDurations, linePolicies, typographyScale } from "@/server/hyperframes/designTokens";

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
  const insets = safeAreaInsets[profile.orientation];

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
          padding: ${insets.top}px ${insets.right}px ${insets.bottom}px ${insets.left}px;
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
          max-width: 100%;
          max-height: 74%;
          overflow: hidden;
          overflow-wrap: normal;
          word-break: normal;
          hyphens: none;
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
          background: var(--surface);
          backdrop-filter: blur(18px) saturate(1.18);
          -webkit-backdrop-filter: blur(18px) saturate(1.18);
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
          width: 100%;
          padding: 22px 26px 24px;
          border-radius: ${radiusScale.lg}px;
          background: var(--surface);
          backdrop-filter: blur(18px) saturate(1.18);
          -webkit-backdrop-filter: blur(18px) saturate(1.18);
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
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.32);
          opacity: 0;
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
          position: relative;
          font-family: ${style.typography.number};
          font-size: ${typographyScale.mega}px;
          font-weight: 950;
          line-height: 0.88;
          color: var(--accent);
          letter-spacing: 0;
          overflow-wrap: normal;
          word-break: normal;
          -webkit-text-stroke: ${strokePolicies.heavy} #03101d;
          paint-order: stroke fill;
        }
        .number-value::after {
          content: "";
          position: absolute;
          inset: -8% -12%;
          background: linear-gradient(110deg, transparent 18%, rgba(255,255,255,0.9) 46%, transparent 68%);
          transform: translateX(var(--shine-x, -130%));
          mix-blend-mode: screen;
          pointer-events: none;
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
          overflow-wrap: normal;
          word-break: normal;
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
          overflow-wrap: normal;
          word-break: normal;
        }
        .bullet-text,
        .check-item,
        .chart-label,
        .cta-copy {
          color: var(--muted);
          font-size: 24px;
          line-height: 1.18;
          overflow-wrap: normal;
          word-break: normal;
        }
        .checklist-card,
        .chart-card,
        .cta-card,
        .lesson-card,
        .myth-card,
        .stat-card,
        .concept-card {
          padding: 34px 36px;
        }
        .lesson-card,
        .myth-card,
        .stat-card,
        .concept-card {
          position: relative;
          border: 1px solid var(--border);
          border-radius: 24px;
          background:
            linear-gradient(90deg, var(--surface), var(--surface-strong)),
            repeating-linear-gradient(0deg, rgba(115, 200, 255, 0.08) 0 1px, transparent 1px 48px),
            repeating-linear-gradient(90deg, rgba(115, 200, 255, 0.06) 0 1px, transparent 1px 48px);
          backdrop-filter: blur(18px) saturate(1.18);
          -webkit-backdrop-filter: blur(18px) saturate(1.18);
          box-shadow: 0 26px 80px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255,255,255,0.08);
          overflow: hidden;
        }
        .lesson-card::before,
        .stat-card::before,
        .concept-card::before {
          content: "";
          position: absolute;
          left: -18%;
          bottom: -48%;
          width: 74%;
          aspect-ratio: 1;
          border: 2px solid rgba(115, 200, 255, 0.24);
          border-radius: 50%;
          pointer-events: none;
        }
        .lesson-title {
          margin-top: 18px;
          font-family: ${style.typography.heading};
          font-size: ${typographyScale.hero}px;
          font-weight: 950;
          line-height: 0.96;
          letter-spacing: 0;
          text-transform: uppercase;
          color: #ffffff;
          text-shadow: 0 0 28px rgba(115, 200, 255, 0.2);
        }
        .lesson-subtext {
          max-width: 760px;
          margin-top: 22px;
          color: #d7e5f7;
          font-size: 28px;
          line-height: 1.25;
        }
        .myth-card {
          display: grid;
          gap: 34px;
          background: linear-gradient(90deg, rgba(7, 12, 22, 0.95), rgba(7, 12, 22, 0.52));
        }
        .myth-word,
        .truth-word {
          position: relative;
          font-family: ${style.typography.heading};
          font-size: ${typographyScale.hero + 12}px;
          font-weight: 950;
          line-height: 0.9;
          text-transform: uppercase;
          letter-spacing: 0;
        }
        .myth-word {
          color: #d8c8ff;
          opacity: 0.8;
        }
        .myth-word::after {
          content: "";
          position: absolute;
          left: -2%;
          right: -2%;
          top: 48%;
          height: 10px;
          border-radius: 999px;
          background: #ff5d4d;
          box-shadow: 0 0 22px rgba(255, 93, 77, 0.62);
          transform: scaleX(var(--strike-scale, 1));
          transform-origin: 0 50%;
        }
        .truth-word {
          color: #ffffff;
          text-shadow: 0 0 30px rgba(115, 200, 255, 0.48);
        }
        .slot-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 18px;
        }
        .slot-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: rgba(10, 18, 32, 0.72);
          color: #eef7ff;
          font-size: 18px;
          line-height: 1;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .slot-chip.style-accent { color: var(--accent); border-color: rgba(255, 180, 71, 0.48); background: rgba(64, 35, 10, 0.62); }
        .slot-chip.style-primary { color: #ffffff; }
        .slot-chip.style-muted { color: var(--muted); }
        .slot-chip.style-success { color: #9df0c6; border-color: rgba(96, 235, 165, 0.42); background: rgba(10, 51, 35, 0.64); }
        .slot-chip.style-danger { color: #ff8a80; border-color: rgba(255, 93, 77, 0.42); background: rgba(69, 17, 15, 0.64); text-decoration: line-through; }
        .slot-chip.style-chip { color: #0d1624; border-color: rgba(255, 180, 71, 0.72); background: linear-gradient(135deg, #ffd27f, #ffb447); font-weight: 900; }
        .support-visuals {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 18px;
        }
        .support-visual {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid rgba(115, 200, 255, 0.2);
          background: rgba(7, 18, 33, 0.72);
          color: #d9ecff;
          font-size: 17px;
          line-height: 1;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }
        .support-visual.kind-hotkey_keys,
        .support-visual.kind-keyboard { color: #ffcf78; border-color: rgba(255, 180, 71, 0.45); }
        .support-visual.kind-cursor,
        .support-visual.kind-mouse { color: #87dbff; border-color: rgba(115, 200, 255, 0.42); }
        .support-visual.kind-warning_mark { color: #ff8a80; border-color: rgba(255, 93, 77, 0.48); }
        .support-visual.kind-checkmark { color: #9df0c6; border-color: rgba(96, 235, 165, 0.42); }
        .inline-hotkey {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 16px;
          padding: 12px 16px;
          border-radius: 14px;
          border: 1px solid rgba(255, 180, 71, 0.72);
          background: rgba(255, 180, 71, 0.14);
          color: #ffcf78;
          font-size: 20px;
          line-height: 1;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }
        .stat-list {
          display: grid;
          gap: 18px;
          margin-top: 24px;
        }
        .stat-row {
          display: grid;
          grid-template-columns: 150px 1fr;
          gap: 18px;
          align-items: center;
          padding: 18px 22px;
          border-radius: 10px;
          background: var(--surface-strong);
          border: 1px solid var(--border);
        }
        .stat-value {
          font-family: ${style.typography.number};
          font-size: 54px;
          font-weight: 950;
          color: var(--accent);
          line-height: 0.9;
        }
        .stat-label {
          color: var(--text);
          font-size: 26px;
          line-height: 1.1;
        }
        .concept-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 220px minmax(0, 1fr);
          gap: 24px;
          align-items: center;
          margin-top: 30px;
        }
        .concept-node,
        .concept-center {
          border: 1px solid var(--border);
          border-radius: 18px;
          background: var(--surface-strong);
          padding: 24px;
        }
        .concept-center {
          display: grid;
          place-items: center;
          min-height: 220px;
          border-radius: 50%;
          color: var(--text);
          font-family: ${style.typography.heading};
          font-size: 44px;
          font-weight: 950;
          text-align: center;
          text-transform: uppercase;
          box-shadow: 0 0 36px rgba(115, 200, 255, 0.34);
        }
        .concept-node {
          color: #d8e8ff;
          font-size: 28px;
          line-height: 1.18;
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
        .variant-safe .phrase-card,
        .variant-safe .glass-card,
        .variant-safe .bullet-shell,
        .variant-safe .checklist-card,
        .variant-safe .chart-card,
        .variant-safe .cta-card,
        .variant-safe .lesson-card,
        .variant-safe .myth-card,
        .variant-safe .stat-card,
        .variant-safe .concept-card { width: 100%; }
        .preset-kinetic_phrase_slam .phrase-card,
        .preset-caption_kinetic_slam .phrase-card,
        .preset-caption_emoji_pop .phrase-card,
        .preset-caption_neon_glow .phrase-card,
        .preset-caption_glitch_rgb .phrase-card,
        .preset-caption_particle_burst .phrase-card,
        .preset-keyword_viral_slam .keyword-stack,
        .preset-keyword_title_slam .keyword-stack,
        .preset-big_number_shimmer .glass-card,
        .preset-big_number_viral .glass-card {
          border-color: rgba(255, 229, 77, 0.64);
          background: #101010;
        }
        .preset-kinetic_phrase_slam .phrase-word,
        .preset-caption_kinetic_slam .phrase-word,
        .preset-caption_neon_glow .phrase-word,
        .preset-caption_particle_burst .phrase-word,
        .preset-keyword_viral_slam .keyword,
        .preset-keyword_title_slam .keyword,
        .preset-big_number_shimmer .number-value,
        .preset-big_number_viral .number-value {
          color: var(--accent-2);
        }
        .preset-caption_emoji_pop .phrase-card::before {
          content: attr(data-icon);
          display: inline-grid;
          place-items: center;
          width: 58px;
          height: 58px;
          border-radius: 18px;
          background: var(--accent-2);
          color: #101010;
          font-size: 34px;
          font-weight: 900;
        }
        .preset-caption_gradient_fill .phrase-word,
        .preset-caption_editorial_emphasis .phrase-word {
          background: linear-gradient(90deg, var(--accent), var(--accent-2));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .preset-caption_highlight .phrase-word {
          color: #f8fbff;
          text-shadow: 0 2px 12px rgba(0, 0, 0, 0.34);
        }
        .preset-caption_highlight .phrase-word.is-emphasis {
          color: var(--accent);
        }
        .preset-caption_highlight .phrase-card,
        .preset-caption_clip_wipe .phrase-card,
        .preset-caption_editorial_emphasis .phrase-card {
          background: #111111;
          border-color: rgba(255, 255, 255, 0.26);
        }
        .preset-caption_neon_glow .phrase-word {
          text-shadow: 0 0 18px var(--accent), 0 0 44px var(--accent);
        }
        .preset-caption_glitch_rgb .phrase-word {
          color: #ffffff;
          text-shadow: -3px 0 #ff4040, 3px 0 #73c8ff;
        }
        .preset-caption_matrix_decode .phrase-card {
          background: #06140f;
          border-color: rgba(115, 255, 181, 0.34);
        }
        .preset-caption_matrix_decode .phrase-word {
          color: #73ffb5;
          text-shadow: 0 0 18px rgba(115, 255, 181, 0.44);
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
            applyStyleOverrides(node, beat);
            stage.appendChild(node);
            fitBeat(node);
            const enter = enterVars(beat.motionId);
            const start = Math.max(0, beat.start);
            const end = start + beat.duration;

            tl.fromTo(node, enter.from, { ...enter.to, duration: enter.duration, ease: enter.ease }, start);
            animateChildren(tl, node, beat, start);
            const exit = exitVars(beat.motionOutId || "slide-up");
            tl.to(node, exit.vars, Math.max(start + 0.9, end - exit.duration));
          });

          tl.seek(0);
          window.__timelines["semantic-overlay"] = tl;

          function hexToRgba(hex, alpha) {
            if (!hex) return "";
            if (hex.startsWith("#")) {
              const cleanHex = hex.replace("#", "");
              let r = 0, g = 0, b = 0;
              if (cleanHex.length === 3) {
                r = parseInt(cleanHex[0] + cleanHex[0], 16);
                g = parseInt(cleanHex[1] + cleanHex[1], 16);
                b = parseInt(cleanHex[2] + cleanHex[2], 16);
              } else if (cleanHex.length === 6 || cleanHex.length === 8) {
                r = parseInt(cleanHex.substring(0, 2), 16);
                g = parseInt(cleanHex.substring(2, 4), 16);
                b = parseInt(cleanHex.substring(4, 6), 16);
              } else {
                return hex;
              }
              return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
            }
            return hex;
          }

          function applyStyleOverrides(wrap, beat) {
            const card = wrap.querySelector(".phrase-card, .glass-card, .bullet-shell, .checklist-card, .chart-card, .cta-card, .lesson-card, .myth-card, .stat-card, .concept-card");
            if (card && beat.styleOverrides) {
              const so = beat.styleOverrides;
              if (so.colorText) {
                card.style.color = so.colorText;
              }
              if (so.surface === "none") {
                card.style.background = "transparent";
                card.style.borderColor = "transparent";
                card.style.boxShadow = "none";
              } else {
                let bgColor = so.colorBackground || "${style.colors.background}";
                const opacity = so.surfaceOpacity !== undefined ? so.surfaceOpacity : 0.82;
                if (so.surface === "glass") {
                  card.style.background = hexToRgba(bgColor, opacity);
                  card.style.backdropFilter = "blur(18px) saturate(1.18)";
                  card.style.webkitBackdropFilter = "blur(18px) saturate(1.18)";
                } else {
                  card.style.background = bgColor;
                  card.style.backdropFilter = "none";
                  card.style.webkitBackdropFilter = "none";
                }
                if (so.borderColor) {
                  card.style.borderColor = so.borderColor;
                } else if (so.colorAccent) {
                  card.style.borderColor = so.colorAccent;
                }
              }
              if (so.borderRadius !== undefined) {
                card.style.borderRadius = so.borderRadius + "px";
              }
              if (so.padding !== undefined) {
                card.style.padding = so.padding + "px";
              }
              if (so.shadow === "none") {
                card.style.boxShadow = "none";
              } else if (so.shadow === "glow" && so.colorAccent) {
                card.style.boxShadow = "0 0 34px " + hexToRgba(so.colorAccent, 0.38);
              }
            }
            return wrap;
          }

          function renderBeat(beat) {
            const wrap = document.createElement("section");
            wrap.className = "beat layout-" + beat.layout + " template-" + beat.templateId + " preset-" + safeClass(beat.presetId || beat.templateId) + " variant-" + (beat.variant || "standard");
            wrap.id = beat.id;

            if (beat.templateId === "kinetic_text") {
              const words = timedWords(beat);
              const emphasis = normalizeWord(String(beat.payload.emphasis || ""));
              const preset = beat.presetId || "";
              
              const html = words.map((word, index) => {
                const normalized = normalizeWord(word.text);
                const isEmphasis = normalized && normalized === emphasis;
                const cls = isEmphasis ? "phrase-word is-emphasis" : "phrase-word";
                
                if (preset === "caption_matrix_decode") {
                  const scr0 = scrambleString(word.text, 0);
                  const scr1 = scrambleString(word.text, 1);
                  return '<span class="' + cls + ' matrix-word" data-offset="' + word.start + '" data-duration="' + (word.duration || 0.3) + '" style="position: relative">' +
                    '<span class="matrix-real" style="visibility:hidden">' + esc(word.text) + '</span>' +
                    '<span class="matrix-scr0" style="display:none; position:absolute; left:0">' + esc(scr0) + '</span>' +
                    '<span class="matrix-scr1" style="display:none; position:absolute; left:0">' + esc(scr1) + '</span>' +
                    '</span>';
                }
                
                return '<span class="' + cls + '" data-offset="' + word.start + '" data-duration="' + (word.duration || 0.3) + '">' + esc(word.text) + '</span>';
              }).join("");
              
              wrap.innerHTML = '<div class="phrase-card" data-icon="' + esc(String(beat.payload.icon || "+")) + '">' + html + '</div>';
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

            if (beat.templateId === "lesson_title") {
              wrap.innerHTML =
                '<div class="lesson-card">'
                + '<div class="eyebrow">' + esc(String(beat.payload.eyebrow || "LESSON")) + '</div>'
                + '<div class="lesson-title">' + esc(String(beat.payload.title || beat.payload.sourceText || "")) + '</div>'
                + '<p class="lesson-subtext">' + esc(String(beat.payload.subtext || "")) + '</p>'
                + renderSlotRow(beat.payload, ["keyword_accent", "command_hotkey"])
                + '</div>';
              return wrap;
            }

            if (beat.templateId === "myth_strike") {
              wrap.innerHTML =
                '<div class="myth-card">'
                + '<div class="eyebrow">' + esc(String(beat.payload.eyebrow || "MYTH")) + '</div>'
                + '<div class="myth-word">' + esc(String(beat.payload.falseText || "")) + '</div>'
                + '<div class="truth-word">' + esc(String(beat.payload.trueText || "")) + '</div>'
                + renderSupportVisuals(beat.payload)
                + '</div>';
              return wrap;
            }

            if (beat.templateId === "stat_panel") {
              const items = objectList(beat.payload.items).slice(0, 4);
              const rows = items.map((item) =>
                '<div class="stat-row">'
                + '<div class="stat-value">' + esc(item.value || "01") + '</div>'
                + '<div class="stat-label">' + esc(item.label || "") + '</div>'
                + '</div>'
              ).join("");
              wrap.innerHTML =
                '<div class="stat-card">'
                + '<div class="eyebrow">' + esc(String(beat.payload.eyebrow || "SYSTEM VIEW")) + '</div>'
                + '<div class="chart-title">' + esc(String(beat.payload.title || "")) + '</div>'
                + renderInlineHotkey(beat.payload)
                + '<div class="stat-list">' + rows + '</div>'
                + renderSupportVisuals(beat.payload)
                + '</div>';
              return wrap;
            }

            if (beat.templateId === "concept_map") {
              wrap.innerHTML =
                '<div class="concept-card">'
                + '<div class="eyebrow">' + esc(String(beat.payload.eyebrow || "DEFINITION")) + '</div>'
                + '<div class="concept-grid">'
                + '<div class="concept-node">' + esc(String(beat.payload.left || "")) + '</div>'
                + '<div class="concept-center">' + esc(String(beat.payload.center || "")) + '</div>'
                + '<div class="concept-node">' + esc(String(beat.payload.right || "")) + '</div>'
                + '</div>'
                + '<p class="lesson-subtext">' + esc(String(beat.payload.caption || "")) + '</p>'
                + '</div>';
              return wrap;
            }

            if (beat.templateId === "cta_plate") {
              wrap.innerHTML = '<div class="cta-card"><p class="eyebrow">' + esc(String(beat.payload.label || "next step")) + '</p><div class="cta-text">' + esc(String(beat.payload.text || "")) + '</div><p class="cta-copy">' + esc(String(beat.payload.copy || "Смысл зафиксирован, можно идти дальше.")) + '</p>' + renderSlotRow(beat.payload, ["command_hotkey", "cta_phrase"]) + renderSupportVisuals(beat.payload) + '</div>';
              return wrap;
            }

            const bulletItems = list(beat.payload.items).slice(0, 3);
            const bulletTitle = String(beat.payload.title || "");
            const cards = bulletItems.map((item, index) =>
              '<article class="bullet-card">'
              + '<span class="bullet-index">' + String(index + 1).padStart(2, "0") + '</span>'
              + '<div><p class="bullet-text">' + esc(item) + '</p></div>'
              + '</article>'
            ).join("");
            wrap.innerHTML =
              '<div class="bullet-shell">'
              + '<div class="eyebrow">' + esc(String(beat.payload.eyebrow || "lesson")) + '</div>'
              + (bulletTitle ? '<div class="bullet-title">' + esc(bulletTitle) + '</div>' : '')
              + '<div class="bullet-grid">' + cards + '</div>'
              + '</div>';
            return wrap;
          }

          function fitBeat(node) {
            const targets = node.querySelectorAll(".phrase-word, .keyword, .number-value, .bullet-title, .checklist-title, .chart-title, .cta-text, .bullet-text, .check-item, .chart-label, .cta-copy, .lesson-title, .lesson-subtext, .myth-word, .truth-word, .stat-value, .stat-label, .concept-center, .concept-node, .slot-chip, .support-visual, .inline-hotkey");
            if (!targets.length) return;
            const minSize = node.classList.contains("template-kinetic_text") ? ${linePolicies.kinetic_text.minFontSize} : ${linePolicies.checklist.minFontSize};
            for (let step = 0; step < 22 && isOverflowing(node); step++) {
              targets.forEach((target) => {
                const current = Number.parseFloat(window.getComputedStyle(target).fontSize);
                if (current > minSize) target.style.fontSize = Math.max(minSize, current - 2) + "px";
              });
            }
            if (isOverflowing(node)) {
              node.classList.add("variant-safe");
              const panels = node.querySelectorAll(".phrase-card, .glass-card, .bullet-shell, .checklist-card, .chart-card, .cta-card, .lesson-card, .myth-card, .stat-card, .concept-card");
              panels.forEach((panel) => {
                panel.style.padding = "18px 20px";
              });
              targets.forEach((target) => {
                const current = Number.parseFloat(window.getComputedStyle(target).fontSize);
                target.style.fontSize = Math.max(minSize, Math.min(current, 32)) + "px";
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
            if (beat.templateId === "kinetic_text") {
              const words = node.querySelectorAll(".phrase-word");
              const preset = beat.presetId || "";
              
              if (preset === "caption_matrix_decode") {
                words.forEach((word) => {
                  const offset = Number.parseFloat(word.dataset.offset || "0");
                  const wStart = start + Math.max(0, offset);
                  
                  const realEl = word.querySelector(".matrix-real");
                  const scr0El = word.querySelector(".matrix-scr0");
                  const scr1El = word.querySelector(".matrix-scr1");
                  
                  if (realEl && scr0El && scr1El) {
                    timeline.set(scr0El, { display: "inline" }, wStart);
                    timeline.set(scr1El, { display: "inline" }, wStart + 0.08);
                    timeline.set(scr0El, { display: "none" }, wStart + 0.08);
                    timeline.set(realEl, { visibility: "visible" }, wStart + 0.16);
                    timeline.set(scr1El, { display: "none" }, wStart + 0.16);
                  }
                });
                return;
              }
              
              if (preset === "caption_neon_glow") {
                words.forEach((word) => {
                  const offset = Number.parseFloat(word.dataset.offset || "0");
                  const dur = Number.parseFloat(word.dataset.duration || "0.3");
                  const wStart = start + Math.max(0, offset);
                  const wEnd = wStart + dur;
                  
                  const isEmp = word.classList.contains("is-emphasis");
                  const activeColor = isEmp ? "var(--accent-2)" : "var(--accent)";
                  
                  timeline.set(word, { color: "rgba(115, 200, 255, 0.14)", textShadow: "none" }, start);
                  
                  timeline.to(word, {
                    color: activeColor,
                    textShadow: "0 0 10px " + activeColor + ", 0 0 30px " + activeColor,
                    duration: 0.08,
                    ease: "none"
                  }, wStart);
                  
                  timeline.to(word, {
                    color: "rgba(115, 200, 255, 0.14)",
                    textShadow: "none",
                    duration: 0.08,
                    ease: "none"
                  }, wEnd);
                });
                return;
              }
              
              if (preset === "caption_gradient_fill") {
                words.forEach((word) => {
                  const offset = Number.parseFloat(word.dataset.offset || "0");
                  const dur = Number.parseFloat(word.dataset.duration || "0.3");
                  const wStart = start + Math.max(0, offset);
                  const wEnd = wStart + dur;
                  
                  timeline.set(word, { backgroundPosition: "100% 0", scale: 1 }, start);
                  
                  timeline.set(word, { scale: 1.04 }, wStart);
                  timeline.fromTo(word,
                    { backgroundPosition: "45% 0" },
                    { backgroundPosition: "0% 0", duration: dur, ease: "none" },
                    wStart
                  );
                  timeline.set(word, { backgroundPosition: "100% 0" }, wEnd);
                  timeline.to(word, { scale: 1, duration: 0.15, ease: "power2.out" }, wEnd);
                });
                return;
              }
              
              if (preset === "kinetic_phrase_slam") {
                words.forEach((word) => {
                  const offset = Number.parseFloat(word.dataset.offset || "0");
                  const dur = Number.parseFloat(word.dataset.duration || "0.3");
                  const wStart = start + Math.max(0, offset);
                  const wEnd = wStart + dur;
                  
                  const isEmp = word.classList.contains("is-emphasis");
                  const activeColor = isEmp ? "var(--accent-2)" : "var(--accent)";
                  
                  timeline.set(word, { color: "rgba(255, 255, 255, 0.4)", scale: 1 }, start);
                  
                  timeline.to(word, {
                    color: activeColor,
                    scale: 1.15,
                    duration: 0.1,
                    ease: "back.out(2.2)"
                  }, wStart);
                  
                  timeline.to(word, {
                    color: "rgba(255, 255, 255, 0.4)",
                    scale: 1,
                    duration: 0.12,
                    ease: "power2.out"
                  }, wEnd);
                });
                return;
              }
              
              words.forEach((word) => {
                const offset = Number.parseFloat(word.dataset.offset || "0");
                const dur = Number.parseFloat(word.dataset.duration || "0.3");
                const wStart = start + Math.max(0, offset);
                const wEnd = wStart + dur;
                
                const isEmp = word.classList.contains("is-emphasis");
                const activeColor = isEmp ? "var(--accent)" : "#ffffff";
                
                timeline.set(word, { color: "rgba(255, 255, 255, 0.35)", y: 12, opacity: 0 }, start);
                
                timeline.to(word, {
                  opacity: 1,
                  y: 0,
                  color: activeColor,
                  duration: 0.18,
                  ease: "power2.out"
                }, wStart);
                
                timeline.to(word, {
                  color: "rgba(255, 255, 255, 0.55)",
                  duration: 0.12,
                  ease: "power1.out"
                }, wEnd);
              });
              return;
            }
            if (beat.templateId === "big_number") {
              const numberValue = node.querySelector(".number-value");
              if (!numberValue) return;
              timeline.fromTo(
                numberValue,
                { scale: 0.72, rotate: -2 },
                { scale: 1, rotate: 0, duration: 0.42, ease: "${motionCurves.slam}" },
                start + 0.02
              );
              timeline.fromTo(
                numberValue,
                { "--shine-x": "-130%" },
                { "--shine-x": "130%", duration: 0.7, ease: "power2.inOut" },
                start + 0.18
              );
              return;
            }
            if (beat.templateId === "myth_strike") {
              timeline.fromTo(node.querySelector(".myth-word"), { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.28, ease: "${motionCurves.active}" }, start + 0.08);
              timeline.fromTo(node.querySelector(".myth-word"), { "--strike-scale": "0" }, { "--strike-scale": "1", duration: 0.36, ease: "power2.inOut" }, start + 0.36);
              timeline.fromTo(node.querySelector(".truth-word"), { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.34, ease: "${motionCurves.slam}" }, start + 0.56);
              return;
            }
            if (beat.templateId === "lesson_title") {
              timeline.fromTo(node.querySelector(".lesson-title"), { opacity: 0, y: 36, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.42, ease: "${motionCurves.zoom}" }, start + 0.08);
              timeline.fromTo(node.querySelector(".lesson-subtext"), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.3, ease: "${motionCurves.calm}" }, start + 0.42);
              return;
            }
            if (beat.templateId === "stat_panel") {
              timeline.fromTo(node.querySelectorAll(".stat-row"), { opacity: 0, x: -34 }, { opacity: 1, x: 0, duration: 0.32, stagger: 0.12, ease: "${motionCurves.active}" }, start + 0.16);
              return;
            }
            if (beat.templateId === "concept_map") {
              timeline.fromTo(node.querySelector(".concept-center"), { opacity: 0, scale: 0.78 }, { opacity: 1, scale: 1, duration: 0.38, ease: "${motionCurves.slam}" }, start + 0.12);
              timeline.fromTo(node.querySelectorAll(".concept-node"), { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.34, stagger: 0.14, ease: "${motionCurves.active}" }, start + 0.34);
              return;
            }
            const children = node.querySelectorAll(".bullet-card, .check-item, .bar-wrap, .keyword-line, .keyword-muted, .slot-chip, .support-visual, .inline-hotkey");
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
            if (motionId === "soft_pop" || motionId === "scale") return { from: { opacity: 0, scale: 0.44 }, to: { opacity: 1, scale: 1 }, duration: ${motionDurations.enter.medium}, ease: "${motionCurves.slam}" };
            if (motionId === "slide-right") return { from: { opacity: 0, x: -48 }, to: { opacity: 1, x: 0 }, duration: ${motionDurations.enter.medium}, ease: "${motionCurves.active}" };
            if (motionId === "fade" || motionId === "word-by-word") return { from: { opacity: 0 }, to: { opacity: 1 }, duration: ${motionDurations.enter.medium}, ease: "power1.out" };
            if (motionId === "none") return { from: { opacity: 0 }, to: { opacity: 1 }, duration: 0.01, ease: "none" };
            if (motionId === "glass_slide" || motionId === "slide-up") return { from: { opacity: 0, y: 28 }, to: { opacity: 1, y: 0 }, duration: ${motionDurations.enter.medium}, ease: "${motionCurves.active}" };
            return { from: { opacity: 0, y: 28, scale: 0.98 }, to: { opacity: 1, y: 0, scale: 1 }, duration: ${motionDurations.enter.medium}, ease: "${motionCurves.active}" };
          }

          function exitVars(motionOutId) {
            const duration = 0.24;
            if (motionOutId === "fade") return { vars: { opacity: 0, duration, ease: "power2.in" }, duration };
            if (motionOutId === "slide-down") return { vars: { opacity: 0, y: "+=18", duration, ease: "power2.in" }, duration };
            if (motionOutId === "scale-down") return { vars: { opacity: 0, scale: 0.44, duration, ease: "power2.in" }, duration };
            if (motionOutId === "none") return { vars: { opacity: 0, duration: 0.01 }, duration: 0.01 };
            if (motionOutId === "slide-up") return { vars: { opacity: 0, y: "-=18", duration, ease: "power2.in" }, duration };
            return { vars: { opacity: 0, y: "-=18", duration, ease: "power2.in" }, duration };
          }

          function list(value) {
            return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
          }

          function objectList(value) {
            if (!Array.isArray(value)) return [];
            return value.map((item) => {
              if (item && typeof item === "object") {
                return {
                  value: String(item.value || ""),
                  label: String(item.label || item.text || "")
                };
              }
              return { value: "", label: String(item || "") };
            }).filter((item) => item.value || item.label);
          }

          function semanticSlots(payload) {
            return Array.isArray(payload.slots) ? payload.slots.filter((item) => item && typeof item === "object") : [];
          }

          function supportVisuals(payload) {
            return Array.isArray(payload.supportVisuals) ? payload.supportVisuals.filter((item) => item && typeof item === "object") : [];
          }

          function renderSlotRow(payload, roles) {
            var html = semanticSlots(payload)
              .filter((slot) => roles.includes(String(slot.role || "")))
              .map((slot) => '<span class="slot-chip style-' + safeClass(String(slot.style || "primary")) + '">' + esc(String(slot.shortText || slot.text || "")) + '</span>')
              .join("");
            return html ? '<div class="slot-row">' + html + '</div>' : "";
          }

          function renderInlineHotkey(payload) {
            var hotkey = semanticSlots(payload).find((slot) => String(slot.role || "") === "command_hotkey");
            if (!hotkey) return "";
            return '<div class="inline-hotkey">' + supportGlyph("hotkey_keys") + esc(String(hotkey.shortText || hotkey.text || "")) + '</div>';
          }

          function renderSupportVisuals(payload) {
            var html = supportVisuals(payload)
              .slice(0, 4)
              .map((visual) => '<span class="support-visual kind-' + safeClass(String(visual.kind || "")) + '">' + supportGlyph(String(visual.kind || "")) + esc(String(visual.label || fallbackSupportLabel(String(visual.kind || "")))) + '</span>')
              .join("");
            return html ? '<div class="support-visuals">' + html + '</div>' : "";
          }

          function supportGlyph(kind) {
            if (kind === "cursor") return "[CURSOR] ";
            if (kind === "mouse") return "[MOUSE] ";
            if (kind === "keyboard" || kind === "hotkey_keys") return "[KEY] ";
            if (kind === "warning_mark") return "[WARN] ";
            if (kind === "checkmark") return "[OK] ";
            if (kind === "number_badge") return "[#] ";
            if (kind === "timeline_tick") return "[TIME] ";
            if (kind === "chart_pulse") return "[DATA] ";
            return "";
          }

          function fallbackSupportLabel(kind) {
            if (kind === "hotkey_keys") return "HOTKEY";
            if (kind === "warning_mark") return "WARNING";
            if (kind === "checkmark") return "FIX";
            if (kind === "timeline_tick") return "TIMING";
            if (kind === "chart_pulse") return "DATA";
            return String(kind || "").replaceAll("_", " ").toUpperCase();
          }

          function splitWords(value) {
            return String(value || "").split(/\\s+/).filter(Boolean);
          }

          function scrambleString(word, seed) {
            var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            var result = "";
            var len = Math.max(3, word.length);
            for (var i = 0; i < len; i++) {
              var idx = (word.charCodeAt(i % word.length) * 17 + seed * 31 + i * 7) % chars.length;
              result += chars[idx];
            }
            return result;
          }

          function timedWords(beat) {
            var result = [];
            if (Array.isArray(beat.payload.words) && beat.payload.words.length) {
              result = beat.payload.words.map((word, index) => ({
                text: String(word.text || word.word || ""),
                start: Number.isFinite(Number(word.start)) ? Number(word.start) : index * 0.12,
                end: Number.isFinite(Number(word.end)) ? Number(word.end) : (Number.isFinite(Number(word.start)) ? Number(word.start) + 0.25 : (index + 1) * 0.12)
              })).filter((word) => word.text.trim());
            } else {
              result = splitWords(String(beat.payload.text || "")).map((word, index) => ({
                text: word,
                start: index * 0.12,
                end: (index + 1) * 0.12
              }));
            }
            for (var i = 0; i < result.length; i++) {
              var current = result[i];
              var next = result[i + 1];
              var limit = next ? next.start : current.start + 0.4;
              current.end = Math.min(current.end, limit);
              current.duration = Math.max(0.08, current.end - current.start);
            }
            return result;
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
