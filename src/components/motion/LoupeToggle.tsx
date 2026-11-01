"use client";

import { useCallback, useSyncExternalStore } from "react";
import { loupeStore, writeLoupe } from "@/lib/animation/loupePreference";
import styles from "./LoupeToggle.module.css";

/**
 * Bottom-left switch for the magnifying-glass cursor. Shown on fine pointers only (there
 * is no cursor to magnify on touch). Turning it off hides the loupe and brings the native
 * cursor back — purely through <html data-loupe>, so nothing else re-renders.
 */
export function LoupeToggle() {
  // the head script already applied the stored value to <html>; read it without a
  // hydration mismatch (server snapshot is "on")
  const state = useSyncExternalStore(loupeStore.subscribe, loupeStore.getSnapshot, loupeStore.getServerSnapshot);

  const toggle = useCallback(() => writeLoupe(loupeStore.getSnapshot() === "on" ? "off" : "on"), []);

  const on = state === "on";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={styles.loupe}
      data-state={state}
      onClick={toggle}
      title={on ? "Put the magnifying glass away" : "Use the magnifying glass"}
    >
      <svg className={styles["loupe__icon"]} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10" cy="10" r="6" />
        <path d="M14.5 14.5 20 20" />
      </svg>
      <span className={styles["loupe__label"]}>Loupe</span>
      <span className={styles["loupe__track"]} aria-hidden="true">
        <span className={styles["loupe__knob"]} />
      </span>
    </button>
  );
}
