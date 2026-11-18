/**
 * Device capability + quality tier, decided once on the client before the 3D chunk loads.
 * No three.js imports here: this module ships in the initial bundle.
 */

export type Quality = {
  /** phones / tablets / narrow windows */
  low: boolean;
  maxDpr: number;
  dust: number;
  hullPoints: number;
  multisampling: number;
  aberration: boolean;
  reducedMotion: boolean;
};

export type Capability = { kind: "pending" } | { kind: "off" } | { kind: "on"; quality: Quality };

let cached: Capability | null = null;

function hasWebGL2() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return false;
    // free the probe context right away: browsers cap live contexts (~16)
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function prefersReducedData() {
  const media = window.matchMedia("(prefers-reduced-data: reduce)").matches;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return media || connection?.saveData === true;
}

export function detectCapability(): Capability {
  if (cached) return cached;
  if (!hasWebGL2() || prefersReducedData()) {
    cached = { kind: "off" };
    return cached;
  }
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.innerWidth < 768;
  const low = coarse || narrow;
  cached = {
    kind: "on",
    quality: {
      low,
      maxDpr: coarse ? 1.25 : 1.5,
      dust: low ? 700 : 2000,
      hullPoints: low ? 3500 : 7000,
      // MSAA on the HDR target is the single most expensive knob: desktop only
      multisampling: low ? 0 : 2,
      aberration: !low,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    },
  };
  return cached;
}
