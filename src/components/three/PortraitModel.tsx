"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as THREE from "three";
import { animate, utils, type JSAnimation } from "animejs";
import "animejs/adapters/three";
import { sceneSignals } from "@/lib/three/sceneSignals";
import { bakePortraitInWorker, type PortraitGeometries } from "@/lib/three/portraitBake";
import {
  BURST_PROGRESS_MAX,
  flowerFragmentShader,
  flowerVertexShader,
  modelFragmentMain,
  modelFragmentPars,
  modelVertexMain,
  modelVertexPars,
} from "@/lib/three/burstShaders";

const MODEL_URL = "/models/portrait.glb";

/**
 * Decode the meshopt-compressed buffers in Web Workers (three's decoder supports it; the
 * drei default decodes synchronously on the main thread).
 */
const decodeInWorkers = (loader: Parameters<NonNullable<Parameters<typeof useGLTF>[3]>>[0]) => {
  // bracket access: a plain decoder method, not a React hook (it only shares the prefix)
  MeshoptDecoder["useWorkers"](2);
  (loader as unknown as { setMeshoptDecoder: (decoder: unknown) => void }).setMeshoptDecoder(MeshoptDecoder);
};
/** model is ~0.98 units tall; this makes it ~3.2 world units like the rest of the stage */
const MODEL_SCALE = 3.2;
/**
 * Yaw baked into the geometry. The Tripo export faces +X; −90° turns it to the camera,
 * and the extra −10° squares the face up (negative = turn toward the viewer's left).
 */
const FACING_YAW = THREE.MathUtils.degToRad(-90 - 10);
/**
 * Forward pitch (crown toward the camera) — reads as a slightly high camera angle,
 * the flattering portrait default, and keeps the nostrils out of view.
 */
const FACING_PITCH = THREE.MathUtils.degToRad(10);
const FACING = new THREE.Matrix4()
  .makeRotationX(FACING_PITCH)
  .multiply(new THREE.Matrix4().makeRotationY(FACING_YAW));
const BRASS = new THREE.Color("#c2a679");
const BURGUNDY = new THREE.Color("#6a1a26");

interface PortraitModelProps {
  particleCount: number;
  reducedMotion: boolean;
  /** begin on the formed bust instead of the flower-gathers-in intro */
  skipIntro: boolean;
  /** called once the geometry is baked and every shader is compiled — safe to render */
  onReady: () => void;
}

/**
 * The quantized glTF is de-quantized, re-oriented and surface-sampled in a Web Worker
 * (lib/three/portrait.worker.ts); shaders are then compiled with compileAsync before the
 * first frame. Neither step runs as a long task on the main thread.
 */
