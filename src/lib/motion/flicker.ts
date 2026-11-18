import { f, prefersReducedMotion } from "./frames";

/**
 * Lamp flickers for chrome elements: "strike" to appear, "off" to disappear.
 *
 * Each keyframe holds its level until the next (`steps(1, end)`), so the element snaps between
 * brightness levels like a filament instead of fading — that hard edge is the whole effect.
 * Both use `fill: "forwards"` so the final opacity sticks without touching inline styles; cancel
 * the returned Animation to hand control back to CSS.
 */

const HOLD = "steps(1, end)";

const STRIKE: Keyframe[] = [
  { opacity: 0, easing: HOLD, offset: 0 },
  { opacity: 1, easing: HOLD, offset: 0.001 },
  { opacity: 0.05, easing: HOLD, offset: 0.14 },
  { opacity: 0.9, easing: HOLD, offset: 0.29 },
  { opacity: 0.1, easing: HOLD, offset: 0.41 },
  { opacity: 1, offset: 1 },
];

const OFF: Keyframe[] = [
  { opacity: 0.15, easing: HOLD, offset: 0 },
  { opacity: 0.85, easing: HOLD, offset: 0.22 },
  { opacity: 0.08, easing: HOLD, offset: 0.45 },
  { opacity: 0.5, easing: HOLD, offset: 0.68 },
  { opacity: 0, offset: 1 },
];

interface FlickerOptions {
  /** start delay in ms (use `f(n)` to author in frames) */
  delay?: number;
  /** override the default duration in ms */
  duration?: number;
}

function run(el: Element, keyframes: Keyframe[], duration: number, end: number, opts: FlickerOptions) {
  if (prefersReducedMotion() || typeof (el as HTMLElement).animate !== "function") {
    // instant state: still reach the end opacity so callers can rely on the outcome
    (el as HTMLElement).style.opacity = String(end);
    return null;
  }
  return (el as HTMLElement).animate(keyframes, {
    duration: opts.duration ?? duration,
    delay: opts.delay ?? 0,
    fill: opts.delay ? "both" : "forwards",
  });
}

/** appear with the "strike" flicker (≈ 8½ frames) */
export function strike(el: Element, opts: FlickerOptions = {}) {
  return run(el, STRIKE, f(8.4), 1, opts);
}

/** disappear with the "off" flicker (≈ 9 frames) */
export function switchOff(el: Element, opts: FlickerOptions = {}) {
  return run(el, OFF, f(9.3), 0, opts);
}

/** 2–3 frame brightness blip for presses and confirmations */
export function blip(el: Element, opts: FlickerOptions = {}) {
  if (prefersReducedMotion() || typeof (el as HTMLElement).animate !== "function") return null;
  return (el as HTMLElement).animate(
    [
      { filter: "brightness(1.8)", easing: HOLD, offset: 0 },
      { filter: "brightness(0.7)", easing: HOLD, offset: 0.4 },
      { filter: "brightness(1)", offset: 1 },
    ],
    { duration: opts.duration ?? f(3), delay: opts.delay ?? 0 },
  );
}
