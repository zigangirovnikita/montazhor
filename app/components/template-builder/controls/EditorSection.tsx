import type { ReactNode } from "react";
import styles from "../../TemplateBuilder.module.css";
import type { SectionId, Status } from "../types";

export const sectionLabels: Record<SectionId, string> = {
  position: "Позиция",
  colors: "Цвета",
  typography: "Типографика",
  surface: "Подложка",
  motion: "Тени и движение"
};

export function EditorSection({
  section,
  open,
  children,
  onOpen,
  onSave,
  onCancel,
  status
}: {
  section: SectionId;
  open: boolean;
  children: ReactNode;
  onOpen: () => void;
  onSave: () => void;
  onCancel: () => void;
  status: Status;
}) {
  return (
    <section className={styles.group}>
      <button className={styles.sectionHead} type="button" onClick={onOpen}>
        <span>{sectionLabels[section]}</span><b>{open ? "Свернуть" : "Открыть"}</b>
      </button>
      <div className={`${styles.sectionPanel} ${open ? styles.sectionPanelOpen : ""}`}>
        <div className={styles.sectionPanelInner}>
          <div className={styles.sectionBody}>
            {children}
            <div className={styles.sectionActions}>
              <button type="button" onClick={onCancel}>Отменить</button>
              <button type="button" onClick={onSave}>{status === "saving" ? "Сохраняю..." : "Сохранить"}</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
