import { hyperframesLocalFontsCss, hyperframesLocalGsapScript } from "@/server/hyperframes/assets";
import type { VideoProfile } from "@/server/video/profile";
import type { TemplateInstancePlan } from "@/lib/types/visual";
import { aisTokens } from "./designTokens";

export function renderTemplateInstanceHtml(
  instance: TemplateInstancePlan["instances"][number],
  profile: VideoProfile
): string {
  const width = profile.width;
  const height = profile.height;

  // Very simple generic renderer to replace React SSR for these templates
  const slots = instance.slots;
  const title = slots.title || slots.eyebrow || slots.quote || slots.wrong || slots.action || instance.templateId;
  const subtitle = slots.text || slots.body || slots.right || slots.message || slots.before || slots.after || JSON.stringify(slots);

  const needsDarkBg = instance.variantId === "fullscreen" || instance.variantId === "side_panel";
  const bgColor = needsDarkBg ? aisTokens.colors.background : "transparent";

  const appHtml = `
    <div style="position: absolute; top: 0; left: 0; width: ${width}px; height: ${height}px; overflow: hidden; font-family: ${aisTokens.typography.fontFamily}; color: ${aisTokens.colors.textPrimary}; box-sizing: border-box; background-color: ${bgColor};">
      <div style="padding: ${aisTokens.spacing.xl}; display: flex; flex-direction: column; justify-content: center; height: 100%; width: 100%;">
        <h1 style="font-size: ${aisTokens.typography.title.fontSize}; font-weight: ${aisTokens.typography.title.fontWeight}; line-height: ${aisTokens.typography.title.lineHeight}; color: ${aisTokens.colors.primary}; text-shadow: ${aisTokens.effects.glowStrong};">
          ${title}
        </h1>
        <p style="font-size: ${aisTokens.typography.subtitle.fontSize}; font-weight: ${aisTokens.typography.subtitle.fontWeight}; line-height: ${aisTokens.typography.subtitle.lineHeight}; color: ${aisTokens.colors.textSecondary};">
          ${subtitle}
        </p>
      </div>
    </div>
  `;

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
