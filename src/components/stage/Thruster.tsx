"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group, PointLight, ShaderMaterial } from "three";
import type { Quality } from "@/lib/three/quality";
import type { EngineMount } from "@/lib/three/ship";
import { stage } from "@/lib/three/state";
import {
  createGlowGeometry,
  createNozzleGlowMaterial,
  createPlumeGeometry,
  createPlumeMaterial,
  createSparksGeometry,
  createSparksMaterial,
  PLASMA_HOT,
} from "@/lib/three/thruster";
import { useDisposeOnUnmount } from "./useDisposeOnUnmount";

const PLUME_LENGTH = 7;
const CORE_LENGTH = 2.6;

/**
 * Twin plasma exhausts at the tail. Lives inside the ship's group so it rides the float motion.
 * Everything is driven from `stage.thrust` / `kick` / `flicker` (Director); off means invisible,
 * so it costs nothing before the skills chapter.
 */
export function Thruster({ engine, quality }: { engine: EngineMount; quality: Quality }) {
  const res = useMemo(
    () => ({
      plume: createPlumeGeometry(engine.radius * 0.8, PLUME_LENGTH, 2.3),
      core: createPlumeGeometry(engine.radius * 0.36, CORE_LENGTH, 1.25),
      plumeMaterial: createPlumeMaterial({ core: false }),
      coreMaterial: createPlumeMaterial({ core: true }),
      glow: createGlowGeometry(),
      glowMaterial: createNozzleGlowMaterial(),
      sparks: createSparksGeometry(quality.low ? 260 : 700),
      sparksMaterial: createSparksMaterial(engine),
    }),
    [engine, quality.low],
  );
  useDisposeOnUnmount(res.plume);
  useDisposeOnUnmount(res.core);
  useDisposeOnUnmount(res.plumeMaterial);
  useDisposeOnUnmount(res.coreMaterial);
  useDisposeOnUnmount(res.glow);
  useDisposeOnUnmount(res.glowMaterial);
  useDisposeOnUnmount(res.sparks);
  useDisposeOnUnmount(res.sparksMaterial);

  const root = useRef<Group>(null);
  const light = useRef<PointLight>(null);

  useFrame(() => {
    const group = root.current;
    if (!group) return;
    const power = stage.thrust;
    group.visible = power > 0.003;
    if (!group.visible) {
      if (light.current) light.current.intensity = 0;
      return;
    }
    const burn = Math.min(power, 1);
    const flicker = stage.flicker;
    const set = (material: ShaderMaterial, key: string, value: number) => (material.uniforms[key].value = value);
    set(res.plumeMaterial, "uPower", power);
    set(res.plumeMaterial, "uFlicker", flicker);
    set(res.coreMaterial, "uPower", power);
    set(res.coreMaterial, "uFlicker", flicker);
    set(res.glowMaterial, "uPower", power * flicker);
    set(res.glowMaterial, "uFlash", stage.kick);
    set(res.glowMaterial, "uSize", engine.radius * (1.6 + 1.4 * stage.kick) * (1 + 0.5 * (stage.boost - 1)));
    set(res.sparksMaterial, "uPower", quality.reducedMotion ? 0 : power);

    // the jet lengthens with power and overshoots on the kick; idle is a short stub
    const length = (0.28 + 0.72 * burn) * (1 + 0.25 * stage.kick) * (0.97 + 0.03 * flicker) * stage.boost;
    // the boost also opens the jet up: wider, but less than it lengthens, so it stays a jet
    const width = 1 + 0.45 * (stage.boost - 1);
    group.traverse((child) => {
      if (child.userData.plume) child.scale.set(width, width, length);
    });
    if (light.current) light.current.intensity = 26 * power * flicker * stage.boost;
  });

  const nozzles = [engine.x, -engine.x];
  return (
    <>
    <group ref={root} visible={false}>
      {nozzles.map((x) => (
        <group key={x}>
          <mesh
            position={[x, engine.y, engine.z]}
            geometry={res.plume}
            material={res.plumeMaterial}
            renderOrder={5}
            userData={{ plume: true }}
          />
          <mesh
            position={[x, engine.y, engine.z]}
            geometry={res.core}
            material={res.coreMaterial}
            renderOrder={6}
            userData={{ plume: true }}
          />
          <mesh
            position={[x, engine.y, engine.z - 0.05]}
            geometry={res.glow}
            material={res.glowMaterial}
            renderOrder={7}
            frustumCulled={false}
          />
        </group>
      ))}
      <points geometry={res.sparks} material={res.sparksMaterial} renderOrder={8} frustumCulled={false} />
    </group>
      {/* lights the rear of the hull: between the nozzles, just behind them. Outside the toggled
          group on purpose: a light that drops out of the scene changes the light count and
          recompiles every lit material — a hitch exactly at ignition. */}
      <pointLight
        ref={light}
        color={PLASMA_HOT}
        intensity={0}
        distance={9}
        decay={2}
        position={[0, engine.y + 0.3, engine.z - 0.7]}
      />
    </>
  );
}
