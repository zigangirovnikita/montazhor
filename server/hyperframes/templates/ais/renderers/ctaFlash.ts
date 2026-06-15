import { aisTokens, escapeHtml } from "../designTokens";
import { slotString, type SlotMap } from "./slotTypes";

export function renderCtaFlash(slots: SlotMap, width: number, height: number): string {
  const action = slotString(slots, "action", "SUBSCRIBE");
  const targetValue = slotString(slots, "target", "");
  const target = targetValue ? `<div class="gsap-target" style="font-size: ${aisTokens.typography.body.fontSize}; color: ${aisTokens.colors.textSecondary}; margin-top: ${aisTokens.spacing.sm};">${escapeHtml(targetValue)}</div>` : "";

  return `
    <div style="position: absolute; top: 0; left: 0; width: ${width}px; height: ${height}px; background-color: ${aisTokens.colors.background}; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: ${aisTokens.typography.fontFamily}; text-align: center; box-sizing: border-box;">
      <div style="background: radial-gradient(circle at center, ${aisTokens.colors.primary} 0%, transparent 60%); position: absolute; width: 100%; height: 100%; z-index: 0; opacity: 0.15;"></div>
      
      <div style="z-index: 1; display: flex; flex-direction: column; align-items: center; padding: ${aisTokens.spacing.lg}; background-color: rgba(17, 21, 32, 0.6); border: 1px solid ${aisTokens.colors.surfaceHighlight}; border-radius: ${aisTokens.borders.radiusLg}; backdrop-filter: ${aisTokens.effects.glassBlur}; box-shadow: ${aisTokens.effects.glowStrong};">
        <div class="gsap-action" style="font-size: ${aisTokens.typography.title.fontSize}; font-weight: ${aisTokens.typography.title.fontWeight}; color: ${aisTokens.colors.textPrimary}; text-transform: uppercase;">
          ${action}
        </div>
        ${target}
      </div>
    </div>
  `;
}
