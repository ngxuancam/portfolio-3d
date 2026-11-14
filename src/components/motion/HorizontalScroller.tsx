"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { themeStore } from "@/theme/themeStore";
import { themes } from "@/theme/themes";

const DESKTOP_MOTION =
  "(min-width: 960px) and (prefers-reduced-motion: no-preference)";

/** blur (px) per px/s of track speed: a card sliding 2 000 px/s smears ~8 px */
const BLUR_PER_SPEED = 0.004;
const SVG_NS = "http://www.w3.org/2000/svg";

interface HorizontalScrollerProps {
  children: ReactNode;
  className?: string;
  trackClassName?: string;
}

/**
 * Pins the section and converts vertical scroll into horizontal travel on
 * desktop. On touch / narrow / reduced-motion it is a normal stacked list:
 * matchMedia reverts the pin and inline styles automatically.
 *
 * Distance is a function-based value with invalidateOnRefresh, so it is
 * re-measured on resize instead of being cached from the first layout.
 *
 * GSAP + ScrollTrigger are imported only when a desktop viewport needs the pin, so
 * phones never download or evaluate them.
 */
export function HorizontalScroller({
  children,
  className,
  trackClassName,
}: HorizontalScrollerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia(DESKTOP_MOTION).matches) return;
    let cancelled = false;
    let revert: (() => void) | undefined;

    void import("@/lib/animation/gsap").then(({ gsap }) => {
      if (cancelled) return;
      const mm = gsap.matchMedia();
      revert = () => mm.revert();
      mm.add(DESKTOP_MOTION, () => {
        const track = trackRef.current;
        const root = rootRef.current;
        if (!track || !root) return;
        const distance = () => track.scrollWidth - root.clientWidth;

        const tween = gsap.to(track, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: root,
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 0.8,
            invalidateOnRefresh: true,
            anticipatePin: 1,
          },
        });

        // cards tilt in as they cross the viewport, tied to the horizontal tween
        gsap.utils
          .toArray<HTMLElement>("[data-card]", track)
          .forEach((card) => {
            gsap.from(card, {
              rotateY: -18,
              scale: 0.92,
              ease: "none",
              scrollTrigger: {
                trigger: card,
                containerAnimation: tween,
                start: "left 95%",
                end: "left 55%",
                scrub: true,
              },
            });
          });

        // Camera motion blur: the cards smear sideways in proportion to how fast the track
        // actually moves (measured, so scrub easing is included). A horizontal-only Gaussian
        // blur from one shared SVG filter; the filter is attached only while there is blur to
        // draw, so resting cards cost nothing. The theme sets the ceiling (0 = off).
        const cards = gsap.utils.toArray<HTMLElement>("[data-card]", track);
        const svg = document.createElementNS(SVG_NS, "svg");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("width", "0");
        svg.setAttribute("height", "0");
        svg.style.position = "absolute";
        svg.innerHTML =
          '<filter id="slide-blur" x="-40%" y="-5%" width="180%" height="110%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="0 0"/></filter>';
        document.body.appendChild(svg);
        const blurNode = svg.querySelector("feGaussianBlur");
        let prevX = Number(gsap.getProperty(track, "x"));
        let blur = 0;
        let filtered = false;
        const tick = (_time: number, deltaMs: number) => {
          const dt = Math.max(deltaMs / 1000, 1e-3);
          const x = Number(gsap.getProperty(track, "x"));
          const speed = Math.abs(x - prevX) / dt;
          prevX = x;
          const target = Math.min(speed * BLUR_PER_SPEED, themes[themeStore.get()].motion.slideBlur);
          blur += (target - blur) * (1 - Math.exp(-dt * 12));
          const on = blur > 0.4;
          if (on) blurNode?.setAttribute("stdDeviation", `${blur.toFixed(2)} 0`);
          if (on !== filtered) {
            filtered = on;
            cards.forEach((card) => (card.style.filter = on ? "url(#slide-blur)" : ""));
          }
        };
        gsap.ticker.add(tick);
        return () => {
          gsap.ticker.remove(tick);
          cards.forEach((card) => (card.style.filter = ""));
          svg.remove();
        };
      });
    });

    return () => {
      cancelled = true;
      revert?.();
    };
  }, []);

  return (
    <div ref={rootRef} className={className}>
      <div ref={trackRef} className={trackClassName}>
        {children}
      </div>
    </div>
  );
}
