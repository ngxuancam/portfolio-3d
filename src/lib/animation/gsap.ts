import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

/**
 * Singleton plugin registration. Every client island imports gsap from here,
 * so plugins are registered exactly once and never during SSR.
 */
if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP, ScrollTrigger);
  gsap.defaults({ ease: "power3.out", duration: 0.9 });
}

export { gsap, ScrollTrigger, useGSAP };

/** Shared breakpoints for gsap.matchMedia() — motion is opt-in, never forced. */
export const MEDIA = {
  motion: "(prefers-reduced-motion: no-preference)",
  desktopMotion: "(min-width: 960px) and (prefers-reduced-motion: no-preference)",
} as const;
