import { aisTokens, escapeHtml } from "../designTokens";
import { slotString, type SlotMap } from "./slotTypes";

export function renderHookFlash(slots: SlotMap, width: number, height: number): string {
  const eyebrowValue = slotString(slots, "eyebrow", "");
  const eyebrow = eyebrowValue ? `<div class="gsap-eyebrow" style="font-size: ${aisTokens.typography.label.fontSize}; color: ${aisTokens.colors.primary}; text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: ${aisTokens.spacing.sm}; text-shadow: ${aisTokens.effects.glowMild};">${escapeHtml(eyebrowValue)}</div>` : "";
  const title = slotString(slots, "title", "TITLE");

  return `
    <div style="position: absolute; top: 0; left: 0; width: ${width}px; height: ${height}px; background-color: ${aisTokens.colors.background}; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: ${aisTokens.typography.fontFamily}; text-align: center; padding: ${aisTokens.spacing.xl}; box-sizing: border-box;">
      <div style="background: radial-gradient(circle at center, ${aisTokens.colors.surfaceHighlight} 0%, transparent 70%); position: absolute; width: 100%; height: 100%; z-index: 0; opacity: 0.5;"></div>
      <div style="z-index: 1; display: flex; flex-direction: column; align-items: center;">
        ${eyebrow}
        <h1 class="gsap-title" style="font-size: ${aisTokens.typography.hero.fontSize}; font-weight: ${aisTokens.typography.hero.fontWeight}; color: ${aisTokens.colors.textPrimary}; text-shadow: ${aisTokens.effects.glowStrong}; margin: 0; line-height: 1.1;">
          ${escapeHtml(title)}
        </h1>
      </div>
    </div>
  `;
}
