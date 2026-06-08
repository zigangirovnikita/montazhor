import { TemplateColorPicker } from "../../TemplateColorPicker";
import styles from "../../TemplateBuilder.module.css";
import type { ControlProps } from "../types";

export function ColorControls({ tab, block, template, updateTheme, updateBlock }: ControlProps) {
  if (tab === "theme") {
    return (
      <>
        <TemplateColorPicker label="Текст" value={template.theme.colorText} onChange={(colorText) => updateTheme({ colorText })} />
        <TemplateColorPicker label="Accent" value={template.theme.colorPrimary} onChange={(colorPrimary) => updateTheme({ colorPrimary })} />
        <TemplateColorPicker label="Background" value={template.theme.colorBackground} onChange={(colorBackground) => updateTheme({ colorBackground })} />
      </>
    );
  }

  return (
    <>
      <TemplateColorPicker label="Текст" value={block?.colorText ?? template.theme.colorText} onChange={(colorText) => updateBlock({ colorText })} />
      <TemplateColorPicker label="Accent" value={block?.colorAccent ?? template.theme.colorPrimary} onChange={(colorAccent) => updateBlock({ colorAccent })} />
      <TemplateColorPicker label="Background" value={block?.colorBackground ?? template.theme.colorBackground} onChange={(colorBackground) => updateBlock({ colorBackground })} />
      <button className={styles.inlineButton} type="button" onClick={() => updateBlock({ colorText: null, colorAccent: null, colorBackground: null })}>Взять из темы</button>
    </>
  );
}
