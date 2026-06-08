import { templateBlockLabels, templateTabs, type TemplateEditorTab, type VisualTemplateData } from "@/lib/templateBuilder";
import styles from "../../TemplateBuilder.module.css";

export function TabRail({
  draft,
  activeTab,
  switchTab
}: {
  draft: VisualTemplateData;
  activeTab: TemplateEditorTab;
  switchTab: (tab: TemplateEditorTab) => void;
}) {
  return (
    <aside className={styles.rail} aria-label="Разделы шаблона">
      {templateTabs.map((tab) => {
        const isEnabled = tab === "theme"
          ? true
          : tab === "elements"
            ? (draft.blocks.list.enabled || draft.blocks.comparison.enabled || draft.blocks.accent.enabled || draft.blocks.chart.enabled || draft.blocks.cta.enabled)
            : draft.blocks[tab].enabled;
            
        return (
          <button
            className={`${styles.category} ${tab === activeTab ? styles.active : ""}`}
            key={tab}
            type="button"
            onClick={() => switchTab(tab)}
          >
            <strong>
              <i className={isEnabled === false ? styles.dotOff : styles.dotOn} />
              {templateBlockLabels[tab].title}
            </strong>
            <span>{templateBlockLabels[tab].note}</span>
          </button>
        );
      })}
    </aside>
  );
}
