/**
 * Where a few landmarks of the blueprint ship sit on screen, so the HTML callouts can
 * follow it. The ship is drawn in the stage worker, so the worker projects the landmarks
 * and posts them; on the main-thread fallback the stage writes straight into this store.
 */
export const ANCHOR_IDS = ["cupola", "wingL", "wingR", "tail"] as const;
export type AnchorId = (typeof ANCHOR_IDS)[number];

export interface AnchorSnapshot {
  /** the ship is fully plotted — callouts may show */
  visible: boolean;
  /** flight speed 0..1, drives the letterbox bars and vignette */
  speed: number;
  /** screen position per landmark, 0..1 of the viewport (origin top-left) */
  points: Record<AnchorId, [number, number]>;
}

class ShipAnchors {
  current: AnchorSnapshot = {
    visible: false,
    speed: 0,
    points: { cupola: [0, 0], wingL: [0, 0], wingR: [0, 0], tail: [0, 0] },
  };
  /** set inside the stage worker: ship it to the page instead of applying locally */
  sink: ((snapshot: AnchorSnapshot) => void) | null = null;
  private readonly listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  /** stage side: publish a new frame of landmarks */
  emit(snapshot: AnchorSnapshot): void {
    if (this.sink) this.sink(snapshot);
    else this.apply(snapshot);
  }

  /** page side: take a frame (from the worker, or straight from the stage) */
  apply(snapshot: AnchorSnapshot): void {
    this.current = snapshot;
    this.listeners.forEach((listener) => listener());
  }
}

export const shipAnchors = new ShipAnchors();
