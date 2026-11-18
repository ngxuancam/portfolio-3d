/**
 * Page-load progress registry, read by the site loader.
 *
 * The work is split into named stages that each own a slice of 0..1, so a stage reports
 * its own 0..1 without knowing what else is loading. The overall value only ever rises:
 * a stage that restarts (e.g. a second model request) can never pull the counter back.
 *
 * Hard failsafe: ~8 s after navigation start everything completes no matter what, so a
 * visitor is never trapped behind the loader by a stalled request or a lost worker.
 */

const SLICES = {
  fonts: [0, 0.1],
  model: [0.1, 0.75],
  build: [0.75, 1],
} as const;

export type LoadStage = keyof typeof SLICES;
type Listener = (progress: number, ready: boolean) => void;

const FAILSAFE_MS = 8000;

const values: Record<LoadStage, number> = { fonts: 0, model: 0, build: 0 };
const listeners = new Set<Listener>();
let progress = 0;
let ready = false;

/** Resolves (never rejects) once the page's web fonts have loaded; at once on the server. */
const fontsReady: Promise<unknown> =
  typeof document !== "undefined" && document.fonts?.ready
    ? document.fonts.ready.catch(() => undefined)
    : Promise.resolve();

const clamp01 = (t: number) => (t > 1 ? 1 : t > 0 ? t : 0);

function emit() {
  for (const listener of listeners) listener(progress, ready);
}

function recompute() {
  let sum = 0;
  for (const name of Object.keys(SLICES) as LoadStage[]) {
    const [from, to] = SLICES[name];
    sum += (to - from) * values[name];
  }
  // float sums of the slices can land a hair under 1
  const next = sum > 0.9999 ? 1 : sum;
  if (next <= progress) return;
  progress = next;
  emit();
}

/** Report stage `name` at t∈[0,1]; maps into the stage's slice of the overall progress. */
export function stage(name: LoadStage, t: number) {
  const value = clamp01(t);
  if (value <= values[name]) return;
  values[name] = value;
  recompute();
}

/** Complete every stage at once (paths that do not wait for the 3D, failsafe). */
export function completeAll() {
  for (const name of Object.keys(SLICES) as LoadStage[]) values[name] = 1;
  recompute();
}

/** The page is usable: the counter may now reach 100. */
export function markReady() {
  if (ready) return;
  ready = true;
  emit();
}

/**
 * Paths that show something other than the live 3D first (the phone poster, the
 * main-thread fallback): finish once the fonts and `extra` (e.g. the poster decode) are
 * done, instead of waiting for the model.
 */
export function settleWithout3d(extra?: Promise<unknown>) {
  void Promise.all([fontsReady, extra?.catch(() => undefined)]).then(() => {
    completeAll();
    markReady();
  });
}

/** Subscribe to progress / ready changes; returns the unsubscribe. */
export function onProgress(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const loadProgress = {
  stage,
  completeAll,
  settleWithout3d,
  markReady,
  onProgress,
  get progress() {
    return progress;
  },
  get ready() {
    return ready;
  },
};

// Browser-only wiring, set up once when the module first evaluates (the loader imports it
// during hydration). Timed from navigation start, so a slow hydration does not extend it.
if (typeof window !== "undefined") {
  const finish = () => {
    completeAll();
    markReady();
  };
  window.setTimeout(finish, Math.max(0, FAILSAFE_MS - performance.now()));

  void fontsReady.then(() => stage("fonts", 1));
}
