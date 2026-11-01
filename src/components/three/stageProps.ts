import type { SignalSnapshot } from "@/lib/three/sceneSignals";

/** Props shared by both stage hosts (offscreen worker and main-thread fallback). */
export interface StageProps {
  reducedMotion: boolean;
  /** start directly on the formed bust (used when replacing the static poster) */
  skipIntro: boolean;
  burstCount: number;
  /** first frame drawn */
  onReady: () => void;
}

/** Shared camera / renderer settings, so both hosts frame the scene identically. */
export const STAGE_CAMERA = { position: [0, 0, 5] as [number, number, number], fov: 45, near: 0.1, far: 60 };
export const STAGE_GL = { antialias: true, alpha: true, powerPreference: "high-performance" as const };
export const STAGE_MAX_DPR = 1.5;

/* ---- main thread ⇄ stage worker protocol -------------------------------------- */

export type StageMessage =
  | {
      type: "init";
      canvas: OffscreenCanvas;
      width: number;
      height: number;
      dpr: number;
      reducedMotion: boolean;
      skipIntro: boolean;
      burstCount: number;
      signals: SignalSnapshot;
    }
  | { type: "resize"; width: number; height: number }
  | { type: "signals"; signals: SignalSnapshot };

export type StageReply = { type: "ready" } | { type: "error"; message: string };

/** OffscreenCanvas can be handed to a worker (WebGL support is confirmed by the worker). */
export function supportsOffscreenStage(): boolean {
  return (
    typeof Worker !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    "transferControlToOffscreen" in HTMLCanvasElement.prototype
  );
}
