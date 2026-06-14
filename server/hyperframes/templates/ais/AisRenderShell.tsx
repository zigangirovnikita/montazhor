import React from "react";
import { aisTokens } from "./designTokens";
import { HookFlash } from "./components/HookFlash";
import { SideCallout } from "./components/SideCallout";
import { StatMeter } from "./components/StatMeter";
import { GoldenRatioSidebar } from "./components/GoldenRatioSidebar";
import { MythStrike } from "./components/MythStrike";
import { BeforeAfter } from "./components/BeforeAfter";
import { StepsCards } from "./components/StepsCards";
import { TrustMap } from "./components/TrustMap";
import { WarningDialogue } from "./components/WarningDialogue";
import { QuoteFlash } from "./components/QuoteFlash";
import { CtaFlash } from "./components/CtaFlash";

export interface AisRenderShellProps {
  templateId: string;
  slots: Record<string, unknown>;
  visualWeight: string;
  layout: string;
  width: number;
  height: number;
}

export const AisRenderShell: React.FC<AisRenderShellProps> = ({
  templateId,
  slots,
  visualWeight,
  layout,
  width,
  height
}) => {
  const containerStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width,
    height,
    overflow: "hidden",
    fontFamily: aisTokens.typography.fontFamily,
    color: aisTokens.colors.textPrimary,
    boxSizing: "border-box"
  };

  // Switch based on templateId
  let Content = null;
  switch (templateId) {
    case "ais.hook_flash.v1":
      Content = <HookFlash slots={slots} />;
      break;
    case "ais.side_callout.v1":
      Content = <SideCallout slots={slots} />;
      break;
    case "ais.stat_meter.v1":
      Content = <StatMeter slots={slots} />;
      break;
    case "ais.golden_ratio_sidebar.v1":
      Content = <GoldenRatioSidebar slots={slots} />;
      break;
    case "ais.myth_strike_overlay.v1":
      Content = <MythStrike slots={slots} />;
      break;
    case "ais.before_after.v1":
      Content = <BeforeAfter slots={slots} />;
      break;
    case "ais.steps_cards.v1":
      Content = <StepsCards slots={slots} />;
      break;
    case "ais.trust_map.v1":
      Content = <TrustMap slots={slots} />;
      break;
    case "ais.warning_dialogue.v1":
      Content = <WarningDialogue slots={slots} />;
      break;
    case "ais.quote_flash.v1":
      Content = <QuoteFlash slots={slots} />;
      break;
    case "ais.cta_flash.v1":
      Content = <CtaFlash slots={slots} />;
      break;
    default:
      Content = <div style={{ padding: 40 }}>Unknown template: {templateId}</div>;
  }

  // Handle generic background/layout if needed, though most components draw their own.
  // Fullscreen components often want a dark background
  const needsDarkBg = layout === "fullscreen" || layout === "side_panel";

  return (
    <div style={{ ...containerStyle, backgroundColor: needsDarkBg ? aisTokens.colors.background : "transparent" }}>
      {Content}
    </div>
  );
};
