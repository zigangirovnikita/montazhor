export function infographicPanelRuntime(payload: string, icons: string, safeDuration: number) {
  return `
        (() => {
          window.__timelines = window.__timelines || {};
          const CARDS = ${payload};
          const ICONS = ${icons};
          const frame = document.querySelector(".frame");
          const flash = document.querySelector(".flash");
          const eyebrow = document.getElementById("eyebrow");
          const eyebrowIcon = document.getElementById("eyebrow-icon");
          const title = document.getElementById("title");
          const metricValue = document.getElementById("metric-value");
          const metricLabel = document.getElementById("metric-label");
          const points = document.getElementById("points");
          const callout = document.getElementById("callout");
          const calloutIcon = document.getElementById("callout-icon");
          const connectorArrow = document.getElementById("connector-arrow");
          const tl = gsap.timeline({ paused: true });
          const cardDuration = Math.max(1.2, ${safeDuration.toFixed(3)} / Math.max(CARDS.length, 1));

          CARDS.forEach((card, index) => {
            const start = index * cardDuration;
            tl.call(() => renderCard(card), [], start);
            tl.fromTo(".frame", { opacity: 0.78, y: 26, scale: 0.985 }, { opacity: 1, y: 0, scale: 1, duration: 0.42, ease: "power3.out" }, start);
            tl.fromTo(".eyebrow-wrap, .metric-card", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.24, ease: "power2.out" }, start + 0.04);
            tl.fromTo("#title", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.34, ease: "power3.out" }, start + 0.08);
            tl.fromTo("#points li", { opacity: 0, x: -18 }, { opacity: 1, x: 0, duration: 0.24, stagger: 0.08, ease: "power2.out" }, start + 0.16);
            tl.fromTo(".visual, .connector, .callout-card", { opacity: 0, x: 18 }, { opacity: 1, x: 0, duration: 0.26, stagger: 0.07, ease: "power2.out" }, start + 0.18);
            tl.fromTo(".bar", { scaleY: 0.45, transformOrigin: "50% 100%" }, { scaleY: 1, duration: 0.42, stagger: 0.06, ease: "power2.out" }, start + 0.24);
            tl.fromTo(".trend-glow", { strokeDasharray: 500, strokeDashoffset: 500 }, { strokeDashoffset: 0, duration: 0.52, ease: "power2.out" }, start + 0.24);
            tl.fromTo(".connector-line", { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: 0.28, ease: "power2.out" }, start + 0.3);
            tl.fromTo(".connector-arrow", { x: -10, opacity: 0 }, { x: 0, opacity: 1, duration: 0.2, ease: "power2.out" }, start + 0.42);

            const transitionStart = Math.max(start + cardDuration - 0.28, start + 0.8);
            tl.fromTo(flash, { opacity: 0, xPercent: -110 }, { opacity: 0.78, xPercent: 120, duration: 0.24, ease: "power2.inOut" }, transitionStart);
            tl.set(flash, { opacity: 0, xPercent: -110 }, transitionStart + 0.24);
            tl.to(".frame", { opacity: 0.92, y: -12, duration: 0.16, ease: "power2.in" }, Math.max(start, start + cardDuration - 0.18));
          });

          function renderCard(card) {
            frame.dataset.kind = card.kind;
            eyebrow.textContent = card.eyebrow;
            eyebrowIcon.innerHTML = iconMarkup(card.icon);
            title.textContent = card.title;
            metricValue.textContent = card.metricValue;
            metricLabel.textContent = card.metricLabel;
            callout.textContent = card.callout;
            calloutIcon.innerHTML = iconMarkup(card.kind === "warning" ? "triangle-alert" : "message-square-more");
            connectorArrow.innerHTML = ICONS.arrowRight;
            points.innerHTML = "";

            for (const point of card.points) {
              const item = document.createElement("li");
              item.textContent = point;
              points.appendChild(item);
            }
          }

          function iconMarkup(name) {
            if (name === "trending-up") return ICONS.trendingUp;
            if (name === "badge-check") return ICONS.badgeCheck;
            if (name === "triangle-alert") return ICONS.triangleAlert;
            return ICONS.messageSquareMore;
          }

          renderCard(CARDS[0] || {
            kind: "signal",
            eyebrow: "Ключевая мысль",
            title: "Главная идея",
            points: ["Смотри до конца"],
            metricValue: "01",
            metricLabel: "сигнал",
            callout: "Сохрани эту мысль",
            icon: "trending-up"
          });
          tl.seek(0);
          window.__timelines["infographic-panel"] = tl;
        })();`;
}
