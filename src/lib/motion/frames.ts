/**
 * Time and easing primitives of the motion language (docs/DESIGN.md › Motion language).
 *
 * Mechanical motion is authored in 30 fps frames rather than milliseconds so that every flicker
 * lands on the same beat as the CSS (`calc(n * var(--f))`). The stepped eases mirror the
 * `--ease-ignite` / `--ease-cutout` tokens in globals.css: six equal holds, like a lamp that
 * catches, drops, and catches again.
 */

/** one 30 fps frame, in ms — keep in sync with `--f` */
export const FRAME_MS = 1000 / 30;

/** n frames → ms */
export const f = (n: number) => n * FRAME_MS;

const IGNITE_LEVELS = [0, 0.3, 0.1, 0.8, 0.45, 1] as const;
const CUTOUT_LEVELS = [0, 0.7, 0.35, 0.95, 0.8, 1] as const;

/** hold each level for 1/6 of the duration; t = 1 always lands exactly on 1 */
function stepped(levels: readonly number[]) {
  return (t: number) => {
    if (t >= 1) return 1;
    if (t <= 0) return 0;
    return levels[Math.min(levels.length - 1, Math.floor(t * levels.length))];
  };
}

export const ignite = stepped(IGNITE_LEVELS);
export const cutout = stepped(CUTOUT_LEVELS);

/** smooth "physical" eases for big reveals and camera-like moves */
export const expoOut = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const quartOut = (t: number) => 1 - Math.pow(1 - t, 4);

/** matches the CSS tokens, for WAAPI `easing` options */
export const EASE_EXPO_CSS = "cubic-bezier(0.19, 1, 0.22, 1)";
export const EASE_QUART_CSS = "cubic-bezier(0.25, 1, 0.5, 1)";

/**
 * Live reduced-motion check. Read at call time (not cached at import) so a visitor who flips
 * the OS setting mid-visit gets static states from the next interaction on.
 */
export function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
