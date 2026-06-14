import type { VisualScenePlan } from "@/lib/types";
import { hyperframesLocalFontsCss, hyperframesLocalGsapScript } from "@/server/hyperframes/assets";
import type { VideoProfile } from "@/server/video/profile";

export function aisTechSceneTemplate(plan: VisualScenePlan, profile: VideoProfile, duration: number) {
  const scenes = plan.scenes.map((scene, index) => sceneHtml(scene, index)).join("\n");
  const timeline = JSON.stringify(plan.scenes.map((scene, index) => ({
    index,
    start: scene.start,
    duration: scene.duration,
    transitionIn: scene.transitionIn,
    transitionOut: scene.transitionOut
  })));

  return renderHtmlShell(scenes, timeline, duration, profile);
}

export function aisTechSceneFragmentTemplate(scene: VisualScenePlan["scenes"][number], profile: VideoProfile) {
  const scenes = sceneHtml(scene, 0);
  const timeline = JSON.stringify([{
    index: 0,
    start: 0,
    duration: scene.duration,
    transitionIn: scene.transitionIn,
    transitionOut: scene.transitionOut
  }]);

  return renderHtmlShell(scenes, timeline, scene.duration, profile);
}

function renderHtmlShell(scenes: string, timeline: string, duration: number, profile: VideoProfile) {
  return `<!doctype html>
<html>
  <head>
    <style>${hyperframesLocalFontsCss()}</style>
  </head>
  <body>
    <div id="ais-scenes" data-composition-id="ais-scenes" data-start="0" data-duration="${duration.toFixed(3)}" data-width="${profile.width}" data-height="${profile.height}">
      ${scenes}
      <div class="transition-wipe"></div>
    </div>
    <style>
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        width: ${profile.width}px;
        height: ${profile.height}px;
        overflow: hidden;
        background: #00ff00;
      }
      #ais-scenes {
        position: relative;
        width: ${profile.width}px;
        height: ${profile.height}px;
        overflow: hidden;
        background: #00ff00;
        color: #f8fbff;
        font-family: "HF Montserrat", Arial, sans-serif;
      }
      .scene {
        position: absolute;
        inset: 0;
        opacity: 0;
        overflow: hidden;
        pointer-events: none;
      }
      .scene.mode-overlay {
        background:
          radial-gradient(circle at 18% 42%, rgba(94, 190, 255, 0.18), transparent 34%),
          linear-gradient(90deg, rgba(2, 7, 18, 0.95), rgba(2, 7, 18, 0.64) 35%, rgba(2, 7, 18, 0.08) 58%, transparent 78%);
      }
      .scene.mode-pip,
      .scene.mode-split,
      .scene.mode-full_frame {
        background:
          radial-gradient(circle at 70% 10%, rgba(86, 170, 255, 0.22), transparent 24%),
          linear-gradient(180deg, #030715, #050a18 55%, #02050e);
      }
      .scene::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          linear-gradient(rgba(101, 194, 255, 0.055) 1px, transparent 1px),
          linear-gradient(90deg, rgba(101, 194, 255, 0.045) 1px, transparent 1px);
        background-size: 64px 64px;
        opacity: 0.45;
      }
      .scene::after {
        content: "";
        position: absolute;
        left: -10%;
        right: -10%;
        bottom: -18%;
        height: 46%;
        background:
          radial-gradient(ellipse at center, rgba(93, 188, 255, 0.22), transparent 62%),
          repeating-linear-gradient(96deg, rgba(94, 190, 255, 0.3) 0 2px, transparent 2px 17px);
        filter: blur(0.2px);
        transform: perspective(700px) rotateX(62deg);
        opacity: 0.44;
      }
      .content {
        position: relative;
        z-index: 2;
        width: 100%;
        height: 100%;
        padding: ${profile.orientation === "portrait" ? "120px 68px" : "76px 112px"};
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 24px;
      }
      .mode-pip .content {
        width: ${profile.orientation === "portrait" ? "100%" : "74%"};
        padding-right: ${profile.orientation === "portrait" ? "68px" : "520px"};
      }
      .mode-split .content {
        width: ${profile.orientation === "portrait" ? "100%" : "66%"};
        padding-right: ${profile.orientation === "portrait" ? "68px" : "48px"};
        padding-bottom: ${profile.orientation === "portrait" ? "760px" : "76px"};
      }
      .mode-overlay .content {
        width: ${profile.orientation === "portrait" ? "100%" : "48%"};
        padding-right: ${profile.orientation === "portrait" ? "68px" : "0"};
      }
      .eyebrow {
        color: #7bd3ff;
        font-family: "HF Golos Text", monospace;
        font-size: ${profile.orientation === "portrait" ? 24 : 20}px;
        font-weight: 700;
        letter-spacing: 0.34em;
        text-transform: uppercase;
      }
      .title {
        max-width: 100%;
        font-family: "HF Unbounded", "HF Montserrat", Arial, sans-serif;
        font-size: ${profile.orientation === "portrait" ? 76 : 82}px;
        line-height: 0.98;
        font-weight: 900;
        letter-spacing: 0;
        text-transform: uppercase;
        text-wrap: balance;
        text-shadow: 0 0 28px rgba(102, 198, 255, 0.22);
      }
      .subtitle, .caption {
        max-width: 760px;
        color: #d9e5f7;
        font-size: ${profile.orientation === "portrait" ? 30 : 27}px;
        line-height: 1.25;
      }
      .accent { color: #68c7ff; }
      .warn { color: #ffb447; }
      .huge {
        font-family: "HF Unbounded", Arial, sans-serif;
        font-size: ${profile.orientation === "portrait" ? 152 : 184}px;
        line-height: 0.85;
        color: #bdeaff;
        text-shadow: 0 0 34px rgba(102, 198, 255, 0.45);
      }
      .hud-pill, .card {
        border: 1px solid rgba(104, 199, 255, 0.36);
        background: rgba(9, 28, 48, 0.78);
        box-shadow: 0 24px 80px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.08);
      }
      .hud-pill {
        width: min(820px, 100%);
        padding: 28px 34px;
        border-radius: 12px;
      }
      .ratio-list { display: grid; gap: 20px; max-width: 760px; }
      .ratio-row {
        display: grid;
        grid-template-columns: 160px 1fr;
        align-items: center;
        gap: 24px;
        padding: 22px 28px;
        border-left: 5px solid #68c7ff;
      }
      .ratio-row:nth-child(3) { border-left-color: #ffb447; }
      .ratio-value {
        font-family: "HF Unbounded", Arial, sans-serif;
        font-size: ${profile.orientation === "portrait" ? 58 : 62}px;
        color: #8fdcff;
      }
      .ratio-row:nth-child(3) .ratio-value { color: #ffb447; }
      .ratio-label {
        font-family: "HF Golos Text", monospace;
        font-size: ${profile.orientation === "portrait" ? 24 : 25}px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      .strike-stack { display: grid; gap: 42px; }
      .strike-word {
        position: relative;
        display: inline-block;
        width: max-content;
        max-width: 100%;
        font-family: "HF Unbounded", Arial, sans-serif;
        font-size: ${profile.orientation === "portrait" ? 92 : 112}px;
        line-height: 0.9;
        color: #d7d6ff;
        text-transform: uppercase;
      }
      .strike-word::after {
        content: "";
        position: absolute;
        left: -2%;
        right: -4%;
        top: 48%;
        height: 9px;
        background: #ff5d48;
        box-shadow: 0 0 22px rgba(255, 93, 72, 0.5);
      }
      .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px; max-width: 1320px; }
      .timeline { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; max-width: 1220px; }
      .timeline .card { min-height: 320px; }
      .card {
        min-height: 430px;
        padding: 34px 30px;
        border-radius: 16px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .card-index {
        color: #69c9ff;
        font-family: "HF Golos Text", monospace;
        font-size: 26px;
        letter-spacing: 0.14em;
      }
      .card-title {
        font-family: "HF Unbounded", Arial, sans-serif;
        font-size: ${profile.orientation === "portrait" ? 42 : 54}px;
        line-height: 0.96;
      }
      .card-text { color: #c8d4e6; font-size: 24px; line-height: 1.22; }
      .map {
        display: grid;
        grid-template-columns: 1fr 260px 1fr;
        gap: 34px;
        align-items: center;
        max-width: 1320px;
      }
      .map-center {
        width: 260px;
        height: 260px;
        border-radius: 50%;
        border: 3px solid #68c7ff;
        display: grid;
        place-items: center;
        font-family: "HF Unbounded", Arial, sans-serif;
        font-size: 44px;
        box-shadow: 0 0 46px rgba(104,199,255,0.28);
      }
      .compare {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 28px;
        max-width: 1120px;
      }
      .compare .card:first-child {
        border-color: rgba(255, 180, 71, 0.42);
      }
      .quote {
        max-width: 900px;
        font-family: "HF Unbounded", Arial, sans-serif;
        font-size: ${profile.orientation === "portrait" ? 58 : 72}px;
        line-height: 1.02;
        text-transform: uppercase;
        text-shadow: 0 0 36px rgba(104, 199, 255, 0.28);
      }
      .quote::before {
        content: "“";
        color: #68c7ff;
      }
      .quote::after {
        content: "”";
        color: #ffb447;
      }
      .cta-shell {
        display: grid;
        gap: 28px;
        max-width: 980px;
      }
      .cta-button-visual {
        width: max-content;
        max-width: 100%;
        padding: 18px 28px;
        border: 2px solid rgba(255, 180, 71, 0.75);
        border-radius: 999px;
        color: #ffb447;
        background: rgba(255, 180, 71, 0.12);
        font-family: "HF Golos Text", monospace;
        font-size: 22px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        box-shadow: 0 0 34px rgba(255, 180, 71, 0.24);
      }
      .dialogue { display: grid; gap: 22px; max-width: 1020px; }
      .dialogue-row {
        padding: 26px 30px;
        border-radius: 16px;
      }
      .dialogue-row.wrong {
        border: 1px solid rgba(255, 180, 71, 0.42);
        background: rgba(55, 28, 8, 0.7);
      }
      .dialogue-row.right {
        border: 1px solid rgba(104, 199, 255, 0.48);
        background: rgba(8, 37, 58, 0.78);
      }
      .dialogue-label {
        margin-bottom: 10px;
        color: #7bd3ff;
        font-family: "HF Golos Text", monospace;
        font-size: 18px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      .transition-wipe {
        position: absolute;
        inset: 0;
        z-index: 20;
        transform: scaleX(0);
        transform-origin: 0 50%;
        background:
          radial-gradient(circle at 24% 48%, rgba(104, 199, 255, 0.42), rgba(104, 199, 255, 0) 36%),
          linear-gradient(90deg, rgba(2, 8, 22, 0.96), rgba(8, 34, 58, 0.96));
      }
      .logo {
        position: absolute;
        z-index: 3;
        top: 70px;
        right: 96px;
        font-family: "HF Unbounded", Arial, sans-serif;
        font-size: 74px;
        font-style: italic;
        color: #fff;
        text-shadow: 0 0 30px rgba(120, 180, 255, 0.7);
      }
      @media (max-aspect-ratio: 1/1) {
        .cards { grid-template-columns: 1fr; }
        .timeline { grid-template-columns: 1fr; }
        .compare { grid-template-columns: 1fr; }
        .card { min-height: 250px; }
        .map { grid-template-columns: 1fr; }
        .map-center { width: 220px; height: 220px; }
        .logo { top: 72px; right: 60px; font-size: 62px; }
      }
    </style>
    ${hyperframesLocalGsapScript()}
    <script>
      window.__timelines = window.__timelines || {};
      const sceneData = ${timeline};
      const tl = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } });
      sceneData.forEach((scene, i) => {
        const root = ".scene-" + scene.index;
        const start = scene.start;
        tl.set(root, { opacity: 1, visibility: "visible", zIndex: 2 }, start);
        tl.fromTo(root, { scale: scene.transitionIn === "zoom" ? 1.025 : 1, x: scene.transitionIn === "slide" ? -34 : 0 }, { scale: 1, x: 0, duration: 0.42, ease: "expo.out" }, start + 0.04);
        tl.fromTo(root + " .anim", { y: 38, opacity: 0 }, { y: 0, opacity: 1, duration: 0.58, stagger: 0.075, ease: "power3.out" }, start + 0.12);
        tl.fromTo(root + " .card", { x: -22, opacity: 0 }, { x: 0, opacity: 1, duration: 0.46, stagger: 0.09, ease: "back.out(1.2)" }, start + 0.22);
        const next = sceneData[i + 1];
        if (next) {
          const transitionAt = Math.max(start + 0.6, next.start - 0.24);
          tl.fromTo(".transition-wipe", { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: 0.18, ease: "power3.in" }, transitionAt);
          tl.set(root, { opacity: 0, visibility: "hidden", zIndex: 1 }, transitionAt + 0.18);
          tl.set(".scene-" + next.index, { opacity: 1, visibility: "visible", zIndex: 2 }, transitionAt + 0.18);
          tl.to(".transition-wipe", { scaleX: 0, transformOrigin: "100% 50%", duration: 0.22, ease: "power3.out" }, transitionAt + 0.19);
        } else {
          const end = Math.max(start + 0.4, start + scene.duration - 0.34);
          tl.to(root, { opacity: 0, duration: 0.32, ease: "power2.in" }, end);
        }
      });
      window.__timelines["ais-scenes"] = tl;
    </script>
  </body>
</html>`;
}

