export const russianFillers = ["ээ", "эм", "ну", "типа", "короче", "как бы", "вот", "значит", "это самое"];
export const englishFillers = ["um", "uh", "like", "you know", "so", "basically", "actually", "i mean"];

export function isFillerWord(text: string) {
  const normalized = text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s]+/gu, "");
  if (russianFillers.includes(normalized) || englishFillers.includes(normalized)) return true;

  // Whisper often writes hesitation sounds with repeated letters:
  // "эээ", "ээээ", "ммм", "мммм", "эммм". Single "а" is a meaningful word, so only repeated forms count.
  return /^э{2,}$/.test(normalized) || /^м{2,}$/.test(normalized) || /^эм{2,}$/.test(normalized) || /^а{2,}$/.test(normalized);
}
