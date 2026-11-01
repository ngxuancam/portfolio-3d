"use client";

import { memo, useEffect, useRef } from "react";

interface CountUpProps {
  value: number;
  suffix?: string;
  className?: string;
}

const DURATION_MS = 1800;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * The final number is server-rendered (correct for crawlers and no-JS). When it first
 * scrolls into view, a single rAF loop counts up and writes textContent directly —
 * no React state, no re-renders. Visibility comes from an IntersectionObserver, which
 * (unlike scroll-position triggers) never forces a synchronous layout.
 */
function CountUpImpl({ value, suffix = "", className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const run = () => {
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min((now - start) / DURATION_MS, 1);
        el.textContent = `${Math.round(easeOutCubic(t) * value)}${suffix}`;
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        run();
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      el.textContent = `${value}${suffix}`;
    };
  }, [value, suffix]);

  return (
    <span ref={ref} className={className}>
      {value}
      {suffix}
    </span>
  );
}

export const CountUp = memo(CountUpImpl);
