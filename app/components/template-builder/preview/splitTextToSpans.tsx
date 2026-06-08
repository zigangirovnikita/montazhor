import type { CSSProperties } from "react";
import { scramble } from "../utils/scramble";

export function splitTextToSpans(text: string, emphasis?: string, preset?: string, accentColor?: string, textColor?: string) {
  const words = text.split(/\s+/).filter(Boolean);
  const normalizedEmphasis = emphasis ? emphasis.toLowerCase().replace(/[^\p{L}\p{N}%$₽-]+/gu, "") : "";
  return words.map((word, index) => {
    const normalizedWord = word.toLowerCase().replace(/[^\p{L}\p{N}%$₽-]+/gu, "");
    const isEmphasis = normalizedEmphasis && normalizedWord === normalizedEmphasis;
    
    let style: CSSProperties = { display: "inline-block", marginRight: "6px" };
    if (textColor) style.color = textColor;
    
    // Set default styles/fonts per preset
    if (preset === "caption_neon_glow") {
      style.color = "rgba(0, 255, 240, 0.14)";
      style.fontFamily = "'Outfit', sans-serif";
      style.textTransform = "uppercase";
    } else if (preset === "caption_gradient_fill") {
      // Siri-like wipe: initial state is white/inactive (e.g. rgba(255,255,255,0.4))
      style.background = `linear-gradient(90deg, ${accentColor || "#fe9f1b"} 0%, #ffe54d 25%, ${accentColor || "#fe9f1b"} 50%, rgba(255, 255, 255, 0.4) 50.5%, rgba(255, 255, 255, 0.4) 100%)`;
      style.backgroundSize = "350% 100%";
      style.backgroundPosition = "100% 0";
      style.WebkitBackgroundClip = "text";
      style.color = "transparent";
      style.fontFamily = "'Montserrat', sans-serif";
      style.fontWeight = 900;
    } else if (preset === "caption_matrix_decode") {
      style.color = "#00ff41";
      style.fontFamily = "'Space Grotesk', sans-serif";
      style.position = "relative";
    } else if (preset === "kinetic_phrase_slam" || preset === "caption_kinetic_slam") {
      style.color = "rgba(255, 255, 255, 0.4)";
      style.fontFamily = "'Anton', sans-serif";
      style.textTransform = "uppercase";
    } else if (preset === "caption_clip_wipe") {
      style.clipPath = "inset(0 100% 0 0)";
      style.fontFamily = "'Poppins', sans-serif";
      style.textTransform = "uppercase";
      style.fontWeight = 800;
      style.color = "#ffffff";
    } else if (preset === "caption_highlight") {
      style.fontFamily = "'Montserrat', sans-serif";
      style.fontWeight = 800;
      style.textTransform = "uppercase";
      style.position = "relative";
      style.padding = "4px 8px 6px";
    } else if (preset === "caption_glitch_rgb") {
      style.fontFamily = "'Space Grotesk', sans-serif";
      style.fontWeight = 700;
      style.textTransform = "uppercase";
      style.color = "#ffffff";
    } else if (preset === "caption_emoji_pop") {
      style.fontFamily = "'Gabarito', sans-serif";
      style.fontWeight = 900;
      style.textTransform = "uppercase";
      style.color = "#ffffff";
      style.WebkitTextStroke = "2px #000000";
    } else if (preset === "caption_particle_burst") {
      style.fontFamily = "'Outfit', sans-serif";
      style.fontWeight = 900;
      style.textTransform = "uppercase";
      style.color = "rgba(255, 255, 255, 0.45)";
    } else if (preset === "caption_editorial_emphasis") {
      if (isEmphasis) {
        style.fontFamily = "'Playfair Display', serif";
        style.fontStyle = "italic";
        style.fontWeight = 800;
        style.fontSize = "1.8em";
        style.lineHeight = 0.9;
      } else {
        style.fontFamily = "'Inter', sans-serif";
        style.fontWeight = 400;
      }
    } else if (preset === "caption_pill_karaoke") {
      style.fontFamily = "'Poppins', sans-serif";
      style.fontWeight = 700;
      style.color = "#A6A6A6";
    } else if (preset === "caption_weight_shift") {
      style.fontFamily = "'Montserrat', sans-serif";
      style.fontWeight = 300;
    } else {
      style.color = "rgba(255, 255, 255, 0.35)";
    }

    const displayText = (preset === "caption_pill_karaoke" || preset === "caption_weight_shift")
      ? word.toLowerCase()
      : (preset === "caption_clip_wipe" || preset === "caption_highlight" || preset === "caption_glitch_rgb" || preset === "caption_emoji_pop" || preset === "caption_particle_burst")
        ? word.toUpperCase()
        : word;

    if (preset === "caption_matrix_decode") {
      const scr0 = scramble(word, 0);
      const scr1 = scramble(word, 1);
      return (
        <span
          key={index}
          className={`phrase-word ${isEmphasis ? "is-emphasis" : ""}`}
          data-offset={index * 0.15}
          data-duration={0.3}
          style={style}
        >
          <span className="matrix-real" style={{ visibility: "hidden" }}>{word}</span>
          <span className="matrix-scr0" style={{ display: "none", position: "absolute", left: 0 }}>{scr0}</span>
          <span className="matrix-scr1" style={{ display: "none", position: "absolute", left: 0 }}>{scr1}</span>
        </span>
      );
    }

    if (preset === "caption_highlight") {
      return (
        <span
          key={index}
          className={`phrase-word hl-word ${isEmphasis ? "is-emphasis" : ""}`}
          data-offset={index * 0.15}
          data-duration={0.3}
          style={style}
        >
          <span className="hl-word-bg" style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, #ff1745 0%, #df1238 100%)",
            borderRadius: "8px",
            opacity: 0,
            transform: "scaleX(0)",
            transformOrigin: "0% 50%",
            zIndex: -1
          }}></span>
          <span className="hl-word-text" style={{ position: "relative", zIndex: 1 }}>{displayText}</span>
        </span>
      );
    }

    return (
      <span
        key={index}
        className={`phrase-word ${isEmphasis ? "is-emphasis" : ""}`}
        data-offset={index * 0.15}
        data-duration={0.3}
        style={style}
      >
        {displayText}
      </span>
    );
  });
}
