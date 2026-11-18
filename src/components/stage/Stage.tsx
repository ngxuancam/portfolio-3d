"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect } from "react";
import type { Quality } from "@/lib/three/quality";
import { resetStage } from "@/lib/three/state";
import { CameraRig } from "./CameraRig";
import { Director } from "./Director";
import { Dust } from "./Dust";
import { Effects } from "./Effects";
import { Lifecycle } from "./Lifecycle";
import { Lights } from "./Lights";
import { Shield } from "./Shield";
import { Ship } from "./Ship";

const VOID = "#050607";

/**
 * The R3F scene. Frame order: Director (−1) computes the timeline → components (0) push it into
 * uniforms/transforms → Effects (1) renders through the post chain.
 * Reduced motion renders on demand only: a static pose needs no frame loop.
 */
export function Stage({ quality }: { quality: Quality }) {
  useEffect(() => resetStage, []);

  return (
    <Canvas
      dpr={[1, quality.maxDpr]}
      flat
      gl={{ antialias: false, alpha: false, stencil: false, powerPreference: "high-performance" }}
      camera={{ fov: 38, near: 0.1, far: 220, position: [6, 1.2, 9] }}
      frameloop={quality.reducedMotion ? "demand" : "always"}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={[VOID]} />
      <fogExp2 attach="fog" args={[VOID, 0.03]} />
      <Director quality={quality} />
      <CameraRig quality={quality} />
      <Lights />
      <Suspense fallback={null}>
        <Ship quality={quality} />
      </Suspense>
      <Shield quality={quality} />
      <Dust quality={quality} />
      <Effects quality={quality} />
      <Lifecycle quality={quality} />
    </Canvas>
  );
}
