/**
 * Scroll and pointer signals shared by the DOM (HUD, chapters) and the 3D stage.
 *
 * Plain mutable values plus a subscribe/notify pair — readers poll in their own frame loop
 * (useFrame, rAF) or subscribe; nothing here ever triggers a React render.
 *
 *  - `page`     0..1   scroll position over the whole document
 *  - `chapter`  0..N-1 continuous index: chapter i-1 → i while chapter i's top travels from the
 *                      bottom of the viewport to its top (fractional in between)
 *  - `velocity`        page units per second, signed (for motion blur, HUD readouts)
 *  - `pointer`  -1..1  normalised device coordinates (y up); `pointerActive` false on touch / idle
 */

type Listener = () => void;
const listeners = new Set<Listener>();

export const signals = {
  page: 0,
  chapter: 0,
  velocity: 0,
  pointer: { x: 0, y: 0 },
  pointerActive: false,
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
  notify() {
    listeners.forEach((listener) => listener());
  },
};

/** Chapter ids in document order — sections render `<section id={id} data-chapter>`. */
export const CHAPTERS = ["top", "about", "skills", "experience", "projects", "contact"] as const;
export type ChapterId = (typeof CHAPTERS)[number];
