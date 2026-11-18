"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { BufferAttribute, BufferGeometry, MathUtils, Points, Raycaster, ShaderMaterial, Vector2, Vector3 } from "three";
import { signals } from "@/lib/scroll/signals";
import { createDustMaterial } from "@/lib/three/materials";
import type { Quality } from "@/lib/three/quality";
import { useDisposeOnUnmount } from "./useDisposeOnUnmount";

const BOX = new Vector3(48, 24, 48);

function createDustGeometry(count: number) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * BOX.x;
    positions[i * 3 + 1] = (Math.random() - 0.5) * BOX.y;
    positions[i * 3 + 2] = (Math.random() - 0.5) * BOX.z;
    seeds[i] = Math.random();
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new BufferAttribute(seeds, 1));
  return geometry;
}

/**
 * Drifting dust. The CPU only updates the pointer ray (damped, so motes ease out of the way
 * instead of snapping); the drift and the push happen in the vertex shader.
 */
export function Dust({ quality }: { quality: Quality }) {
  const geometry = useMemo(() => createDustGeometry(quality.dust), [quality.dust]);
  const material = useMemo(() => createDustMaterial(BOX.clone()), []);
  useDisposeOnUnmount(geometry);
  useDisposeOnUnmount(material);

  const ref = useRef<Points>(null);
  const scratch = useRef<{ ray: Raycaster; ndc: Vector2 } | null>(null);

  useFrame((state, rawDelta) => {
    const points = ref.current;
    if (!points) return;
    const tmp = (scratch.current ??= { ray: new Raycaster(), ndc: new Vector2() });
    const dt = Math.min(rawDelta, 0.1);
    const u = (points.material as ShaderMaterial).uniforms;
    const active = signals.pointerActive && !quality.reducedMotion;
    u.uPush.value = MathUtils.damp(u.uPush.value, active ? 1 : 0, 3, dt);
    if (!active && u.uPush.value < 0.001) return;
    tmp.ndc.x = MathUtils.damp(tmp.ndc.x, signals.pointer.x, 6, dt);
    tmp.ndc.y = MathUtils.damp(tmp.ndc.y, signals.pointer.y, 6, dt);
    tmp.ray.setFromCamera(tmp.ndc, state.camera);
    (u.uRayOrigin.value as Vector3).copy(tmp.ray.ray.origin);
    (u.uRayDir.value as Vector3).copy(tmp.ray.ray.direction);
  });

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={4} />;
}
