import styles from "../../TemplateBuilder.module.css";

export type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
};

export function ConfirmDialog({
  state,
  onClose,
  onConfirm
}: {
  state: ConfirmState | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!state) return null;
  
  return (
    <div className={styles.confirmOverlay} role="dialog" aria-modal="true" aria-labelledby="template-confirm-title" aria-describedby="template-confirm-message">
      <div className={styles.confirmCard}>
        <p className={styles.confirmKicker}>Подтверждение</p>
        <h2 id="template-confirm-title">{state.title}</h2>
        <p id="template-confirm-message">{state.message}</p>
        <div className={styles.confirmActions}>
          <button type="button" onClick={onClose}>Отмена</button>
          <button type="button" onClick={onConfirm}>{state.confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
