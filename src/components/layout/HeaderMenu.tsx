"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { smoothScrollStore } from "@/lib/animation/smoothScrollStore";
import styles from "./HeaderMenu.module.css";

interface HeaderMenuProps {
  /** the server-rendered <nav>; inline on desktop, a drop-down panel on mobile */
  children: ReactNode;
}

/**
 * Mobile disclosure for the primary nav. The links stay server-rendered (crawlable);
 * this island only adds the hamburger → X toggle and the panel behaviour:
 * Esc / link click closes, focus moves into the panel on open and back on close, and
 * smooth scrolling pauses while it is open. On desktop the wrapper is `display: contents`
 * and the button is hidden, so the nav renders inline as before.
 */
export function HeaderMenu({ children }: HeaderMenuProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((value) => !value), []);

  useEffect(() => {
    if (!open) return;
    const lenis = smoothScrollStore.get();
    lenis?.stop();
    // next frame: the panel's open styles are applied, so the link is focusable
    const focusFrame = requestAnimationFrame(() => panelRef.current?.querySelector<HTMLAnchorElement>("a")?.focus());

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKey);
      lenis?.start();
    };
  }, [open]);

  // following a link closes the panel (event delegation: links are server-rendered)
  const onPanelClick = useCallback(
    (event: React.MouseEvent) => {
      if ((event.target as Element).closest("a")) close();
    },
    [close],
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={styles["menu-toggle"]}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        data-open={open}
        onClick={toggle}
      >
        <span className={styles["menu-toggle__bar"]} />
        <span className={styles["menu-toggle__bar"]} />
        <span className={styles["menu-toggle__bar"]} />
      </button>
      <div ref={panelRef} id={panelId} className={styles["menu-panel"]} data-open={open} onClick={onPanelClick}>
        {children}
      </div>
    </>
  );
}
