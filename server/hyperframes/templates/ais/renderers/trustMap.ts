import { aisTokens, escapeHtml } from "../designTokens";
import { slotString, type SlotMap } from "./slotTypes";

export function renderTrustMap(slots: SlotMap, width: number, height: number): string {
  const centerEntity = slotString(slots, "centerEntity", "CORE");
  const nodes = Array.isArray(slots.nodes) ? slots.nodes : ["A", "B", "C", "D"];

  // Very simplified radial layout CSS
  const nodeHtml = nodes.map((node, idx) => {
    const angle = (idx / nodes.length) * 2 * Math.PI;
    const radius = 250;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    return `
      <div class="gsap-node" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) translate(${x}px, ${y}px); background-color: ${aisTokens.colors.surfaceHighlight}; padding: ${aisTokens.spacing.sm} ${aisTokens.spacing.md}; border-radius: ${aisTokens.borders.radiusSm}; border: 1px solid ${aisTokens.colors.border}; font-size: ${aisTokens.typography.label.fontSize}; color: ${aisTokens.colors.textSecondary}; white-space: nowrap;">
        ${escapeHtml(node)}
      </div>
    `;
  }).join("");

  return `
    <div style="position: absolute; top: 0; left: 0; width: ${width}px; height: ${height}px; background-color: ${aisTokens.colors.background}; font-family: ${aisTokens.typography.fontFamily}; overflow: hidden; box-sizing: border-box;">
      <div style="position: absolute; top: 50%; left: 50%; width: 100%; height: 100%; transform: translate(-50%, -50%); pointer-events: none; opacity: 0.1; background-image: radial-gradient(${aisTokens.colors.primary} 1px, transparent 1px); background-size: 40px 40px;"></div>
      
      <div class="gsap-nodes-container" style="position: relative; width: 100%; height: 100%;">
        ${nodeHtml}
        <div class="gsap-center" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: ${aisTokens.colors.surface}; border: 2px solid ${aisTokens.colors.primary}; padding: ${aisTokens.spacing.md} ${aisTokens.spacing.lg}; border-radius: ${aisTokens.borders.radiusMd}; font-size: ${aisTokens.typography.subtitle.fontSize}; font-weight: bold; color: ${aisTokens.colors.textPrimary}; box-shadow: ${aisTokens.effects.glowMild}; text-shadow: ${aisTokens.effects.glowStrong};">
          ${escapeHtml(centerEntity)}
        </div>
      </div>
    </div>
  `;
}
