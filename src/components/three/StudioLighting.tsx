"use client";

import { memo } from "react";

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
  return (
    <>
      <hemisphereLight args={["#fff8ee", "#d9cbb4", 0.9]} />
      <directionalLight position={[-3, 3, 4]} intensity={2.6} color="#fff4e8" />
      <directionalLight position={[3.5, 0.5, 3.5]} intensity={0.9} color="#eef1ff" />
      <directionalLight position={[-5, 1, -2]} intensity={2.0} color="#ffffff" />
      <directionalLight position={[5, 1, -2]} intensity={2.0} color="#f2e6cf" />
      <directionalLight position={[0, 5, -4]} intensity={1.6} color="#9fb6e0" />
    </>
  );
}

/** Static rig: no props, memoised so it never re-renders after mount. */
export const StudioLighting = memo(StudioLightingImpl);
