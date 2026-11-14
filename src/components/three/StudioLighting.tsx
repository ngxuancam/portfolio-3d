"use client";

import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { stageTheme } from "@/lib/three/stageTheme";

/**
 * Classic portrait studio rig, direct lights only (no environment map: rendering a
 * cubemap and filtering it to PMREM was a long main-thread task on the first frame):
 *   key   - front-left, above eye line (main modelling light)
 *   fill  - front-right, lower and softer (opens up the shadow side)
 *   kick  - left and right, slightly behind (separates the silhouette from the canvas)
 *   back  - behind and above (hair light / rim on the shoulders)
 *   sky/ground - a warm hemisphere for the soft wrap the environment used to give
 */
function StudioLightingImpl() {
  const hemi = useRef<THREE.HemisphereLight>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);
  const kickL = useRef<THREE.DirectionalLight>(null);
  const kickR = useRef<THREE.DirectionalLight>(null);
  const back = useRef<THREE.DirectionalLight>(null);

  // light colours follow the live theme (a handful of Color copies per frame)
  useFrame(() => {
    const c = stageTheme.current;
    hemi.current?.color.copy(c.sky);
    hemi.current?.groundColor.copy(c.ground);
    key.current?.color.copy(c.key);
    fill.current?.color.copy(c.fill);
    kickL.current?.color.copy(c.kickLeft);
    kickR.current?.color.copy(c.kickRight);
    back.current?.color.copy(c.back);
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={["#ffffff", "#ffffff", 0.9]} />
      <directionalLight ref={key} position={[-3, 3, 4]} intensity={2.6} />
      <directionalLight ref={fill} position={[3.5, 0.5, 3.5]} intensity={0.9} />
      <directionalLight ref={kickL} position={[-5, 1, -2]} intensity={2.0} />
      <directionalLight ref={kickR} position={[5, 1, -2]} intensity={2.0} />
      <directionalLight ref={back} position={[0, 5, -4]} intensity={1.6} />
    </>
  );
}

/** Static rig: no props, memoised so it never re-renders after mount. */
export const StudioLighting = memo(StudioLightingImpl);
