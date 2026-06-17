import type { Phrase, SemanticVisualPlan, TimingReport, TimingWarning } from "./types";

export function validateTiming(plan: SemanticVisualPlan, phrases: Phrase[]): TimingReport {
  const warnings: TimingWarning[] = [];
  let ok = true;

  for (const layer of plan.layers) {
    const dur = layer.outputEnd - layer.outputStart;

    if (dur <= 0) {
      warnings.push({
        layerId: layer.id,
        type: "invalid_duration",
        message: `Layer has zero or negative duration (${dur.toFixed(2)}s).`
      });
      ok = false;
    }

    if ("sourceStart" in layer || "sourceEnd" in layer) {
      warnings.push({
        layerId: layer.id,
        type: "negative_start", // reused type or we can add a new one, but let's just use invalid_duration to be safe
        message: `VisualLayer must not contain sourceStart or sourceEnd. It must use the output timeline.`
      });
      ok = false;
    }

    if (layer.outputStart < 0) {
      warnings.push({
        layerId: layer.id,
        type: "negative_start",
        message: `Layer starts at negative time ${layer.outputStart.toFixed(2)}.`
      });
      ok = false;
    }

    if (layer.outputEnd > plan.duration) {
      warnings.push({
        layerId: layer.id,
        type: "exceeds_duration",
        message: `Layer ends at ${layer.outputEnd.toFixed(2)}, which is after total duration ${plan.duration.toFixed(2)}.`
      });
      ok = false;
    }

    if (layer.phraseId) {
      const phrase = phrases.find(p => p.id === layer.phraseId);
      if (phrase) {
        if (layer.outputEnd < phrase.outputEnd - 0.2) {
          const phraseDur = phrase.outputEnd - phrase.outputStart;
          const ratio = dur / phraseDur;
          if (ratio < 0.65) {
            warnings.push({
              layerId: layer.id,
              type: "ends_too_early",
              message: `Layer ends at ${layer.outputEnd.toFixed(2)}, but phrase ends at ${phrase.outputEnd.toFixed(2)}. It covers only ${Math.round(ratio * 100)}% of phrase.`
            });
            ok = false; // Setting ok = false for this specific constraint
          }
        }
      }
    }

    if (dur > 0 && dur < 0.6 && layer.component !== "shortcut_key") {
      warnings.push({
        layerId: layer.id,
        type: "too_short_for_reading",
        message: `Layer is ${dur.toFixed(2)}s long, which might be too short to read.`
      });
      // warning only, not setting ok = false unless we want to be strict
    }
  }

  return { ok, warnings };
}
