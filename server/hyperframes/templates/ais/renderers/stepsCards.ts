import { aisTokens } from "../designTokens";

export function renderStepsCards(slots: Record<string, any>, width: number, height: number): string {
  const steps = Array.isArray(slots.steps) ? slots.steps : ["Step 1", "Step 2", "Step 3"];

  const stepHtml = steps.map((step, idx) => `
    <div class="gsap-step" style="background-color: ${aisTokens.colors.surface}; border: 1px solid ${aisTokens.colors.surfaceHighlight}; border-radius: ${aisTokens.borders.radiusMd}; padding: ${aisTokens.spacing.md} ${aisTokens.spacing.lg}; display: flex; align-items: center; gap: ${aisTokens.spacing.md}; box-shadow: ${aisTokens.effects.cardShadow}; width: 100%; max-width: 800px; margin-bottom: ${aisTokens.spacing.sm};">
      <div style="width: 48px; height: 48px; border-radius: 24px; background-color: ${aisTokens.colors.primary}; color: ${aisTokens.colors.background}; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; flex-shrink: 0; box-shadow: ${aisTokens.effects.glowMild};">
        ${idx + 1}
      </div>
      <div style="font-size: ${aisTokens.typography.body.fontSize}; color: ${aisTokens.colors.textPrimary}; font-weight: ${aisTokens.typography.body.fontWeight};">
        ${step}
      </div>
    </div>
  `).join("");

  return `
    <div style="position: absolute; top: 0; left: 0; width: ${width}px; height: ${height}px; background-color: ${aisTokens.colors.background}; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: ${aisTokens.typography.fontFamily}; padding: ${aisTokens.spacing.xl}; box-sizing: border-box;">
      <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
        ${stepHtml}
      </div>
    </div>
  `;
}
