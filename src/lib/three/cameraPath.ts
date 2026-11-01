import * as THREE from "three";

/**
 * Camera "shots", one per page section, in the order they appear on the page.
 *  - position / target: where the camera is and what it looks at (world units)
 *  - frame: screen-space shift of the subject, as a fraction of viewport width
 *           (+ = subject sits right of centre). Applied with camera.setViewOffset,
 *           so composition never fights the orbit angle.
 * The flower blooms around (0, 0.38, 0.48) with a ~2 unit radius.
 */
interface Shot {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly frame: number;
}

const FLOWER: readonly [number, number, number] = [0, 0.38, 0.48];

const WIDE_SHOTS: readonly Shot[] = [
  { position: [0, 0.1, 5.7], target: [0, 0.1, 0], frame: 0.28 }, // hero — bust right of the headline
  { position: [3.6, 1.6, 3.6], target: FLOWER, frame: 0.26 }, // about — three-quarter orbit, right
  { position: [0.3, 5.6, 1.4], target: FLOWER, frame: 0 }, // skills — straight down into the bloom
  { position: [-3.8, -1.1, 2.8], target: FLOWER, frame: 0.26 }, // experience — low angle, right
  { position: [0.5, 0.8, 2.3], target: [0.1, 0.4, 0.45], frame: 0 }, // projects — close-up through the petals
  { position: [0, 0.4, 7.8], target: [0, 0.4, 0], frame: 0 }, // contact — pull back, centred
];

const NARROW_SHOTS: readonly Shot[] = [
  { position: [0, -1.65, 9.4], target: [0, -1.65, 0], frame: 0 }, // hero — smaller bust in the top half, copy below
  { position: [2.8, 1.6, 4.4], target: FLOWER, frame: 0 },
  { position: [0.2, 6.4, 1.6], target: FLOWER, frame: 0 },
  { position: [-3.0, -1.0, 3.6], target: FLOWER, frame: 0 },
  { position: [0.4, 0.8, 3.0], target: [0.1, 0.4, 0.45], frame: 0 },
  { position: [0, 0.4, 9], target: [0, 0.4, 0], frame: 0 },
];

export interface CameraPath {
  readonly positions: THREE.CatmullRomCurve3;
  readonly targets: THREE.CatmullRomCurve3;
  readonly frames: readonly number[];
  readonly stages: number;
}

/** Catmull-Rom through the shots: the camera glides through every keyframe without kinks. */
export function createCameraPath(wide: boolean): CameraPath {
  const shots = wide ? WIDE_SHOTS : NARROW_SHOTS;
  const toVec = (v: readonly [number, number, number]) => new THREE.Vector3(...v);
  return {
    positions: new THREE.CatmullRomCurve3(shots.map((s) => toVec(s.position)), false, "centripetal"),
    targets: new THREE.CatmullRomCurve3(shots.map((s) => toVec(s.target)), false, "centripetal"),
    frames: shots.map((s) => s.frame),
    stages: shots.length,
  };
}

/** Smoothly interpolated framing offset for a fractional stage. */
export function frameAt(path: CameraPath, stage: number): number {
  const i = THREE.MathUtils.clamp(Math.floor(stage), 0, path.stages - 1);
  const next = Math.min(i + 1, path.stages - 1);
  const f = THREE.MathUtils.smoothstep(stage - i, 0, 1);
  return THREE.MathUtils.lerp(path.frames[i], path.frames[next], f);
}
