"use client";

import { Suspense, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { stageTheme } from "@/lib/three/stageTheme";
import { PortraitModel } from "./PortraitModel";
import { StudioLighting } from "./StudioLighting";
import { CameraRig } from "./CameraRig";
import { ShipModel } from "./ShipModel";

/** Advances the theme morph each frame; wakes a demand-driven loop (reduced motion) while it runs. */
function ThemeDriver() {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => stageTheme.subscribe(invalidate), [invalidate]);
  useFrame((_, delta) => {
    if (stageTheme.step(delta)) invalidate();
  });
  return null;
}

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
      <ThemeDriver />
      <StudioLighting />
      <CameraRig />
      <Suspense fallback={null}>
        <ShipModel />
      </Suspense>
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
