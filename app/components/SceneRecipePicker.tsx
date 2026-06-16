"use client";

import type { SceneRecipeId } from "@/lib/types";

const labels: Record<SceneRecipeId, string> = {
  hook_title_left: "Hook слева",
  hook_title_center: "Hook по центру",
  headline_with_accent_number: "Заголовок + акцентная цифра",
  step_number_callout: "Шаг с номером",
  before_after_phrase_swap: "До / после",
  rule_card: "Карточка правила",
  list_progression: "Прогрессия списка",
  big_number_grow: "Крупная цифра",
  big_number_plus_text_plate: "Цифра + плашка",
  warning_strike_fix: "Ошибка -> исправление",
  hotkey_command_tip: "Горячая клавиша",
  myth_vs_truth: "Миф vs факт",
  definition_card: "Карточка определения",
  comparison_split: "Сравнение",
  checklist_reveal: "Чек-лист",
  timeline_year_callout: "Таймлайн",
  trust_diagram: "Диаграмма",
  quote_emphasis: "Цитата",
  cta_finish: "CTA",
  speaker_lower_half_top_visual: "Спикер снизу",
  speaker_right_panel_left_infographic: "Спикер справа + инфографика",
  voiceover_full_graphic: "Full graphic",
  camera_punch_in: "Punch-in",
  clean_section_transition: "Переход"
};

export function SceneRecipePicker({
  recipeIds,
  value,
  disabled,
  onChange
}: {
  recipeIds: SceneRecipeId[];
  value: SceneRecipeId;
  disabled?: boolean;
  onChange: (recipeId: SceneRecipeId) => void;
}) {
  return (
    <label className="scene-recipe-picker">
      <span>Сцена</span>
      <select disabled={disabled} value={value} onChange={(event) => onChange(event.target.value as SceneRecipeId)}>
        {recipeIds.map((recipeId) => (
          <option key={recipeId} value={recipeId}>{labels[recipeId] ?? recipeId}</option>
        ))}
      </select>
    </label>
  );
}
