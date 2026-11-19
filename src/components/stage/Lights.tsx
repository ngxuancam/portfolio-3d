"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Vector3, type DirectionalLight } from "three";
import { stage } from "@/lib/three/state";

/** camera-space directions for the fill (front-left-below) and the cool rim (back-left) */
const FILL_CAM = new Vector3(-0.6, -0.35, 1).normalize();
const RIM_CAM = new Vector3(-0.9, 0.35, -1).normalize();

/**
 * Space lighting: one hard key from the sun (the glare in the frame's upper right, so the ship is
 * back/side-lit and its silhouette catches the light), a faint indigo fill so the facing side is not
 * a black hole, and an electric-blue rim from the opposite side. Fill and rim follow the camera — in space
 * there is no room to bounce light, so they are cheats tied to the framing, kept subtle.
 */
export function Lights() {
  const key = useRef<DirectionalLight>(null);
  const fill = useRef<DirectionalLight>(null);
  const rim = useRef<DirectionalLight>(null);

  useFrame((state) => {
    const q = state.camera.quaternion;
    key.current?.position.copy(stage.sunDir).multiplyScalar(60);
    fill.current?.position.copy(FILL_CAM).applyQuaternion(q).multiplyScalar(60);
    rim.current?.position.copy(RIM_CAM).applyQuaternion(q).multiplyScalar(60);
  });

  return (
    <>
      <ambientLight color="#3c3f80" intensity={0.06} />
      <directionalLight ref={key} color="#ece8ff" intensity={3.0} />
      <directionalLight ref={fill} color="#5a5cc8" intensity={0.5} />
      <directionalLight ref={rim} color="#4d7dff" intensity={2.4} />
    </>
  );
}
