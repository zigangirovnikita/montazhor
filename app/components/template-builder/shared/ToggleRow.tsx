import type { TemplateBlockBase } from "@/lib/templateBuilder";
import styles from "../../TemplateBuilder.module.css";

export function ToggleRow({ block, onChange }: { block: TemplateBlockBase; onChange: (enabled: boolean) => void }) {
  return (
    <div className={styles.group}>
      <label className={styles.toggleRow} style={{ padding: "16px 20px" }}>
        <span>Включить элемент в этом шаблоне</span>
        <input
          type="checkbox"
          checked={block.enabled}
          onChange={(e) => {
            e.stopPropagation();
            onChange(e.target.checked);
          }}
          onClick={(e) => e.stopPropagation()}
        />
      </label>
    </div>
  );
}
