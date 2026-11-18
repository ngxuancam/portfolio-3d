"use client";

import { useEffect, useRef } from "react";
import { shipAnchors, type AnchorId } from "@/lib/three/shipAnchors";
import { sceneSignals } from "@/lib/three/sceneSignals";
import { SheetReadout } from "./SheetReadout";
import styles from "./BlueprintSheet.module.css";

/** Callouts: which landmark each points at, the label, and the row its label sits on (% of height). */
const CALLOUTS: readonly { id: AnchorId; text: string; row: number }[] = [
  { id: "cupola", text: "Command Cupola", row: 26 },
  { id: "wingR", text: "Wing Spar", row: 56 },
  { id: "tail", text: "Aft Thrusters", row: 84 },
];

const pct = (n: number) => n.toFixed(2);

/**
 * The engineering-sheet furniture of the Blueprint theme: sheet frame, edge rulers,
 * crosshair corners, a title block — and callouts whose leader lines and wingspan
 * dimension follow the flying ship. The stage reports where the ship's landmarks are on
 * screen (lib/three/shipAnchors.ts); this writes them straight into the SVG and labels,
 * so React never re-renders per frame. Visible only when the theme sets `--sheet: 1`.
 * ponytail: leaders ignore occlusion by the hull and may cross when the ship banks hard.
 */
export function BlueprintSheet() {
  const heroRef = useRef<HTMLDivElement>(null);
  const cineRef = useRef<HTMLDivElement>(null);
  const leaderRefs = useRef<(SVGPathElement | null)[]>([]);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const dimRef = useRef<SVGPathElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const update = () => {
      const { visible, points, speed } = shipAnchors.current;
      cineRef.current?.style.setProperty("--cine", (visible ? speed : 0).toFixed(3));
      // callouts belong to the hero shot: they fade out over the first half of the hero scroll
      const fade = Math.max(0, 1 - sceneSignals.scroll / 0.5);
      hero.dataset.live = String(visible && fade > 0);
      hero.style.opacity = String(fade);
      if (!visible || fade <= 0) return;

      CALLOUTS.forEach((c, i) => {
        const [ax, ay] = points[c.id];
        const x = ax * 100;
        const y = ay * 100;
        const lx = Math.min(90, Math.max(86, x + 5)); // where the label starts
        // diagonal off the landmark, then a horizontal run into the label
        leaderRefs.current[i]?.setAttribute("d", `M${pct(x)} ${pct(y)} L${pct(lx - 4)} ${c.row} L${pct(lx)} ${c.row}`);
        const label = labelRefs.current[i];
        if (label) {
          label.style.left = `${lx + 0.6}%`;
          label.style.top = `${c.row}%`;
        }
      });

      // wingspan: a dimension line above the ship, between the two wing tips
      const [lx, ly] = points.wingL;
      const [rx, ry] = points.wingR;
      const x1 = lx * 100;
      const x2 = rx * 100;
      const yd = Math.max(13, Math.min(ly, ry) * 100 - 7);
      dimRef.current?.setAttribute(
        "d",
        `M${pct(x1)} ${pct(ly * 100)} L${pct(x1)} ${pct(yd)} M${pct(x2)} ${pct(ry * 100)} L${pct(x2)} ${pct(yd)} M${pct(x1)} ${pct(yd)} L${pct(x2)} ${pct(yd)}`,
      );
      const span = spanRef.current;
      if (span) {
        span.style.left = `${(x1 + x2) / 2}%`;
        span.style.top = `${yd - 2}%`;
      }
    };
    update();
    const unsubAnchors = shipAnchors.subscribe(update);
    const unsubScroll = sceneSignals.subscribe(update);
    return () => {
      unsubAnchors();
      unsubScroll();
    };
  }, []);

  return (
    <>
      {/* cinematic letterbox + vignette, opened by the ship's flight speed */}
      <div ref={cineRef} className={styles.cine} aria-hidden="true">
        <div className={`${styles["cine__bar"]} ${styles["cine__bar--top"]}`} />
        <div className={`${styles["cine__bar"]} ${styles["cine__bar--bottom"]}`} />
      </div>
    <div className={styles.sheet} aria-hidden="true">
      <div className={styles["sheet__frame"]} />
      <div className={`${styles["sheet__ruler"]} ${styles["sheet__ruler--x"]}`} />
      <div className={`${styles["sheet__ruler"]} ${styles["sheet__ruler--y"]}`} />
      <span className={`${styles["sheet__cross"]} ${styles["sheet__cross--tl"]}`} />
      <span className={`${styles["sheet__cross"]} ${styles["sheet__cross--tr"]}`} />
      <span className={`${styles["sheet__cross"]} ${styles["sheet__cross--bl"]}`} />
      <span className={`${styles["sheet__cross"]} ${styles["sheet__cross--br"]}`} />

      <div ref={heroRef} className={styles["sheet__hero"]} data-live="false">
        <svg className={styles["sheet__lines"]} viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
          {CALLOUTS.map((c, i) => (
            <path
              key={c.id}
              ref={(el) => {
                leaderRefs.current[i] = el;
              }}
              className={styles["sheet__line"]}
            />
          ))}
          <path ref={dimRef} className={styles["sheet__line"]} />
        </svg>
        {CALLOUTS.map((c, i) => (
          <span
            key={c.id}
            ref={(el) => {
              labelRefs.current[i] = el;
            }}
            className={styles["sheet__label"]}
          >
            {c.text}
          </span>
        ))}
        <span ref={spanRef} className={`${styles["sheet__label"]} ${styles["sheet__label--center"]}`}>
          135 m
        </span>
      </div>

      <dl className={styles["sheet__title"]}>
        <div><dt>Project</dt><dd>NXC-01 Portfolio</dd></div>
        <div><dt>Drawn</dt><dd>N. X. Cam</dd></div>
        <div><dt>Scale</dt><dd>1 : 200</dd></div>
        <div><dt>Stage</dt><dd><SheetReadout field="stage" /></dd></div>
        <div><dt>Scroll</dt><dd><SheetReadout field="scroll" /></dd></div>
      </dl>
    </div>
    </>
  );
}
