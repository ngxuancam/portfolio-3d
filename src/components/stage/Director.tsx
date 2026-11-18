"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { FogExp2, MathUtils, PerspectiveCamera } from "three";
import { progress } from "@/lib/loading/progress";
import { signals } from "@/lib/scroll/signals";
import type { Quality } from "@/lib/three/quality";
import { shared, stage } from "@/lib/three/state";
import { buildProgress, fogDensity, INTRO_SECONDS, shieldProgress, sweepThreshold } from "@/lib/three/timeline";

/** if the loader never sets data-loaded, start the intro this long after the stage is ready */
const INTRO_FALLBACK_S = 3;
/** scroll damping rate: wheel steps glide in ≈ 0.25 s */
const SCROLL_DAMP = 4.5;

/**
 * Owns the timeline. Runs before everything else each frame (priority −1) and writes the shared
 * stage state + uniforms that the rest of the scene reads.
 */
export function Director({ quality }: { quality: Quality }) {
  const clock = useRef({ first: true, introStart: -1, readySince: -1, elapsed: 0 });

  useFrame((state, rawDelta) => {
    // clamp: after a hidden tab or a long GC pause, glide rather than teleport
    const dt = Math.min(rawDelta, 0.1);
    const c = clock.current;
    c.elapsed += dt;

    if (c.first) {
      c.first = false;
      stage.chapter = signals.chapter;
    }

    if (quality.reducedMotion) {
      stage.chapter = signals.chapter;
      stage.intro = 1;
      stage.build = 1;
      stage.shield = 0;
    } else {
      shared.uTime.value += dt;
      if (c.introStart < 0) {
        if (progress.ready && c.readySince < 0) c.readySince = c.elapsed;
        const lifted = document.documentElement.dataset.loaded !== undefined;
        const fallback = c.readySince >= 0 && c.elapsed - c.readySince > INTRO_FALLBACK_S;
        if (lifted || fallback) c.introStart = c.elapsed;
      } else {
        stage.intro = Math.min(1, (c.elapsed - c.introStart) / INTRO_SECONDS);
      }
      stage.chapter = MathUtils.damp(stage.chapter, signals.chapter, SCROLL_DAMP, dt);
      stage.build = buildProgress(stage.intro, stage.chapter);
      stage.shield = shieldProgress(stage.chapter);
    }
    shared.uThreshold.value = sweepThreshold(stage.build);

    // matches the layout: from 64rem the text takes columns 1–7 and leaves the right to the ship
    stage.narrow = state.size.width < 1024;
    // narrow screens also get the page's 45 % scrim; this only takes the edge off the weld
    const dim = stage.narrow ? 0.85 : 1;
    shared.uDim.value = quality.reducedMotion || c.elapsed < 0.2 ? dim : MathUtils.damp(shared.uDim.value, dim, 4, dt);

    const density = fogDensity(stage.chapter);
    shared.uFogDensity.value = density;
    if (state.scene.fog instanceof FogExp2) state.scene.fog.density = density;

    const camera = state.camera as PerspectiveCamera;
    const bufferHeight = state.size.height * state.viewport.dpr;
    shared.uPointScale.value = bufferHeight / (2 * Math.tan(MathUtils.degToRad(camera.fov) / 2));
  }, -1);

  return null;
}
