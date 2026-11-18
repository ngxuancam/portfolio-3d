"use client";

import { useEffect, useRef, useState } from "react";
import { resume } from "@/content/resume";
import { progress } from "@/lib/loading/progress";
import { EASE_EXPO_CSS, f, scramble, switchOff } from "@/lib/motion";
import styles from "./Loader.module.css";

/**
 * Boot screen. Server-rendered as the first element of the page, opaque from the first paint, so
 * the site never flashes before it.
 *
 * Who drives what:
 *  - The intro (frame rules, corner marks, emblem, rail, readout) is pure CSS gated on
 *    `html.has-motion`, so it plays from the first paint — before React has even hydrated.
 *  - Once mounted, JS owns the counter, the bar, the status label and the outro.
 *
 * When does it end? The displayed counter chases `progress` with bounded speed and may only show
 * 100 once `progress.ready` is set and the value is 1 (the 3D agent's `markReady()`, or the 8 s
 * failsafe in progress.ts). The outro starts the frame the counter lands on 100.
 *
 * Fallbacks (why not just hide on `html:not(.has-motion)`: reduced-motion visitors also lack that
 * class but do run JS, and they should still see the real readiness state):
 *  - No JS at all → a <noscript> style removes the overlay before it is ever painted.
 *  - JS present but the bundle fails → a CSS animation fades the overlay out at 9 s. Once
 *    mounted, JS cancels that animation (`loader--live`) and takes over; if hydration itself
 *    arrives after 9 s, the CSS has already done its job and JS just finishes silently.
 *  - prefers-reduced-motion → no choreography, a short fade once ready.
 */

const INITIALS = resume.basics.name
  .split(/\s+/)
  .map((part) => part[0])
  .join("")
  .toUpperCase();
/** studio coordinates for the rail — decorative, not résumé data */
const COORDS = "16.05°N 108.20°E";
/** the static page is prerendered, so this is the year the build ran — hence "BUILD" */
const BUILD_YEAR = new Date().getFullYear();

/** the CSS failsafe fires at 9 s; past this point the overlay is already (being) hidden */
const CSS_FAILSAFE_MS = 8800;

/** counter chase, in percentage points per second */
const CHASE_RATE = 3.2; // fraction of the remaining gap closed per second
const MIN_SPEED = 8; // never crawls slower than this while behind…
const MAX_SPEED = 90; // …and never jumps faster than this
const CREEP_SPEED = 0.8; // when real progress stalls, keep breathing…
const CREEP_LEAD = 6; // …but never run more than this many points ahead of it

const STAGES: readonly [number, string][] = [
  [10, "Calibrating type"],
  [75, "Assembling hull"],
  [100, "Compiling shaders"],
  [Infinity, "Systems nominal"],
];
const stageFor = (value: number) => STAGES.find(([below]) => value < below)![1];

/** emblem: a hull seen from above, nose up, in a 200-unit box */
const HULL_PATHS = [
  "M100 30 L128 118 L150 150 L112 140 L100 160 L88 140 L50 150 L72 118 Z",
  "M100 46 V146",
  "M86 84 H114",
  "M78 108 H122",
  "M72 118 L88 140",
  "M128 118 L112 140",
];
const RING_TICKS = Array.from({ length: 72 }, (_, i) => i * 5);

