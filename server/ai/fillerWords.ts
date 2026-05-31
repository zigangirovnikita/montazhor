import { isElongatedHesitationToken } from "@/server/ai/cutTimingPolicy";

export const russianFillers = ["ээ", "эм", "ну", "типа", "короче", "как бы", "вот", "значит", "это самое"];
export const englishFillers = ["um", "uh", "like", "you know", "so", "basically", "actually", "i mean"];

export function normalizeFillerToken(text: string) {
  return text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s]+/gu, "");
}

export function isFillerWord(text: string) {
  const normalized = normalizeFillerToken(text);
  if (russianFillers.includes(normalized) || englishFillers.includes(normalized)) return true;

  return isElongatedHesitationToken(normalized);
}
