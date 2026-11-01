"use client";

import { memo, useEffect, useRef, type AnchorHTMLAttributes, type ReactNode } from "react";

interface MagneticLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children: ReactNode;
  strength?: number;
}

/** Fraction of the remaining distance covered per 60fps frame (frame-rate corrected). */
const FOLLOW = 0.16;

/**
 * A real <a> (crawlable, keyboard-accessible) that leans toward the pointer.
 * A tiny rAF spring writes `translate` directly — no animation library, no React state;
 * the loop only runs while the link is being hovered or is settling back.
 */
function MagneticLinkImpl({ children, strength = 0.35, ...anchorProps }: MagneticLinkProps) {
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = linkRef.current;
    if (!el || !window.matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;

    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let frame = 0;
    let last = 0;

    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 16.67, 3) : 1;
      last = now;
      const k = 1 - Math.pow(1 - FOLLOW, dt);
      current.x += (target.x - current.x) * k;
      current.y += (target.y - current.y) * k;
      el.style.translate = `${current.x.toFixed(2)}px ${current.y.toFixed(2)}px`;
      const settled = Math.abs(target.x - current.x) < 0.05 && Math.abs(target.y - current.y) < 0.05;
      if (settled) {
        frame = 0;
        last = 0;
      } else {
        frame = requestAnimationFrame(tick);
      }
    };
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      target.x = (event.clientX - rect.left - rect.width / 2) * strength;
      target.y = (event.clientY - rect.top - rect.height / 2) * strength;
      kick();
    };
    const onLeave = () => {
      target.x = 0;
      target.y = 0;
      kick();
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.style.translate = "";
    };
  }, [strength]);

  return (
    <a ref={linkRef} {...anchorProps}>
      {children}
    </a>
  );
}

export const MagneticLink = memo(MagneticLinkImpl);
