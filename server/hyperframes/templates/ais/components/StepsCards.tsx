import React from "react";
import { aisTokens } from "../designTokens";

export const StepsCards: React.FC<{ slots: Record<string, any> }> = ({ slots }) => {
  return (
    <div style={{
      padding: aisTokens.spacing.xl,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      height: '100%',
      width: '100%'
    }}>
      <h1 style={{ ...aisTokens.typography.title, color: aisTokens.colors.primary, textShadow: aisTokens.effects.glowStrong }}>
        {slots.title || slots.eyebrow || slots.quote || slots.wrong || slots.action || "StepsCards"}
      </h1>
      <p style={{ ...aisTokens.typography.subtitle, color: aisTokens.colors.textSecondary }}>
        {slots.text || slots.body || slots.right || slots.message || slots.before || slots.after || JSON.stringify(slots)}
      </p>
    </div>
  );
};
