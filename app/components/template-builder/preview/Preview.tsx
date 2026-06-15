import type { CSSProperties, PointerEvent, RefObject } from "react";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import type { TemplateBlockBase, VisualTemplateData } from "@/lib/templateBuilder";
import { applyOpacity } from "../utils/colorUtils";
import { OverlayContent } from "./OverlayContent";
import styles from "../../TemplateBuilder.module.css";

// Helper to reliably get a number value
function numberValue(val: unknown, fallback: number): number {
  if (typeof val === "number" && !isNaN(val)) return val;
  return fallback;
}

type TweenVars = Record<string, string | number>;

export function Preview({
  block,
  theme,
  kind,
  dragEnabled,
  stageRef,
  onPointerDown,
  onPointerMove,
  animationTrigger,
  onReplay
}: {
  block: TemplateBlockBase & Record<string, unknown>;
  theme: VisualTemplateData["theme"];
  kind: "title" | "text" | "number" | "chart" | "list" | "accent" | "surface" | "cta";
  dragEnabled: boolean;
  stageRef: RefObject<HTMLDivElement | null>;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  animationTrigger: number;
  onReplay: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const fontSize = numberValue(block.fontSize, numberValue((block.number as Record<string, unknown>)?.fontSize, numberValue((block.headline as Record<string, unknown>)?.fontSize, 58)));
  const weight = numberValue(block.fontWeight, numberValue((block.number as Record<string, unknown>)?.fontWeight, numberValue((block.headline as Record<string, unknown>)?.fontWeight, 900)));
  const position = block.position;

  const bgOpacity = block.surfaceOpacity !== undefined && block.surfaceOpacity !== null
    ? block.surfaceOpacity
    : (block.surface === "glass" ? 0.28 : 0.82);
  const rawBgColor = block.colorBackground ?? theme.colorBackground;
  const backgroundColor = block.surface === "none"
    ? "transparent"
    : applyOpacity(rawBgColor, bgOpacity);

  const overlayStyle = {
    left: `${position.x}%`,
    top: `${position.y}%`,
    color: block.colorText ?? theme.colorText,
    backgroundColor,
    borderColor: block.borderColor ?? block.colorAccent ?? theme.colorPrimary,
    borderRadius: block.borderRadius,
    padding: block.padding,
    "--overlay-scale": 0.58,
    "--anchor-x": position.anchor === "right" ? "-100%" : position.anchor === "center" || position.anchor === "bottom" ? "-50%" : "0%",
    "--anchor-y": position.anchor === "bottom" || position.anchor === "center" ? "-50%" : "0%",
    "--color-accent": block.colorAccent ?? theme.colorPrimary,
    "--accent": block.colorAccent ?? theme.colorPrimary
  } as CSSProperties;

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.killTweensOf(el);
      const targets = gsap.utils.toArray(el.querySelectorAll(".keyword, .number-value, .bullet-card, .check-item, .bar, .keyword-line, .truth-word, .myth-word, .stat-row, .concept-center, .concept-node, .lesson-title, .lesson-subtext"));
      if (targets.length > 0) {
        gsap.killTweensOf(targets);
      }

      gsap.set(el, { opacity: 0, y: 0, x: 0, scale: 0.58 });
      if (targets.length > 0) {
        gsap.set(targets, { opacity: 0, y: 0, x: 0, scale: 1, rotate: 0, scaleY: 1, "--strike-scale": 0, "--shine-x": "-130%" });
      }

      const tl = gsap.timeline();
      const animSpeed = block.animationSpeed ?? theme.defaultAnimationSpeed ?? 0.6;
      const durationFactor = Math.max(0.24, 1.3 - animSpeed * 0.95);
      const animationIn = block.animationIn ?? "glass_slide";

      let enterFrom: TweenVars = { opacity: 0, y: 28, scale: 0.56 };
      let enterTo: TweenVars = { opacity: 1, y: 0, scale: 0.58, ease: "power3.out" };
      let enterDuration = 0.38 * durationFactor;

      if (animationIn === "depth_zoom") {
        enterFrom = { opacity: 0, scale: 0.55, y: 14 };
        enterTo = { opacity: 1, scale: 0.58, y: 0, ease: "expo.out" };
      } else if (animationIn === "calm_fade") {
        enterFrom = { opacity: 0, y: 14, scale: 0.58 };
        enterTo = { opacity: 1, y: 0, scale: 0.58, ease: "power2.out" };
      } else if (animationIn === "word_slam") {
        enterFrom = { opacity: 0, scale: 0.62, y: 0 };
        enterTo = { opacity: 1, scale: 0.58, y: 0, ease: "back.out(1.35)" };
      } else if (animationIn === "soft_pop") {
        enterFrom = { opacity: 0, scale: 0.44, y: 0 };
        enterTo = { opacity: 1, scale: 0.58, y: 0, ease: "back.out(1.2)" };
      } else if (animationIn === "slide-right") {
        enterFrom = { opacity: 0, x: -48, scale: 0.58 };
        enterTo = { opacity: 1, x: 0, scale: 0.58, ease: "power2.out" };
      } else if (animationIn === "fade") {
        enterFrom = { opacity: 0, scale: 0.58 };
        enterTo = { opacity: 1, scale: 0.58, ease: "power1.out" };
      } else if (animationIn === "scale") {
        enterFrom = { opacity: 0, scale: 0.22, y: 0 };
        enterTo = { opacity: 1, scale: 0.58, y: 0, ease: "power2.out" };
      } else if (animationIn === "glass_slide" || animationIn === "slide-up") {
        enterFrom = { opacity: 0, y: 28, scale: 0.58 };
        enterTo = { opacity: 1, y: 0, scale: 0.58, ease: "power3.out" };
      } else if (animationIn === "word-by-word") {
        enterFrom = { opacity: 0, scale: 0.58 };
        enterTo = { opacity: 1, scale: 0.58, ease: "power1.out" };
      } else if (animationIn === "none") {
        enterFrom = { opacity: 0, scale: 0.58 };
        enterTo = { opacity: 1, scale: 0.58, ease: "none" };
        enterDuration = 0.01;
      }

      tl.fromTo(el, enterFrom, {
        ...enterTo,
        duration: enterDuration
      });

      const preset = block.layoutPreset ?? "";

      if (kind === "text" || kind === "surface" || kind === "title") {
        if (preset === "lesson_title_block" || preset === "lesson_title_cinematic") {
          const lTitle = el.querySelector(".lesson-title");
          const lSub = el.querySelector(".lesson-subtext");
          if (lTitle) {
            tl.fromTo(lTitle, { opacity: 0, y: 28, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.38 * durationFactor, ease: "expo.out" }, "-=0.1");
          }
          if (lSub) {
            tl.fromTo(lSub, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.28 * durationFactor, ease: "power2.out" }, "-=0.2");
          }
        } else {
          const words = gsap.utils.toArray(el.querySelectorAll(".phrase-word")) as HTMLElement[];
          if (words.length) {
            
            if (preset === "caption_matrix_decode") {
              words.forEach((word, index) => {
                const offset = enterDuration * 0.6 + index * 0.15 * durationFactor;
                const realEl = word.querySelector(".matrix-real");
                const scr0El = word.querySelector(".matrix-scr0");
                const scr1El = word.querySelector(".matrix-scr1");
                if (realEl && scr0El && scr1El) {
                  tl.set(scr0El, { display: "inline" }, offset);
                  tl.set(scr1El, { display: "inline" }, offset + 0.18 * durationFactor);
                  tl.set(scr0El, { display: "none" }, offset + 0.18 * durationFactor);
                  tl.set(realEl, { visibility: "visible" }, offset + 0.36 * durationFactor);
                  tl.set(scr1El, { display: "none" }, offset + 0.36 * durationFactor);
                }
              });
            } else if (preset === "caption_neon_glow") {
              words.forEach((word, index) => {
                const offset = enterDuration * 0.6 + index * 0.15 * durationFactor;
                const dur = 0.3 * durationFactor;
                const activeColor = word.classList.contains("is-emphasis") ? "var(--color-accent)" : "#00FFF0";
                
                tl.to(word, {
                  color: activeColor,
                  textShadow: `0 0 10px ${activeColor}, 0 0 20px ${activeColor}`,
                  duration: 0.08 * durationFactor
                }, offset);
                
                tl.to(word, {
                  color: "rgba(0, 255, 240, 0.14)",
                  textShadow: "none",
                  duration: 0.08 * durationFactor
                }, offset + dur);
              });
            } else if (preset === "caption_gradient_fill") {
              words.forEach((word, index) => {
                const offset = enterDuration * 0.6 + index * 0.15 * durationFactor;
                const dur = 0.3 * durationFactor;
                
                tl.set(word, { scale: 1.04 }, offset);
                tl.fromTo(word,
                  { backgroundPosition: "45% 0" },
                  { backgroundPosition: "0% 0", duration: dur, ease: "none" },
                  offset
                );
                tl.set(word, { backgroundPosition: "100% 0" }, offset + dur);
                tl.to(word, { scale: 1, duration: 0.15 * durationFactor, ease: "power2.out" }, offset + dur);
              });
            } else if (preset === "kinetic_phrase_slam" || preset === "caption_kinetic_slam") {
              words.forEach((word, index) => {
                const offset = enterDuration * 0.6 + index * 0.15 * durationFactor;
                const dur = 0.3 * durationFactor;
                const activeColor = word.classList.contains("is-emphasis") ? "var(--color-accent)" : "#ffffff";
                
                tl.to(word, {
                  color: activeColor,
                  scale: 1.15,
                  duration: 0.1 * durationFactor,
                  ease: "back.out(2.2)"
                }, offset);
                
                tl.to(word, {
                  color: "rgba(255, 255, 255, 0.4)",
                  scale: 1,
                  duration: 0.12 * durationFactor,
                  ease: "power2.out"
                }, offset + dur);
              });
            } else if (preset === "caption_clip_wipe") {
              words.forEach((word, index) => {
                const offset = enterDuration * 0.6 + index * 0.15 * durationFactor;
                const dur = 0.3 * durationFactor;
                const activeColor = word.classList.contains("is-emphasis") ? "var(--color-accent)" : "#ffffff";
                
                tl.to(word, { clipPath: "inset(0 0% 0 0)", duration: 0.3 * durationFactor, ease: "power2.out" }, offset);
                if (word.classList.contains("is-emphasis")) {
                  tl.to(word, { color: activeColor, duration: 0.05 }, offset + 0.1 * durationFactor);
                }
                tl.to(word, { color: "rgba(255, 255, 255, 0.4)", duration: 0.2 * durationFactor }, offset + dur);
              });
              tl.to(words, { clipPath: "inset(0 0% 0 100%)", duration: 0.25 * durationFactor, stagger: 0.04 * durationFactor, ease: "power2.in" }, "+=1.2");
            } else if (preset === "caption_highlight") {
              words.forEach((word, index) => {
                const offset = enterDuration * 0.6 + index * 0.15 * durationFactor;
                const dur = 0.3 * durationFactor;
                const bgEl = word.querySelector(".hl-word-bg");
                
                tl.set(word, { opacity: 0, y: 8 }, 0);
                tl.to(word, { opacity: 1, y: 0, filter: "brightness(1.05)", duration: 0.12 * durationFactor, ease: "power2.out" }, offset);
                tl.to(word, { filter: "brightness(1)", duration: 0.16 * durationFactor, ease: "power2.out" }, offset + 0.12 * durationFactor);
                
                if (bgEl) {
                  tl.to(bgEl, { opacity: 1, scaleX: 1, duration: 0.15 * durationFactor, ease: "power2.out" }, offset);
                  tl.to(bgEl, { opacity: 0, scaleX: 1.02, duration: 0.1 * durationFactor, ease: "power2.in" }, offset + dur);
                  tl.set(bgEl, { scaleX: 0 }, offset + dur + 0.1);
                }
              });
            } else if (preset === "caption_glitch_rgb") {
              words.forEach((word, index) => {
                const offset = enterDuration * 0.6 + index * 0.15 * durationFactor;
                const dur = 0.3 * durationFactor;
                const travel = index % 2 === 0 ? -12 : 12;
                const sm = 8;
                
                tl.set(word, { opacity: 0, scale: 1.15 }, 0);
                tl.to(word, {
                  opacity: 1,
                  scale: 1,
                  x: travel,
                  textShadow: `${sm}px 0 #ff003c, -${sm}px 0 #00e5ff, 0 5px 18px rgba(0,0,0,0.52)`,
                  duration: 0.1 * durationFactor,
                  ease: "none"
                }, offset);
                tl.to(word, {
                  x: 0,
                  textShadow: "0 5px 18px rgba(0,0,0,0.52)",
                  duration: 0.2 * durationFactor,
                  ease: "power3.out"
                }, offset + 0.1 * durationFactor);
                tl.to(word, { color: "rgba(255, 255, 255, 0.4)", duration: 0.1 }, offset + dur);
              });
            } else if (preset === "caption_emoji_pop") {
              words.forEach((word, index) => {
                const offset = enterDuration * 0.6 + index * 0.15 * durationFactor;
                const dur = 0.3 * durationFactor;
                const activeColor = word.classList.contains("is-emphasis") ? "var(--color-accent)" : "#B2F7FF";
                
                tl.fromTo(word, 
                  { scaleX: 0.8, scaleY: 1, opacity: 0 },
                  { scaleX: 1, scaleY: 1, opacity: 1, color: activeColor, duration: 0.15 * durationFactor, ease: "power3.out" },
                  offset
                );
                tl.to(word, {
                  scaleX: 0.75, opacity: 0.8, duration: 0.1 * durationFactor, ease: "power2.in"
                }, offset + dur);
              });
            } else if (preset === "caption_particle_burst") {
              words.forEach((word, index) => {
                const offset = enterDuration * 0.6 + index * 0.15 * durationFactor;
                const dur = 0.3 * durationFactor;
                const activeColor = word.classList.contains("is-emphasis") ? "#FFD700" : "#ffffff";
                
                tl.set(word, { opacity: 0, scale: 0.8 }, 0);
                tl.to(word, { opacity: 1, color: activeColor, scale: 1.12, duration: 0.1 * durationFactor, ease: "back.out(2)" }, offset);
                tl.to(word, { color: "rgba(255, 255, 255, 0.45)", scale: 1, duration: 0.12 * durationFactor }, offset + dur);
              });
            } else if (preset === "caption_editorial_emphasis") {
              words.forEach((word, index) => {
                const offset = enterDuration * 0.6 + index * 0.15 * durationFactor;
                const dur = 0.3 * durationFactor;
                
                tl.fromTo(word,
                  { opacity: 0, scale: 1.12, transformOrigin: "0% 100%" },
                  { opacity: 1, scale: 1, duration: 0.12 * durationFactor, ease: "power2.out" },
                  offset
                );
                tl.to(word, { color: "rgba(245, 240, 208, 0.5)", duration: 0.15 * durationFactor }, offset + dur);
              });
            } else if (preset === "caption_pill_karaoke") {
              words.forEach((word, index) => {
                const offset = enterDuration * 0.6 + index * 0.15 * durationFactor;
                const dur = 0.3 * durationFactor;
                
                tl.set(word, { opacity: 0, y: 8 }, 0);
                tl.to(word, { opacity: 1, y: 0, color: "#1C1E1D", duration: 0.12 * durationFactor, ease: "power2.out" }, offset);
                tl.to(word, { color: "#A6A6A6", duration: 0.1 * durationFactor, ease: "none" }, offset + dur);
              });
            } else if (preset === "caption_weight_shift") {
              words.forEach((word, index) => {
                const offset = enterDuration * 0.6 + index * 0.15 * durationFactor;
                const dur = 0.3 * durationFactor;
                
                tl.set(word, { opacity: 0 }, 0);
                tl.to(word, { opacity: 1, fontWeight: 700, duration: 0.12 * durationFactor, ease: "power2.out" }, offset);
                tl.to(word, { fontWeight: 300, duration: 0.15 * durationFactor, ease: "power2.out" }, offset + dur);
              });
            } else {
              words.forEach((word, index) => {
                const offset = enterDuration * 0.6 + index * 0.12 * durationFactor;
                const dur = 0.3 * durationFactor;
                const activeColor = word.classList.contains("is-emphasis") ? "var(--color-accent)" : "#ffffff";
                
                tl.set(word, { opacity: 0, y: 12 }, 0);
                
                tl.to(word, {
                  opacity: 1,
                  y: 0,
                  color: activeColor,
                  duration: 0.18 * durationFactor,
                  ease: "power2.out"
                }, offset);
                
                tl.to(word, {
                  color: "rgba(255, 255, 255, 0.55)",
                  duration: 0.12 * durationFactor,
                  ease: "power1.out"
                }, offset + dur);
              });
            }
          }
        }
      } else if (kind === "number") {
        if (preset === "hud_ratio_panel") {
          const rows = gsap.utils.toArray(el.querySelectorAll(".stat-row"));
          if (rows.length) {
            tl.fromTo(rows,
              { opacity: 0, x: -28 },
              { opacity: 1, x: 0, duration: 0.28 * durationFactor, stagger: 0.08 * durationFactor, ease: "power3.out" },
              "-=0.1"
            );
          }
        } else {
          const numValue = el.querySelector(".number-value");
          if (numValue) {
            tl.fromTo(numValue,
              { scale: 0.72, rotate: -2, opacity: 0 },
              { scale: 1, rotate: 0, opacity: 1, duration: 0.38 * durationFactor, ease: "back.out(1.35)" },
              "-=0.1"
            );
            tl.fromTo(numValue,
              { "--shine-x": "-130%" },
              { "--shine-x": "130%", duration: 0.6 * durationFactor, ease: "power2.inOut" },
              "-=0.08"
            );
          }
        }
      } else if (kind === "chart") {
        const bars = gsap.utils.toArray(el.querySelectorAll(".bar"));
        if (bars.length) {
          tl.fromTo(bars,
            { scaleY: 0.12, opacity: 0 },
            { scaleY: 1, opacity: 1, duration: 0.44 * durationFactor, stagger: 0.08 * durationFactor, ease: "power3.out" },
            "-=0.1"
          );
        }
      } else if (kind === "list") {
        if (preset === "bullet_cards_lesson" || preset === "bullet_cards_premium") {
          const cards = gsap.utils.toArray(el.querySelectorAll(".bullet-card"));
          if (cards.length) {
            tl.fromTo(cards,
              { opacity: 0, y: 20 },
              { opacity: 1, y: 0, duration: 0.32 * durationFactor, stagger: 0.1 * durationFactor, ease: "power2.out" },
              "-=0.1"
            );
          }
        } else {
          const items = gsap.utils.toArray(el.querySelectorAll(".check-item"));
          if (items.length) {
            tl.fromTo(items,
              { opacity: 0, y: 14 },
              { opacity: 1, y: 0, duration: 0.24 * durationFactor, stagger: 0.08 * durationFactor, ease: "power1.out" },
              "-=0.1"
            );
          }
        }
      } else if (kind === "accent") {
        if (preset === "myth_strike_redline") {
          const myth = el.querySelector(".myth-word");
          const truth = el.querySelector(".truth-word");
          if (myth) {
            tl.fromTo(myth, { opacity: 0, x: -28 }, { opacity: 1, x: 0, duration: 0.26 * durationFactor, ease: "power3.out" }, "-=0.1");
            tl.fromTo(myth, { "--strike-scale": 0 }, { "--strike-scale": 1, duration: 0.3 * durationFactor, ease: "power2.inOut" }, "+=0.1");
          }
          if (truth) {
            tl.fromTo(truth, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.28 * durationFactor, ease: "back.out(1.35)" }, "-=0.08");
          }
        } else if (preset === "concept_orbit_map") {
          const center = el.querySelector(".concept-center");
          const nodes = gsap.utils.toArray(el.querySelectorAll(".concept-node"));
          if (center) {
            tl.fromTo(center, { opacity: 0, scale: 0.78 }, { opacity: 1, scale: 1, duration: 0.34 * durationFactor, ease: "back.out(1.35)" }, "-=0.1");
          }
          if (nodes.length) {
            tl.fromTo(nodes, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.3 * durationFactor, stagger: 0.1 * durationFactor, ease: "power3.out" }, "-=0.15");
          }
        } else {
          const keyword = el.querySelector(".keyword");
          const eyebrow = el.querySelector(".eyebrow");
          const subtext = el.querySelector(".subtext");
          const elements = [eyebrow, keyword, subtext].filter(Boolean);
          if (elements.length) {
            tl.fromTo(elements,
              { opacity: 0, y: 14 },
              { opacity: 1, y: 0, duration: 0.26 * durationFactor, stagger: 0.06 * durationFactor, ease: "power2.out" },
              "-=0.1"
            );
          }
        }
      } else if (kind === "cta") {
        const items = gsap.utils.toArray(el.querySelectorAll("strong, small"));
        if (items.length) {
          tl.fromTo(items,
            { opacity: 0, scale: 0.92 },
            { opacity: 1, scale: 1, duration: 0.3 * durationFactor, stagger: 0.1 * durationFactor, ease: "back.out(1.1)" },
            "-=0.1"
          );
        }
      }

      // Exit animation
      const animationOut = block.animationOut ?? "slide-up";
      let exitVars: TweenVars = { opacity: 0, y: "-=18", scale: 0.58, ease: "power2.in", duration: 0.24 };
      if (animationOut === "fade") {
        exitVars = { opacity: 0, scale: 0.58, ease: "power2.in", duration: 0.24 };
      } else if (animationOut === "slide-down") {
        exitVars = { opacity: 0, y: "+=18", scale: 0.58, ease: "power2.in", duration: 0.24 };
      } else if (animationOut === "scale-down") {
        exitVars = { opacity: 0, scale: 0.44, ease: "power2.in", duration: 0.24 };
      } else if (animationOut === "none") {
        exitVars = { opacity: 0, ease: "none", duration: 0.01 };
      }
      tl.to(el, exitVars, "+=1.5");
    }, el);

    return () => ctx.revert();
  }, [animationTrigger, block.font, block.surface, block.shadow, block.animationSpeed, block.animationIn, block.animationOut, kind, block.layoutPreset, block.colorAccent, block.colorText, theme?.colorPrimary, theme?.defaultAnimationSpeed]);

  return (
    <div className={`${styles.stage} ${styles.aspect_portrait}`} ref={stageRef}>
      <div className={styles.phoneVideo} />
      <button className={styles.replayBtn} type="button" onClick={onReplay} aria-label="Воспроизвести анимацию">
        <svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
      </button>
      <div ref={overlayRef} className={`${styles.overlay} ${styles.freePosition} ${styles[`kind_${kind}`]} ${styles[`surface_${block.surface ?? theme.defaultSurface}`]} ${styles[`shadow_${block.shadow ?? theme.defaultShadow}`]} ${styles[`font_${block.font ?? theme.font}`]} preset-${block.layoutPreset ?? ""}`} style={overlayStyle}>
        <OverlayContent key={`${kind}-${block.layoutPreset ?? ""}-${animationTrigger}`} kind={kind} accentColor={String(block.colorAccent ?? theme.colorPrimary)} fontSize={fontSize} weight={weight} block={block} theme={theme} />
      </div>
      {dragEnabled ? (
        <button
          className={styles.dragHandle}
          type="button"
          style={{ left: `${position.x}%`, top: `${position.y}%` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          aria-label="Перетащить позицию блока"
        />
      ) : null}
    </div>
  );
}
