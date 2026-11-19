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
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  WebGLRenderTarget,
} from "three";
import type { Quality } from "@/lib/three/quality";
import {
  createGlareMaterial,
  createSkyBakeMaterial,
  createSkyMaterial,
  createStarMaterial,
  createStarShell,
  syncSpaceUniforms,
} from "@/lib/three/space";
import { stage } from "@/lib/three/state";
import { spaceDrift } from "@/lib/three/timeline";
import { useDisposeOnUnmount } from "./useDisposeOnUnmount";

/** star shells: radius, radial depth, desktop / low-tier count, size scale */
const SHELLS = [
  { radius: 150, depth: 40, count: [2600, 1100], size: 1.15 },
  { radius: 260, depth: 60, count: [1800, 800], size: 1 },
  { radius: 430, depth: 80, count: [1200, 500], size: 0.85 },
] as const;
const SKY_RADIUS = 900;
/** distance of the sun glare from the camera: in front of every star shell */
const GLARE_DISTANCE = 110;
/** sky drift from "projects" on: radians per second about a slightly tilted axis */
const DRIFT_RATE = 0.012;
const DRIFT_TILT = 0.12;

/**
 * Outer space. World-fixed star shells give true depth parallax as the camera spirals out; the
 * sky is camera-centred (infinitely far); the sun is a fixed world direction, so the spiral
 * carries it across the frame and its glare swells when the camera faces it.
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
  const starfield = useRef<Group>(null);
  const glare = useRef<Mesh>(null);
  const scratch = useRef<{ sun: Vector3; forward: Vector3; inverse: Quaternion; frozen: boolean; drift: number } | null>(null);

  useFrame((state, rawDelta) => {
    const tmp = (scratch.current ??= { sun: new Vector3(), forward: new Vector3(), inverse: new Quaternion(), frozen: false, drift: 0 });
    const camera = state.camera as PerspectiveCamera;
    const dt = Math.min(rawDelta, 0.1);
    const narrow = stage.narrow;
    syncSpaceUniforms({
      narrow,
      dpr: state.viewport.dpr,
      width: state.size.width,
      height: state.size.height,
      stars: res.shells.map((shell) => shell.material),
      sky: res.skyMaterial,
    });

    // from "projects" on the ship coasts: the whole sky turns very slowly past it, a sense of
    // travel without anything flying at the camera. Accumulated, so it never snaps back.
    if (!quality.reducedMotion) tmp.drift += dt * DRIFT_RATE * spaceDrift(stage.chapter);
    sky.current?.position.copy(camera.position);
    sky.current?.rotation.set(DRIFT_TILT, tmp.drift, 0);
    starfield.current?.rotation.set(DRIFT_TILT, tmp.drift, 0);

    const g = glare.current;
    const field = starfield.current;
    if (!g || !field) return;
    field.updateMatrix();
    const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
    // the sun is a fixed WORLD direction (effectively at infinity): framed off the hero's upper
    // right on the first frame, then the camera's spiral carries it across and out of the frame
    if (!tmp.frozen) {
      tmp.frozen = true;
      const aspect = state.size.width / Math.max(1, state.size.height);
      const ndcX = (narrow ? 0.85 : 1.02) - stage.viewShift;
      tmp.sun.set(ndcX * tanHalf * aspect, 0.9 * tanHalf, -1).normalize().applyQuaternion(camera.quaternion);
      // stored in the starfield's own frame, so the sky drift carries the sun along with the stars
      tmp.sun.applyQuaternion(tmp.inverse.copy(field.quaternion).invert());
    }
    stage.sunDir.copy(tmp.sun).applyQuaternion(field.quaternion);
    g.position.copy(camera.position).addScaledVector(stage.sunDir, GLARE_DISTANCE);
    g.quaternion.copy(camera.quaternion);

    // glare into the lens: the more squarely the camera faces the sun, the bigger and hotter it is
    camera.getWorldDirection(tmp.forward);
    const facing = Math.max(0, tmp.forward.dot(stage.sunDir));
    // 0 beyond ~25° off-axis (the hero framing sits right at that edge), 1 looking straight at it
    const align = Math.pow(Math.min(1, Math.max(0, (facing - 0.9) / 0.1)), 2);
    g.scale.setScalar(GLARE_DISTANCE * tanHalf * (0.85 + 0.8 * align));
    const material = g.material as ShaderMaterial;
    material.uniforms.uIntensity.value = 1 + 1.8 * align;
    material.uniforms.uVeil.value = align;
  });

  return (
    <>
      <mesh ref={sky} geometry={res.skyGeometry} material={res.skyMaterial} renderOrder={-30} frustumCulled={false} />
      <group ref={starfield}>
        {res.shells.map((shell, i) => (
          <points key={i} geometry={shell.geometry} material={shell.material} renderOrder={-20} frustumCulled={false} />
        ))}
      </group>
      <mesh ref={glare} geometry={res.glareGeometry} material={res.glareMaterial} renderOrder={-5} frustumCulled={false} />
    </>
  );
}
