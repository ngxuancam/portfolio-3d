import type { SignalSnapshot } from "@/lib/three/sceneSignals";
import type { StageLook } from "@/theme/themes";
import type { AnchorSnapshot } from "@/lib/three/shipAnchors";

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
      look: StageLook;
    }
  | { type: "resize"; width: number; height: number }
  | { type: "signals"; signals: SignalSnapshot }
  | { type: "theme"; look: StageLook };

export type StageReply = { type: "ready" } | { type: "error"; message: string } | { type: "anchors"; anchors: AnchorSnapshot };

/** OffscreenCanvas can be handed to a worker (WebGL support is confirmed by the worker). */
export function supportsOffscreenStage(): boolean {
  return (
    typeof Worker !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    "transferControlToOffscreen" in HTMLCanvasElement.prototype
  );
}
