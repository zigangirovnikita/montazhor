import { aisTokens, escapeHtml } from "../designTokens";
import { slotString, type SlotMap } from "./slotTypes";

export function renderWarningDialogue(slots: SlotMap, width: number, height: number): string {
  const speakerValue = slotString(slots, "speaker", "");
  const speaker = speakerValue ? `<div style="font-size: ${aisTokens.typography.label.fontSize}; color: ${aisTokens.colors.warning}; text-transform: uppercase; margin-bottom: ${aisTokens.spacing.xs};">${escapeHtml(speakerValue)}</div>` : "";
  const message = slotString(slots, "message", "WARNING");

  return `
    <div style="position: absolute; top: 0; left: 0; width: ${width}px; height: ${height}px; display: flex; flex-direction: column; justify-content: flex-end; align-items: flex-end; padding: ${aisTokens.spacing.xl}; font-family: ${aisTokens.typography.fontFamily}; box-sizing: border-box;">
      <div class="gsap-dialogue" style="background-color: ${aisTokens.colors.surface}; border: 1px solid ${aisTokens.colors.warning}; border-radius: ${aisTokens.borders.radiusMd} ${aisTokens.borders.radiusMd} 0 ${aisTokens.borders.radiusMd}; padding: ${aisTokens.spacing.md}; box-shadow: 0 10px 30px rgba(255, 165, 2, 0.2); max-width: 40%;">
        ${speaker}
        <div style="font-size: ${aisTokens.typography.body.fontSize}; color: ${aisTokens.colors.textPrimary}; line-height: ${aisTokens.typography.body.lineHeight};">
          ${escapeHtml(message)}
        </div>
      </div>
    </div>
  `;
}
