import { Uniform, Vector2, Vector3 } from "three";

/**
 * Per-frame stage state, written once per frame by the Director (useFrame priority −1) and read by
 * every other stage component. Plain mutable values — nothing here re-renders React.
 *
 * The uniforms are shared *objects*: each material puts the same Uniform instance in its uniform
 * map, so one write here updates every material without per-material bookkeeping.
 */
export const stage = {
  /** damped chapter index (0..5) */
  chapter: 0,
  /** 0..1 build progress */
  build: 0,
  /** 0..1 shield reveal */
  shield: 0,
  /** 0..1 automatic intro after the loader lifts */
  intro: 0,
  /** narrow viewport: ship centred and dimmed behind the text */
  narrow: false,
  /** world position of the build front on the hull, and 0..1 how much it is "on" the hull */
  front: new Vector3(),
  frontWeight: 0,
};

export const shared = {
  uTime: new Uniform(0),
  uThreshold: new Uniform(-1),
  /** (axis min, 1 / axis length) along the hull's local z */
  uSweep: new Uniform(new Vector2(0, 1)),
  uFogDensity: new Uniform(0.03),
  /** 1 on wide screens, < 1 when the ship sits behind the text column */
  uDim: new Uniform(1),
  /** pixels per world unit at distance 1 (drawing-buffer height / 2·tan(fov/2)) for point sizes */
  uPointScale: new Uniform(800),
};

export function resetStage() {
  stage.chapter = 0;
  stage.build = 0;
  stage.shield = 0;
  stage.intro = 0;
  stage.frontWeight = 0;
  shared.uTime.value = 0;
  shared.uThreshold.value = -1;
}
