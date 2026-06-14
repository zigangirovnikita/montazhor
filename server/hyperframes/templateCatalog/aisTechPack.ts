import type { MotionTemplateDefinition } from "@/lib/types/visual";

export const aisTechPack: MotionTemplateDefinition[] = [
  {
    id: "ais.hook_flash.v1",
    label: "Hook Flash",
    family: "hook",
    visualWeight: "full",
    layout: "fullscreen",
    duration: { min: 1.0, max: 4.0, ideal: 2.0 },
    slots: [
      { name: "eyebrow", type: "short_text", required: false, maxWords: 5 },
      { name: "title", type: "short_text", required: true, maxWords: 6 }
    ],
    safeZones: { avoidFace: false, preferredArea: "full" },
    render: "hyperframes",
    component: "HookFlash",
    version: "v1"
  },
  {
    id: "ais.side_callout.v1",
    label: "Side Callout",
    family: "stat",
    visualWeight: "callout",
    layout: "overlay_right",
    duration: { min: 2.0, max: 6.0, ideal: 3.5 },
    slots: [
      { name: "text", type: "short_text", required: true, maxWords: 10 }
    ],
    safeZones: { avoidFace: true, preferredArea: "right" },
    render: "hyperframes",
    component: "SideCallout",
    version: "v1"
  },
  {
    id: "ais.stat_meter.v1",
    label: "Stat Meter",
    family: "stat",
    visualWeight: "medium",
    layout: "overlay_left",
    duration: { min: 2.0, max: 5.0, ideal: 3.0 },
    slots: [
      { name: "value", type: "number", required: true, maxWords: 2 },
      { name: "label", type: "short_text", required: true, maxWords: 5 }
    ],
    safeZones: { avoidFace: true, preferredArea: "left" },
    render: "hyperframes",
    component: "StatMeter",
    version: "v1"
  },
  {
    id: "ais.golden_ratio_sidebar.v1",
    label: "Golden Ratio Sidebar",
    family: "lesson",
    visualWeight: "medium",
    layout: "side_panel",
    duration: { min: 3.0, max: 8.0, ideal: 5.0 },
    slots: [
      { name: "title", type: "short_text", required: true, maxWords: 5 },
      { name: "body", type: "short_text", required: true, maxWords: 15 }
    ],
    safeZones: { avoidFace: true, preferredArea: "right" },
    render: "hyperframes",
    component: "GoldenRatioSidebar",
    version: "v1"
  },
  {
    id: "ais.myth_strike_overlay.v1",
    label: "Myth Strike",
    family: "myth",
    visualWeight: "medium",
    layout: "overlay_left",
    duration: { min: 2.5, max: 6.0, ideal: 4.0 },
    slots: [
      { name: "wrong", type: "short_text", required: true, maxWords: 8 },
      { name: "right", type: "short_text", required: true, maxWords: 8 }
    ],
    safeZones: { avoidFace: true, preferredArea: "left" },
    render: "hyperframes",
    component: "MythStrike",
    version: "v1"
  },
  {
    id: "ais.before_after.v1",
    label: "Before / After",
    family: "compare",
    visualWeight: "full",
    layout: "fullscreen",
    duration: { min: 3.0, max: 7.0, ideal: 5.0 },
    slots: [
      { name: "before", type: "short_text", required: true, maxWords: 6 },
      { name: "after", type: "short_text", required: true, maxWords: 6 }
    ],
    safeZones: { avoidFace: false, preferredArea: "full" },
    render: "hyperframes",
    component: "BeforeAfter",
    version: "v1"
  },
  {
    id: "ais.steps_cards.v1",
    label: "Steps Cards",
    family: "steps",
    visualWeight: "full",
    layout: "fullscreen",
    duration: { min: 4.0, max: 10.0, ideal: 6.0 },
    slots: [
      { name: "steps", type: "list", required: true, maxItems: 3, maxWords: 8 }
    ],
    safeZones: { avoidFace: false, preferredArea: "full" },
    render: "hyperframes",
    component: "StepsCards",
    version: "v1"
  },
  {
    id: "ais.trust_map.v1",
    label: "Trust Map",
    family: "stat",
    visualWeight: "full",
    layout: "fullscreen",
    duration: { min: 3.0, max: 8.0, ideal: 5.0 },
    slots: [
      { name: "centerEntity", type: "short_text", required: true, maxWords: 4 },
      { name: "nodes", type: "list", required: true, maxItems: 5, maxWords: 3 }
    ],
    safeZones: { avoidFace: false, preferredArea: "full" },
    render: "hyperframes",
    component: "TrustMap",
    version: "v1"
  },
  {
    id: "ais.warning_dialogue.v1",
    label: "Warning Dialogue",
    family: "dialogue",
    visualWeight: "medium",
    layout: "overlay_right",
    duration: { min: 3.0, max: 6.0, ideal: 4.0 },
    slots: [
      { name: "speaker", type: "short_text", required: false, maxWords: 3 },
      { name: "message", type: "short_text", required: true, maxWords: 12 }
    ],
    safeZones: { avoidFace: true, preferredArea: "right" },
    render: "hyperframes",
    component: "WarningDialogue",
    version: "v1"
  },
  {
    id: "ais.quote_flash.v1",
    label: "Quote Flash",
    family: "quote",
    visualWeight: "medium",
    layout: "overlay_left",
    duration: { min: 2.0, max: 6.0, ideal: 4.0 },
    slots: [
      { name: "quote", type: "short_text", required: true, maxWords: 15 }
    ],
    safeZones: { avoidFace: true, preferredArea: "left" },
    render: "hyperframes",
    component: "QuoteFlash",
    version: "v1"
  },
  {
    id: "ais.cta_flash.v1",
    label: "CTA Flash",
    family: "cta",
    visualWeight: "full",
    layout: "fullscreen",
    duration: { min: 3.0, max: 6.0, ideal: 4.0 },
    slots: [
      { name: "action", type: "short_text", required: true, maxWords: 5 },
      { name: "target", type: "short_text", required: false, maxWords: 6 }
    ],
    safeZones: { avoidFace: false, preferredArea: "full" },
    render: "hyperframes",
    component: "CtaFlash",
    version: "v1"
  }
];
