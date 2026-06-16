import type { Phrase, SemanticAnalysis, SemanticIntent } from "./types";

export function analyzeSemantics(phrases: Phrase[]): SemanticAnalysis[] {
  return phrases.map(phrase => {
    const text = phrase.text.toLowerCase();
    let intent: SemanticIntent = "plain_explanation";
    const entities: Record<string, any> = {};

    // 1. CTA
    if (/(подпиши|сохрани|сохраняй|пиши|напиши|ставь|лайк)/.test(text)) {
      intent = "cta";
    }
    // 2. Lists / Steps / Titles
    else if (/(топ-?\d+|\d+ способ|\d+ причин|\d+ ошибк|первый|второй|третий|шаг \d+)/.test(text)) {
      intent = "list_title";
      const match = phrase.text.match(/(ТОП-?\d+|\d+)/i);
      if (match) {
        entities.number = match[0].toUpperCase();
      }
    }
    // 3. Do / Don't
    else if (/(не делай|нельзя|ошибка|перестань|хватит)/.test(text)) {
      intent = "do_dont";
    }
    // 4. Shortcuts
    else if (/(command|ctrl|shift|alt|cmd)\s*\+\s*([a-z0-9])/i.test(phrase.text)) {
      intent = "shortcut";
      const match = phrase.text.match(/(Command|Ctrl|Shift|Alt|Cmd)\s*\+\s*([a-z0-9])/i);
      if (match) {
        entities.shortcut = `${match[1]}+${match[2]}`.toUpperCase();
        entities.keys = [match[1].toUpperCase() === "COMMAND" || match[1].toUpperCase() === "CMD" ? "⌘" : match[1].toUpperCase(), match[2].toUpperCase()];
      }
    }
    // 5. Tools
    else if (/(capcut|chatgpt|canva|n8n|figma|notion|premiere)/.test(text)) {
      intent = "tool";
      const match = phrase.text.match(/(CapCut|ChatGPT|Canva|n8n|Figma|Notion|Premiere)/i);
      if (match) {
        entities.tool = match[1];
      }
    }

    return {
      phraseId: phrase.id,
      intent,
      confidence: 0.8,
      entities: Object.keys(entities).length > 0 ? entities : undefined
    };
  });
}
