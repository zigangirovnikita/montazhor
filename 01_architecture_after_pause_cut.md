# ТЗ 1. Перестроить архитектуру монтажа после обрезки пауз

## Коротко

Нужно заменить текущую логику “добавим разные вставки” на архитектуру:

```text
обрезанное видео + remapped word timings
→ смысловые фразы
→ семантический разбор каждой фразы
→ визуальный план слоёв
→ HyperFrames overlay
→ финальная композиция
```

Главная цель - чтобы приложение думало не “какую вставку добавить”, а:

```text
что означает эта фраза
→ какие смысловые части в ней есть
→ что нужно визуально выделить
→ какой готовый компонент подходит
→ когда он должен появиться и исчезнуть
```

Важно: автор видео не должен договаривать фразу на “голом” видео после того, как вставка уже исчезла. Все визуальные вставки должны режиссёрно совпадать с произносимыми словами.

---

## Контекст

Репозиторий: `https://github.com/zigangirovnikita/montazhor/`

Ограничение: человек, который дал это ТЗ, не видит всю текущую картину репозитория целиком. Поэтому перед реализацией нужно самому изучить текущую архитектуру:

- где происходит транскрибация;
- где формируется EDL;
- где рендерится clean cut;
- где строятся субтитры;
- где сейчас находится ContentPlanner / MotionInsert / HyperFrames render;
- где происходит финальная композиция;
- какие артефакты уже пишутся в `storage/projects/{projectId}`;
- какие типы уже есть в `lib/types`.

Нельзя бездумно удалить старую логику. Нужно встроить новый слой так, чтобы старый пайплайн не сломался.

---

## Главная проблема, которую нужно исправить

Сейчас визуальная логика слишком похожа на:

```text
найдём место и вставим карточку/инфографику/субтитры
```

Нужно сделать:

```text
разберём каждую фразу по смыслу
→ поймём, что в ней нужно визуально показать
→ создадим слои, привязанные к словам и таймингам
```

Пример:

Фраза:

```text
Не режьте мышкой, лучше используйте Command+B
```

Плохой результат:

```text
на экране 1 секунду появляется “Command+B”
потом вставка исчезает
а автор ещё 5 секунд говорит эту же мысль
```

Правильный результат:

```text
пока автор говорит “не режьте мышкой” - появляется “нарезка мышкой” и зачёркивается
пока автор говорит “лучше используйте Command+B” - появляется “используйте [⌘] [B]”
слой держится до конца смысловой фразы, а не исчезает раньше речи
```

---

## Ключевой архитектурный инвариант

Все визуальные вставки после обрезки пауз должны работать в **таймлайне готового обрезанного видео**, а не в исходном таймлайне.

Нельзя использовать исходные `word.start` / `word.end` напрямую после EDL, если видео уже было склеено из kept ranges.

Нужно ввести явное различение:

```ts
sourceStart: number; // время в исходном видео
sourceEnd: number;

outputStart: number; // время в обрезанном видео
outputEnd: number;
```

Для визуальных слоёв обязательно использовать `outputStart/outputEnd`.

---

## Новый пайплайн

После текущего этапа обрезки пауз должен появиться новый блок:

```text
1. transcript.json
2. edl.json
3. remapTranscriptToOutputTimeline()
4. phrases.json
5. semanticAnalysis.json
6. visualPlan.json
7. visual-overlay/index.html
8. compose final video with overlay
```

Желаемый общий пайплайн:

```text
upload
→ extract audio
→ transcribe with word timings
→ normalize timings
→ build EDL / remove pauses
→ render clean cut
→ remap transcript words to clean-cut output timeline
→ build semantic phrases
→ build semantic visual plan
→ compile visual plan to HyperFrames overlay
→ render overlay
→ compose clean video + captions + visual overlay
→ final export
```

---

## Артефакт 1: `remappedTranscript.json`

Создать функцию:

```ts
remapTranscriptToOutputTimeline(transcript, edl): RemappedTranscript
```

Она должна:

