import type { TemplateInstance, MotionTemplateDefinition } from "@/lib/types/visual";

function normalizeText(text: string): string {
  // Lowercase and remove punctuation
  return text.toLowerCase().replace(/[.,!?;:"'«»()\[\]]/g, "").trim();
}

export function compileTemplateInstance(
  instance: TemplateInstance,
  templateDefinition: MotionTemplateDefinition
): TemplateInstance | null {
  const compiledSlots: Record<string, unknown> = {};

  for (const slotDef of templateDefinition.slots) {
    let value = instance.slots[slotDef.name];

    if (slotDef.required && (value === undefined || value === null || value === "")) {
      return null;
    }

    if (value !== undefined && value !== null) {
      if (slotDef.type === "short_text" || slotDef.type === "label") {
        if (typeof value === "string") {
          let text = value.trim();
          const words = text.split(/\s+/);
          if (words.length > 15) {
            // Reject sourceText-style long sentences completely
            return null;
          }
          if (slotDef.maxWords && words.length > slotDef.maxWords) {
            text = words.slice(0, slotDef.maxWords).join(" ") + "...";
          }
          compiledSlots[slotDef.name] = text;
        } else {
          compiledSlots[slotDef.name] = String(value);
        }
      } else if (slotDef.type === "number") {
        compiledSlots[slotDef.name] = String(value);
      } else if (slotDef.type === "list") {
        if (Array.isArray(value)) {
          let list = value.map(v => String(v).trim()).filter(Boolean);
          if (slotDef.maxItems && list.length > slotDef.maxItems) {
            list = list.slice(0, slotDef.maxItems);
          }
          let hasLongSentence = false;
          list = list.map(item => {
            const words = item.split(/\s+/);
            if (words.length > 15) hasLongSentence = true;
            if (slotDef.maxWords && words.length > slotDef.maxWords) {
              return words.slice(0, slotDef.maxWords).join(" ") + "...";
            }
            return item;
          });
          if (hasLongSentence) return null;
          compiledSlots[slotDef.name] = list;
        } else {
          compiledSlots[slotDef.name] = [String(value)];
        }
      } else {
        compiledSlots[slotDef.name] = value;
      }
    }
  }

  // Remove duplicates and overlaps across slots
  const seenNormalizedTexts: string[] = [];
  for (const [key, val] of Object.entries(compiledSlots)) {
    if (typeof val === "string" && val.length > 0) {
      const norm = normalizeText(val);
      if (norm.length > 2) {
        // Check exact or partial overlap with previously seen slots
        const isDuplicateOrOverlap = seenNormalizedTexts.some(seen => 
          seen === norm || seen.includes(norm) || norm.includes(seen)
        );

        if (isDuplicateOrOverlap) {
          // AI repeated the same text or a substring in another slot
          compiledSlots[key] = ""; // Clear duplicate
        } else {
          seenNormalizedTexts.push(norm);
        }
      }
    }
  }

  // Ensure duration limits
  let duration = instance.duration;
  if (duration < templateDefinition.duration.min) {
    duration = templateDefinition.duration.min;
  }
  if (duration > templateDefinition.duration.max) {
    duration = templateDefinition.duration.max;
  }

  return {
    ...instance,
    duration,
    slots: compiledSlots
  };
}
