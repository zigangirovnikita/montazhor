import styles from "../../TemplateBuilder.module.css";

export function ChoiceGrid<T extends string>({
  items,
  value,
  onChange
}: {
  items: Array<{ id: T; label: string }>;
  value: string | T;
  onChange: (value: T) => void;
}) {
  return (
    <div className={styles.choiceGrid}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={value === item.id ? styles.segmentedActive : styles.segmented}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