function sceneHtml(scene: VisualScenePlan["scenes"][number], index: number) {
  const payload = scene.payload;
  const mode = `mode-${scene.layoutMode}`;
  if (scene.sceneType === "ratio_stack") return shell(scene, index, mode, ratioStack(payload));
  if (scene.sceneType === "myth_strike") return shell(scene, index, mode, mythStrike(payload));
  if (scene.sceneType === "stat_hud") return shell(scene, index, mode, statHud(payload));
  if (scene.sceneType === "trust_map") return shell(scene, index, mode, trustMap(payload));
  if (scene.sceneType === "three_cards") return shell(scene, index, mode, threeCards(payload));
  if (scene.sceneType === "warning_dialogue") return shell(scene, index, mode, warningDialogue(payload));
  if (scene.sceneType === "compare_split") return shell(scene, index, mode, compareSplit(payload));
  if (scene.sceneType === "timeline_steps") return shell(scene, index, mode, timelineSteps(payload));
  if (scene.sceneType === "quote_focus") return shell(scene, index, mode, quoteFocus(payload));
  if (scene.sceneType === "cta_plate") return shell(scene, index, mode, ctaPlate(payload));
  return shell(scene, index, mode, lessonTitle(payload));
}

function shell(scene: VisualScenePlan["scenes"][number], index: number, mode: string, content: string) {
  const logo = scene.layoutMode === "pip" || scene.layoutMode === "full_frame" ? `<div class="logo anim">AIS</div>` : "";
  return `<section class="scene scene-${index} ${mode}">${logo}<div class="content">${content}</div></section>`;
}

