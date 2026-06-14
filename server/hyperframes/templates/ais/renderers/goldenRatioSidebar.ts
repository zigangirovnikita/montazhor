import { aisTokens } from "../designTokens";

export function renderGoldenRatioSidebar(slots: Record<string, any>, width: number, height: number): string {
  const title = slots.title || "LESSON";
  const body = slots.body || "Content";

  // Using a side_panel layout which covers the right side completely
  return `
    <div style="position: absolute; top: 0; left: 0; width: ${width}px; height: ${height}px; font-family: ${aisTokens.typography.fontFamily}; box-sizing: border-box; display: flex;">
      <div style="flex: 2;"></div>
      <div class="gsap-sidebar" style="flex: 1; background-color: ${aisTokens.colors.background}; border-left: 2px solid ${aisTokens.colors.surfaceHighlight}; display: flex; flex-direction: column; justify-content: center; padding: ${aisTokens.spacing.lg}; box-shadow: ${aisTokens.effects.cardShadow}; z-index: 10;">
        <h3 class="gsap-sidebar-title" style="font-size: ${aisTokens.typography.subtitle.fontSize}; font-weight: ${aisTokens.typography.subtitle.fontWeight}; color: ${aisTokens.colors.primary}; margin: 0 0 ${aisTokens.spacing.sm} 0; text-shadow: ${aisTokens.effects.glowMild};">
          ${title}
        </h3>
        <p class="gsap-sidebar-body" style="font-size: ${aisTokens.typography.body.fontSize}; color: ${aisTokens.colors.textPrimary}; line-height: ${aisTokens.typography.body.lineHeight}; margin: 0;">
          ${body}
        </p>
      </div>
    </div>
  `;
}
