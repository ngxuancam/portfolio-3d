"use client";

import { useEffect, useRef, type ReactNode } from "react";

const DESKTOP_MOTION =
  "(min-width: 960px) and (prefers-reduced-motion: no-preference)";

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
