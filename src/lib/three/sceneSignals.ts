/**
 * Mutable, framework-agnostic signal bag shared between DOM land (GSAP,
 * pointer listeners) and the WebGL render loop.
 *
 * Writing here never triggers a React render: producers mutate plain numbers,
 * and `useFrame` reads them once per frame. This is the key to keeping the 3D
 * scene at 60fps while the page scrolls — React stays idle.
 *
 * When the stage renders in a Web Worker, the worker has its own instance: producers
 * call notify() after writing, the host coalesces a snapshot() per frame into one
 * postMessage, and the worker apply()s it.
 */
export interface SignalSnapshot {
  scroll: number;
  stage: number;
  pointerX: number;
  pointerY: number;
}

class SceneSignals {
  /** Normalised pointer, -1..1 on both axes */
  readonly pointer = { x: 0, y: 0 };
  /** Hero scroll progress, 0 (top) .. 1 (hero fully scrolled past) — drives the burst */
  scroll = 0;
  /** Camera stage, 0 (hero) .. sections-1 (contact), fractional between sections */
  stage = 0;

  private readonly listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Call after writing — lets an off-thread stage know something changed. */
  notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  snapshot(): SignalSnapshot {
    return { scroll: this.scroll, stage: this.stage, pointerX: this.pointer.x, pointerY: this.pointer.y };
  }

  apply(snapshot: SignalSnapshot): void {
    this.scroll = snapshot.scroll;
    this.stage = snapshot.stage;
    this.pointer.x = snapshot.pointerX;
    this.pointer.y = snapshot.pointerY;
  }
}

export const sceneSignals = new SceneSignals();
