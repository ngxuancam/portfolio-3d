"use client";

import { useSyncExternalStore } from "react";
import { setTheme, themeStore } from "@/theme/themeStore";
import { defaultThemeId, themes, type ThemeId } from "@/theme/themes";
import styles from "./ThemeToggle.module.css";

/** Dev-only tester: one click re-skins CSS and morphs the 3D stage (see layout.tsx). */
export function ThemeToggle() {
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
