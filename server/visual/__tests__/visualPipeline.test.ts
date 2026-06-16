import { sourceToOutputTime } from "../remapTranscript";
import { validateTiming } from "../timingValidator";
import { analyzeSemantics } from "../semanticAnalyzer";
import type { Phrase, SemanticVisualPlan } from "../types";
import type { EditRange } from "@/lib/types";

describe("Visual Pipeline Architecture Tests", () => {
  describe("Тест 1: remap таймингов", () => {
    it("should correctly remap source to output time", () => {
      const keptRanges = [
        { sourceStart: 10, sourceEnd: 15, reason: "keep" },
        { sourceStart: 20, sourceEnd: 25, reason: "keep" }
      ] as EditRange[];

      expect(sourceToOutputTime(10, keptRanges)).toBeCloseTo(0);
      expect(sourceToOutputTime(12, keptRanges)).toBeCloseTo(2);
      expect(sourceToOutputTime(20, keptRanges)).toBeCloseTo(5);
      expect(sourceToOutputTime(24, keptRanges)).toBeCloseTo(9);
      expect(sourceToOutputTime(17, keptRanges)).toBeNull();
    });
  });

  describe("Тест 2: фраза не заканчивается раньше речи", () => {
    it("should return a warning if layer ends too early", () => {
      const phrases: Phrase[] = [
        {
          id: "p01",
          outputStart: 0.0,
          outputEnd: 6.0,
          text: "Не режьте мышкой, лучше используйте Command+B",
          wordIds: [],
          sourceSpans: []
        }
      ];

      const plan: SemanticVisualPlan = {
        stylePackId: "dynamic_viral",
        duration: 6.0,
        layers: [
          {
            id: "layer-001",
            phraseId: "p01",
            component: "strikeout_replace",
            outputStart: 0.0,
            outputEnd: 1.0,
            zIndex: 10,
            timing: { anchor: "phrase" },
            props: {}
          }
        ]
      };

      const report = validateTiming(plan, phrases);
      expect(report.ok).toBe(false);
      expect(report.warnings.some(w => w.type === "ends_too_early")).toBe(true);
    });
  });

  describe("Тест 3: правильный do/dont", () => {
    it("should detect do_dont intent and extract shortcuts", () => {
      const phrases: Phrase[] = [
        {
          id: "p01",
          outputStart: 0,
          outputEnd: 5,
          text: "Не режьте мышкой, лучше используйте Command+B",
          wordIds: [],
          sourceSpans: []
        }
      ];

      const analysis = analyzeSemantics(phrases);
      expect(analysis[0].intent).toBe("do_dont");
      expect(analysis[0].entities?.shortcut).toBe("COMMAND+B");
      expect(analysis[0].entities?.keys).toEqual(["⌘", "B"]);
    });
  });

  describe("Тест 4: title with number", () => {
    it("should extract list_title and number", () => {
      const phrases: Phrase[] = [
        {
          id: "p01",
          outputStart: 0,
          outputEnd: 3,
          text: "Топ-3 способа получить классное видео в CapCut",
          wordIds: [],
          sourceSpans: []
        }
      ];

      const analysis = analyzeSemantics(phrases);
      expect(analysis[0].intent).toBe("list_title");
      expect(analysis[0].entities?.number).toBe("ТОП-3");
      expect(analysis[0].entities?.tool).toBe("CapCut");
    });
  });
});