function PortraitModelImpl({ particleCount, reducedMotion, skipIntro, onReady }: PortraitModelProps) {
  const noIntro = reducedMotion || skipIntro;
  const { scene } = useGLTF(MODEL_URL, false, false, decodeInWorkers);
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const invalidate = useThree((state) => state.invalidate);
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const sceneRoot = useThree((state) => state.scene);
  const [geometries, setGeometries] = useState<PortraitGeometries | null>(null);
  const [compiled, setCompiled] = useState(false);
  /** intro progress, tweened by anime.js; the effective progress is max(intro, scroll) */
  const intro = useRef({ value: noIntro ? 0 : BURST_PROGRESS_MAX });

  const source = useMemo(() => {
    let found: THREE.Mesh | undefined;
    scene.traverse((child) => {
      if (!found && (child as THREE.Mesh).isMesh) found = child as THREE.Mesh;
    });
    if (!found) throw new Error("portrait.glb has no mesh");
    return found;
  }, [scene]);

  // geometry work happens off the main thread
  useEffect(() => {
    const job = bakePortraitInWorker(source, FACING, particleCount);
    let alive = true;
    job.promise.then((result) => {
      if (alive) setGeometries(result);
      else {
        result.geometry.dispose();
        result.particles.dispose();
      }
    });
    return () => {
      alive = false;
      job.cancel();
    };
  }, [source, particleCount]);

  // One uniform bag shared by the model's injected shader and the particle shader.
  const uniforms = useMemo(
    () => ({
      uProgress: { value: noIntro ? 0 : BURST_PROGRESS_MAX },
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uEdgeColor: { value: BRASS.clone() },
      uRimColorA: { value: BRASS.clone() },
      uRimColorB: { value: BURGUNDY.clone() },
      uMap: { value: (source.material as THREE.MeshStandardMaterial).map },
      uFlowerRadius: { value: 0.62 },
      uFlowerCenter: { value: new THREE.Vector3(0, 0.12, 0.15) },
      uBlur: { value: 0 },
    }),
    // reducedMotion only seeds the starting value; it must not rebuild the material
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source],
  );

  // Extend the glTF's own PBR material instead of replacing it: textures, normal map and
  // lighting stay intact, the dissolve + holographic rim are injected via onBeforeCompile.
  const material = useMemo(() => {
    const base = (source.material as THREE.MeshStandardMaterial).clone();
    base.metalness = Math.min(base.metalness, 0.15);
    base.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${modelVertexPars}`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>\n${modelVertexMain}`);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${modelFragmentPars}`)
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n${modelFragmentMain}`);
    };
    base.customProgramCacheKey = () => "portrait-burst";
    return base;
  }, [source, uniforms]);

  // Built here (not as JSX) so it keeps a reference to the shared uniform bag —
  // R3F copies a `uniforms` prop, which would silently split the two shaders apart.
  const particleMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: flowerVertexShader,
        fragmentShader: flowerFragmentShader,
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
      }),
    [uniforms],
  );

  useEffect(
    () => () => {
      material.dispose();
      particleMaterial.dispose();
    },
    [material, particleMaterial],
  );
  useEffect(
    () => () => {
      geometries?.geometry.dispose();
      geometries?.particles.dispose();
    },
    [geometries],
  );

  // Compile every program in the background (KHR_parallel_shader_compile) before the
  // first frame — a synchronous compile on first render was the longest main-thread task.
  useEffect(() => {
    if (!geometries) return;
    let alive = true;
    gl.compileAsync(sceneRoot, camera).then(() => {
      if (!alive) return;
      setCompiled(true);
      onReady();
    });
    return () => {
      alive = false;
    };
  }, [geometries, gl, sceneRoot, camera, onReady]);

  // anime.js intro: the flower gathers into the bust while the stage rises into place.
  useEffect(() => {
    const group = groupRef.current;
    if (!group || !compiled) return;
    if (noIntro) {
      intro.current.value = 0;
      utils.set(group, { y: 0 });
      invalidate();
      return;
    }
    const animations: JSAnimation[] = [
      animate(intro.current, { value: [BURST_PROGRESS_MAX, 0], duration: 3200, delay: 250, ease: "inOutCubic" }),
      animate(group, { y: [-0.25, 0], duration: 3200, delay: 250, ease: "outExpo" }),
    ];
    return () => animations.forEach((animation) => animation.revert());
  }, [compiled, noIntro, invalidate]);

  // Both shaders hold the same uniform objects, so writing through the points'
  // material updates the model's dissolve too.
  useFrame((state, delta) => {
    const shared = (pointsRef.current?.material as THREE.ShaderMaterial | undefined)?.uniforms;
    if (!shared) return;
    shared.uTime.value += delta;
    shared.uPixelRatio.value = state.viewport.dpr;
    // scroll owns the burst once the intro has finished; damped so wheel steps feel fluid
    const scrollProgress = THREE.MathUtils.smoothstep(sceneSignals.scroll, 0.04, 0.9) * BURST_PROGRESS_MAX;
    const target = Math.max(intro.current.value, scrollProgress);
    shared.uProgress.value = THREE.MathUtils.damp(shared.uProgress.value, target, 8, delta);
    // depth of field only for the close-up "Things I've built" shot (camera stage 4):
    // fades in as the camera approaches, out as it pulls back for Contact
    const stage = sceneSignals.stage;
    const focusBlur = THREE.MathUtils.smoothstep(stage, 3.3, 4) * (1 - THREE.MathUtils.smoothstep(stage, 4, 4.7));
    shared.uBlur.value = THREE.MathUtils.damp(shared.uBlur.value, focusBlur, 3, delta);
  });

  if (!geometries) return null;

  return (
    <group ref={groupRef} scale={MODEL_SCALE}>
      <mesh geometry={geometries.geometry} material={material} />
      <points ref={pointsRef} geometry={geometries.particles} material={particleMaterial} frustumCulled={false} />
    </group>
  );
}

export const PortraitModel = memo(PortraitModelImpl);

useGLTF.preload(MODEL_URL, false, false, decodeInWorkers);
