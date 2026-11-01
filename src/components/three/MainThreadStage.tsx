"use client";

import { useCallback, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { StageScene } from "./StageScene";
import { STAGE_CAMERA, STAGE_GL, STAGE_MAX_DPR, type StageProps } from "./stageProps";
import styles from "./SceneBackdrop.module.css";

/**
 * Fallback stage for browsers without OffscreenCanvas-in-a-worker: the same scene in a
 * regular <Canvas> on the main thread. Lazy-loaded, so three.js only reaches the main
 * thread when this path is actually taken.
 */
export default function MainThreadStage({ reducedMotion, skipIntro, burstCount, onReady }: StageProps) {
  const [dpr, setDpr] = useState(STAGE_MAX_DPR);
  // nothing is drawn until the model is baked and its shaders compiled (no first-frame stall)
  const [ready, setReady] = useState(false);
  const handleReady = useCallback(() => {
    setReady(true);
    onReady();
  }, [onReady]);

  // Stable callbacks so PerformanceMonitor keeps sampling instead of resetting on every render.
  const handleIncline = useCallback(() => setDpr(STAGE_MAX_DPR), []);
  const handleDecline = useCallback(() => setDpr(1), []);

  return (
    <div className={styles["scene-backdrop"]} aria-hidden="true">
      <Canvas
        className={styles["scene-backdrop__canvas"]}
        dpr={dpr}
        frameloop={!ready ? "never" : reducedMotion ? "demand" : "always"}
        camera={STAGE_CAMERA}
        gl={STAGE_GL}
      >
        <PerformanceMonitor onIncline={handleIncline} onDecline={handleDecline} />
        <StageScene reducedMotion={reducedMotion} skipIntro={skipIntro} burstCount={burstCount} onReady={handleReady} />
      </Canvas>
    </div>
  );
}
