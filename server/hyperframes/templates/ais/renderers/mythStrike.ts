import { aisTokens, escapeHtml } from "../designTokens";

export function renderMythStrike(slots: Record<string, any>, width: number, height: number): string {
  const wrong = slots.wrong || "MYTH";
  const right = slots.right || "FACT";

  return `
    <div style="position: absolute; top: 0; left: 0; width: ${width}px; height: ${height}px; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; padding-left: ${aisTokens.spacing.xl}; font-family: ${aisTokens.typography.fontFamily}; box-sizing: border-box;">
      <div style="display: flex; flex-direction: column; gap: ${aisTokens.spacing.md};">
        <div class="gsap-wrong" style="font-size: ${aisTokens.typography.subtitle.fontSize}; font-weight: ${aisTokens.typography.subtitle.fontWeight}; color: ${aisTokens.colors.error}; position: relative; display: inline-block; padding: ${aisTokens.spacing.xs} ${aisTokens.spacing.sm}; background-color: rgba(255, 71, 87, 0.1); border-radius: ${aisTokens.borders.radiusSm}; text-shadow: 0 0 10px rgba(255, 71, 87, 0.4);">
          <span style="text-decoration: line-through;">${escapeHtml(wrong)}</span>
        </div>
        <div class="gsap-right" style="font-size: ${aisTokens.typography.title.fontSize}; font-weight: ${aisTokens.typography.title.fontWeight}; color: ${aisTokens.colors.success}; padding: ${aisTokens.spacing.xs} ${aisTokens.spacing.sm}; background-color: rgba(46, 213, 115, 0.1); border-radius: ${aisTokens.borders.radiusSm}; text-shadow: 0 0 20px rgba(46, 213, 115, 0.4);">
          ${escapeHtml(right)}
        </div>
      </div>
    </div>
  `;
}
