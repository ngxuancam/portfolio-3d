"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  Group,
  HalfFloatType,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  WebGLRenderTarget,
} from "three";
import type { Quality } from "@/lib/three/quality";
import {
  createGlareMaterial,
  createPlanetMaterial,
  createSkyBakeMaterial,
  createSkyMaterial,
  createStarMaterial,
  createStarShell,
  syncSpaceUniforms,
} from "@/lib/three/space";
import { stage } from "@/lib/three/state";
import { useDisposeOnUnmount } from "./useDisposeOnUnmount";

/** star shells: radius, radial depth, desktop / low-tier count, size scale */
const SHELLS = [
  { radius: 150, depth: 40, count: [2600, 1100], size: 1.15 },
  { radius: 260, depth: 60, count: [1800, 800], size: 1 },
  { radius: 430, depth: 80, count: [1200, 500], size: 0.85 },
] as const;
const SKY_RADIUS = 900;
/** camera-space distances: planet in front of every star shell, glare in front of the planet */
const PLANET_DISTANCE = 125;
const GLARE_DISTANCE = 110;

/**
 * Outer space. World-fixed star shells give true depth parallax as the camera spirals out; the
 * sky texture, planet and sun are composed relative to the camera so they always sit in the
 * right-hand part of the frame and never behind the text.
 */
export function Space({ quality }: { quality: Quality }) {
  const gl = useThree((s) => s.gl);

  const res = useMemo(() => {
    const size = quality.low ? 1024 : 2048;
    const target = new WebGLRenderTarget(size, size / 2, {
      type: HalfFloatType,
      magFilter: LinearFilter,
      minFilter: LinearFilter,
      generateMipmaps: false,
      depthBuffer: false,
    });
    return {
      target,
      shells: SHELLS.map((s) => ({
        geometry: createStarShell(s.count[quality.low ? 1 : 0], s.radius, s.depth),
        material: createStarMaterial(s.size),
      })),
      skyGeometry: new SphereGeometry(SKY_RADIUS, 48, 24),
      skyMaterial: createSkyMaterial(target.texture),
      planetGeometry: new SphereGeometry(1, 96, 48),
      planetMaterial: createPlanetMaterial(),
      glareGeometry: new PlaneGeometry(2, 2),
      glareMaterial: createGlareMaterial(),
    };
  }, [quality.low]);
  useDisposeOnUnmount(res.target);
  useDisposeOnUnmount(res.shells[0].geometry);
  useDisposeOnUnmount(res.shells[0].material);
  useDisposeOnUnmount(res.shells[1].geometry);
  useDisposeOnUnmount(res.shells[1].material);
  useDisposeOnUnmount(res.shells[2].geometry);
  useDisposeOnUnmount(res.shells[2].material);
  useDisposeOnUnmount(res.skyGeometry);
  useDisposeOnUnmount(res.skyMaterial);
  useDisposeOnUnmount(res.planetGeometry);
  useDisposeOnUnmount(res.planetMaterial);
  useDisposeOnUnmount(res.glareGeometry);
  useDisposeOnUnmount(res.glareMaterial);

  // bake the galactic band once: ~8M noise evaluations, a few ms of GPU, then a texture lookup
  useEffect(() => {
    const material = createSkyBakeMaterial();
    const quad = new Mesh(new PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    const previous = gl.getRenderTarget();
    gl.setRenderTarget(res.target);
    gl.render(quad, new OrthographicCamera());
    gl.setRenderTarget(previous);
    quad.geometry.dispose();
    material.dispose();
  }, [gl, res.target]);

  const sky = useRef<Mesh>(null);
  const attached = useRef<Group>(null);
  const planet = useRef<Mesh>(null);
  const glare = useRef<Mesh>(null);
  const scratch = useRef<{ sun: Vector3; toSun: Vector3; spin: number } | null>(null);

  useFrame((state, rawDelta) => {
    const tmp = (scratch.current ??= { sun: new Vector3(), toSun: new Vector3(), spin: 0 });
    const camera = state.camera as PerspectiveCamera;
    const dpr = state.viewport.dpr;
    const narrow = stage.narrow;
    syncSpaceUniforms({
      narrow,
      dpr,
      width: state.size.width,
      height: state.size.height,
      stars: res.shells.map((shell) => shell.material),
      sky: res.skyMaterial,
    });

    sky.current?.position.copy(camera.position);
    const group = attached.current;
    if (!group || !planet.current || !glare.current) return;
    group.position.copy(camera.position);
    group.quaternion.copy(camera.quaternion);

    // place things by where they should APPEAR (NDC), undoing the view offset the rig applies
    const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
    const aspect = state.size.width / Math.max(1, state.size.height);
    const place = (target: Vector3, ndcX: number, ndcY: number, distance: number) => {
      const halfH = distance * tanHalf;
      return target.set((ndcX - stage.viewShift) * halfH * aspect, ndcY * halfH, -distance);
    };

    // the planet creeps up and inward as the camera pulls out: a slow sense of travel
    const travel = Math.min(1, stage.chapter / 5);
    place(planet.current.position, narrow ? 0.7 : 0.95 - 0.08 * travel, -1.32 + 0.1 * travel, PLANET_DISTANCE);
    planet.current.scale.setScalar(PLANET_DISTANCE * tanHalf * 0.78);
    if (!quality.reducedMotion) tmp.spin += Math.min(rawDelta, 0.1) * 0.004;
    planet.current.rotation.set(0.35, tmp.spin, 0.2);

    place(glare.current.position, narrow ? 0.85 : 1.02, 0.9, GLARE_DISTANCE);
    glare.current.scale.setScalar(GLARE_DISTANCE * tanHalf * 0.85);

    // sun direction (camera space → world) drives the key light and the planet's terminator
    tmp.sun.copy(glare.current.position).normalize();
    // the sun is "at infinity" along that ray: light reaching the planet comes from far beyond it
    tmp.toSun.copy(tmp.sun).multiplyScalar(4000).sub(planet.current.position).normalize();
    const planetMaterial = planet.current.material as ShaderMaterial;
    (planetMaterial.uniforms.uSunView.value as Vector3).copy(tmp.toSun);
    stage.sunDir.copy(tmp.sun).applyQuaternion(camera.quaternion);
  });

  return (
    <>
      <mesh ref={sky} geometry={res.skyGeometry} material={res.skyMaterial} renderOrder={-30} frustumCulled={false} />
      {res.shells.map((shell, i) => (
        <points key={i} geometry={shell.geometry} material={shell.material} renderOrder={-20} frustumCulled={false} />
      ))}
      <group ref={attached}>
        <mesh ref={planet} geometry={res.planetGeometry} material={res.planetMaterial} renderOrder={-10} />
        <mesh ref={glare} geometry={res.glareGeometry} material={res.glareMaterial} renderOrder={-5} frustumCulled={false} />
      </group>
    </>
  );
}
