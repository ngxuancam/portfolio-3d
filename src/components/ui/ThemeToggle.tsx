"use client";

import { useEffect, useSyncExternalStore } from "react";
import { shipAnchors } from "@/lib/three/shipAnchors";
import { setTheme, themeStore } from "@/theme/themeStore";
import { defaultThemeId, themes, type ThemeId } from "@/theme/themes";
import styles from "./ThemeToggle.module.css";

/** Dev-only tester: one click re-skins CSS and morphs the 3D stage (see layout.tsx). */
export function ThemeToggle() {
  // tap for a motion probe: where the ship is on screen. Runs only where this component is
  // rendered, which layout.tsx limits to development.
  useEffect(() => {
    (window as unknown as { __shipAnchors?: typeof shipAnchors }).__shipAnchors = shipAnchors;
  }, []);
  const current = useSyncExternalStore(themeStore.subscribe, themeStore.get, () => defaultThemeId);
  return (
    <div className={styles.toggle} role="group" aria-label="Theme">
      {(Object.keys(themes) as ThemeId[]).map((id) => (
        <button
          key={id}
          type="button"
          className={styles["toggle__btn"]}
          aria-pressed={current === id}
          onClick={() => setTheme(id)}
        >
          {themes[id].name}
        </button>
      ))}
    </div>
  );
}