function lessonTitle(payload: Record<string, unknown>) {
  return `${eyebrow(payload.eyebrow)}<div class="title anim">${text(payload.title, "KEY IDEA")}</div><div class="subtitle anim">${text(payload.subtitle ?? payload.sourceText, "")}</div>`;
}

function statHud(payload: Record<string, unknown>) {
  return `${eyebrow(payload.eyebrow)}<div class="huge anim">${text(payload.value, "01")}</div><div class="title anim">${text(payload.label, "SYSTEM")}</div><div class="caption anim">${text(payload.caption ?? payload.sourceText, "")}</div>`;
}

function ratioStack(payload: Record<string, unknown>) {
  const items = arrayPayload(payload.items).slice(0, 3);
  return `${eyebrow(payload.eyebrow)}<div class="ratio-list">${items.map((item) => `<div class="ratio-row hud-pill anim"><div class="ratio-value">${text(item.value, "0%")}</div><div class="ratio-label">${text(item.label, "SYSTEM")}</div></div>`).join("")}</div>`;
}

function mythStrike(payload: Record<string, unknown>) {
  return `${eyebrow(payload.eyebrow)}<div class="strike-stack"><div class="strike-word anim">${text(payload.falseText, "MYTH")}</div><div class="title anim accent">${text(payload.trueText, "")}</div></div>`;
}

