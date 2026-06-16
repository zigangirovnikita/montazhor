import type { RemappedWord, Phrase } from "./types";

export function buildPhrases(words: RemappedWord[]): Phrase[] {
  const phrases: Phrase[] = [];
  if (words.length === 0) return phrases;

  let currentPhraseWords: RemappedWord[] = [];
  let phraseIndex = 1;

  const commitPhrase = () => {
    if (currentPhraseWords.length === 0) return;
    
    const outputStart = currentPhraseWords[0].outputStart;
    const outputEnd = currentPhraseWords[currentPhraseWords.length - 1].outputEnd;
    const text = currentPhraseWords.map(w => w.text).join(" ");
    
    const sourceSpans: { sourceStart: number; sourceEnd: number }[] = [];
    let currentSpan = { sourceStart: currentPhraseWords[0].sourceStart, sourceEnd: currentPhraseWords[0].sourceEnd };
    
    for (let i = 1; i < currentPhraseWords.length; i++) {
      const w = currentPhraseWords[i];
      if (w.sourceStart - currentSpan.sourceEnd < 0.1) {
        currentSpan.sourceEnd = w.sourceEnd;
      } else {
        sourceSpans.push(currentSpan);
        currentSpan = { sourceStart: w.sourceStart, sourceEnd: w.sourceEnd };
      }
    }
    sourceSpans.push(currentSpan);

    phrases.push({
      id: `p${String(phraseIndex).padStart(2, '0')}`,
      outputStart,
      outputEnd,
      text,
      wordIds: currentPhraseWords.map(w => w.id),
      sourceSpans
    });
    phraseIndex++;
    currentPhraseWords = [];
  };

  const isListMarker = (word: string) => /^(первый|второй|третий|способ|ошибка|правило)$/i.test(word);
  const isRuleMarker = (word: string) => /^(не|нельзя|ошибка)$/i.test(word);
  const isCtaMarker = (word: string) => /^(напишите|сохраните|подпишитесь)$/i.test(word);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    if (currentPhraseWords.length > 0) {
      const lastWord = currentPhraseWords[currentPhraseWords.length - 1];
      const pause = word.outputStart - lastWord.outputEnd;
      const currentDuration = lastWord.outputEnd - currentPhraseWords[0].outputStart;

      let split = false;

      // Rule 1: Pause > 0.45s
      if (pause > 0.45) split = true;
      // Rule 2: Too long > 6s
      if (currentDuration > 6.0) split = true;
      
      // Semantic split triggers
      const cleanWord = word.text.replace(/[^\wа-яА-ЯёЁ]/g, "");
      if (isListMarker(cleanWord) || isRuleMarker(cleanWord) || isCtaMarker(cleanWord)) {
        if (currentDuration > 1.5) {
          split = true;
        }
      }

      if (split) {
        commitPhrase();
      }
    }

    currentPhraseWords.push(word);
  }

  commitPhrase();

  // Merge short phrases (< 0.8s) if not last
  const mergedPhrases: Phrase[] = [];
  let i = 0;
  while (i < phrases.length) {
    const p = phrases[i];
    const dur = p.outputEnd - p.outputStart;
    
    if (dur < 0.8 && i < phrases.length - 1) {
      const nextP = phrases[i + 1];
      // Merge p into nextP
      nextP.outputStart = p.outputStart;
      nextP.text = p.text + " " + nextP.text;
      nextP.wordIds = [...p.wordIds, ...nextP.wordIds];
      nextP.sourceSpans = [...p.sourceSpans, ...nextP.sourceSpans];
      // Don't push p, just let nextP absorb it
      i++;
    } else {
      mergedPhrases.push(p);
      i++;
    }
  }

  return mergedPhrases.map((p, idx) => ({ ...p, id: `p${String(idx + 1).padStart(2, '0')}` }));
}
