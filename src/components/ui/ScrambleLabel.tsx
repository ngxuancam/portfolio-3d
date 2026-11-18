"use client";

import { useEffect, useRef } from "react";
import { bindScrambleHover } from "@/lib/motion";

interface ScrambleLabelProps {
  text: string;
  className?: string;
}

/**
 * Text that decodes through glyphs when its nearest link/button is hovered or focused.
 *
 * The real text is rendered twice: once visually hidden (what screen readers and crawlers get)
 * and once aria-hidden (what the scramble rewrites). The server HTML therefore carries the plain
 * label, and the effect is a pure enhancement that never changes the accessible name.
 */
export function ScrambleLabel({ text, className }: ScrambleLabelProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const target = ref.current;
    const trigger = target?.closest("a, button");
    if (!target || !trigger) return;
    return bindScrambleHover(trigger, target, text);
  }, [text]);

  return (
    <span className={className}>
      <span className="u-visually-hidden">{text}</span>
      <span ref={ref} aria-hidden="true">
        {text}
      </span>
    </span>
  );
}