function trustMap(payload: Record<string, unknown>) {
  return `${eyebrow(payload.eyebrow)}<div class="title anim">${text(payload.title, "TRUST MAP")}</div><div class="map anim"><div class="card"><div class="card-index">SOURCE A</div><div class="card-title accent">${text(payload.left, "EARNED")}</div></div><div class="map-center">${text(payload.center, "TRUST")}</div><div class="card"><div class="card-index">SOURCE B</div><div class="card-title accent">${text(payload.right, "INHERITED")}</div></div></div>`;
}

function threeCards(payload: Record<string, unknown>) {
  const items = arrayPayload(payload.items).slice(0, 3);
  return `${eyebrow(payload.eyebrow)}<div class="cards anim">${items.map((item, index) => `<div class="card"><div class="card-index">${text(item.index, String(index + 1).padStart(2, "0"))}</div><div class="card-title">${text(item.title, "POINT")}</div><div class="card-text">${text(item.text, "")}</div></div>`).join("")}</div>`;
}

function warningDialogue(payload: Record<string, unknown>) {
  return `${eyebrow(payload.eyebrow)}<div class="cta-button-visual anim">${text(payload.label, "PREMATURE")}</div><div class="dialogue"><div class="dialogue-row wrong anim"><div class="dialogue-label">WRONG MOVE</div><div class="subtitle">${text(payload.wrong, "")}</div></div><div class="dialogue-row right anim"><div class="dialogue-label">BETTER</div><div class="subtitle">${text(payload.right, "")}</div></div></div>`;
}