1. Пройти по `edl.keptRanges`.
2. Для каждого слова определить, попадает ли оно в kept range.
3. Если слово полностью вырезано - удалить его.
4. Если слово частично пересекается с kept range - обрезать его границы.
5. Перевести `sourceStart/sourceEnd` в `outputStart/outputEnd`.
6. Сохранить связь с оригиналом.

Пример структуры:

```json
{
  "language": "ru",
  "durationOutput": 42.7,
  "words": [
    {
      "id": "w001",
      "text": "Топ",
      "sourceStart": 12.14,
      "sourceEnd": 12.32,
      "outputStart": 0.10,
      "outputEnd": 0.28
    }
  ]
}
```

### Формула remap

Для каждого kept range:

```text
outputCursor = сумма длительностей предыдущих kept ranges

если sourceTime внутри keptRange:
outputTime = outputCursor + (sourceTime - keptRange.sourceStart)
```

Сделать функции:

```ts
sourceToOutputTime(sourceTime, keptRanges): number | null
sourceRangeToOutputRange(sourceStart, sourceEnd, keptRanges): OutputRange[]
```

Если исходный диапазон пересекает несколько kept ranges - вернуть несколько output ranges или разделить слово/фразу. Не склеивать через вырезанную паузу без явного решения.

---

## Артефакт 2: `phrases.json`

Создать `PhraseBuilder`.

Он получает `remappedTranscript.words` и строит смысловые фразы.

Пример:

```json
[
  {
    "id": "p01",
    "outputStart": 0.1,
    "outputEnd": 2.8,
    "text": "Топ-3 способа получить классное видео в CapCut",
    "wordIds": ["w001", "w002", "w003"],
    "sourceSpans": [
      { "sourceStart": 12.14, "sourceEnd": 14.84 }
    ]
  }
]
```

### Правила PhraseBuilder

Использовать комбинацию:

- пунктуация из транскрипта;
- паузы между словами;
- максимальная длина фразы;
- смысловые маркеры;
- начало списка;
- смена мысли;
- CTA-маркеры.

Рекомендуемые стартовые правила:

```text
если пауза между словами > 0.45 сек → возможная граница фразы
если фраза длиннее 6 сек → попытаться разделить
если фраза короче 0.8 сек → склеить с соседней, если это не отдельный акцент
если есть “первый / второй / третий / способ / ошибка / правило” → возможное начало новой фразы
если есть “не делайте / нельзя / ошибка” → возможный отдельный semantic phrase
если есть CTA “напишите / сохраните / подпишитесь” → отдельная фраза
```

### Важно

Фраза должна иметь `outputStart/outputEnd` по первому и последнему слову.  
Не задавать длительность “на глаз”.

---

## Артефакт 3: `semanticAnalysis.json`

Создать `SemanticAnalyzer`.

Он должен определить для каждой фразы:

```ts
type SemanticIntent =
  | "title"
  | "list_title"
  | "step"
  | "rule"
  | "warning"
  | "mistake"
  | "do_dont"
  | "shortcut"
  | "tool"
  | "number_fact"
  | "comparison"
  | "before_after"
  | "benefit"
  | "definition"
  | "example"
  | "cta"
  | "plain_explanation";
```

Пример:

```json
{
  "phraseId": "p03",
  "intent": "do_dont",
  "confidence": 0.89,
  "entities": {
    "badAction": {
      "text": "нарезка мышкой",
      "wordIds": ["w021", "w022"]
    },
    "goodAction": {
      "text": "используйте Command+B",
      "wordIds": ["w027", "w028"]
    },
    "shortcut": {
      "text": "Command+B",
      "keys": ["⌘", "B"],
      "wordIds": ["w028"]
    }
  }
}
```

### Как реализовать

Можно начать с гибрида:

1. Детерминированные правила:
   - числа;
   - `топ-3`, `3 способа`, `5 ошибок`;
   - `первый/второй/третий`;
   - `Command+B`, `Ctrl+K`, `Shift+...`;
   - `не делайте`, `нельзя`, `ошибка`;
   - названия инструментов: CapCut, ChatGPT, Canva, n8n и т.д.
