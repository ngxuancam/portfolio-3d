"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const CustomCursor = dynamic(() => import("./CustomCursor").then((m) => m.CustomCursor), { ssr: false });
const LoupeToggle = dynamic(() => import("./LoupeToggle").then((m) => m.LoupeToggle), { ssr: false });

/**
 * Pointer-only extras (the magnifying-glass cursor and its on/off switch). Touch devices
 * never load them; on desktop they are fetched once the browser is idle, so their code
 * (and GSAP) stays out of the critical path.
 */
export function PointerExtras() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const id = window.requestIdleCallback(() => setEnabled(true), { timeout: 2000 });
    return () => window.cancelIdleCallback(id);
  }, []);

  if (!enabled) return null;
  return (
    <>
      <LoupeToggle />
      <CustomCursor />
    </>
  );
}
