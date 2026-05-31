/**
 * Profanity word lists for Russian and English.
 * Used by semantic cleanup
 * and by the heuristic fallback.
 */

export const russianProfanity = [
  // Основные корни мата и их производные
  "блять", "блядь", "бля",
  "хуй", "хуя", "хуе", "хуё",
  "пизда", "пиздец", "пизд",
  "ебать", "ебаный", "ебан", "ёб", "еб",
  "сука", "суки", "сучка",
  "нахуй", "нахуя", "нахер",
  "пиздец", "пиздато",
  "залупа",
  "мудак", "мудила",
  "дерьмо",
  "жопа", "жопу",
  "херня", "хер", "херово",
];

export const englishProfanity = [
  "fuck", "fucking", "fucked", "fucker",
  "shit", "shitty", "bullshit",
  "damn", "goddamn",
  "ass", "asshole",
  "bitch",
  "bastard",
  "crap",
  "dick", "dickhead",
  "piss",
  "wtf",
];

/**
 * Check if a word is profanity.
 * Uses prefix matching for Russian (morphology) and exact match for English.
 */
export function isProfanity(text: string): boolean {
  const normalized = text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s]+/gu, "");
  if (!normalized) return false;

  // Russian: check if word starts with any profanity root
  if (russianProfanity.some((root) => normalized.startsWith(root) || normalized === root)) {
    return true;
  }

  // English: exact match
  if (englishProfanity.includes(normalized)) {
    return true;
  }

  return false;
}