2. Маленький LLM-вызов только для спорных фраз:
   - сократить длинную фразу до визуального текста;
   - определить badAction/goodAction;
   - выбрать semantic intent, если правила не уверены.

Запрещено просить LLM писать HTML/CSS/JS.

---

## Артефакт 4: `visualPlan.json`

Создать `SemanticVisualPlanner`.

Он получает:

- `phrases.json`;
- `semanticAnalysis.json`;
- список доступных компонентов из `ComponentRegistry`;
- style pack;
- настройки плотности.

Он возвращает план визуальных слоёв:

```json
{
  "stylePackId": "dynamic_orange_black",
  "duration": 42.7,
  "layers": [
    {
      "id": "layer-001",
      "phraseId": "p01",
      "component": "number_title_combo",
      "outputStart": 0.1,
      "outputEnd": 2.8,
      "zIndex": 20,
      "timing": {
        "anchor": "phrase",
        "mustCoverPhrase": true,
        "enterDuration": 0.16,
        "exitDuration": 0.16
      },
      "props": {
        "number": "ТОП-3",
        "title": "способа получить классное видео",
        "tool": "CapCut"
      }
    }
  ]
}
```

---

## Самое важное: правила таймингов visualPlan

### 1. Визуальный слой не должен жить меньше смысла

Если слой визуализирует всю фразу, то:

```text
layer.outputStart <= phrase.outputStart + 0.10
layer.outputEnd >= phrase.outputEnd - 0.10
```

Если слой визуализирует часть фразы, то он должен покрывать соответствующие слова:

```text
layer.outputStart <= firstRelevantWord.outputStart + 0.10
layer.outputEnd >= lastRelevantWord.outputEnd - 0.10
```

### 2. Запрещено показывать ключевую фразу на 1 секунду, если автор произносит её 5-7 секунд

Добавить validator:

```ts
if layer.props contains text derived from phrase:
  layerDuration >= min(phraseDuration * 0.65, phraseDuration - 0.2)
```

Исключение: короткий flash/accent layer, но тогда рядом должен быть основной удерживающий слой.

### 3. Использовать режиссёрскую структуру времени

Каждый слой должен иметь:

```text
enter → active/hold → exit
```

Например:

```text
0.00-0.15 появление
0.15-2.55 удержание
2.55-2.80 исчезновение
```

Не делать так:

```text
0.00-0.80 вставка
0.80-5.00 голое видео, хотя фраза продолжается
```

### 4. У layer должно быть понятное основание

Каждый слой должен ссылаться на:

```text
phraseId
wordIds или entityId
timing.anchor
```

Если слой не привязан к фразе/слову - это decorative layer. Таких должно быть мало.

### 5. Heavy effects не должны забивать речь

Добавить density controller:

```json
{
  "maxActiveSemanticLayers": 3,
  "maxHeavyLayersPer10Sec": 2,
  "minGapBetweenHeavyEffects": 1.5,
  "allowCaptionsAlways": true
}
```

---

## Артефакт 5: `timingReport.json`

Создать валидатор таймингов.

Он должен проверять:

- все visual layers используют `outputStart/outputEnd`;
- слой не выходит за duration;
- слой не заканчивается сильно раньше фразы;
- текстовый слой покрывает произносимую фразу;
- shortcut layer покрывает произнесение shortcut;
- `strikeout_replace` покрывает badAction и goodAction;
- нет слишком плотных наложений;
- нет отрицательных/нулевых длительностей;
- нет слоя короче 0.6 сек, если он содержит читаемый текст.

Пример:

```json
{
  "ok": false,
  "warnings": [
    {
      "layerId": "layer-003",
      "type": "ends_too_early",
      "message": "Layer ends at 5.8, but phrase p03 ends at 9.9. It covers only 31% of phrase duration."
    }
  ]
}
```

Если `timingReport.ok === false`, preview должен либо не рендериться, либо рендериться с предупреждением в логах.

