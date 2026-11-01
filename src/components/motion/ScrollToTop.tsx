"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { smoothScrollStore } from "@/lib/animation/smoothScrollStore";
import styles from "./ScrollToTop.module.css";

const RING_RADIUS = 22;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/**
 * Glass "back to top" button with a brass page-progress ring.
 *  - the ring is a CSS scroll-driven animation (no JS per scroll)
 *  - visibility flips a data-attribute from an IntersectionObserver on the hero: shown
 *    once most of the hero has scrolled away
 * Scrolling never re-renders React and needs no animation library.
 */
export function ScrollToTop() {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const button = buttonRef.current;
    const hero = document.getElementById("top");
    if (!button || !hero) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        button.dataset.visible = String(entry.intersectionRatio < 0.2);
      },
      { threshold: [0, 0.2, 1] },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  // Footer avoidance: while the footer is on screen, `--footer-lift` (on the root, so the
  // idle-loaded loupe switch can use it too) holds how far it has risen into the viewport.
  // The scroll listener only exists while the footer intersects.
  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      frame = 0;
      const lift = Math.max(0, window.innerHeight - footer.getBoundingClientRect().top);
      root.style.setProperty("--footer-lift", `${lift.toFixed(1)}px`);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        update();
      } else {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
        cancelAnimationFrame(frame);
        frame = 0;
        root.style.removeProperty("--footer-lift");
      }
    });
    observer.observe(footer);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
      root.style.removeProperty("--footer-lift");
    };
  }, []);

  const handleClick = () => smoothScrollStore.scrollTo(0, { duration: 1.8 });

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`${styles["scroll-top"]} u-glass u-glass--lens`}
      data-visible="false"
      onClick={handleClick}
      aria-label="Back to top"
      style={{ "--ring-length": RING_LENGTH } as CSSProperties}
    >
      <svg className={styles["scroll-top__ring"]} viewBox="0 0 48 48" aria-hidden="true">
        <circle className={styles["scroll-top__track"]} cx="24" cy="24" r={RING_RADIUS} />
        <circle
          className={styles["scroll-top__progress"]}
          cx="24"
          cy="24"
          r={RING_RADIUS}
          strokeDasharray={RING_LENGTH}
          strokeDashoffset={RING_LENGTH}
        />
      </svg>
      <svg className={styles["scroll-top__arrow"]} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />
      </svg>
    </button>
  );
}
