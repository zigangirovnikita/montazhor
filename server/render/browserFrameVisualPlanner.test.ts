import { describe, expect, it } from "vitest";
import { buildVisualBeatsForBrowserPlan } from "./browserFrameVisualPlanner";

describe("browserFrameVisualPlanner", () => {
  it("builds chart, list, comparison and cta beats from subtitles", () => {
    const beats = buildVisualBeatsForBrowserPlan({
      subtitles: [
        subtitle("s1", 0, 1.2, "Рост 25% и 40% за месяц"),
        subtitle("s2", 1.3, 2.6, "Первое хук, второе доказательство, третье CTA"),
        subtitle("s3", 2.7, 3.8, "Это не ошибка а система"),
        subtitle("s4", 3.9, 5, "Напиши СИСТЕМА в комментарии")
      ],
      duration: 5,
      styleOptions: {
        subtitleFont: "manrope",
        subtitleStyle: "active_word",
        subtitleBackdrop: "glass",
        infographicTone: "glass",
        infographicAccent: "mint",
        autoLists: true,
        autoComparisons: true,
        autoCharts: true,
        autoCta: true,
        autoStrike: true,
        visualDensity: "high"
      }
    });

    expect(beats.some((beat) => beat.templateId === "metric_chart")).toBe(true);
    expect(beats.some((beat) => beat.templateId === "checklist")).toBe(true);
    expect(beats.some((beat) => beat.templateId === "concept_map" || beat.templateId === "myth_strike")).toBe(true);
    expect(beats.some((beat) => beat.templateId === "cta_plate")).toBe(true);
  });

  it("respects auto toggles and disabled templates", () => {
    const beats = buildVisualBeatsForBrowserPlan({
      subtitles: [
        subtitle("s1", 0, 1, "Рост 25% и 40%"),
        subtitle("s2", 1.1, 2.3, "Первое хук, второе доказательство, третье CTA"),
        subtitle("s3", 2.4, 3.6, "Напиши сейчас")
      ],
      duration: 4,
      styleOptions: {
        subtitleFont: "manrope",
        subtitleStyle: "active_word",
        subtitleBackdrop: "glass",
        infographicTone: "glass",
        infographicAccent: "mint",
        autoLists: false,
        autoComparisons: false,
        autoCharts: false,
        autoCta: true,
        autoStrike: false,
        disabledTemplates: ["cta_plate"],
        visualDensity: "high"
      }
    });

    expect(beats).toHaveLength(0);
  });

  it("limits count by density", () => {
    const subtitles = [
      subtitle("s1", 0, 1.1, "Рост 25% и 40%"),
      subtitle("s2", 1.2, 2.3, "Первое хук, второе доказательство, третье CTA"),
      subtitle("s3", 2.4, 3.5, "Это не хаос а система"),
      subtitle("s4", 3.6, 4.7, "Напиши СИСТЕМА"),
      subtitle("s5", 4.8, 5.9, "Ещё 15% роста")
    ];

    const low = buildVisualBeatsForBrowserPlan({
      subtitles,
      duration: 6,
      styleOptions: baseStyle("low")
    });
    const high = buildVisualBeatsForBrowserPlan({
      subtitles,
      duration: 6,
      styleOptions: baseStyle("high")
    });

    expect(low.length).toBeLessThan(high.length);
    expect(low.length).toBeLessThanOrEqual(2);
    expect(high.length).toBeGreaterThanOrEqual(3);
  });

  it("prefers semantic blocks over subtitle heuristics when available", () => {
    const beats = buildVisualBeatsForBrowserPlan({
      subtitles: [
        subtitle("s1", 0, 1.5, "Просто текст без явных шаблонов"),
        subtitle("s2", 1.6, 3, "И ещё один обычный кусок")
      ],
      semanticBlocks: [
        semanticBlock("b1", "proof", 0, 1.8, "Рост 37% и 52% за месяц"),
        semanticBlock("b2", "cta", 1.9, 3.1, "Напиши СИСТЕМА и я пришлю шаблон")
      ],
      duration: 4,
      styleOptions: baseStyle("high")
    });

    expect(beats).toHaveLength(2);
    expect(beats[0]?.templateId).toBe("metric_chart");
    expect(beats[1]?.templateId).toBe("cta_plate");
  });

  it("builds timeline and table payload modes from semantic blocks", () => {
    const beats = buildVisualBeatsForBrowserPlan({
      subtitles: [],
      semanticBlocks: [
        semanticBlock("b1", "timeline", 0, 2.4, "2022 запуск, 2023 рост, 2024 масштаб"),
        semanticBlock("b2", "proof", 2.5, 4.6, "Россия 25%, Европа 40%, США 55%")
      ],
      duration: 5,
      styleOptions: baseStyle("high")
    });

    expect(beats[0]?.templateId).toBe("checklist");
    expect(beats[0]?.payload.mode).toBe("timeline");
    expect(beats[1]?.templateId).toBe("metric_chart");
    expect(beats[1]?.payload.mode).toBe("table");
  });

  it("builds semantic definition payload for concept map", () => {
    const beats = buildVisualBeatsForBrowserPlan({
      subtitles: [],
      semanticBlocks: [
        semanticBlock("b1", "definition", 0, 2.2, "Контент-план это система тем и смыслов")
      ],
      duration: 3,
      styleOptions: baseStyle("high")
    });

    expect(beats[0]?.templateId).toBe("concept_map");
    expect(beats[0]?.payload.mode).toBe("definition");
    expect(beats[0]?.payload.title).toBe("КОНТЕНТ-ПЛАН");
  });

  it("builds comparison payload mode from subtitle heuristics", () => {
    const beats = buildVisualBeatsForBrowserPlan({
      subtitles: [
        subtitle("s1", 0, 1.6, "Это не хаос а система")
      ],
      duration: 2,
      styleOptions: baseStyle("high")
    });

    expect(beats[0]?.templateId === "concept_map" || beats[0]?.templateId === "myth_strike").toBe(true);
    if (beats[0]?.templateId === "concept_map") {
      expect(beats[0]?.payload.mode).toBe("comparison");
    }
  });
});

function subtitle(id: string, start: number, end: number, text: string) {
  return {
    id,
    start,
    end,
    text,
    words: text.split(/\s+/).map((word, index, items) => ({
      word,
      start: start + ((end - start) / items.length) * index,
      end: start + ((end - start) / items.length) * (index + 1)
    })),
    highlightedWords: []
  };
}

function baseStyle(density: "low" | "medium" | "high") {
  return {
    subtitleFont: "manrope" as const,
    subtitleStyle: "active_word" as const,
    subtitleBackdrop: "glass" as const,
    infographicTone: "glass" as const,
    infographicAccent: "mint" as const,
    autoLists: true,
    autoComparisons: true,
    autoCharts: true,
    autoCta: true,
    autoStrike: true,
    visualDensity: density
  };
}

function semanticBlock(
  id: string,
  type: "proof" | "cta" | "timeline" | "definition",
  start: number,
  end: number,
  text: string
) {
  return {
    id,
    type,
    start,
    end,
    text,
    summary: text,
    words: text.split(/\s+/).map((word, index, items) => ({
      word,
      start: start + ((end - start) / items.length) * index,
      end: start + ((end - start) / items.length) * (index + 1)
    })),
    transcriptWordRange: { startIndex: 0, endIndex: Math.max(0, text.split(/\s+/).length - 1) },
    wordCount: text.split(/\s+/).length
  };
}
