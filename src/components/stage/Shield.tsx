"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Mesh, ShaderMaterial } from "three";
import { createHexDome } from "@/lib/three/hexDome";
import { createShieldMaterial } from "@/lib/three/materials";
import type { Quality } from "@/lib/three/quality";
import { stage } from "@/lib/three/state";
import { useDisposeOnUnmount } from "./useDisposeOnUnmount";

const RADIUS = 18;

/** Hex shield dome around the ship, revealed top-down cell by cell later in the scroll. */
export function Shield({ quality }: { quality: Quality }) {
  const geometry = useMemo(
    // detail 17 ≈ 1.9k cells / 11k triangles above the floor line; 13 on low tier ≈ 1.1k cells
    () => createHexDome({ radius: RADIUS, detail: quality.low ? 13 : 17, floor: -0.14 }),
    [quality.low],
  );
  const material = useMemo(() => createShieldMaterial(), []);
  useDisposeOnUnmount(geometry);
  useDisposeOnUnmount(material);

  const ref = useRef<Mesh>(null);
  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.visible = stage.shield > 0.001;
    const u = (mesh.material as ShaderMaterial).uniforms;
    u.uProgress.value = stage.shield;
    // 1 well inside the dome, 0 once outside: the dome fills the whole view from in there
    const distance = state.camera.position.distanceTo(mesh.position);
    u.uInside.value = 1 - Math.min(1, Math.max(0, (distance - RADIUS * 0.85) / (RADIUS * 0.3)));
  });

  // a slight tilt so the cell rows never line up with the horizon
  return (
    <mesh
      ref={ref}
      geometry={geometry}
      material={material}
      position={[0, -1.4, 0]}
      rotation={[0, 0.3, 0.05]}
      renderOrder={3}
      frustumCulled={false}
    />
  );
}
