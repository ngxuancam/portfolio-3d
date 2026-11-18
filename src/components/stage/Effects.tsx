"use client";

import { useFrame, useThree } from "@react-three/fiber";
import {
  BloomEffect,
  ChromaticAberrationEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
  type Effect,
} from "postprocessing";
import { useEffect, useMemo } from "react";
import { HalfFloatType, Vector2 } from "three";
import { createSanitizePass } from "@/lib/three/sanitize";
import type { Quality } from "@/lib/three/quality";
import { useDisposeOnUnmount } from "./useDisposeOnUnmount";

/**
 * Post chain on a half-float target so the HDR weld survives until bloom:
 * sanitise (NaN/Inf guard) → bloom (threshold just under the edge) → chromatic aberration
 * (desktop) → neutral tone mapping → vignette. No film grain: space reads clean and still.
 * The effects merge into ONE fullscreen pass after the bloom mips.
 */
export function Effects({ quality }: { quality: Quality }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  const composer = useMemo(() => {
    const composer = new EffectComposer(gl, {
      frameBufferType: HalfFloatType,
      multisampling: quality.multisampling,
    });
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(createSanitizePass());
    const effects: Effect[] = [
      new BloomEffect({
        mipmapBlur: true,
        // the hologram rim peaks ≈ 0.6; the weld is ×7: only the weld and shield flashes bloom
        luminanceThreshold: 0.85,
        luminanceSmoothing: 0.2,
        intensity: quality.low ? 0.9 : 1.15,
        radius: 0.65,
        levels: quality.low ? 5 : 7,
      }),
    ];
    if (quality.aberration) {
      effects.push(
        new ChromaticAberrationEffect({
          offset: new Vector2(0.0011, 0.0007),
          radialModulation: true,
          modulationOffset: 0.25,
        }),
      );
    }
    effects.push(
      new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
      new VignetteEffect({ offset: 0.32, darkness: 0.62 }),
    );
    composer.addPass(new EffectPass(camera, ...effects));
    return composer;
  }, [gl, scene, camera, quality.multisampling, quality.aberration, quality.low]);

  // TEMP-DEBUG
  if (typeof window !== "undefined") (window as unknown as Record<string, unknown>).__lab = { scene, camera, composer, gl };
  useDisposeOnUnmount(composer);
  useEffect(() => composer.setSize(size.width, size.height), [composer, size, dpr]);

  // priority 1 takes over rendering from R3F: the composer draws the frame
  useFrame((_, delta) => composer.render(delta), 1);
  return null;
}
