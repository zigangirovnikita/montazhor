import type { VideoRegion } from "@/server/video/profile";

export function infographicPanelStyles(region: VideoRegion) {
  const titleSize = region.width >= region.height ? "68px" : "62px";

  return `
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          width: ${region.width}px;
          height: ${region.height}px;
          overflow: hidden;
          background: #0d1117;
        }
        #infographic-panel {
          width: ${region.width}px;
          height: ${region.height}px;
          overflow: hidden;
          color: #f8f4ec;
          font-family: "HF Onest", Arial, sans-serif;
          background:
            radial-gradient(circle at 18% 18%, rgba(100, 218, 193, 0.18), transparent 28%),
            radial-gradient(circle at 84% 80%, rgba(255, 108, 54, 0.18), transparent 34%),
            linear-gradient(180deg, #0b1016 0%, #10161f 100%);
        }
        .stage {
          position: relative;
          width: 100%;
          height: 100%;
          padding: 42px;
          overflow: hidden;
        }
        .ambient {
          position: absolute;
          border-radius: 999px;
          filter: blur(42px);
          opacity: 0.58;
          pointer-events: none;
        }
        .ambient-a {
          top: -8%;
          right: -4%;
          width: 32%;
          height: 26%;
          background: rgba(105, 212, 192, 0.34);
        }
        .ambient-b {
          left: -6%;
          bottom: -10%;
          width: 36%;
          height: 30%;
          background: rgba(255, 90, 54, 0.26);
        }
        .grid-bg {
          position: absolute;
          inset: 0;
          opacity: 0.14;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.14) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.14) 1px, transparent 1px);
          background-size: 34px 34px;
          mask-image: linear-gradient(180deg, rgba(255, 255, 255, 0.92), transparent 92%);
        }
        .flash {
          position: absolute;
          inset: 0;
          opacity: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.88) 48%, transparent 100%);
          transform: translateX(-120%);
          mix-blend-mode: screen;
          pointer-events: none;
        }
        .frame {
          position: relative;
          width: 100%;
          height: 100%;
          padding: 34px 34px 28px;
          border-radius: 34px;
          border: 1px solid rgba(255, 255, 255, 0.09);
          background: linear-gradient(180deg, rgba(13, 19, 29, 0.82) 0%, rgba(15, 24, 34, 0.92) 100%);
          box-shadow: 0 26px 70px rgba(0, 0, 0, 0.28);
          backdrop-filter: blur(18px);
          overflow: hidden;
        }
        .frame::before {
          content: "";
          position: absolute;
          inset: 0 0 auto;
          height: 5px;
          background: linear-gradient(90deg, #69d4c0 0%, #ff8c42 100%);
          opacity: 0.9;
        }
        .frame[data-kind="checklist"]::before {
          background: linear-gradient(90deg, #69d4c0 0%, #e9fdf7 100%);
        }
        .frame[data-kind="warning"]::before {
          background: linear-gradient(90deg, #ff8c42 0%, #ffd38f 100%);
        }
        .frame-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
        }
        .eyebrow-wrap {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .icon-badge,
        .callout-icon,
        .connector-arrow {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .icon-badge {
          width: 48px;
          height: 48px;
          border-radius: 16px;
          color: #0b1117;
          background: linear-gradient(135deg, #69d4c0 0%, #d9fff8 100%);
          box-shadow: 0 12px 28px rgba(105, 212, 192, 0.24);
          flex: 0 0 auto;
        }
        .icon-badge svg,
        .callout-icon svg,
        .connector-arrow svg {
          width: 24px;
          height: 24px;
          stroke: currentColor;
        }
        .eyebrow {
          margin: 0;
          color: rgba(237, 241, 247, 0.72);
          font-family: "HF Manrope", Arial, sans-serif;
          font-size: 24px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .metric-card {
          min-width: 180px;
          padding: 18px 18px 16px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          gap: 6px;
          text-align: right;
        }
        .metric-value {
          font-family: "HF Unbounded", Arial, sans-serif;
          font-size: 34px;
          line-height: 1;
          color: #ffffff;
        }
        .metric-label {
          color: rgba(237, 241, 247, 0.7);
          font-size: 17px;
          line-height: 1.2;
        }
        #title {
          margin: 22px 0 0;
          max-width: 92%;
          font-family: "HF Montserrat", Arial, sans-serif;
          font-size: ${titleSize};
          line-height: 0.98;
          letter-spacing: -0.04em;
          text-wrap: balance;
        }
        .content-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(260px, 0.9fr);
          gap: 22px;
          align-items: stretch;
          margin-top: 26px;
          height: calc(100% - 184px);
        }
        #points {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        #points li {
          position: relative;
          padding: 18px 20px 18px 56px;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.055);
          border: 1px solid rgba(255, 255, 255, 0.07);
          font-size: 28px;
          line-height: 1.18;
          color: #f6f3ee;
        }
        #points li::before {
          content: "";
          position: absolute;
          left: 18px;
          top: 18px;
          width: 24px;
          height: 24px;
          border-radius: 999px;
          background: linear-gradient(135deg, #69d4c0 0%, #d9fff8 100%);
          box-shadow: 0 8px 22px rgba(105, 212, 192, 0.25);
        }
        .frame[data-kind="warning"] #points li::before {
          background: linear-gradient(135deg, #ff8c42 0%, #ffe7b8 100%);
          box-shadow: 0 8px 22px rgba(255, 140, 66, 0.22);
        }
        .visual-panel {
          display: grid;
          grid-template-rows: 1fr auto auto;
          gap: 16px;
          min-height: 0;
        }
        .visual {
          position: relative;
          min-height: 0;
          border-radius: 28px;
          padding: 22px 20px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.03));
          border: 1px solid rgba(255, 255, 255, 0.08);
          overflow: hidden;
        }
        .mini-chart {
          position: absolute;
          left: 18px;
          right: 18px;
          bottom: 20px;
          display: flex;
          align-items: end;
          gap: 14px;
          height: 44%;
        }
        .bar {
          flex: 1 1 0;
          border-radius: 16px 16px 8px 8px;
          background: linear-gradient(180deg, rgba(105, 212, 192, 0.34), rgba(105, 212, 192, 0.92));
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22);
        }
        .bar-a { height: 38%; }
        .bar-b { height: 62%; }
        .bar-c { height: 86%; }
        .trend-line {
          position: absolute;
          inset: 18px;
          opacity: 0.98;
        }
        .trend-line svg {
          width: 100%;
          height: 100%;
        }
        .trend-path {
          fill: none;
          stroke: rgba(255, 255, 255, 0.38);
          stroke-width: 4;
          stroke-linecap: round;
        }
        .trend-glow {
          fill: none;
          stroke: #69d4c0;
          stroke-width: 6;
          stroke-linecap: round;
          filter: drop-shadow(0 0 12px rgba(105, 212, 192, 0.5));
        }
        .frame[data-kind="warning"] .trend-glow {
          stroke: #ff8c42;
          filter: drop-shadow(0 0 12px rgba(255, 140, 66, 0.48));
        }
        .connector {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 8px;
        }
        .connector-line {
          flex: 1 1 auto;
          height: 2px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(105, 212, 192, 0.12), rgba(105, 212, 192, 0.9));
        }
        .frame[data-kind="warning"] .connector-line {
          background: linear-gradient(90deg, rgba(255, 140, 66, 0.12), rgba(255, 140, 66, 0.94));
        }
        .connector-arrow {
          width: 40px;
          height: 40px;
          color: #69d4c0;
        }
        .frame[data-kind="warning"] .connector-arrow {
          color: #ffb36d;
        }
        .callout-card {
          display: grid;
          grid-template-columns: 48px minmax(0, 1fr);
          align-items: center;
          gap: 14px;
          padding: 16px 18px;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.055);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .callout-icon {
          width: 48px;
          height: 48px;
          border-radius: 16px;
          color: #0b1117;
          background: linear-gradient(135deg, #ff8c42 0%, #ffe4be 100%);
        }
        .frame[data-kind="checklist"] .callout-icon {
          background: linear-gradient(135deg, #69d4c0 0%, #ddfff8 100%);
        }
        .callout-card p {
          margin: 0;
          font-size: 23px;
          line-height: 1.18;
          color: #f5f1ea;
        }`;
}
