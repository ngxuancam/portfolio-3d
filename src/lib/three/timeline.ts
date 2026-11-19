/**
 * Scroll → stage mapping. Pure functions of the (damped) chapter index so the whole choreography
 * reads in one place and every component samples the same curve.
 *
 * Chapters: 0 top · 1 about · 2 skills · 3 experience · 4 projects · 5 contact.
 *
 *   build   0 at rest on the hero; the first scroll lights the weld, chapters 0 → 2 carry it to 1
 *   thrust  engines ignite as the hull completes (≈ 1.9 → 2), full burn through skills →
 *           experience, settling to an idle glow from projects on
 *   shield  chapters 2.5 → 4, revealed top-down cell by cell
 *   camera  climb close (0 → 2) → pull back (2 → 4) → wide establishing view (4 → 5)
 */

/*
 * Front start sits a full wobble + edge width below the tail, so at build 0 not a single pixel
 * of the burning edge shows: the hero is the calm hologram only.
 */
const SWEEP_START = -0.12;
const SWEEP_END = 1.18;

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth = (x: number) => x * x * (3 - 2 * x);
export const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
export const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;
const range = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));

/** 0..1 build progress: starts the moment scrolling does, complete when "skills" lands. */
export const buildProgress = (chapter: number) => range(chapter, 0, 2);

/** 0..1 how present the build effects (point cloud, motes) are: in over the first ~4 % of build */
export const buildActivity = (build: number) => smooth(range(build, 0, 0.04));

/** steady engine level (before the ignition kick) */
export const thrustLevel = (chapter: number) =>
  smooth(range(chapter, 1.88, 2)) * (1 - 0.62 * smooth(range(chapter, 3.4, 4.4)));

/**
 * Build progress → front position along the normalised axis. Padded past both ends so the noisy
 * front fully clears the hull at 0 and 1 (wobble amplitude ≈ 0.075 + edge width).
 */
export const sweepThreshold = (build: number) => SWEEP_START + (SWEEP_END - SWEEP_START) * build;

/**
 * Extra burn on top of the steady thrust (1 = none): the jet grows longer and wider through
 * "experience" (chapter 3), then eases back before the idle glow of "projects".
 */
export const thrustBoost = (chapter: number) =>
  1 + 0.75 * smooth(range(chapter, 2.25, 3)) * (1 - smooth(range(chapter, 3.35, 4)));

/** 0..1 how much the sky drifts past the coasting ship: in on the way into "projects" */
export const spaceDrift = (chapter: number) => smooth(range(chapter, 3.4, 4));

export const shieldProgress = (chapter: number) => smooth(range(chapter, 2.5, 4));

export type CameraPose = { angle: number; radius: number; height: number; lookY: number };

/**
 * One key per chapter. Angle is the orbit angle around world Y (0 = looking down −z from +z);
 * the total sweep is ~0.7 turn so the spiral reads without making anyone seasick.
 */
/*
 * Radii are sized so the subject fits the right ~40 % of a 16:9 viewport (the text owns columns
 * 1–7); CameraRig scales them up for squarer windows. The contact radius keeps the whole r = 18
 * dome right of the text column.
 */
const KEYS: readonly CameraPose[] = [
  { angle: 0.6, radius: 13, height: 1.6, lookY: 0.15 }, // top: three-quarter low view
  { angle: 1.55, radius: 11.5, height: 2.6, lookY: 0.25 }, // about: climbing in
  { angle: 2.55, radius: 11, height: 4, lookY: 0.35 }, // skills: close, above the spine
  { angle: 3.35, radius: 17, height: 7, lookY: 0.8 }, // experience: pulling back under the dome
  { angle: 4.05, radius: 36, height: 13, lookY: 2.5 }, // projects: outside the shield
  { angle: 4.55, radius: 56, height: 22, lookY: 3 }, // contact: wide establishing view
];

/** Ease each chapter segment separately: the camera settles as a chapter lands, then moves on. */
export function cameraPose(chapter: number, out: CameraPose): CameraPose {
  const c = Math.min(Math.max(chapter, 0), KEYS.length - 1);
  const i = Math.min(Math.floor(c), KEYS.length - 2);
  const t = easeInOutCubic(c - i);
  const a = KEYS[i];
  const b = KEYS[i + 1];
  out.angle = a.angle + (b.angle - a.angle) * t;
  out.radius = a.radius + (b.radius - a.radius) * t;
  out.height = a.height + (b.height - a.height) * t;
  out.lookY = a.lookY + (b.lookY - a.lookY) * t;
  return out;
}

/** The static pose used for prefers-reduced-motion: built ship, a calm three-quarter view. */
export const STATIC_POSE: CameraPose = { angle: 0.95, radius: 13, height: 3.4, lookY: 0.2 };

/**
 * How much the close passes aim at the build front instead of the hull centre (0..0.75): with the
 * view offset this keeps the bright weld in the right half rather than wherever the hull is.
 * Fades out as the camera starts to pull back.
 */
export const frontFocus = (chapter: number) => 0.75 * (1 - smooth(range(chapter, 1.7, 2.7)));

/** Pointer parallax strength: full while close, 15 % once pulled back. */
export const parallaxScale = (chapter: number) => 1 - 0.85 * smooth(range(chapter, 2, 3.6));

