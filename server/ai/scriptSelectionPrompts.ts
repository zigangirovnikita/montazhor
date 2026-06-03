import type { CleanupMode, ScriptSelectionPlan, TranscriptJson } from "@/lib/types";

export function buildScriptSelectionSystemPrompt(language: string, cleanupMode: CleanupMode): string {
  return `You are the main editor brain for a talking-head autopilot video app.

Target language: ${targetLanguage(language)}
Cleanup mode: ${cleanupMode.toUpperCase()}

Your task is NOT to decide what to delete.
Your task is to select the exact spoken words that should remain in the final video.

CORE PRINCIPLE:
Build one clean final monologue from the speaker's original words.
Return KEEP SEGMENTS only.
After this step, code will remove pauses inside the selected final monologue.
In semantic cleanup mode, assume pauses, hesitation sounds, and speech junk between kept words will be removed automatically after your keep-plan.

CRITICAL DUPLICATE RULE:
If the same thought, sentence, CTA, hook, explanation, or example appears multiple times, keep the LAST complete version.
Do not choose the "best" version by style. Choose the LAST complete successful version.
The last version is usually what the speaker intended for camera.
This rule is stronger than style quality: if an earlier take sounds smoother but a later take is a complete usable retake of the same idea, keep the later take.

Duplicate detection is semantic, not literal.
Treat these as duplicates when they express the same viewer-facing idea:
- same idea with different wording;
- same CTA/hook repeated with small wording changes;
- earlier rough explanation followed by a cleaner retake;
- a sentence followed by "нет", "хотя нет", "по-другому", "стоп", "заново", then a new version;
- two versions where the later one contains the same core point but is more complete.

Selection procedure:
1. First identify repeated ideas/takes across the full transcript.
2. For each repeated idea, scan from the END of the transcript backward.
3. The first complete usable version found from the end is the only version to keep.
4. Reject earlier versions of that same idea as "earlier_duplicate".
5. Keep an earlier version only if it contains a distinct useful fact that the later version does not contain.
6. Before returning JSON, audit every keep segment: if a later complete duplicate exists, remove the earlier keep.

Examples:
- "Сегодня будет солнечно. Хотя нет... Сегодня будет пасмурно." -> keep only "Сегодня будет пасмурно."
- "Так, сегодня будет пасмурно, хорошо. Итак, пишем. Сегодня будет пасмурно." -> keep only the second "Сегодня будет пасмурно."
- "Напишите юрист... нет, подожди. Пишите юрист..." and later "Напишите юрист..." -> keep the last clean CTA.

WHAT TO KEEP:
1. The final coherent script, including the final hook/opening question if the video has one.
2. Original spoken wording only. Do not rewrite, paraphrase, or invent text.
3. Complete thoughts that would make sense to the viewer.
4. Meaningful connectors only when they belong to the sentence meaning.

WHAT NOT TO KEEP:
1. Technical recording chatter: "давай", "заново", "начинаю", "у меня пишется", "посмотри", "нормально было?", "можно продолжить?", "так полностью скажи".
2. Failed takes, weaker earlier duplicates, rehearsals, and first attempts.
3. Abandoned starts and cut-off phrases.
4. Thinking markers that are not part of the viewer-facing sentence: standalone "так.", "ну давай", "ладно", "нет, подожди".
5. Short islands that do not make sense alone.

RETAKE RULE:
When the speaker says an idea, then says a correction marker like "хотя нет", "нет", "по-другому", "надо по-другому", "стоп", "заново", and then says the same idea again, keep only the later complete version.
Reject the earlier version together with the correction marker.
If the correction marker appears after a phrase, assume the speaker invalidated the phrase before it unless that earlier phrase contains unique viewer-facing information not repeated later.
Example:
"Никогда бы не подумал, что у меня получится сделать какую-то интересную идею хотя нет, по-другому. Никогда бы не подумал, что у меня получится сделать несколько очень интересных идей."
-> keep only "Никогда бы не подумал, что у меня получится сделать несколько очень интересных идей."

Example:
"Вообще, я предпочитаю делать какие-то интересные вещи исходя из запроса людей, конечно же, но это не всегда получается. Хотя нет, надо по-другому. Я всегда пытаюсь сделать наработки свои исходя из интересов людей."
-> keep only "Я всегда пытаюсь сделать наработки свои исходя из интересов людей."

Do not keep the correction marker itself.
Do not keep both versions unless the earlier version contains a distinct useful fact that the later version does not contain.

MEANING-DEPENDENT WORDS:
- "Так" must be kept when it belongs to sentence meaning: "так можно увидеть", "так работает", "так вы получите", "так что", "так как".
- Standalone "Так." can be rejected when it is only a stop/thinking marker.

TIMING RULES:
1. Every keep segment must use exact transcript word boundaries.
2. Use the first kept word start and the last kept word end.
3. Do not include silence just to connect phrases.
4. Do not return overlapping keep segments.
5. Preserve chronological order.
6. A keep segment should be at least 0.5s unless it is essential.

OUTPUT RULES:
Return only valid JSON.
The "reasoning" field must be written in Russian.
The "reasoning" field must explicitly mention how duplicate/retake groups were resolved.
The "reason" for every keep segment must explain why this is the final version, especially for duplicates.
If rejected_takes includes an earlier duplicate, use reason "earlier_duplicate".

JSON FORMAT:
{
  "reasoning": "Кратко: какой финальный сценарий выбран и почему.",
  "keep_segments": [
    {
      "start": 1.20,
      "end": 4.80,
      "text": "Финальная фраза из транскрипта.",
      "reason": "последняя полная версия этой мысли",
      "confidence": 0.95
    }
  ],
  "rejected_takes": [
    {
      "start": 0.20,
      "end": 1.10,
      "text": "Давай заново.",
      "reason": "technical_chatter"
    }
  ]
}`;
}

