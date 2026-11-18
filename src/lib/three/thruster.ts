import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  PlaneGeometry,
  ShaderMaterial,
  Uniform,
} from "three";
import { NOISE_GLSL, SAFE_GLSL } from "./glsl";
import { shared } from "./state";

/*
 * Plasma thruster. Palette: white-hot at the throat → electric blue → violet in the tail of the
 * plume. Cool, high-energy colours read as "plasma drive" and stay distinct from the orange weld.
 */
export const PLASMA_CORE = new Color("#f4fbff");
export const PLASMA_HOT = new Color("#6fd0ff");
export const PLASMA_TAIL = new Color("#7a5cff");

/**
 * An open cone along −z, nozzle at z = 0. Lots of length segments: the vertex shader necks the
 * radius at every shock diamond, which needs geometry to bend.
 */
export function createPlumeGeometry(radius: number, length: number, flare: number) {
  const geometry = new CylinderGeometry(radius, radius * flare, length, 28, 64, true);
  // cylinder runs along y centred on 0 → put the top (nozzle) at the origin, then point it down −z
  geometry.translate(0, -length / 2, 0);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

/**
 * The plume shell. A cylinder can't hold volume, so it fakes it: brightness follows how squarely
 * the surface faces the camera (the middle of the silhouette is the thickest column of gas), plus
 * turbulence scrolling down the jet and stationary shock diamonds that pulse with the flicker.
 */
export function createPlumeMaterial({ core }: { core: boolean }) {
  return new ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uPower: new Uniform(0),
      uFlicker: new Uniform(1),
      uDiamonds: new Uniform(core ? 4 : 5),
      uIntensity: new Uniform(core ? 9 : 2.6),
      uCore: new Uniform(PLASMA_CORE),
      uHot: new Uniform(PLASMA_HOT),
      uTail: new Uniform(PLASMA_TAIL),
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uDiamonds;
      uniform float uPower;
      varying float vS;
      varying vec3 vNormalView;
      varying vec3 vView;
      varying vec3 vLocal;
      ${NOISE_GLSL}
      void main() {
        // uv.y = 1 at the nozzle (cylinder top) → s = 0 there, 1 at the plume's end
        float s = 1.0 - uv.y;
        vS = s;
        vec3 p = position;
        // neck at each shock diamond + a little turbulence that streams away from the nozzle
        float neck = 0.5 + 0.5 * cos(s * uDiamonds * 6.2832);
        float wobble = stageNoise(vec3(p.xy * 2.0, s * 5.0 - uTime * 7.0));
        float swell = 1.0 - 0.16 * neck * (1.0 - s) + 0.08 * wobble * s;
        p.xy *= swell * mix(0.6, 1.0, clamp(uPower, 0.0, 1.0));
        vLocal = p;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vView = -mv.xyz;
        vNormalView = normalMatrix * normal;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uPower;
      uniform float uFlicker;
      uniform float uDiamonds;
      uniform float uIntensity;
      uniform vec3 uCore;
      uniform vec3 uHot;
      uniform vec3 uTail;
      varying float vS;
      varying vec3 vNormalView;
      varying vec3 vView;
      varying vec3 vLocal;
      ${NOISE_GLSL}
      ${SAFE_GLSL}
      void main() {
        // interpolation can push s a hair outside 0..1 — pow() of a negative base is NaN
        float s = clamp(vS, 0.0, 1.0);
        float facing = pow(clamp(abs(dot(safeNormalize(vNormalView), safeNormalize(vView))), 0.0, 1.0), 1.8);
        float fade = pow(max(1.0 - s, 0.0), 1.6) * smoothstep(0.0, 0.03, s + 0.01);
        float turb = 0.65 + 0.35 * stageNoise(vec3(vLocal.xy * 3.0, s * 9.0 - uTime * 11.0));
        // Mach discs: bright bands at the necks, strongest near the nozzle, pulsing with the burn
        // GPU cos() may return a hair below −1: clamp the base or pow() goes NaN on some pixels
        float disc = pow(clamp(0.5 + 0.5 * cos(s * uDiamonds * 6.2832), 0.0, 1.0), 10.0) * (1.0 - s);
        disc *= 0.75 + 0.25 * sin(uTime * 23.0 + s * 17.0);
        float energy = facing * (fade * max(turb, 0.0) + disc * 1.6) * clamp(uPower, 0.0, 2.0) * uFlicker;
        vec3 col = mix(uCore, uHot, smoothstep(0.0, 0.35, s));
        col = mix(col, uTail, smoothstep(0.4, 1.0, s));
        gl_FragColor = vec4(safeHdr(col * energy * uIntensity), 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
  });
}

/** Camera-facing glow at the nozzle throat: the "white-hot" disc, and the ignition flash. */
export function createNozzleGlowMaterial() {
  return new ShaderMaterial({
    uniforms: {
      uPower: new Uniform(0),
      uFlash: new Uniform(0),
      uSize: new Uniform(1),
      uCore: new Uniform(PLASMA_CORE),
      uHot: new Uniform(PLASMA_HOT),
    },
    vertexShader: /* glsl */ `
      uniform float uSize;
      varying vec2 vP;
      void main() {
        vP = position.xy;
        // billboard: expand the quad in view space around the transformed centre
        vec4 centre = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        centre.xy += position.xy * uSize;
        gl_Position = projectionMatrix * centre;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uPower;
      uniform float uFlash;
      uniform vec3 uCore;
      uniform vec3 uHot;
      varying vec2 vP;
      ${SAFE_GLSL}
      void main() {
        float r = length(vP);
        float core = exp(-r * 14.0);
        float halo = exp(-r * 4.0) * (1.0 - smoothstep(0.7, 1.0, r));
        vec3 col = uCore * core * 6.0 + uHot * halo * 0.9;
        gl_FragColor = vec4(safeHdr(col * clamp(uPower + uFlash * 2.5, 0.0, 6.0)), 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

export const createGlowGeometry = () => new PlaneGeometry(2, 2);

/**
 * Ion sparks streaming backwards out of both nozzles. Every particle is a looping function of
 * time and its seeds (no CPU simulation): it leaves the throat, spreads, cools from white to
 * violet and fades.
 */
export function createSparksGeometry(count: number) {
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    seeds[i * 4] = Math.random();
    seeds[i * 4 + 1] = Math.random();
    seeds[i * 4 + 2] = Math.random();
    // which engine: alternate so both get exactly half
    seeds[i * 4 + 3] = i % 2 === 0 ? 1 : -1;
  }
  const geometry = new BufferGeometry();
  // positions are computed in the shader; the attribute only sets the vertex count
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute("aSeed", new BufferAttribute(seeds, 4));
  return geometry;
}

export function createSparksMaterial(engine: { x: number; y: number; z: number; radius: number }) {
  return new ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uPointScale: shared.uPointScale,
      uPower: new Uniform(0),
      uEngine: new Uniform([engine.x, engine.y, engine.z, engine.radius]),
      uCore: new Uniform(PLASMA_CORE),
      uTail: new Uniform(PLASMA_TAIL),
      uHot: new Uniform(PLASMA_HOT),
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uPointScale;
      uniform float uPower;
      uniform vec4 uEngine;
      attribute vec4 aSeed;
      varying float vLife;
      varying float vAlpha;
      void main() {
        float speed = 0.7 + 0.6 * aSeed.x;
        float life = fract(uTime * speed * 0.9 + aSeed.y);
        float angle = aSeed.z * 6.2832 + life * 3.0;
        float spread = uEngine.w * (0.35 + life * 2.2 * (0.4 + aSeed.x));
        vec3 p = vec3(uEngine.x * aSeed.w, uEngine.y, uEngine.z);
        p.xy += vec2(cos(angle), sin(angle)) * spread;
        p.z -= life * (2.0 + 7.0 * aSeed.x) * clamp(uPower, 0.0, 1.2);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        // depth guard: a spark at (or behind) the eye would divide by ~0 → infinite point size
        gl_PointSize = clamp((0.035 + 0.03 * aSeed.z) * (1.0 - life * 0.6) * uPointScale / max(-mv.z, 0.05), 1.0, 64.0);
        vLife = life;
        vAlpha = (1.0 - life) * (1.0 - life) * clamp(uPower, 0.0, 1.5);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uCore;
      uniform vec3 uHot;
      uniform vec3 uTail;
      varying float vLife;
      varying float vAlpha;
      ${SAFE_GLSL}
      void main() {
        float r = length(gl_PointCoord - 0.5);
        float a = (1.0 - smoothstep(0.1, 0.5, r)) * clamp(vAlpha, 0.0, 2.0);
        if (a < 0.003) discard;
        vec3 col = mix(uCore * 4.0, uHot * 2.0, smoothstep(0.0, 0.3, vLife));
        col = mix(col, uTail, smoothstep(0.4, 1.0, vLife));
        gl_FragColor = vec4(safeHdr(col * a), 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}
