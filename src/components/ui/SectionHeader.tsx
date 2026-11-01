import styles from "./SectionHeader.module.css";

interface SectionHeaderProps {
  index: string;
  eyebrow: string;
  title: string;
  titleId: string;
  lead?: string;
}

/** Server component: consistent, crawlable section heading with its own reveal hooks. */
export function SectionHeader({ index, eyebrow, title, titleId, lead }: SectionHeaderProps) {
  return (
    <header className={styles["section-header"]}>
      <p className={styles["section-header__eyebrow"]} data-reveal="fade">
        <span className={styles["section-header__index"]}>{index}</span>
        {eyebrow}
      </p>
      <h2 id={titleId} className={styles["section-header__title"]} data-reveal="rise">
        {title}
      </h2>
      {lead && (
        <p className={styles["section-header__lead"]} data-reveal="rise">
          {lead}
        </p>
      )}
    </header>
  );
}
