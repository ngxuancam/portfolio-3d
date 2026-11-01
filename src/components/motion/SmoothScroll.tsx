"use client";

import { useEffect } from "react";
import { smoothScrollStore } from "@/lib/animation/smoothScrollStore";

/**
 * Inertial smooth scrolling, driven by GSAP's ticker so Lenis, ScrollTrigger and the
 * WebGL loop all advance on the same frame — no double rAF, no scroll/scene drift.
 * Skipped for reduced-motion users and touch devices (native scrolling stays untouched);
 * Lenis and GSAP are imported only where they will run.
 */
export function SmoothScroll() {
  useEffect(() => {
    // Every load starts on the hero: drop any #section from the URL and reset the scroll.
    // Repeated on `load` because the browser / router can restore the old offset late.
    if (window.location.hash)
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    const resetToTop = () => {
      window.scrollTo(0, 0);
      smoothScrollStore.get()?.scrollTo(0, { immediate: true, force: true });
    };
    resetToTop();
    if (document.readyState !== "complete")
      window.addEventListener("load", resetToTop, { once: true });

    // Touch devices keep native scrolling: it is already inertial and runs on the
    // compositor, so Lenis would only add a per-frame JS loop on the weakest CPUs.
    if (
      window.matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse)")
        .matches
    ) {
      return () => window.removeEventListener("load", resetToTop);
    }

    let cleanup: (() => void) | undefined;
    let cancelled = false;
    void Promise.all([import("lenis"), import("@/lib/animation/gsap")]).then(
      ([{ default: Lenis }, { gsap, ScrollTrigger }]) => {
        if (cancelled) return;
        const lenis = new Lenis({
          lerp: 0.09,
          wheelMultiplier: 0.9,
          anchors: { offset: -80 },
          // let islands (the hero snap) claim an input before any scrolling starts. Lenis skips
          // preventDefault for claimed events, so cancel the native scroll here — otherwise the
          // browser would still move the page under the glide.
          virtualScroll: ({ deltaY, event }) => {
            if (!smoothScrollStore.intercept(deltaY)) return true;
            if (event.cancelable) event.preventDefault();
            return false;
          },
        });
        lenis.on("scroll", ScrollTrigger.update);
        smoothScrollStore.set(lenis);
        resetToTop();

        const tick = (time: number) => lenis.raf(time * 1000);
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);
        document.documentElement.classList.add("has-smooth-scroll");

        cleanup = () => {
          gsap.ticker.remove(tick);
          smoothScrollStore.set(null);
          lenis.destroy();
          document.documentElement.classList.remove("has-smooth-scroll");
        };
      },
    );

    return () => {
      cancelled = true;
      window.removeEventListener("load", resetToTop);
      cleanup?.();
    };
  }, []);

  return null;
}
