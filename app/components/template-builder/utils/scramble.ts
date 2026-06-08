export function scramble(word: string, seed: number) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const len = Math.max(3, word.length);
  for (let i = 0; i < len; i++) {
    const idx = (word.charCodeAt(i % word.length) * 17 + seed * 31 + i * 7) % chars.length;
    result += chars[idx];
  }
  return result;
}
