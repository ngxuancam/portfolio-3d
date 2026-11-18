/**
 * Loading registry: every piece of real work reports into a named stage, and the loader shows one
 * monotonic 0..1 progress built from those stages.
 *
 *   progress.stage("model", 0.4)   // the model is 40 % downloaded
 *   progress.done("model")
 *   progress.markReady()           // everything needed for the first frame is in place
 *
 * Each stage owns a fixed slice of the bar, so a fast stage can never make the bar jump backwards
 * when a slow one starts. Stages that do not apply (e.g. no 3D on this device) are skipped with
 * `skip()`, which simply completes them. A failsafe completes everything after `FAILSAFE_MS`: a
 * visitor is never trapped behind the loader.
 */

export type StageName = "fonts" | "model" | "build";

/** [start, end] slice of the bar owned by each stage. */
const SLICES: Record<StageName, readonly [number, number]> = {
  fonts: [0, 0.1],
  model: [0.1, 0.75],
  build: [0.75, 1],
};

const FAILSAFE_MS = 8000;

type Listener = (progress: number) => void;

const fractions: Record<StageName, number> = { fonts: 0, model: 0, build: 0 };
const listeners = new Set<Listener>();
let progressValue = 0;
let readyValue = false;
let failsafe: ReturnType<typeof setTimeout> | null = null;

function recompute() {
  let total = 0;
  for (const name of Object.keys(SLICES) as StageName[]) {
    const [from, to] = SLICES[name];
    total += (to - from) * fractions[name];
  }
  // monotonic: rounding or a stage restarting must never move the bar backwards
  if (total <= progressValue) return;
  progressValue = Math.min(1, total);
  listeners.forEach((listener) => listener(progressValue));
}

export const progress = {
  get value() {
    return progressValue;
  },
  get ready() {
    return readyValue;
  },
  /** report a stage's own completion, 0..1 */
  stage(name: StageName, fraction: number) {
    fractions[name] = Math.max(fractions[name], Math.min(1, Math.max(0, fraction)));
    recompute();
  },
  done(name: StageName) {
    this.stage(name, 1);
  },
  /** the stage does not apply here (no WebGL, reduced data …): count it as complete */
  skip(name: StageName) {
    this.stage(name, 1);
  },
  markReady() {
    if (readyValue) return;
    readyValue = true;
    (Object.keys(fractions) as StageName[]).forEach((name) => (fractions[name] = 1));
    recompute();
    listeners.forEach((listener) => listener(progressValue));
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    listener(progressValue);
    return () => void listeners.delete(listener);
  },
  /** arm the failsafe; called once by the loader on mount */
  armFailsafe() {
    if (failsafe !== null || typeof window === "undefined") return;
    failsafe = setTimeout(() => this.markReady(), FAILSAFE_MS);
  },
};
