import { defaultThemeId, themes, type ThemeId } from "./themes";

/**
 * Runtime theme choice, mirrored on <html data-theme> so CSS switches by attribute alone.
 * The stage hosts subscribe and forward the new look to the WebGL stage.
 * ponytail: not persisted — add localStorage + a head script (see loupePreference.ts) to keep it.
 */
const listeners = new Set<() => void>();

export const themeStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
  get(): ThemeId {
    const id = document.documentElement.dataset.theme;
    return id && id in themes ? (id as ThemeId) : defaultThemeId;
  },
};

export function setTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
  // CSS hides the loupe cursor + switch (and restores the native cursor) when this is "off"
  document.documentElement.dataset.themeLoupe = themes[id].loupe ? "on" : "off";
  listeners.forEach((listener) => listener());
}
