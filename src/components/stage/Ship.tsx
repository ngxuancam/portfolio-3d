"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { use, useEffect, useMemo, useRef } from "react";
import { Color, Group, Mesh, Object3D, PointLight, Points, ShaderMaterial } from "three";
import { progress } from "@/lib/loading/progress";
import { createHologramMaterial, createHullMaterial, createHullPointsMaterial } from "@/lib/three/materials";
import type { Quality } from "@/lib/three/quality";
import { loadShip, sampleHull } from "@/lib/three/ship";
import { trackCompile } from "@/lib/three/lifetime";
import { shared, stage } from "@/lib/three/state";
import { Thruster } from "./Thruster";
import { useDisposeOnUnmount } from "./useDisposeOnUnmount";

const reportModel = (fraction: number) => progress.stage("model", fraction);
const EDGE_LIGHT = new Color("#c95cff");
const TAU = Math.PI * 2;
/** resting pose: slightly elevated, a touch of pitch and bank */
const BASE = { y: 0.25, pitch: 0.04, roll: -0.05 };

/**
 * The ship, drawn three times from one geometry (plus its engines, see Thruster): the solid built hull (opaque, writes depth), the
 * hologram of the unbuilt part (additive) and the surface point cloud (additive). All three run
 * the same sweep function, so they agree on the front to the pixel.
 *
 * Suspends on the model; once mounted it pre-compiles every program, then reports `build` and
 * marks the loader ready after the first frames are actually on screen.
 */
export function Ship({ quality }: { quality: Quality }) {
  const asset = use(loadShip(reportModel));
  const { gl, scene, camera, invalidate } = useThree();

  const parts = useMemo(() => {
    if (!asset) return null;
    return {
      hull: createHullMaterial(asset.map),
      hologram: createHologramMaterial(),
      pointsMaterial: createHullPointsMaterial(),
      pointsGeometry: sampleHull(asset.geometry, quality.hullPoints),
    };
  }, [asset, quality.hullPoints]);

  useEffect(() => {
    if (!asset) return;
    shared.uSweep.value.set(asset.axisMin, 1 / asset.axisLength);
  }, [asset]);

  useDisposeOnUnmount(parts?.hull);
  useDisposeOnUnmount(parts?.hologram);
  useDisposeOnUnmount(parts?.pointsMaterial);
  useDisposeOnUnmount(parts?.pointsGeometry);
  // the parsed asset is module-cached; three re-uploads it if the stage ever mounts again
  useDisposeOnUnmount(asset?.geometry);
  useDisposeOnUnmount(asset?.map);

  // compile every program up front so the first scroll never hitches on a shader compile.
  // Once per mount (the ref survives Strict Mode's effect replay), tracked so nothing it is
  // still polling gets disposed underneath it.
  const warm = useRef({ started: false, compiled: false, frames: 0 });
  useEffect(() => {
    if (!asset) {
      progress.skip("model");
      progress.skip("build");
      progress.markReady();
      return;
    }
    const w = warm.current;
    if (w.started) return;
    w.started = true;
    progress.stage("build", 0.2);
    // compile() only walks VISIBLE objects, and the thruster / shield / hologram toggle themselves
    // off — reveal everything for the synchronous traversal so none of them compiles mid-scroll
    const hidden: Object3D[] = [];
    scene.traverse((object) => {
      if (!object.visible) {
        hidden.push(object);
        object.visible = true;
      }
    });
    const compiling = gl.compileAsync(scene, camera);
    hidden.forEach((object) => (object.visible = false));
    trackCompile(compiling)
      .catch(() => undefined)
      .then(() => {
        progress.done("build");
        w.compiled = true;
        invalidate();
      });
  }, [asset, gl, scene, camera, invalidate]);

  const groupRef = useRef<Group>(null);
  const hologramRef = useRef<Mesh>(null);
  const pointsRef = useRef<Points>(null);
  const lightRef = useRef<PointLight>(null);

  useFrame(() => {
    const w = warm.current;
    if (w.compiled && !progress.ready) {
      // two frames: one to upload, one actually presented
      if (++w.frames >= 2) progress.markReady();
      else invalidate();
    }
    if (!asset) return;
    const threshold = shared.uThreshold.value;
    // once the front has cleared the nose there is nothing left to draw in the additive passes
    const unbuilt = threshold < 1.12;
    if (hologramRef.current) hologramRef.current.visible = unbuilt;
    if (pointsRef.current) {
      // no specks on the calm hero: the cloud only appears once building has begun
      pointsRef.current.visible = unbuilt && stage.activity > 0.001;
      (pointsRef.current.material as ShaderMaterial).uniforms.uActivity.value = stage.activity;
    }

    // floating, not parked: slow incommensurate drift / bob / roll (periods 7–13 s), plus a
    // forward lurch when the engines kick
    const group = groupRef.current;
    if (group) {
      const t = quality.reducedMotion ? 0 : shared.uTime.value;
      group.position.set(
        Math.sin((t * TAU) / 11.3) * 0.06,
        BASE.y + Math.sin((t * TAU) / 7.4) * 0.08,
        Math.sin((t * TAU) / 13.1) * 0.04 + stage.kick * stage.thrust * 0.18,
      );
      group.rotation.set(
        BASE.pitch + Math.sin((t * TAU) / 9.6 + 1.3) * 0.018,
        Math.sin((t * TAU) / 12.7 + 0.4) * 0.025,
        BASE.roll + Math.sin((t * TAU) / 8.7 + 2.1) * 0.032,
      );
    }
    const light = lightRef.current;
    if (light) {
      const front = Math.min(1, Math.max(0, threshold));
      light.position.set(0, 0.9, asset.axisMin + asset.axisLength * front);
      // on while the front is on the hull, off before it starts and after it leaves
      const onHull = Math.min(1, Math.max(0, (threshold + 0.06) / 0.08)) * Math.min(1, Math.max(0, (1.1 - threshold) / 0.1));
      light.intensity = 9 * onHull * shared.uDim.value;
      // world-space weld position (just under the light, on the hull) for close-pass framing
      stage.front.set(0, 0.35, light.position.z);
      if (group) group.localToWorld(stage.front);
      stage.frontWeight = onHull;
    }
  });

  if (!asset || !parts) return null;
  return (
    <group ref={groupRef} position={[0, BASE.y, 0]} rotation={[BASE.pitch, 0, BASE.roll]}>
      <mesh geometry={asset.geometry} material={parts.hull} />
      <mesh ref={hologramRef} geometry={asset.geometry} material={parts.hologram} renderOrder={1} />
      <points ref={pointsRef} geometry={parts.pointsGeometry} material={parts.pointsMaterial} renderOrder={2} />
      <pointLight ref={lightRef} color={EDGE_LIGHT} intensity={0} distance={6} decay={2} />
      <Thruster engine={asset.engine} quality={quality} />
    </group>
  );
}
