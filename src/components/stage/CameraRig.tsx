"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { MathUtils, PerspectiveCamera, Vector3 } from "three";
import { signals } from "@/lib/scroll/signals";
import type { Quality } from "@/lib/three/quality";
import { stage } from "@/lib/three/state";
import {
  cameraPose,
  frontFocus,
  parallaxScale,
  smooth,
  STATIC_POSE,
  type CameraPose,
} from "@/lib/three/timeline";

const UP = new Vector3(0, 1, 0);
const PARALLAX = 0.1;
/**
 * On wide screens the look target is drawn this far right of centre (NDC): 0.58 ≈ 79 % of the
 * width, the middle of the free area right of the text column (columns 1–7 ≈ 58 %).
 */
const WIDE_SHIFT = 0.58;
/** reference aspect the chapter radii are tuned for; squarer windows back off proportionally */
const REF_ASPECT = 16 / 9;

const createScratch = () => ({
  pose: { angle: 0, radius: 0, height: 0, lookY: 0 } as CameraPose,
  target: new Vector3(),
  aim: new Vector3(),
  focus: 0,
  offset: new Vector3(),
  right: new Vector3(),
  yaw: 0,
  pitch: 0,
  shift: Number.NaN,
  view: { width: 0, height: 0, shift: Number.NaN, fov: 0 },
});

/**
 * Scroll-scrubbed spiral around the ship + damped pointer parallax. The parallax orbits the look
 * target (yaw about world Y, pitch about the camera's right axis) instead of rotating the camera
 * in place, so the ship shifts against the background like a real head move.
 *
 * Composition uses a view offset (an off-axis projection): the orbit stays centred on its target
 * (the hull, or part-way to the weld on close passes) while that target is drawn right of centre.
 */
export function CameraRig({ quality }: { quality: Quality }) {
  // per-frame scratch lives in a ref: mutated every frame, never part of render
  const scratch = useRef<ReturnType<typeof createScratch> | null>(null);

  useFrame((state, rawDelta) => {
    const tmp = (scratch.current ??= createScratch());
    const dt = Math.min(rawDelta, 0.1);
    const camera = state.camera as PerspectiveCamera;
    const { width, height } = state.size;
    const narrow = stage.narrow;

    const pose = quality.reducedMotion ? STATIC_POSE : cameraPose(stage.chapter, tmp.pose);
    // narrow: the ship is centred behind the text, so back off to keep it whole; wide but squarer
    // than 16:9: the free right-hand area is narrower in world units, so back off to fit it
    const aspectFit = Math.min(1.45, Math.max(1, REF_ASPECT / (width / Math.max(1, height))));
    const radius = pose.radius * (narrow ? 1.35 : aspectFit);

    // close passes aim part-way at the weld so it stays framed on the right, not behind the text
    const focusTarget = quality.reducedMotion || narrow ? 0 : frontFocus(stage.chapter) * stage.frontWeight;
    tmp.focus = MathUtils.damp(tmp.focus, focusTarget, 3, dt);
    tmp.aim.set(stage.front.x, Math.max(pose.lookY, stage.front.y), stage.front.z);
    tmp.target.set(0, pose.lookY, 0).lerp(tmp.aim, tmp.focus);
    tmp.offset.set(Math.sin(pose.angle) * radius, pose.height, Math.cos(pose.angle) * radius);

    const active = signals.pointerActive && !quality.reducedMotion;
    const k = 1 - Math.exp(-3 * dt);
    tmp.yaw += ((active ? signals.pointer.x * PARALLAX : 0) - tmp.yaw) * k;
    tmp.pitch += ((active ? signals.pointer.y * PARALLAX : 0) - tmp.pitch) * k;
    const strength = parallaxScale(stage.chapter);
    tmp.offset.applyAxisAngle(UP, tmp.yaw * strength);
    tmp.right.crossVectors(UP, tmp.offset).normalize();
    tmp.offset.applyAxisAngle(tmp.right, tmp.pitch * strength);

    camera.position.copy(tmp.target).add(tmp.offset);
    camera.lookAt(tmp.target);
    // engine shake: position-only jitter after aiming, so the frame trembles rather than swings
    if (stage.shake > 1e-4) {
      const t = state.clock.elapsedTime;
      tmp.right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      camera.position.addScaledVector(tmp.right, Math.sin(t * 61) * Math.sin(t * 23.3) * stage.shake);
      camera.position.y += Math.sin(t * 47 + 1.7) * Math.sin(t * 17.9) * stage.shake;
    }
    // a hint of roll while close in, levelled out as the camera pulls back
    if (!quality.reducedMotion) camera.rotateZ(-0.045 * (1 - smooth(Math.min(1, stage.chapter / 2.5))));

    const shiftTarget = narrow ? 0 : WIDE_SHIFT;
    // first frame and reduced motion (render-on-demand: no frames to damp over) snap straight there
    tmp.shift =
      Number.isNaN(tmp.shift) || quality.reducedMotion ? shiftTarget : MathUtils.damp(tmp.shift, shiftTarget, 5, dt);
    const fov = narrow ? 48 : 38;
    const v = tmp.view;
    if (v.width !== width || v.height !== height || Math.abs(v.shift - tmp.shift) > 1e-4 || v.fov !== fov) {
      v.width = width;
      v.height = height;
      v.shift = tmp.shift;
      v.fov = fov;
      stage.viewShift = tmp.shift;
      camera.fov = fov;
      // negative x offset slides the window left, i.e. the scene is drawn right of centre
      camera.setViewOffset(width, height, (-tmp.shift * width) / 2, 0, width, height);
    }
  });

  return null;
}
