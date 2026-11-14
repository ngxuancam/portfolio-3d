"use client";

import { useEffect, useRef } from "react";
import { sceneSignals } from "@/lib/three/sceneSignals";

/** A live number on the title block, written straight to the DOM — never re-renders React. */
export function SheetReadout({ field }: { field: "stage" | "scroll" }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const write = () => {
      if (ref.current) ref.current.textContent = sceneSignals[field].toFixed(2);
    };
    write();
    return sceneSignals.subscribe(write);
  }, [field]);
  return <span ref={ref}>0.00</span>;
}
