import type Lenis from "lenis";

/**
 * Module-level holder for the single Lenis instance (Singleton). Other islands
 * — the hero snap, the scroll-to-top button — scroll through it so programmatic
 * scrolls share Lenis' easing; when it is absent (reduced motion) they fall back
 * to native scrolling.
 */
let instance: Lenis | null = null;

/** Returns true to swallow a wheel/touch input before Lenis scrolls (e.g. to start a snap). */
export type ScrollInterceptor = (deltaY: number) => boolean;
let interceptor: ScrollInterceptor | null = null;

/** Gentle start and finish: a glide from rest never jolts. */
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const smoothScrollStore = {
  set(lenis: Lenis | null) {
    instance = lenis;
  },
  get(): Lenis | null {
    return instance;
  },
  setInterceptor(next: ScrollInterceptor | null) {
    interceptor = next;
  },
  /** Called by Lenis' virtualScroll hook; true means "handled, don't scroll". */
  intercept(deltaY: number): boolean {
    return interceptor?.(deltaY) ?? false;
  },
  scrollTo(target: number | string | HTMLElement, options: { duration?: number; onComplete?: () => void } = {}) {
    if (instance) {
      instance.scrollTo(target, {
        duration: options.duration ?? 1.4,
        easing: easeInOutCubic,
        lock: true,
        onComplete: options.onComplete,
      });
      return;
    }
    const top =
      typeof target === "number"
        ? target
        : ((typeof target === "string" ? document.querySelector<HTMLElement>(target) : target)?.offsetTop ?? 0);
    window.scrollTo({ top, behavior: "smooth" });
    options.onComplete?.();
  },
};
