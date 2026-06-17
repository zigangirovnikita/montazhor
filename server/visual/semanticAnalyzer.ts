import type { Phrase, SemanticAnalysis, SemanticIntent } from "./types";

export function analyzeSemantics(phrases: Phrase[]): SemanticAnalysis[] {
  return phrases.map(phrase => {
    const text = phrase.text;
    const lowerText = text.toLowerCase();
    const entities: Record<string, any> = {};

    // 1. Extract shortcut
    const shortcutMatch = text.match(/(Command|Ctrl|Shift|Alt|Cmd)\s*\+\s*([a-z0-9])/i);
    if (shortcutMatch) {
      entities.shortcut = {
        text: shortcutMatch[0],
        keys: [shortcutMatch[1].toUpperCase() === "COMMAND" || shortcutMatch[1].toUpperCase() === "CMD" ? "⌘" : shortcutMatch[1].toUpperCase(), shortcutMatch[2].toUpperCase()]
      };
    }

    // 2. Extract tool
    const toolMatch = text.match(/(CapCut|ChatGPT|Canva|n8n|Figma|Notion|Premiere)/i);
    if (toolMatch) {
      entities.tool = toolMatch[1];
    }

    // 3. Extract number
    const numberMatch = text.match(/(ТОП-?\d+|\d+)/i);
    if (numberMatch && /(топ-?\d+|\d+ способ|\d+ причин|\d+ ошибк|первый|второй|третий|шаг \d+)/i.test(text)) {
      entities.number = numberMatch[0].toUpperCase();
    }

    // 4. Extract badAction & goodAction for do_dont
    const doDontMatch = text.match(/не\s+([^,]+),\s*(?:лучше\s+)?(.+)/i);
    if (doDontMatch) {
      entities.badAction = { text: doDontMatch[1].trim().replace(/^режьте/i, "нарезка") };
      entities.goodAction = { text: doDontMatch[2].trim() };
    } else {
      const simpleBadMatch = text.match(/(?:не делай(?:те)?|нельзя|ошибка:?|перестань(?:те)?|хватит)\s+(.+)/i);
      if (simpleBadMatch) {
        entities.badAction = { text: simpleBadMatch[1].trim() };
      }
    }

    // Determine primary intent
    let intent: SemanticIntent = "plain_explanation";

    if (entities.badAction || entities.goodAction) {
      intent = "do_dont";
    } else if (/(топ-?\d+|\d+ способ|\d+ причин|\d+ ошибк)/i.test(text)) {
      intent = "list_title";
      let titleText = text;
      if (entities.number) {
        titleText = titleText.replace(new RegExp(entities.number, "i"), "").trim();
      }
      if (entities.tool) {
        titleText = titleText.replace(new RegExp(`\\s*в\\s+${entities.tool}`, "i"), "").trim();
        titleText = titleText.replace(new RegExp(`\\s*${entities.tool}`, "i"), "").trim();
      }
      entities.title = titleText;
    } else if (entities.shortcut) {
      intent = "shortcut";
    } else if (entities.tool) {
      intent = "tool";
    } else if (/(подпиши|сохрани|сохраняй|пиши|напиши|ставь|лайк)/i.test(text)) {
      intent = "cta";
    }

    return {
      phraseId: phrase.id,
      intent,
      confidence: 0.8,
      entities: Object.keys(entities).length > 0 ? entities : undefined
    };
  });
}
