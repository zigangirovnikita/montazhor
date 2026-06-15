export type SlotValue = string | number | boolean | null | undefined;
export type SlotMap = Record<string, SlotValue | SlotValue[]>;

export function slotString(slots: SlotMap, key: string, fallback: string) {
  const value = slots[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}
