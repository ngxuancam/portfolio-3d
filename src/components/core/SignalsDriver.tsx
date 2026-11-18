"use client";

import { useEffect } from "react";
import { CHAPTERS, signals } from "@/lib/scroll/signals";

/**
 * Feeds `signals` (src/lib/scroll/signals.ts) from the page: one passive scroll listener and one
 * rAF per frame against cached chapter offsets — no layout reads while scrolling.
 */
export function SignalsDriver() {
  useEffect(() => {
    const chapters = CHAPTERS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    let tops: number[] = [];
    let viewport = 1;
    let range = 1;
    const measure = () => {
      viewport = window.innerHeight;
      range = Math.max(1, document.documentElement.scrollHeight - viewport);
      tops = chapters.map((el) => el.getBoundingClientRect().top + window.scrollY);
    };

    let frame = 0;
    let lastY = window.scrollY;
    let lastT = performance.now();
    const update = (now: number) => {
      frame = 0;
      const y = window.scrollY;
      const dt = Math.max(1, now - lastT) / 1000;
      signals.velocity = (y - lastY) / range / dt;
      lastY = y;
      lastT = now;
      signals.page = Math.min(1, Math.max(0, y / range));
      let chapter = 0;
      tops.forEach((top, i) => {
        if (i === 0) return;
        const t = (y - (top - viewport)) / viewport;
        if (t > 0) chapter = i - 1 + Math.min(t, 1);
      });
      signals.chapter = chapter;
      signals.notify();
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    const fine = window.matchMedia("(pointer: fine)").matches;
    const onPointer = (event: PointerEvent) => {
      signals.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      signals.pointer.y = -((event.clientY / window.innerHeight) * 2 - 1);
      signals.pointerActive = true;
      signals.notify();
    };
    const onLeave = () => {
      signals.pointerActive = false;
      signals.notify();
    };

    const resize = new ResizeObserver(() => {
      measure();
      onScroll();
    });
    resize.observe(document.body);
    measure();
    update(performance.now());
    window.addEventListener("scroll", onScroll, { passive: true });
    if (fine) {
      window.addEventListener("pointermove", onPointer, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
    }
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return null;
}
