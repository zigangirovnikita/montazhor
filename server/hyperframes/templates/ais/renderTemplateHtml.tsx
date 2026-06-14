import React from "react";
import { renderToString } from "react-dom/server";
import { hyperframesLocalFontsCss, hyperframesLocalGsapScript } from "@/server/hyperframes/assets";
import type { VideoProfile } from "@/server/video/profile";
import type { TemplateInstancePlan } from "@/lib/types/visual";
import { AisRenderShell } from "./AisRenderShell";

export function renderTemplateInstanceHtml(
  instance: TemplateInstancePlan["instances"][number],
  profile: VideoProfile
): string {
  const width = profile.width;
  const height = profile.height;

  const appHtml = renderToString(
    <AisRenderShell 
      templateId={instance.templateId}
      slots={instance.slots}
      visualWeight={instance.visualWeight}
      layout={instance.variantId} 
      width={width}
      height={height}
    />
  );

  // Provide GSAP timeline logic based on transitionIn / transitionOut
  // HyperFrames natively executes timelines defined under window.timeline or handles elements with data-composition-id
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

      // Very simple transitions to satisfy HyperFrames timeline requirement
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
