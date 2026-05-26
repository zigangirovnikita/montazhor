export function hookTemplate(text: string, preset: string) {
  return baseTemplate("hook-title", text, preset, "AI REEL AUTOPILOT");
}

export function baseTemplate(id: string, text: string, preset: string, label: string) {
  const accent = preset === "dynamic_viral" ? "#ffb84d" : preset === "premium_calm" ? "#d8c5a1" : "#69d4c0";
  return `<!doctype html>
<html>
  <body>
    <div data-composition-id="${id}" data-width="1080" data-height="1920">
      <main class="scene">
        <p>${escapeHtml(label)}</p>
        <h1>${escapeHtml(text)}</h1>
      </main>
      <style>
        body { margin: 0; background: #101312; }
        [data-composition-id="${id}"] { width: 1080px; height: 1920px; background: radial-gradient(circle at 20% 20%, ${accent}55, transparent 34%), #101312; color: #f5efe4; font-family: Arial, sans-serif; overflow: hidden; }
        .scene { height: 100%; box-sizing: border-box; padding: 220px 96px; display: flex; flex-direction: column; justify-content: center; gap: 28px; }
        p { color: ${accent}; font-size: 34px; letter-spacing: .16em; margin: 0; text-transform: uppercase; }
        h1 { font-size: 92px; line-height: .96; letter-spacing: -0.06em; margin: 0; max-width: 900px; }
      </style>
      <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
      <script>
        window.__timelines = window.__timelines || {};
        const tl = gsap.timeline({ paused: true });
        tl.from("p", { y: 40, opacity: 0, duration: 0.4, ease: "power3.out" }, 0);
        tl.from("h1", { y: 80, opacity: 0, duration: 0.6, ease: "power3.out" }, 0.12);
        tl.to(".scene", { opacity: 0, duration: 0.25, ease: "power2.in" }, 1.45);
        window.__timelines["${id}"] = tl;
      </script>
    </div>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
