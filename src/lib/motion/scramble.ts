import { FRAME_MS, prefersReducedMotion } from "./frames";

/**
 * Glyph-decode text effect: every character starts as a random glyph and resolves to its real
 * value at its own random moment, loosely left to right.
 *
 * The DOM is written on 30 fps frame ticks, not every rAF: on a 120 Hz screen per-rAF writes
 * read as noise rather than as a mechanical readout, and cost four times the text layouts.
 */

export const SCRAMBLE_GLYPHS = "▪▫/\\_<>01#";

export interface ScrambleOptions {
  /** total time until the last character resolves, ms (default 12 frames) */
  duration?: number;
  /** 0..1 — how much the resolve order follows reading order (1 = strict sweep) */
  sweep?: number;
  /** glyph set to draw from */
  glyphs?: string;
  /** called once the final text is in place (not called when cancelled) */
  onDone?: () => void;
}

const running = new WeakMap<Element, () => void>();

/** returns `cancel()`, which stops the effect and leaves the final text in place */
export function scramble(el: Element, text: string, opts: ScrambleOptions = {}) {
  running.get(el)?.();

  const finish = () => {
    el.textContent = text;
  };
  if (prefersReducedMotion() || typeof requestAnimationFrame === "undefined") {
    finish();
    opts.onDone?.();
    return () => {};
  }

  const duration = opts.duration ?? FRAME_MS * 12;
  const sweep = opts.sweep ?? 0.6;
  const glyphs = opts.glyphs ?? SCRAMBLE_GLYPHS;
  const chars = Array.from(text);
  const n = Math.max(1, chars.length - 1);
  // whitespace resolves at once so word shapes stay readable while the rest decodes
  const resolveAt = chars.map((ch, i) =>
    /\s/.test(ch) ? 0 : duration * (sweep * (i / n) + (1 - sweep) * Math.random()),
  );

  const start = performance.now();
  let lastTick = -1;
  let raf = 0;

  const tick = (now: number) => {
    const elapsed = now - start;
    const frame = Math.floor(elapsed / FRAME_MS);
    if (frame !== lastTick) {
      lastTick = frame;
      let out = "";
      for (let i = 0; i < chars.length; i++) {
        out += elapsed >= resolveAt[i] ? chars[i] : glyphs[(Math.random() * glyphs.length) | 0];
      }
      el.textContent = out;
    }
    if (elapsed >= duration) {
      finish();
      running.delete(el);
      opts.onDone?.();
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  const cancel = () => {
    cancelAnimationFrame(raf);
    running.delete(el);
    finish();
  };
  running.set(el, cancel);
  return cancel;
}

/**
 * Scramble `target` back into `text` whenever `trigger` is hovered or keyboard-focused.
 * Returns a cleanup. `target` should be aria-hidden with the real text exposed separately
 * (see ScrambleLabel), so assistive tech never reads the glyph soup.
 */
export function bindScrambleHover(trigger: Element, target: Element, text: string, opts: ScrambleOptions = {}) {
  let cancel: (() => void) | null = null;
  const play = () => {
    cancel?.();
    cancel = scramble(target, text, { duration: FRAME_MS * 10, ...opts });
  };
  trigger.addEventListener("pointerenter", play);
  trigger.addEventListener("focus", play);
  return () => {
    trigger.removeEventListener("pointerenter", play);
    trigger.removeEventListener("focus", play);
    cancel?.();
  };
}
