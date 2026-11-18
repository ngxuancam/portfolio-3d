import type { ReactNode } from "react";
import styles from "./Chapter.module.css";

/**
 * Four square registration marks pinned to the corners of the nearest positioned ancestor.
 * Purely decorative, so they are hidden from assistive tech. Reused by chapter frames and cards.
 */
export function CornerMarks({ className }: { className?: string }) {
  return (
    <span className={[styles.corners, className].filter(Boolean).join(" ")} aria-hidden="true">
      <span className={`${styles.corner} ${styles["corner--tl"]}`} />
      <span className={`${styles.corner} ${styles["corner--tr"]}`} />
      <span className={`${styles.corner} ${styles["corner--bl"]}`} />
      <span className={`${styles.corner} ${styles["corner--br"]}`} />
    </span>
  );
}

interface ChapterProps {
  /** must be one of CHAPTERS in lib/scroll/signals — the scroll signals look sections up by id */
  id: "about" | "skills" | "experience" | "projects" | "contact";
  /** 1-based position in the log, shown as "01 / ABOUT" */
  index: number;
  /** short mono label for the index header */
  label: string;
  /** the chapter's h2 */
  title: ReactNode;
  /** HUD readout shown at the right end of the header rule */
  readout: string;
  children: ReactNode;
  className?: string;
}

/**
 * One "chapter" of the lab log. The header (index · rule · readout) spans the whole frame so it
 * reads like an instrument strip across the stage, while the content keeps to the left seven
 * columns on wide screens — the ship being built on the right stays visible through the page.
 */
export function Chapter({ id, index, label, title, readout, children, className }: ChapterProps) {
  const titleId = `${id}-title`;
  const indexText = String(index).padStart(2, "0");

  return (
    <section id={id} data-chapter aria-labelledby={titleId} className={[styles.chapter, className].filter(Boolean).join(" ")}>
      <div className={`u-container ${styles.chapter__frame}`}>
        <CornerMarks />
        {/* the index repeats the h2 for sighted readers only, so it is hidden from the a11y tree */}
        <div className={styles.chapter__head} aria-hidden="true">
          <span className={`u-label ${styles.chapter__index} ${styles.strike}`}>
            <span className={styles.chapter__num}>{indexText}</span> / {label}
          </span>
          <span className={styles.chapter__rule} />
          <span className={`u-label ${styles.chapter__readout} ${styles.strike}`}>{readout}</span>
        </div>
        <div className={styles.chapter__column}>
          <h2 id={titleId} className={`${styles.chapter__title} ${styles.reveal}`}>
            {title}
          </h2>
          {children}
        </div>
      </div>
    </section>
  );
}

/** Classes shared by every section: scroll reveals, the signal dot, tag lists, mono keys. */
export { styles as chapterStyles };