function compareSplit(payload: Record<string, unknown>) {
  return `${eyebrow(payload.eyebrow)}<div class="compare anim"><div class="card"><div class="card-index">A</div><div class="card-title warn">${text(payload.left, "BEFORE")}</div></div><div class="card"><div class="card-index">B</div><div class="card-title accent">${text(payload.right, "AFTER")}</div></div></div><div class="caption anim">${text(payload.caption ?? payload.sourceText, "")}</div>`;
}

function timelineSteps(payload: Record<string, unknown>) {
  const items = arrayPayload(payload.items).slice(0, 3);
  return `${eyebrow(payload.eyebrow)}<div class="title anim">${text(payload.title, "SEQUENCE")}</div><div class="timeline anim">${items.map((item, index) => `<div class="card"><div class="card-index">${text(item.index, String(index + 1).padStart(2, "0"))}</div><div class="card-title accent">${text(item.title, "STEP")}</div><div class="card-text">${text(item.text, "")}</div></div>`).join("")}</div>`;
}

function quoteFocus(payload: Record<string, unknown>) {
  return `${eyebrow(payload.eyebrow)}<div class="quote anim">${text(payload.quote ?? payload.sourceText, "")}</div>`;
}

function ctaPlate(payload: Record<string, unknown>) {
  return `${eyebrow(payload.eyebrow)}<div class="cta-shell"><div class="title anim">${text(payload.text, "NEXT STEP")}</div><div class="cta-button-visual anim">${text(payload.label, "ACTION")}</div></div>`;
}

function eyebrow(value: unknown) {
  return `<div class="eyebrow anim">${text(value, "LESSON")}</div>`;
}

function arrayPayload(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item))) : [];
}

function text(value: unknown, fallback: string) {
  const raw = typeof value === "string" || typeof value === "number" ? String(value) : fallback;
  return escapeHtml(raw.trim() || fallback);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
