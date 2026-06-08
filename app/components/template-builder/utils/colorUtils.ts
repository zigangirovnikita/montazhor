export function applyOpacity(color: string | undefined | null, opacity: number): string {
  if (!color) return "";
  const alpha = Math.max(0, Math.min(1, opacity));

  // #rrggbb или #rgb
  if (color.startsWith("#")) {
    let hex = color.slice(1);
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
  }

  // rgba(...) - заменяем 4-й параметр
  if (color.startsWith("rgba(")) {
    return color.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, `rgba($1,$2,$3, ${alpha})`);
  }

  // rgb(...) - конвертируем в rgba
  if (color.startsWith("rgb(")) {
    return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  }

  // hsl(...) → hsla(...)
  if (color.startsWith("hsl(")) {
    return color.replace("hsl(", "hsla(").replace(")", `, ${alpha})`);
  }

  // hsla(...) - заменяем последний параметр
  if (color.startsWith("hsla(")) {
    return color.replace(/hsla\(([^,]+),([^,]+),([^,]+),[^)]+\)/, `hsla($1,$2,$3, ${alpha})`);
  }

  // oklch(...) и hwb(...) - используем color-mix через CSS custom property
  // Браузер не может это сделать в JS, поэтому оборачиваем через oklch с / alpha
  if (color.startsWith("oklch(")) {
    // oklch(L C H) → oklch(L C H / alpha)
    // если уже есть / - заменяем, если нет - добавляем перед )
    if (color.includes("/")) {
      return color.replace(/\/[^)]+\)/, `/ ${alpha})`);
    }
    return color.replace(")", ` / ${alpha})`);
  }

  return color;
}
