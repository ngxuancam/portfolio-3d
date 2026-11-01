/**
 * Visitor preference for the magnifying-glass cursor. Stored per browser (it is a
 * personal comfort setting) and mirrored on <html data-loupe="on|off"> so CSS alone
 * decides what renders — the head script applies it before first paint, no flash.
 */
export const LOUPE_STORAGE_KEY = "loupe";

export type LoupeState = "on" | "off";

const listeners = new Set<() => void>();

/** useSyncExternalStore adapter: subscribe / read the live preference. */
export const loupeStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: (): LoupeState => (document.documentElement.dataset.loupe === "off" ? "off" : "on"),
  getServerSnapshot: (): LoupeState => "on",
};

export function writeLoupe(state: LoupeState) {
  document.documentElement.dataset.loupe = state;
  listeners.forEach((listener) => listener());
  try {
    window.localStorage.setItem(LOUPE_STORAGE_KEY, state);
  } catch {
    /* private mode / blocked storage: the choice still applies for this visit */
  }
}

/** Inline, pre-paint read of the stored preference, for the root layout head script. */
export const LOUPE_HEAD_SCRIPT = `try{document.documentElement.dataset.loupe=localStorage.getItem('${LOUPE_STORAGE_KEY}')==='off'?'off':'on'}catch(e){document.documentElement.dataset.loupe='on'}`;
