import * as THREE from "three";
import { THREE_COLOR_KEYS, type StageLook, type ThreeColorKey } from "@/theme/themes";

type Palette = Record<ThreeColorKey, THREE.Color>;
const makePalette = () => Object.fromEntries(THREE_COLOR_KEYS.map((k) => [k, new THREE.Color()])) as Palette;

/** exponential-damping rates (1/s): colours settle in ~1s, the formation a bit slower */
const COLOR_RATE = 4;
const EPS = 1e-3;

/**
 * The live look of the 3D stage: `current` chases `target` every frame (stepped by
 * StageScene), so a theme switch morphs instead of snapping. The Colors in `current` are
 * the very objects bound to shader uniforms, so stepping updates the GPU inputs for free.
 * Like sceneSignals, each thread (worker or main) owns its own instance.
 */
class StageTheme {
  readonly current = makePalette();
  shape = 0;
  /** speed of the stage clock (see StageLook.tempo) */
  tempo = 1;
  private morph = 1.8;
  private targetTempo = 1;
  private readonly target = makePalette();
  private targetShape = 0;
  private readonly listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  set(look: StageLook, snap = false): void {
    for (const k of THREE_COLOR_KEYS) {
      this.target[k].set(look.colors[k]);
      if (snap) this.current[k].copy(this.target[k]);
    }
    this.targetShape = look.shape;
    this.targetTempo = look.tempo;
    this.morph = look.morph;
    if (snap) {
      this.shape = look.shape;
      this.tempo = look.tempo;
    }
    this.listeners.forEach((listener) => listener());
  }

  /** Advance toward the target; returns true while something is still moving. */
  step(delta: number): boolean {
    let moving = false;
    for (const k of THREE_COLOR_KEYS) {
      const c = this.current[k];
      const t = this.target[k];
      c.r = THREE.MathUtils.damp(c.r, t.r, COLOR_RATE, delta);
      c.g = THREE.MathUtils.damp(c.g, t.g, COLOR_RATE, delta);
      c.b = THREE.MathUtils.damp(c.b, t.b, COLOR_RATE, delta);
      if (Math.abs(c.r - t.r) + Math.abs(c.g - t.g) + Math.abs(c.b - t.b) > EPS) moving = true;
    }
    this.tempo = THREE.MathUtils.damp(this.tempo, this.targetTempo, 3, delta);
    this.shape = THREE.MathUtils.damp(this.shape, this.targetShape, this.morph, delta);
    if (Math.abs(this.shape - this.targetShape) > EPS) moving = true;
    else this.shape = this.targetShape;
    return moving;
  }
}

export const stageTheme = new StageTheme();
