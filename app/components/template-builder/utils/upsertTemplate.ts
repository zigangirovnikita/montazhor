import type { StoredTemplate } from "@/lib/templateBuilder";

export function upsertTemplate(list: StoredTemplate[], item: StoredTemplate) {
  const next = [...list];
  const idx = next.findIndex((t) => t.id === item.id);
  if (idx > -1) {
    next[idx] = item;
  } else {
    next.push(item);
  }
  return next;
}
