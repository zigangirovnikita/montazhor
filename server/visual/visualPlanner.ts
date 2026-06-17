import type { Phrase, SemanticAnalysis, SemanticVisualPlan, VisualLayer } from "./types";
import type { StylePreset } from "@/lib/types";

interface PlannerConfig {
  stylePackId: StylePreset;
  duration: number;
}

export function buildSemanticVisualPlan(
  phrases: Phrase[],
  analyses: SemanticAnalysis[],
  config: PlannerConfig
): SemanticVisualPlan {
  const layers: VisualLayer[] = [];
  let layerId = 1;
  let lastHeavyLayerEnd = -10;

  for (let i = 0; i < phrases.length; i++) {
    const phrase = phrases[i];
    const analysis = analyses.find(a => a.phraseId === phrase.id);
    if (!analysis) continue;

    const outputStart = phrase.outputStart;
    const outputEnd = phrase.outputEnd;
    const phraseDur = outputEnd - outputStart;

    let component = "";
    const props: Record<string, any> = {};
    let isHeavy = false;

    if (analysis.intent === "list_title") {
      component = "number_title_combo";
      props.number = analysis.entities?.number || "";
      props.title = analysis.entities?.title || phrase.text;
      props.tool = analysis.entities?.tool || "";
      isHeavy = true;
    } else if (analysis.intent === "do_dont") {
      component = "strikeout_replace";
      props.badText = analysis.entities?.badAction?.text || "";
      props.goodPrefix = "";
      props.goodText = analysis.entities?.goodAction?.text || "";
      props.accentText = analysis.entities?.shortcut?.text || "";
      props.keys = analysis.entities?.shortcut?.keys;
      isHeavy = true;
    } else if (analysis.intent === "shortcut") {
      component = "shortcut_key";
      props.shortcut = analysis.entities?.shortcut?.text;
      props.keys = analysis.entities?.shortcut?.keys;
      isHeavy = true;
    } else if (analysis.intent === "tool") {
      component = "tool_highlight";
      props.tool = analysis.entities?.tool;
      props.text = phrase.text;
    } else if (analysis.intent === "cta") {
      component = "cta_plate";
      props.text = phrase.text;
      isHeavy = true;
    } else {
      component = "plain_caption";
      props.text = phrase.text;
    }

    // Basic density controller: limit heavy effects rate
    if (isHeavy) {
      if (outputStart - lastHeavyLayerEnd < 1.5) {
        continue;
      }
      lastHeavyLayerEnd = outputEnd;
    }

    const enterDuration = Math.min(0.16, phraseDur / 4);
    const exitDuration = Math.min(0.16, phraseDur / 4);

    layers.push({
      id: `layer-${String(layerId++).padStart(3, '0')}`,
      phraseId: phrase.id,
      component,
      outputStart,
      outputEnd,
      zIndex: 20,
      timing: {
        anchor: "phrase",
        mustCoverPhrase: true,
        enterDuration,
        exitDuration
      },
      props
    });
  }

  return {
    stylePackId: config.stylePackId,
    duration: config.duration,
    layers
  };
}