export function Loader() {
  const [gone, setGone] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const padRef = useRef<HTMLSpanElement>(null);
  const stageRef = useRef<HTMLSpanElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const html = document.documentElement;
    const motion = html.classList.contains("has-motion");

    const finish = () => {
      html.dataset.loaded = "true";
      setGone(true);
    };

    progress.armFailsafe();
    // the fonts stage is ours: Inter 200 and the mono must be in before the counter means anything
    document.fonts?.ready.then(() => progress.done("fonts"), () => progress.done("fonts"));

    if (performance.now() > CSS_FAILSAFE_MS) {
      // hydrated too late: the CSS failsafe already lifted the overlay; do not bring it back
      finish();
      return;
    }

    root.classList.add(styles["loader--live"]);
    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden";

    const timers: ReturnType<typeof setTimeout>[] = [];
    const animations: Animation[] = [];
    const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const track = (a: Animation | null) => a && animations.push(a);
    let cancelScramble: (() => void) | null = null;

    // ── counter loop ────────────────────────────────────────────────
    let shown = 0;
    let lastInt = -1;
    let lastQuarter = -1;
    let stage = stageFor(0);
    let last = performance.now();
    let raf = 0;

    const render = (value: number) => {
      root.style.setProperty("--p", (value / 100).toFixed(4));
      const int = Math.floor(value);
      if (int === lastInt) return;
      lastInt = int;
      const digits = String(int);
      if (counterRef.current) counterRef.current.textContent = digits;
      if (padRef.current) padRef.current.textContent = "000".slice(digits.length);
      // the live region speaks at quarters only: per-percent updates would drown a screen reader
      const quarter = Math.floor(int / 25);
      if (quarter !== lastQuarter && statusRef.current) {
        lastQuarter = quarter;
        statusRef.current.textContent = int >= 100 ? "Loaded" : `Loading ${quarter * 25}%`;
      }
      const next = stageFor(value);
      if (next !== stage && stageRef.current) {
        stage = next;
        cancelScramble?.();
        cancelScramble = scramble(stageRef.current, next);
      }
    };

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const real = progress.value * 100;
      const complete = progress.ready && progress.value >= 1;
      const goal = complete ? 100 : Math.min(99, real);

      if (shown < goal) {
        const speed = Math.min(MAX_SPEED, Math.max(MIN_SPEED, (goal - shown) * CHASE_RATE));
        shown = Math.min(goal, shown + speed * dt);
      } else if (!complete) {
        const cap = Math.min(99, real + CREEP_LEAD);
        if (shown < cap) shown = Math.min(cap, shown + CREEP_SPEED * dt);
      }
      render(shown);

      if (shown >= 100) {
        outro();
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    // ── outro ───────────────────────────────────────────────────────
    const q = (name: string) => root.querySelectorAll<HTMLElement>(`[data-part~="${name}"]`);

    const outro = () => {
      const release = () => {
        html.style.overflow = prevOverflow;
      };

      if (!motion) {
        track(root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" }));
        later(200, () => {
          release();
          finish();
        });
        return;
      }

      // t0: readouts switch off; the bar overloads, then fires away
      q("off").forEach((el, i) => track(switchOff(el, { delay: (i % 3) * f(1) })));
      const bar = root.querySelector<HTMLElement>(`[data-part~="bar"]`);
      if (bar) {
        track(
          bar.animate(
            [
              { filter: "brightness(1)", transform: "scaleX(1)", easing: "steps(1, end)" },
              { filter: "brightness(2.6)", transform: "scaleX(1)", offset: 0.2, easing: EASE_EXPO_CSS },
              { filter: "brightness(2.6)", transform: "scaleX(0)" },
            ],
            { duration: f(3) + 320, fill: "forwards" },
          ),
        );
      }

      // t ≈ 200 ms: a signal line sweeps across, in from the left, out to the right
      const sweep = root.querySelector<HTMLElement>(`[data-part~="sweep"]`);
      if (sweep) {
        track(
          sweep.animate(
            [
              { transform: "scaleX(0)", transformOrigin: "0 50%", offset: 0, easing: EASE_EXPO_CSS },
              { transform: "scaleX(1)", transformOrigin: "0 50%", offset: 320 / 740 },
              { transform: "scaleX(1)", transformOrigin: "100% 50%", offset: 320 / 740, easing: EASE_EXPO_CSS },
              { transform: "scaleX(0)", transformOrigin: "100% 50%", offset: 1 },
            ],
            { duration: 740, delay: f(6), fill: "both" },
          ),
        );
      }

      // t ≈ 520 ms: the frame cuts out behind the sweep
      later(f(6) + 320, () => q("frame").forEach((el) => track(switchOff(el))));

      // t ≈ 700 ms: the veil lifts bottom-up and the site takes over
      later(700, () => {
        release();
        // flagged at the start of the lift, so the hero entrance plays while it is revealed
        html.dataset.loaded = "true";
        track(
          root.animate([{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(0 0 100% 0)" }], {
            duration: 1200,
            easing: EASE_EXPO_CSS,
            fill: "forwards",
          }),
        );
      });
      later(700 + 1200, finish);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      animations.forEach((a) => a.cancel());
      cancelScramble?.();
      html.style.overflow = prevOverflow;
      root.classList.remove(styles["loader--live"]);
    };
  }, []);

  if (gone) return null;

  return (
    <>
      <div ref={rootRef} className={styles.loader} data-loader="" aria-hidden="true">
        {/* without JS nothing would ever lift the overlay, so it is never shown at all */}
        <noscript>
          <style dangerouslySetInnerHTML={{ __html: "[data-loader]{display:none!important}" }} />
        </noscript>

        <span className={`${styles.rule} ${styles["rule--top"]}`} data-part="frame" />
        <span className={`${styles.rule} ${styles["rule--bottom"]}`} data-part="frame" />
        <span className={`${styles.rule} ${styles["rule--left"]}`} data-part="frame" />
        <span className={`${styles.rule} ${styles["rule--right"]}`} data-part="frame" />
        <span className={`${styles.axis} ${styles["axis--x"]}`} data-part="frame" />
        <span className={`${styles.axis} ${styles["axis--y"]}`} data-part="frame" />

        {(["tl", "tr", "bl", "br"] as const).map((corner) => (
          <span key={corner} className={`${styles.corner} ${styles[`corner--${corner}`]}`} data-part="off" />
        ))}

        <svg className={styles.emblem} viewBox="0 0 200 200" fill="none" data-part="off">
          <g className={styles.emblem__ring}>
            {RING_TICKS.map((deg) => (
              <line
                key={deg}
                x1="100"
                y1={deg % 30 === 0 ? 6 : 10}
                x2="100"
                y2="14"
                transform={`rotate(${deg} 100 100)`}
                className={deg % 90 === 0 ? styles["emblem__tick--major"] : undefined}
              />
            ))}
          </g>
          <g className={styles.emblem__ghost}>
            {HULL_PATHS.map((d, i) => (
              <path key={d} d={d} pathLength={1} style={{ animationDelay: `calc(${8 + i * 2} * var(--f))` }} />
            ))}
          </g>
          {/* the built hull follows the counter, not the clock */}
          <g className={styles.emblem__built}>
            {HULL_PATHS.map((d) => (
              <path key={d} d={d} pathLength={1} />
            ))}
          </g>
          <line className={styles.emblem__edge} x1="44" y1="160" x2="156" y2="160" />
        </svg>

        <p className={styles.rail} data-part="off">
          {INITIALS} — PORTFOLIO — {COORDS} — BUILD <span suppressHydrationWarning>{BUILD_YEAR}</span>
        </p>

        <p className={styles.stage} data-part="off">
          <span className={styles.stage__key}>SYS</span>
          <span ref={stageRef}>{stageFor(0)}</span>
        </p>

        <div className={styles.readout}>
          <p className={styles.counter} data-part="off">
            <span ref={padRef} className={styles.counter__pad}>
              00
            </span>
            <span ref={counterRef}>0</span>
          </p>
          <div className={styles.meter}>
            <span className={styles.bar} data-part="bar">
              <span className={styles.bar__fill} />
              <span className={styles.bar__tail} />
            </span>
            <span className={styles.meter__label} data-part="off">
              Loading
            </span>
          </div>
        </div>

        <span className={styles.sweep} data-part="sweep" />
      </div>
      <p ref={statusRef} className="u-visually-hidden" role="status" aria-live="polite">
        Loading 0%
      </p>
    </>
  );
}
