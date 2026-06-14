import { aisTokens, escapeHtml } from "../designTokens";

export function renderSideCallout(slots: Record<string, any>, width: number, height: number): string {
  const text = slots.text || "CALLOUT";

  return `
    <div style="position: absolute; top: 0; left: 0; width: ${width}px; height: ${height}px; display: flex; flex-direction: column; justify-content: center; align-items: flex-end; padding-right: ${aisTokens.spacing.xl}; font-family: ${aisTokens.typography.fontFamily}; box-sizing: border-box;">
      <div class="gsap-card" style="background-color: ${aisTokens.colors.surface}; border-left: 4px solid ${aisTokens.colors.primary}; padding: ${aisTokens.spacing.md}; border-radius: 0 ${aisTokens.borders.radiusMd} ${aisTokens.borders.radiusMd} 0; box-shadow: ${aisTokens.effects.cardShadow}; max-width: 40%;">
        <p style="font-size: ${aisTokens.typography.body.fontSize}; color: ${aisTokens.colors.textPrimary}; margin: 0; line-height: ${aisTokens.typography.body.lineHeight}; text-shadow: ${aisTokens.effects.glowMild};">
          ${escapeHtml(text)}
        </p>
      </div>
    </div>
  `;
}
