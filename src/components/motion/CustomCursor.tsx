"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/animation/gsap";
import styles from "./CustomCursor.module.css";

const INTERACTIVE = "a, button, [data-cursor]";
/** Loupe art at 1× / 2× of its rendered size (~142px wide at rest, ~192px on hover). */
const FRAME_SRCSET = "/cursor/magnifier-1x.webp 1x, /cursor/magnifier-2x.webp 2x";

/**
 * Magnifying-glass cursor (Sherlock Holmes style) that refracts *everything* beneath it —
 * DOM text and the WebGL stage alike. It is the topmost layer and uses `backdrop-filter`
 * with a pixel-sized SVG magnifying lens (built by GlassLensManager for `.u-glass--lens`),
 * so the browser samples whatever is painted behind it.
 *
 * The frame is a photographed antique loupe (public/cursor/magnifier-{1x,2x}.webp) aligned so its
 * brass ring sits exactly on the lens edge. It is a rigid object, so
 * it only moves and — after the reference liquid-glass demo — swells elastically on hover
 * and dips on press (GSAP `elastic.out(1, 0.3)`). The size change animates width/height,
 * not scale, so the magnified content is rendered fresh at full resolution.
 *
 * Also drives --light-angle so every CSS glass rim glints toward the pointer.
 * Fine pointers only; React never re-renders on pointer movement.
 */
export function CustomCursor() {
  const lensRef = useRef<HTMLDivElement>(null);
  const shapeRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLImageElement>(null);

  useGSAP(() => {
    const lens = lensRef.current;
    const shape = shapeRef.current;
    const dot = dotRef.current;
    if (!lens || !shape || !dot) return;
    const mm = gsap.matchMedia();

    mm.add("(pointer: fine) and (prefers-reduced-motion: no-preference)", () => {
      // the art is only requested where the cursor can exist — never on touch devices
      if (frameRef.current && !frameRef.current.srcset) frameRef.current.srcset = FRAME_SRCSET;
      // rest in the middle of the screen until the pointer first moves — not stuck in the corner
      gsap.set([lens, dot], {
        x: Math.round(window.innerWidth / 2),
        y: Math.round(window.innerHeight / 2),
        xPercent: -50,
        yPercent: -50,
        autoAlpha: 1,
      });
      // the native cursor is hidden only now that the loupe exists (see globals.css)
      document.documentElement.dataset.cursor = "ready";
      // whole pixels: at a fractional offset the lens resamples what it magnifies every
      // frame, which reads as blurry text while the loupe glides
      const lensX = gsap.quickTo(lens, "x", { duration: 0.35, ease: "power3", snap: "x" });
      const lensY = gsap.quickTo(lens, "y", { duration: 0.35, ease: "power3", snap: "y" });
      const dotX = gsap.quickTo(dot, "x", { duration: 0.06, ease: "power3" });
      const dotY = gsap.quickTo(dot, "y", { duration: 0.06, ease: "power3" });

      // elastic size per state — a liquid wobble between them
      const base = shape.offsetWidth;
      const shapeTo = (scale: number) =>
        gsap.to(shape, {
          width: base * scale,
          height: base * scale,
          duration: 1.3,
          ease: "elastic.out(1, 0.3)",
          overwrite: true,
        });
      let state: "idle" | "hover" | "down" = "idle";
      const setState = (next: typeof state) => {
        if (next === state) return;
        state = next;
        shapeTo(next === "hover" ? 1.35 : next === "down" ? 0.86 : 1);
      };

      // glass highlight angle: smoothed through one reused tween, unwrapped so it never
      // spins the long way round when crossing ±180°
      const root = document.documentElement;
      const light = { angle: 135 };
      const lightTo = gsap.quickTo(light, "angle", {
        duration: 0.8,
        ease: "power2.out",
        onUpdate: () => root.style.setProperty("--light-angle", `${light.angle.toFixed(1)}deg`),
      });

      const isInteractive = (target: EventTarget | null) =>
        (target as Element | null)?.closest?.(INTERACTIVE) != null;

      const onMove = (event: PointerEvent) => {
        lensX(event.clientX);
        lensY(event.clientY);
        dotX(event.clientX);
        dotY(event.clientY);

        const dx = window.innerWidth / 2 - event.clientX;
        const dy = window.innerHeight / 2 - event.clientY;
        const target = (Math.atan2(dx, -dy) * 180) / Math.PI;
        lightTo(light.angle + (((target - light.angle + 540) % 360) - 180));
      };
      const onOver = (event: PointerEvent) => {
        if (state !== "down") setState(isInteractive(event.target) ? "hover" : "idle");
      };
      const onDown = () => setState("down");
      const onUp = (event: PointerEvent) => setState(isInteractive(event.target) ? "hover" : "idle");

      window.addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("pointerover", onOver, { passive: true });
      window.addEventListener("pointerdown", onDown, { passive: true });
      window.addEventListener("pointerup", onUp, { passive: true });
      return () => {
        root.style.removeProperty("--light-angle");
        delete document.documentElement.dataset.cursor;
        window.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerover", onOver);
        window.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointerup", onUp);
      };
    });
    return () => mm.revert();
  });

  return (
    <>
      <div ref={lensRef} className={styles["cursor__lens"]} aria-hidden="true">
        <div ref={shapeRef} className={`${styles["cursor__glass"]} u-glass--lens`}>
          {/* antique brass loupe; its glass is transparent so the lens shows through */}
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative cursor art, not content */}
          <img
            ref={frameRef}
            className={styles["cursor__frame"]}
            alt=""
            width={200}
            height={310}
            decoding="async"
            draggable={false}
          />
        </div>
      </div>
      <div ref={dotRef} className={styles["cursor__dot"]} aria-hidden="true" />
    </>
  );
}
