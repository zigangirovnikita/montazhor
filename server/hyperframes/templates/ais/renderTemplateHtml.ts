import { hyperframesLocalFontsCss, hyperframesLocalGsapScript } from "@/server/hyperframes/assets";
import type { VideoProfile } from "@/server/video/profile";
import type { TemplateInstancePlan } from "@/lib/types/visual";
import { aisTokens } from "./designTokens";

import { renderHookFlash } from "./renderers/hookFlash";
import { renderSideCallout } from "./renderers/sideCallout";
import { renderStatMeter } from "./renderers/statMeter";
import { renderGoldenRatioSidebar } from "./renderers/goldenRatioSidebar";
import { renderMythStrike } from "./renderers/mythStrike";
import { renderBeforeAfter } from "./renderers/beforeAfter";
import { renderStepsCards } from "./renderers/stepsCards";
import { renderTrustMap } from "./renderers/trustMap";
import { renderWarningDialogue } from "./renderers/warningDialogue";
import { renderQuoteFlash } from "./renderers/quoteFlash";
import { renderCtaFlash } from "./renderers/ctaFlash";

export function renderTemplateInstanceHtml(
  instance: TemplateInstancePlan["instances"][number],
  profile: VideoProfile
): string {
  const width = profile.width;
  const height = profile.height;
  const slots = instance.slots;

  let appHtml = "";

  switch (instance.templateId) {
    case "ais.hook_flash.v1":
      appHtml = renderHookFlash(slots, width, height);
      break;
    case "ais.side_callout.v1":
      appHtml = renderSideCallout(slots, width, height);
      break;
    case "ais.stat_meter.v1":
      appHtml = renderStatMeter(slots, width, height);
      break;
    case "ais.golden_ratio_sidebar.v1":
      appHtml = renderGoldenRatioSidebar(slots, width, height);
      break;
    case "ais.myth_strike_overlay.v1":
      appHtml = renderMythStrike(slots, width, height);
      break;
    case "ais.before_after.v1":
      appHtml = renderBeforeAfter(slots, width, height);
      break;
    case "ais.steps_cards.v1":
      appHtml = renderStepsCards(slots, width, height);
      break;
    case "ais.trust_map.v1":
      appHtml = renderTrustMap(slots, width, height);
      break;
    case "ais.warning_dialogue.v1":
      appHtml = renderWarningDialogue(slots, width, height);
      break;
    case "ais.quote_flash.v1":
      appHtml = renderQuoteFlash(slots, width, height);
      break;
    case "ais.cta_flash.v1":
      appHtml = renderCtaFlash(slots, width, height);
      break;
    default:
      // Fallback
      appHtml = renderSideCallout(slots, width, height);
      break;
  }

  // Find the layout to determine compositing mode
  // The catalog tells us layout, but here we can infer it or check it.
  // Overlays need a green chroma key background.
  const isOverlay = 
    instance.templateId.includes("callout") ||
    instance.templateId.includes("stat_meter") ||
    instance.templateId.includes("myth_strike") ||
    instance.templateId.includes("warning_dialogue") ||
    instance.templateId.includes("quote_flash");

  // We wrap the appHtml in a green screen if it's an overlay
  if (isOverlay) {
    appHtml = `
      <div style="position: absolute; top: 0; left: 0; width: ${width}px; height: ${height}px; background-color: #00ff00;">
        ${appHtml}
      </div>
    `;
  }

  return `<!doctype html>
<html>
  <head>
    <style>
      ${hyperframesLocalFontsCss()}
      body { margin: 0; padding: 0; overflow: hidden; background: transparent; }
    </style>
  </head>
  <body>
    <div id="ais-scenes" data-composition-id="ais-scenes" data-start="0" data-duration="${instance.duration.toFixed(3)}" data-width="${width}" data-height="${height}">
      ${appHtml}
    </div>
    <script>${hyperframesLocalGsapScript()}</script>
    <script>
      const tl = gsap.timeline();
      const container = document.getElementById("ais-scenes");
      
      const transIn = "${instance.transitionIn}";
      const transOut = "${instance.transitionOut}";
      const duration = ${instance.duration};

      if (transIn === "fade") {
        tl.from(container, { opacity: 0, duration: 0.3 });
      } else if (transIn === "slide") {
        tl.from(container, { x: -100, opacity: 0, duration: 0.4, ease: "power2.out" });
      } else if (transIn === "zoom") {
        tl.from(container, { scale: 0.8, opacity: 0, duration: 0.4, ease: "back.out(1.5)" });
      }

      tl.to(container, { opacity: 1, duration: duration - 0.8 });

      if (transOut === "fade") {
        tl.to(container, { opacity: 0, duration: 0.3 });
      } else if (transOut === "slide") {
        tl.to(container, { x: 100, opacity: 0, duration: 0.4 });
      }
    </script>
  </body>
</html>`;
}
