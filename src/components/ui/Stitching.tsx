import styles from "./Stitching.module.css";

/**
 * Saddle-stitched seam, like the edge of a leather belt or wallet. A static SVG overlay
 * inset from the card edge; geometry comes from CSS (rect x/y/width/height/rx are CSS
 * properties in SVG 2), so one markup fits every card size. Server component, zero JS.
 *
 * Two strokes per seam: a faint needle-hole shadow offset by 1px, then the brass thread
 * on top — the thread reads as sitting on, not printed into, the card.
 */
export function Stitching() {
  return (
    <svg className={styles.stitching} aria-hidden="true" focusable="false">
      <rect className={styles["stitching__holes"]} />
      <rect className={styles["stitching__thread"]} />
    </svg>
  );
}
