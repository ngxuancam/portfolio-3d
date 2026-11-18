"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import type { Quality } from "@/lib/three/quality";

/**
 * Stops the frame loop entirely while the tab is hidden (rAF throttling alone still wakes the
 * GPU on some browsers) and restores the right loop mode when it comes back.
 */
export function Lifecycle({ quality }: { quality: Quality }) {
  const setFrameloop = useThree((s) => s.setFrameloop);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const resume = quality.reducedMotion ? "demand" : "always";
    const onVisibility = () => {
      if (document.hidden) {
        setFrameloop("never");
      } else {
        setFrameloop(resume);
        invalidate();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [quality.reducedMotion, setFrameloop, invalidate]);

  return null;
}
