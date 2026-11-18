"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { MathUtils, PerspectiveCamera } from "three";
import { signals } from "@/lib/scroll/signals";
import type { Quality } from "@/lib/three/quality";
import { shared, stage } from "@/lib/three/state";
import { buildActivity, buildProgress, shieldProgress, sweepThreshold, thrustLevel } from "@/lib/three/timeline";

/** scroll damping rate: wheel steps glide in ≈ 0.25 s */
const SCROLL_DAMP = 4.5;
/** steady glow shown instead of a live burn under prefers-reduced-motion */
const STATIC_THRUST = 0.6;

/**
 * Owns the timeline. Runs before everything else each frame (priority −1) and writes the shared
 * stage state + uniforms that the rest of the scene reads.
 */
export function Director({ quality }: { quality: Quality }) {
  const clock = useRef({ first: true, elapsed: 0, ignited: false, ignitedAt: 0 });

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
      stage.build = 1;
      stage.activity = 0;
      stage.shield = 0;
      stage.thrust = STATIC_THRUST;
      stage.kick = 0;
      stage.flicker = 1;
      stage.shake = 0;
    } else {
      const t = (shared.uTime.value += dt);
      stage.chapter = MathUtils.damp(stage.chapter, signals.chapter, SCROLL_DAMP, dt);
      stage.build = buildProgress(stage.chapter);
      stage.activity = buildActivity(stage.build);
      stage.shield = shieldProgress(stage.chapter);

      // ignition is an EVENT (edge-triggered), so the kick plays once per arrival, not per frame
      const level = thrustLevel(stage.chapter);
      if (!c.ignited && level > 0.02) {
        c.ignited = true;
        c.ignitedAt = c.elapsed;
      } else if (c.ignited && level < 0.005) {
        c.ignited = false;
      }
      stage.kick = c.ignited ? Math.exp(-(c.elapsed - c.ignitedAt) * 3.2) : 0;
      // the kick overshoots the burn: the engine catches hard, then settles
      stage.thrust = level * (1 + 0.9 * stage.kick);
      // two incommensurate sines + a random jitter: never periodic enough to read as a loop
      stage.flicker = 0.9 + 0.07 * Math.sin(t * 53) * Math.sin(t * 31.7) + 0.06 * Math.random();
      stage.shake = 0.06 * stage.kick * level + 0.004 * level;
    }
    shared.uThreshold.value = sweepThreshold(stage.build);

    // matches the layout: from 64rem the text takes columns 1–7 and leaves the right to the ship
    stage.narrow = state.size.width < 1024;
    // narrow screens also get the page's 45 % scrim; this only takes the edge off the weld
    const dim = stage.narrow ? 0.85 : 1;
    shared.uDim.value = quality.reducedMotion || c.elapsed < 0.2 ? dim : MathUtils.damp(shared.uDim.value, dim, 4, dt);

    const camera = state.camera as PerspectiveCamera;
    const bufferHeight = state.size.height * state.viewport.dpr;
    shared.uPointScale.value = bufferHeight / (2 * Math.tan(MathUtils.degToRad(camera.fov) / 2));
  }, -1);

  return null;
}