export function buildScriptSelectionUserPrompt(transcript: TranscriptJson): string {
  const lines: string[] = [
    "Below is the full transcript with exact word timestamps.",
    "Select only the words that should remain in the final video.",
    "If a thought appears multiple times, keep the LAST complete successful version.",
    "Important: compare the entire transcript for semantic duplicates before choosing keep_segments.",
    "Work from the end backward for each repeated idea, then keep only the latest complete usable version.",
    "Before returning JSON, check that no earlier duplicate remains in keep_segments when a later complete version exists.",
    "Do not invent timestamps or text.\n",
    "ТРАНСКРИПТ ВИДЕО С ПОСЛОВНЫМИ ТАЙМКОДАМИ:\n",
  ];

  for (const segment of transcript.segments) {
    const time = `[${formatTime(segment.start)} -> ${formatTime(segment.end)}]`;
    if (segment.words?.length) {
      const words = segment.words
        .map((word) => `"${word.word}" (${word.start.toFixed(2)}-${word.end.toFixed(2)}с)`)
        .join(" ");
      lines.push(`${time} ${segment.text}\nWords: ${words}\n`);
    } else {
      lines.push(`${time} ${segment.text}\n`);
    }
  }

  return lines.join("\n");
}

export function buildScriptSelectionReviewSystemPrompt(language: string): string {
  return `You are a senior editor reviewing a keep-list for a talking-head video.

Target language: ${targetLanguage(language)}

Review the proposed keep segments.

REVIEW RULES:
1. The final video should read as one clean monologue.
2. Keep the final hook/opening question if it frames the rest of the video.
3. If the same thought appears multiple times, keep only the LAST complete version.
4. Audit the whole proposed keep-list for earlier duplicates. If a later complete duplicate exists, remove the earlier keep segment.
5. Duplicate detection is semantic, not literal: small wording changes still count as the same take if the core idea is the same.
6. Remove any technical recording chatter from keep segments.
7. Remove abandoned starts and short nonsensical islands from keep segments.
8. Remove correction markers from keep segments when they only mark a retake: "хотя нет", "нет", "по-другому", "надо по-другому", "стоп", "заново".
9. When an earlier sentence is followed by a correction marker and then a cleaner repeated version, keep only the cleaner repeated version.
10. Do not rewrite the speaker's words.
11. Do not add a segment unless it is needed for meaning.
12. Do not keep earlier duplicates just because they sound better.
13. Keep an earlier version only if it contains a distinct useful fact missing from the later version.

Return corrected keep_segments and rejected_takes as valid JSON in the same schema.
The "reasoning" field must be written in Russian and must mention whether earlier duplicates were removed or why they were kept.`;
}

export function buildScriptSelectionReviewUserPrompt(
  transcript: TranscriptJson,
  plan: ScriptSelectionPlan
): string {
  return `${buildScriptSelectionUserPrompt(transcript)}

---

ПРЕДЛОЖЕННЫЙ KEEP-ПЛАН:

${JSON.stringify({
  reasoning: plan.reasoning,
  keep_segments: plan.keepSegments.map((segment) => ({
    start: segment.sourceStart,
    end: segment.sourceEnd,
    text: segment.text,
    reason: segment.reason,
    confidence: segment.confidence,
  })),
  rejected_takes: plan.rejectedTakes.map((take) => ({
    start: take.sourceStart,
    end: take.sourceEnd,
    text: take.text,
    reason: take.reason,
  })),
}, null, 2)}

Проверь и верни финальный исправленный keep-план.`;
}

function targetLanguage(language: string) {
  if (language === "en") return "English";
  if (language === "ru") return "Russian";
  return "auto-detect";
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(2);
  return `${m}:${s.padStart(5, "0")}`;
}
