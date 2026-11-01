"use client";

import { Suspense } from "react";
import { PortraitModel } from "./PortraitModel";
import { StudioLighting } from "./StudioLighting";
import { CameraRig } from "./CameraRig";

export interface StageSceneProps {
  reducedMotion: boolean;
  /** start directly on the formed bust (used when replacing the static poster) */
  skipIntro: boolean;
  burstCount: number;
  /** the model is baked and every shader compiled — safe to start the frame loop */
  onReady: () => void;
}

/**
 * The scene graph itself — lights, camera journey, bust + flower. Renderer-agnostic:
 * mounted by the OffscreenCanvas worker (stageWorkerEntry) or, as a fallback, by a
 * regular main-thread <Canvas> (MainThreadStage).
 */
export function StageScene({ reducedMotion, skipIntro, burstCount, onReady }: StageSceneProps) {
  return (
    <>
      <StudioLighting />
      <CameraRig />
      <Suspense fallback={null}>
        <PortraitModel
          particleCount={burstCount}
          reducedMotion={reducedMotion}
          skipIntro={skipIntro}
          onReady={onReady}
        />
      </Suspense>
    </>
  );
}
