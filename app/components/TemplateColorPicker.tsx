"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alpha,
  EditableInputRGBA,
  Hue,
  Saturation,
  hexToHsva,
  hsvaToHex,
  hsvaToHexa,
  hsvaToRgba,
  type HsvaColor
} from "@uiw/react-color";
import { createPortal } from "react-dom";
import styles from "./TemplateColorPicker.module.css";

type PickerMode = "grid" | "spectrum" | "sliders";

const RECENT_COLORS_KEY = "montazhor-template-recent-colors";
const PICKER_MODES: Array<{ id: PickerMode; label: string }> = [
  { id: "grid", label: "Сетка" },
  { id: "spectrum", label: "Спектр" },
  { id: "sliders", label: "Слайдеры" }
];
const RECENT_FALLBACK = ["#f9f871", "#dd3d1d", "#7d31a8", "#3562e6", "#213e91", "#b7b7b9", "#f3f4f6"];
const GRAYSCALE_SWATCHES = ["#ffffff", "#e7e7e7", "#d1d1d1", "#bababa", "#a3a3a3", "#8a8a8a", "#707070", "#555555", "#3d3d3d", "#262626", "#0f0f0f", "#000000"];
const PALETTE_HUES = [202, 224, 250, 278, 334, 8, 22, 35, 45, 58, 68, 88];
const PALETTE_ROWS = Array.from({ length: 8 }, (_, rowIndex) => rowIndex);