---

## Интеграция в текущий пайплайн

Нужно найти текущий участок, где после EDL строится content plan.

Ориентировочно заменить или расширить:

```text
transcript + edl
→ ContentPlanner
```

на:

```text
transcript + edl
→ remappedTranscript
→ phraseBuilder
→ semanticAnalyzer
→ semanticVisualPlanner
→ visualPlan
```

Старый `ContentPlanner` можно временно оставить fallback-режимом.

---

## Требования к логам

Добавить понятные логи:

```text
Visual planning: remapped 842 words to output timeline.
PhraseBuilder: built 37 phrases from 842 words.
SemanticAnalyzer: detected 6 list/step phrases, 3 do/dont phrases, 4 shortcuts.
VisualPlanner: created 21 semantic layers.
TimingValidator: 0 errors, 3 warnings.
Visual overlay rendered via HyperFrames.
```

---

## Тестовые сценарии

Создать минимальные unit/integration tests или fixture scripts.

### Тест 1: remap таймингов

Вход:

```json
keptRanges = [
  { "sourceStart": 10, "sourceEnd": 15 },
  { "sourceStart": 20, "sourceEnd": 25 }
]
```

Ожидание:

```text
source 10 → output 0
source 12 → output 2
source 20 → output 5
source 24 → output 9
source 17 → null
```

### Тест 2: фраза не заканчивается раньше речи

Фраза:

```text
0.0-6.0 “Не режьте мышкой, лучше используйте Command+B”
```

Слой:

```text
0.0-1.0 strikeout_replace
```

Ожидание:

```text
validator error: ends_too_early
```

### Тест 3: правильный do/dont

Фраза:

```text
“Не режьте мышкой, лучше используйте Command+B”
```

Ожидание:

```json
{
  "intent": "do_dont",
  "badAction": "нарезка мышкой",
  "goodAction": "используйте Command+B",
  "shortcut": "Command+B"
}
```

### Тест 4: title with number

Фраза:

```text
“Топ-3 способа получить классное видео в CapCut”
```

Ожидание:

```json
{
  "intent": "list_title",
  "number": "ТОП-3",
  "title": "способа получить классное видео",
  "tool": "CapCut"
}
```

---

## Что нельзя делать

Нельзя:

- добавлять случайные вставки “для красоты” без связи с фразой;
- использовать исходные тайминги после EDL без remap;
- давать LLM писать HyperFrames HTML/CSS/JS на каждый ролик;
- показывать визуальную фразу 1 сек, если автор говорит её 5-7 сек;
- добавлять всю библиотеку HyperFrames до появления нормального visualPlan;
- делать компоненты, которые сами решают абсолютные тайминги внутри себя без layer contract.

---

## Что должно получиться в конце этого этапа

После выполнения ТЗ в проекте должны появиться:

```text
server/visual/phraseBuilder.ts
server/visual/remapTranscript.ts
server/visual/semanticAnalyzer.ts
server/visual/visualPlanner.ts
server/visual/timingValidator.ts
server/visual/types.ts
```

И артефакты проекта:

```text
storage/projects/{projectId}/remappedTranscript.json
storage/projects/{projectId}/phrases.json
storage/projects/{projectId}/semanticAnalysis.json
storage/projects/{projectId}/visualPlan.json
storage/projects/{projectId}/timingReport.json
```

---

## Критерии приёмки

Этап считается готовым, если:

1. После обрезки пауз появляется `remappedTranscript.json`.
2. Все слова имеют `sourceStart/sourceEnd` и `outputStart/outputEnd`.
3. Появляется `phrases.json`.
4. Появляется `semanticAnalysis.json`.
5. Появляется `visualPlan.json`.
6. `visualPlan` использует только output timeline.
7. Есть `timingReport.json`.
8. Валидатор ловит ситуацию, когда вставка исчезает раньше произносимой фразы.
9. Старый пайплайн не сломан.
10. Можно отрендерить видео хотя бы с временным debug overlay, где слои совпадают с речью.
