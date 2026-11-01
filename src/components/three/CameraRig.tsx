"use client";

import { memo, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { sceneSignals } from "@/lib/three/sceneSignals";
import { createCameraPath, frameAt } from "@/lib/three/cameraPath";

const WIDE_ASPECT = 1.1;

/**
 * Flies the camera along the section path. `sceneSignals.stage` (0 … sections-1) is
 * written by ScrollTrigger; here it is damped and sampled from the curves every frame,
 * so wheel steps turn into one continuous glide and React never re-renders.
 */
function CameraRigImpl() {
  const wide = useThree((state) => state.size.width / state.size.height > WIDE_ASPECT);
  const path = useMemo(() => createCameraPath(wide), [wide]);
  // damped state + scratch vectors, reused every frame (no per-frame allocation)
  const rig = useRef({ stage: 0, pointerX: 0, pointerY: 0, position: new THREE.Vector3(), target: new THREE.Vector3() });

  useFrame((state, delta) => {
    const s = rig.current;
    const { position, target } = s;
    s.stage = THREE.MathUtils.damp(s.stage, sceneSignals.stage, 3.2, delta);
    s.pointerX = THREE.MathUtils.damp(s.pointerX, sceneSignals.pointer.x, 2.5, delta);
    s.pointerY = THREE.MathUtils.damp(s.pointerY, sceneSignals.pointer.y, 2.5, delta);

    const t = THREE.MathUtils.clamp(s.stage / (path.stages - 1), 0, 1);
    path.positions.getPoint(t, position);
    path.targets.getPoint(t, target);
    // a little handheld parallax from the pointer — translation only, the subject never tilts
    position.x += s.pointerX * 0.18;
    position.y += s.pointerY * 0.12;

    state.camera.position.copy(position);
    state.camera.lookAt(target);

    // composition: slide the frustum so the subject sits left/centre/right of the copy
    const { width, height } = state.size;
    const camera = state.camera as THREE.PerspectiveCamera;
    camera.setViewOffset(width, height, -frameAt(path, s.stage) * width, 0, width, height);
  });

  return null;
}

export const CameraRig = memo(CameraRigImpl);
