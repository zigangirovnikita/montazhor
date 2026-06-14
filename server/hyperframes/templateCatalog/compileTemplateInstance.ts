import type { TemplateInstance, MotionTemplateDefinition } from "@/lib/types/visual";

export function compileTemplateInstance(
  instance: TemplateInstance,
  templateDefinition: MotionTemplateDefinition
): TemplateInstance | null {
  const compiledSlots: Record<string, unknown> = {};

  for (const slotDef of templateDefinition.slots) {
    let value = instance.slots[slotDef.name];

    if (slotDef.required && (value === undefined || value === null || value === "")) {
      // Missing required slot, reject the instance entirely
      return null;
    }

    if (value !== undefined && value !== null) {
      if (slotDef.type === "short_text" || slotDef.type === "label") {
        if (typeof value === "string") {
          let text = value.trim();
          if (slotDef.maxWords) {
            const words = text.split(/\s+/);
            if (words.length > slotDef.maxWords) {
              text = words.slice(0, slotDef.maxWords).join(" ") + "...";
            }
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
          if (slotDef.maxWords) {
            list = list.map(item => {
              const words = item.split(/\s+/);
              if (words.length > slotDef.maxWords!) {
                return words.slice(0, slotDef.maxWords).join(" ") + "...";
              }
              return item;
            });
          }
          compiledSlots[slotDef.name] = list;
        } else {
          // Fallback if AI didn't pass array
          compiledSlots[slotDef.name] = [String(value)];
        }
      } else {
        compiledSlots[slotDef.name] = value;
      }
    }
  }

  // Remove duplicates across slots (naive check)
  const seenTexts = new Set<string>();
  for (const [key, val] of Object.entries(compiledSlots)) {
    if (typeof val === "string") {
      const lower = val.toLowerCase();
      if (seenTexts.has(lower) && val.length > 3) {
        // AI repeated the same text in another slot
        compiledSlots[key] = ""; // Clear duplicate
      } else {
        seenTexts.add(lower);
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
