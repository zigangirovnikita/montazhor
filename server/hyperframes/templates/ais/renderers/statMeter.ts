import { aisTokens, escapeHtml } from "../designTokens";
import { slotString, type SlotMap } from "./slotTypes";

export function renderStatMeter(slots: SlotMap, width: number, height: number): string {
  const value = slotString(slots, "value", "100");
  const label = slotString(slots, "label", "STAT");

  return `
    <div style="position: absolute; top: 0; left: 0; width: ${width}px; height: ${height}px; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; padding-left: ${aisTokens.spacing.xl}; font-family: ${aisTokens.typography.fontFamily}; box-sizing: border-box;">
      <div class="gsap-stat-container" style="background-color: rgba(17, 21, 32, 0.8); backdrop-filter: ${aisTokens.effects.glassBlur}; padding: ${aisTokens.spacing.md} ${aisTokens.spacing.lg}; border-radius: ${aisTokens.borders.radiusMd}; border: 1px solid ${aisTokens.colors.surfaceHighlight}; box-shadow: ${aisTokens.effects.cardShadow};">
        <h2 class="gsap-stat-value" style="font-size: ${aisTokens.typography.hero.fontSize}; font-weight: ${aisTokens.typography.hero.fontWeight}; color: ${aisTokens.colors.primary}; text-shadow: ${aisTokens.effects.glowStrong}; margin: 0; line-height: 1;">
          ${value}
        </h2>
        <div class="gsap-stat-label" style="font-size: ${aisTokens.typography.label.fontSize}; color: ${aisTokens.colors.textSecondary}; text-transform: uppercase; letter-spacing: 0.1em; margin-top: ${aisTokens.spacing.xs};">
          ${escapeHtml(label)}
        </div>
      </div>
    </div>
  `;
}
