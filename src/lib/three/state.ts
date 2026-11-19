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
  /** 0..1 presence of build effects (point cloud, motes) */
  activity: 0,
  /** engine output: 0 off, 1 full burn, > 1 briefly during the ignition kick */
  thrust: 0,
  /** 1 = normal burn; > 1 through the experience chapter (longer, wider jet) */
  boost: 1,
  /** 1 at ignition, decaying: drives the flash, recoil and camera shake */
  kick: 0,
  /** 0.8..1.1 per-frame engine flicker */
  flicker: 1,
  /** camera shake amplitude (world units) */
  shake: 0,
  /** view offset currently applied by the camera (NDC) — for camera-attached sky elements */
  viewShift: 0,
  /** world-space direction TO the sun (set by the sky, read by lights and the planet) */
  sunDir: new Vector3(0.5, 0.4, -0.7).normalize(),
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
  /** space has no fog: kept as a uniform so additive materials can still fade at extreme range */
  uFogDensity: new Uniform(0.0),
  /** 1 on wide screens, < 1 when the ship sits behind the text column */
  uDim: new Uniform(1),
  /** pixels per world unit at distance 1 (drawing-buffer height / 2·tan(fov/2)) for point sizes */
  uPointScale: new Uniform(800),
};

export function resetStage() {
  stage.chapter = 0;
  stage.build = 0;
  stage.shield = 0;
  stage.activity = 0;
  stage.thrust = 0;
  stage.boost = 1;
  stage.kick = 0;
  stage.shake = 0;
  stage.frontWeight = 0;
  shared.uTime.value = 0;
  shared.uThreshold.value = -1;
}
