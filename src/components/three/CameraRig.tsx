"use client";

import { memo, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { sceneSignals } from "@/lib/three/sceneSignals";
import { stageTheme } from "@/lib/three/stageTheme";
import { cinema } from "@/lib/three/cinema";
import { createCameraPath, frameAt } from "@/lib/three/cameraPath";

const WIDE_ASPECT = 1.1;
/** vertical FOV of the portrait shots, and of the ship's wide-angle look */
const FOV_PORTRAIT = 45;
const FOV_SHIP = 64;

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
    // the blueprint ship keeps the hero shot on every section (the page scrolls over it)
    const stageTarget = sceneSignals.stage * (1 - stageTheme.shape);
    s.stage = THREE.MathUtils.damp(s.stage, stageTarget, 3.2, delta);
    s.pointerX = THREE.MathUtils.damp(s.pointerX, sceneSignals.pointer.x, 2.5, delta);
    s.pointerY = THREE.MathUtils.damp(s.pointerY, sceneSignals.pointer.y, 2.5, delta);

    const t = THREE.MathUtils.clamp(s.stage / (path.stages - 1), 0, 1);
    path.positions.getPoint(t, position);
    path.targets.getPoint(t, target);
    // a little handheld parallax from the pointer — translation only, the subject never tilts
    // (none in the blueprint theme: its ship follows the scroll only)
    const parallax = 1 - stageTheme.shape;
    position.x += s.pointerX * 0.18 * parallax;
    position.y += s.pointerY * 0.12 * parallax;

    const k = stageTheme.shape * (cinema.calm ? 0 : 1); // cinematic extras: none in calm mode

    state.camera.position.copy(position);
    state.camera.lookAt(target);
    state.camera.rotateZ(-cinema.bank * 0.2 * k); // the shot leans into the ship's bank

    // composition: slide the frustum so the subject sits left/centre/right of the copy
    const { width, height } = state.size;
    const camera = state.camera as THREE.PerspectiveCamera;
    camera.fov = THREE.MathUtils.lerp(FOV_PORTRAIT, FOV_SHIP, stageTheme.shape) + cinema.speed * 6 * k; // widens at speed; setViewOffset re-projects
    camera.setViewOffset(width, height, -frameAt(path, s.stage) * width, 0, width, height);
  });

  return null;
}

export const CameraRig = memo(CameraRigImpl);
