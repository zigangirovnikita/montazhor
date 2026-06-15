import { aisTokens, escapeHtml } from "../designTokens";
import { slotString, type SlotMap } from "./slotTypes";

export function renderQuoteFlash(slots: SlotMap, width: number, height: number): string {
  const quote = slotString(slots, "quote", "QUOTE");

  return `
    <div style="position: absolute; top: 0; left: 0; width: ${width}px; height: ${height}px; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; padding-left: ${aisTokens.spacing.xl}; font-family: ${aisTokens.typography.fontFamily}; box-sizing: border-box;">
      <div class="gsap-quote" style="max-width: 50%; border-left: 8px solid ${aisTokens.colors.secondary}; padding-left: ${aisTokens.spacing.md}; position: relative;">
        <div style="position: absolute; top: -40px; left: -20px; font-size: 120px; color: rgba(126, 87, 194, 0.2); line-height: 1; font-family: serif; user-select: none;">"</div>
        <div style="font-size: ${aisTokens.typography.subtitle.fontSize}; font-weight: ${aisTokens.typography.subtitle.fontWeight}; color: ${aisTokens.colors.textPrimary}; line-height: 1.4; text-shadow: ${aisTokens.effects.glowMild};">
          ${escapeHtml(quote)}
        </div>
      </div>
    </div>
  `;
}
