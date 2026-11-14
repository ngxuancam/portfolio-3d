import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { themeStore } from "@/theme/themeStore";
import { themes } from "@/theme/themes";

/**
 * Singleton plugin registration. Every client island imports gsap from here,
 * so plugins are registered exactly once and never during SSR.
 */
if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP, ScrollTrigger);
  // tweens created from now on use the active theme's feel (running ones finish as they were)
  const applyMotion = () => {
    const { gsapEase, gsapDuration } = themes[themeStore.get()].motion;
    gsap.defaults({ ease: gsapEase, duration: gsapDuration });
  };
  applyMotion();
  themeStore.subscribe(applyMotion);
}

export { gsap, ScrollTrigger, useGSAP };

/** Shared breakpoints for gsap.matchMedia() — motion is opt-in, never forced. */
export const MEDIA = {
  motion: "(prefers-reduced-motion: no-preference)",
  desktopMotion: "(min-width: 960px) and (prefers-reduced-motion: no-preference)",
} as const;
