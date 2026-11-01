"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { useReducedMotion } from "@/lib/animation/useReducedMotion";
import { sceneSignals } from "@/lib/three/sceneSignals";
import { smoothScrollStore } from "@/lib/animation/smoothScrollStore";
import { POSTER_MEDIA } from "@/lib/three/stageMedia";

import { supportsOffscreenStage } from "./stageProps";

/**
 * Proxy / lazy-loading pattern, two hosts for the same scene:
 *  - OffscreenStage: renders in a Web Worker on an OffscreenCanvas — three.js, the model
 *    and every frame stay off the main thread (no scroll jank, no TBT)
 *  - MainThreadStage: fallback <Canvas> for browsers without OffscreenCanvas workers
 * Neither is requested until the page is loaded (and, on phones, the poster is shown).
 */
const OffscreenStage = dynamic(() => import("./OffscreenStage"), { ssr: false, loading: () => null });
const MainThreadStage = dynamic(() => import("./MainThreadStage"), { ssr: false, loading: () => null });

/** Particle budget from device capability, decided once on the main thread. */
const pickBurstCount = () =>
  window.matchMedia("(max-width: 640px)").matches || (navigator.hardwareConcurrency ?? 4) <= 4 ? 6000 : 12000;

interface StagePlan {
  host: "offscreen" | "main";
  /** phones replace the poster: appear as the bust it shows, no gather-in intro */
  skipIntro: boolean;
  burstCount: number;
}

/** Section ids in page order — must match the shots in lib/three/cameraPath.ts */
const STAGE_SECTIONS = ["top", "about", "skills", "experience", "projects", "contact"] as const;

export function SceneBackdropLoader() {
  const reducedMotion = useReducedMotion();
  const [plan, setPlan] = useState<StagePlan | null>(null);

  // When to start the stage — one state update for the lifetime:
  //  - wide screens: after `load`, once the browser is idle (with the gather-in intro)
  //  - portrait/phones: as soon as the hero poster has loaded and decoded, then idle; the
  //    stage builds in its worker behind the poster and replaces it seamlessly
  useEffect(() => {
    let cancelled = false;
    let idleId = 0;
    const onPoster = window.matchMedia(POSTER_MEDIA).matches;
    const start = () => {
      idleId = window.requestIdleCallback(
        () => {
          if (cancelled) return;
          setPlan({
            host: supportsOffscreenStage() ? "offscreen" : "main",
            skipIntro: onPoster,
            burstCount: pickBurstCount(),
          });
        },
        { timeout: 2500 },
      );
    };

    if (onPoster) {
      const poster = document.querySelector<HTMLImageElement>("#top picture img");
      const ready = poster ? poster.decode().catch(() => undefined) : Promise.resolve();
      void ready.then(() => !cancelled && start());
    } else if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", start);
      window.cancelIdleCallback(idleId);
    };
  }, []);

  // no OffscreenCanvas WebGL in this browser after all: same scene, main thread
  const handleFallback = useCallback(() => setPlan((current) => current && { ...current, host: "main" }), []);

  // the poster fades out once the stage has drawn its first frame
  const handleStageReady = useCallback(() => {
    document.documentElement.dataset.stage = "ready";
  }, []);

  // Scroll → signal bag. A passive listener and one rAF per frame, against cached section
  // offsets — no scroll library at startup, no forced layout while scrolling.
  //  - burst:  0 → 1 while the hero scrolls away ("top top" → "bottom top")
  //  - stage:  i-1 → i while section i travels from the viewport bottom to its top
  useEffect(() => {
    const hero = document.getElementById("top");
    if (!hero) return;
    const sections = STAGE_SECTIONS.slice(1)
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    let heroHeight = 1;
    let tops: number[] = [];
    let viewport = 1;
    const measure = () => {
      viewport = window.innerHeight;
      heroHeight = hero.offsetHeight || 1;
      tops = sections.map((el) => el.getBoundingClientRect().top + window.scrollY);
    };

    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      sceneSignals.scroll = Math.min(Math.max(y / heroHeight, 0), 1);
      let stage = 0;
      tops.forEach((top, i) => {
        const progress = (y - (top - viewport)) / viewport;
        if (progress >= 0) stage = i + Math.min(progress, 1);
      });
      sceneSignals.stage = stage;
      sceneSignals.notify();
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    // section offsets change with layout (fonts, the projects pin spacer, viewport size)
    const resizeObserver = new ResizeObserver(() => {
      measure();
      onScroll();
    });
    resizeObserver.observe(document.body);
    measure();
    update();
    window.addEventListener("scroll", onScroll, { passive: true });

    // Snap: the hero is never left half-scrolled. The input is claimed *before* Lenis
    // moves, so the glide starts from rest — no momentum to cancel, no jolt. While a
    // glide runs, further input is swallowed. (Lenis only runs on fine pointers.)
    const about = document.getElementById("about");
    let snapping = false;
    const glideTo = (target: number | HTMLElement) => {
      snapping = true;
      smoothScrollStore.scrollTo(target, { duration: 1.7, onComplete: () => (snapping = false) });
    };
    smoothScrollStore.setInterceptor((deltaY) => {
      if (snapping) return true;
      if (!about || Math.abs(deltaY) < 1) return false;
      const y = window.scrollY;
      const aboutTop = about.offsetTop;
      if (deltaY > 0 && y < aboutTop - 2) {
        glideTo(about);
        return true;
      }
      if (deltaY < 0 && y > 2 && y <= aboutTop + 2) {
        glideTo(0);
        return true;
      }
      return false;
    });

    const onPointerMove = (event: PointerEvent) => {
      sceneSignals.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      sceneSignals.pointer.y = -((event.clientY / window.innerHeight) * 2 - 1);
      sceneSignals.notify();
    };
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (finePointer) window.addEventListener("pointermove", onPointerMove, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (finePointer) window.removeEventListener("pointermove", onPointerMove);
      smoothScrollStore.setInterceptor(null);
    };
  }, []);

  if (!plan) return null;
  const props = {
    reducedMotion,
    skipIntro: plan.skipIntro,
    burstCount: plan.burstCount,
    onReady: handleStageReady,
  };
  return plan.host === "offscreen" ? (
    <OffscreenStage {...props} onFallback={handleFallback} />
  ) : (
    <MainThreadStage {...props} />
  );
}
