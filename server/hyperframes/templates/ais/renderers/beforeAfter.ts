import { aisTokens } from "../designTokens";

export function renderBeforeAfter(slots: Record<string, any>, width: number, height: number): string {
  const before = slots.before || "BEFORE";
  const after = slots.after || "AFTER";

  return `
    <div style="position: absolute; top: 0; left: 0; width: ${width}px; height: ${height}px; background-color: ${aisTokens.colors.background}; display: flex; font-family: ${aisTokens.typography.fontFamily}; box-sizing: border-box;">
      <div class="gsap-before" style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; border-right: 1px solid ${aisTokens.colors.border}; padding: ${aisTokens.spacing.xl}; text-align: center;">
        <div style="font-size: ${aisTokens.typography.label.fontSize}; color: ${aisTokens.colors.textSecondary}; text-transform: uppercase; margin-bottom: ${aisTokens.spacing.sm};">Было</div>
        <div style="font-size: ${aisTokens.typography.subtitle.fontSize}; color: ${aisTokens.colors.error}; font-weight: ${aisTokens.typography.subtitle.fontWeight}; opacity: 0.8;">
          ${before}
        </div>
      </div>
      <div class="gsap-after" style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: ${aisTokens.spacing.xl}; text-align: center; background: radial-gradient(circle at center, rgba(0, 212, 255, 0.1) 0%, transparent 70%);">
        <div style="font-size: ${aisTokens.typography.label.fontSize}; color: ${aisTokens.colors.primary}; text-transform: uppercase; margin-bottom: ${aisTokens.spacing.sm}; text-shadow: ${aisTokens.effects.glowMild};">Стало</div>
        <div style="font-size: ${aisTokens.typography.subtitle.fontSize}; color: ${aisTokens.colors.textPrimary}; font-weight: ${aisTokens.typography.subtitle.fontWeight}; text-shadow: ${aisTokens.effects.glowStrong};">
          ${after}
        </div>
      </div>
    </div>
  `;
}
