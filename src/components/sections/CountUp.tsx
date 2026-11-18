"use client";

import { useEffect, useRef } from "react";

interface CountUpProps {
  value: number;
  suffix?: string;
  className?: string;
}

const DURATION_MS = 1400;
/** expo-out: fast start, long settle — the "physical" personality of the brief */
const easeExpoOut = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * A metric that counts up from zero the first time it scrolls into view.
 *
 * The server renders the final value, so no-JS, crawlers and reduced-motion visitors read the real
 * number. Frames write straight to the text node — no React state, no re-render per frame. Screen
 * readers get a stable hidden copy, since the animated digits are hidden from them.
 */
export function CountUp({ value, suffix = "", className }: CountUpProps) {
  const digitsRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = digitsRef.current;
    if (!el || value <= 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // nothing to animate without the observer; keep the server-rendered value
    if (typeof IntersectionObserver === "undefined") return;

    let frame = 0;
    let shown = -1;
    const write = (n: number) => {
      if (n === shown) return; // only touch the DOM when the visible digit changes
      shown = n;
      el.textContent = String(n);
    };

    write(0);

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / DURATION_MS);
          write(Math.round(easeExpoOut(t) * value));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      // leave the true value behind if we unmount mid-count (e.g. fast refresh)
      el.textContent = String(value);
    };
  }, [value]);

  return (
    <span className={className}>
      <span aria-hidden="true">
        <span ref={digitsRef}>{value}</span>
        {suffix}
      </span>
      <span className="u-visually-hidden">
        {value}
        {suffix}
      </span>
    </span>
  );
}