export function TemplateColorPicker({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<PickerMode>("grid");
  const [draft, setDraft] = useState<HsvaColor>(() => parseColor(value));
  const [recentColors, setRecentColors] = useState<string[]>(() => {
    if (typeof window === "undefined") return RECENT_FALLBACK;
    const saved = window.localStorage.getItem(RECENT_COLORS_KEY);
    if (!saved) return RECENT_FALLBACK;
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) && parsed.every((item) => typeof item === "string")
        ? parsed.slice(0, 8)
        : RECENT_FALLBACK;
    } catch {
      window.localStorage.removeItem(RECENT_COLORS_KEY);
      return RECENT_FALLBACK;
    }
  });
  const initialValueRef = useRef(value);
  const panelId = `color-panel-${label.toLowerCase().replace(/\s+/g, "-")}`;

  const paletteSwatches = useMemo(() => {
    return PALETTE_ROWS.flatMap((row) => {
      const saturation = Math.max(22, 82 - row * 7);
      const valueLevel = Math.min(98, 28 + row * 10);
      return PALETTE_HUES.map((hue) => serializeColor({ h: hue, s: saturation, v: valueLevel, a: 1 }));
    });
  }, []);

  function openPicker() {
    initialValueRef.current = value;
    setDraft(parseColor(value));
    window.setTimeout(() => setIsOpen(true), 0);
  }

  const closePicker = useCallback((commit: boolean) => {
    if (!commit) {
      onChange(initialValueRef.current);
      setDraft(parseColor(initialValueRef.current));
    } else {
      const committed = serializeColor(draft);
      const nextRecent = [committed, ...recentColors.filter((item) => item.toLowerCase() !== committed.toLowerCase())].slice(0, 8);
      setRecentColors(nextRecent);
      window.localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(nextRecent));
    }
    setIsOpen(false);
  }, [draft, onChange, recentColors]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePicker(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closePicker, isOpen]);

  function updateDraft(nextColor: HsvaColor) {
    setDraft(nextColor);
    onChange(serializeColor(nextColor));
  }

  const currentRgba = hsvaToRgba(draft);
  const alphaPercent = Math.round(draft.a * 100);
  const saturationGradient = `linear-gradient(90deg, ${serializeColor({ ...draft, s: 0, a: 1 })} 0%, ${serializeColor({ ...draft, s: 100, a: 1 })} 100%)`;
  const valueGradient = `linear-gradient(90deg, #000000 0%, ${serializeColor({ ...draft, v: 100, a: 1 })} 100%)`;

  return (
    <>
      <div className={styles.field}>
        <span>{label}</span>
        <button
          aria-controls={panelId}
          aria-expanded={isOpen}
          className={styles.trigger}
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openPicker();
          }}
        >
          <span className={styles.swatch} style={{ backgroundColor: value }} />
          <code>{value.toUpperCase()}</code>
        </button>
      </div>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div aria-hidden="true" className={styles.scrim} onClick={() => closePicker(false)}>
              <div aria-labelledby={`${panelId}-title`} className={styles.sheet} id={panelId} role="dialog" onClick={(event) => event.stopPropagation()}>
                <div className={styles.sheetHeader}>
                  <button className={styles.headerButton} type="button" onClick={() => closePicker(false)}>
                    Отмена
                  </button>
                  <h4 id={`${panelId}-title`}>{label}</h4>
                  <button className={styles.confirmButton} type="button" onClick={() => closePicker(true)}>
                    Готово
                  </button>
                </div>

                <div className={styles.modeTabs}>
                  {PICKER_MODES.map((item) => (
                    <button
                      className={mode === item.id ? styles.modeTabActive : styles.modeTab}
                      key={item.id}
                      type="button"
                      onClick={() => setMode(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className={styles.previewStrip}>
                  <div className={styles.previewCard}>
                    <span>Текущий цвет</span>
                    <strong>{serializeColor(draft).toUpperCase()}</strong>
                  </div>
                  <div className={styles.previewSwatch} style={{ backgroundColor: serializeColor(draft) }} />
                </div>

                {mode === "grid" ? (
                  <div className={styles.gridPanel}>
                    <div className={styles.swatchGrid}>
                      {GRAYSCALE_SWATCHES.map((color) => (
                        <button
                          aria-label={color}
                          className={styles.gridSwatch}
                          key={color}
                          style={{ backgroundColor: color }}
                          type="button"
                          onClick={() => updateDraft(parseColor(color))}
                        />
                      ))}
                    </div>
                    <div className={styles.swatchGrid}>
                      {paletteSwatches.map((color) => (
                        <button
                          aria-label={color}
                          className={styles.gridSwatch}
                          key={color}
                          style={{ backgroundColor: color }}
                          type="button"
                          onClick={() => updateDraft(parseColor(color))}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {mode === "spectrum" ? (
                  <div className={styles.spectrumPanel}>
                    <Saturation className={styles.saturation} hsva={draft} onChange={updateDraft} radius={22} />
                    <div className={styles.sliderStack}>
                      <label className={styles.sliderLabel}>
                        <span>Оттенок</span>
                        <Hue className={styles.colorSlider} height={18} hue={draft.h} radius={999} onChange={(nextHue) => updateDraft({ ...draft, ...nextHue })} />
                      </label>
                      <label className={styles.sliderLabel}>
                        <span>Непрозрачность</span>
                        <div className={styles.opacityRow}>
                          <Alpha className={styles.colorSlider} height={18} hsva={draft} radius={999} onChange={(nextAlpha) => updateDraft({ ...draft, ...nextAlpha })} />
                          <strong>{alphaPercent}%</strong>
                        </div>
                      </label>
                    </div>
                  </div>
                ) : null}

                {mode === "sliders" ? (
                  <div className={styles.sliderPanel}>
                    <label className={styles.channelBlock}>
                      <div className={styles.channelMeta}>
                        <span>Hue</span>
                        <strong>{Math.round(draft.h)}</strong>
                      </div>
                      <Hue className={styles.colorSlider} height={18} hue={draft.h} radius={999} onChange={(nextHue) => updateDraft({ ...draft, ...nextHue })} />
                    </label>
                    <label className={styles.channelBlock}>
                      <div className={styles.channelMeta}>
                        <span>Saturation</span>
                        <strong>{Math.round(draft.s)}%</strong>
                      </div>
                      <input
                        className={styles.nativeSlider}
                        max={100}
                        min={0}
                        style={{ backgroundImage: saturationGradient }}
                        type="range"
                        value={draft.s}
                        onChange={(event) => updateDraft({ ...draft, s: Number(event.target.value) })}
                      />
                    </label>
                    <label className={styles.channelBlock}>
                      <div className={styles.channelMeta}>
                        <span>Brightness</span>
                        <strong>{Math.round(draft.v)}%</strong>
                      </div>
                      <input
                        className={styles.nativeSlider}
                        max={100}
                        min={0}
                        style={{ backgroundImage: valueGradient }}
                        type="range"
                        value={draft.v}
                        onChange={(event) => updateDraft({ ...draft, v: Number(event.target.value) })}
                      />
                    </label>
                    <label className={styles.channelBlock}>
                      <div className={styles.channelMeta}>
                        <span>Opacity</span>
                        <strong>{alphaPercent}%</strong>
                      </div>
                      <Alpha className={styles.colorSlider} height={18} hsva={draft} radius={999} onChange={(nextAlpha) => updateDraft({ ...draft, ...nextAlpha })} />
                    </label>
                    <EditableInputRGBA
                      aProps={{ label: "A" }}
                      bProps={{ label: "B" }}
                      className={styles.rgbaEditor}
                      gProps={{ label: "G" }}
                      hsva={draft}
                      placement="top"
                      rProps={{ label: "R" }}
                      onChange={(color) => updateDraft(color.hsva)}
                    />
                  </div>
                ) : null}

                <div className={styles.recentSection}>
                  <span>Недавние</span>
                  <div className={styles.recentRow}>
                    {recentColors.map((color) => (
                      <button
                        aria-label={color}
                        className={styles.recentSwatch}
                        key={color}
                        style={{ backgroundColor: color }}
                        type="button"
                        onClick={() => updateDraft(parseColor(color))}
                      />
                    ))}
                  </div>
                </div>

                <div className={styles.rgbaRow}>
                  <span>RGBA</span>
                  <code>
                    {currentRgba.r}, {currentRgba.g}, {currentRgba.b}, {draft.a.toFixed(2)}
                  </code>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function parseColor(value: string): HsvaColor {
  try {
    return hexToHsva(value);
  } catch {
    return hexToHsva("#ffffff");
  }
}

function serializeColor(hsva: HsvaColor): string {
  return hsva.a < 0.999 ? hsvaToHexa(hsva) : hsvaToHex(hsva);
}
