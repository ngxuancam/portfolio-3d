import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  ShaderMaterial,
  Uniform,
  Vector2,
  Vector3,
  type Texture,
} from "three";
import { NOISE_GLSL, SAFE_GLSL } from "./glsl";
import { shared } from "./state";

/*
 * Deep space: a baked galactic band (equirect texture, rendered once on the GPU), three star
 * shells at different radii (real parallax as the camera travels) and a camera-attached sun glare
 * for composition. Everything respects the text column: a screen-space fade keeps
 * the left side dark on wide screens (`uLeftFade` 1) and is off on narrow ones (the scrim does it).
 */

/** shared by sky, stars and glare: 1 on wide screens, 0 on narrow */
export const leftFade = new Uniform(1);

/** per-frame viewport-dependent uniforms for the sky layers */
export function syncSpaceUniforms(o: {
  narrow: boolean;
  dpr: number;
  width: number;
  height: number;
  stars: readonly ShaderMaterial[];
  sky: ShaderMaterial;
}) {
  leftFade.value = o.narrow ? 0 : 1;
  for (const material of o.stars) material.uniforms.uDpr.value = o.dpr;
  (o.sky.uniforms.uResolution.value as Vector2).set(o.width * o.dpr, o.height * o.dpr);
}

/** screen-x attenuation, `x` in NDC; text column ≈ −1 … 0.16 */
const LEFT_FADE_GLSL = /* glsl */ `
uniform float uLeftFade;
float sideFade(float ndcX, float floorLevel) {
  return mix(1.0, mix(floorLevel, 1.0, smoothstep(-0.3, 0.35, ndcX)), uLeftFade);
}
`;

// ───────────────────────────── stars ─────────────────────────────

/**
 * One shell of stars. Magnitudes follow a steep power law (most stars are barely there, a few are
 * bright) and colour varies from blue-white to a faint pink.
 */
export function createStarShell(count: number, radius: number, depth: number) {
  const positions = new Float32Array(count * 3);
  const star = new Float32Array(count * 3);
  const p = new Vector3();
  for (let i = 0; i < count; i++) {
    // uniform on the sphere (normalised gaussian-ish via rejection), thickened radially
    do p.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    while (p.lengthSq() > 1 || p.lengthSq() < 1e-4);
    p.normalize().multiplyScalar(radius + (Math.random() - 0.5) * depth);
    p.toArray(positions, i * 3);
    star[i * 3] = Math.pow(Math.random(), 5.5);
    star[i * 3 + 1] = Math.random();
    star[i * 3 + 2] = Math.random();
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("aStar", new BufferAttribute(star, 3));
  return geometry;
}

export function createStarMaterial(sizeScale: number) {
  return new ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uDpr: new Uniform(1),
      uSize: new Uniform(sizeScale),
      uLeftFade: leftFade,
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uDpr;
      uniform float uSize;
      attribute vec3 aStar;
      varying vec3 vColor;
      ${LEFT_FADE_GLSL}
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float m = aStar.x;
        // faint stars twinkle more (atmosphere-free space barely twinkles; this is just alive)
        float twinkle = 1.0 - 0.45 * (1.0 - m) * (0.5 + 0.5 * sin(uTime * (0.5 + aStar.y * 1.9) + aStar.y * 61.0));
        float side = sideFade(gl_Position.x / gl_Position.w, 0.3);
        gl_PointSize = (1.0 + 2.4 * m * m) * uSize * uDpr;
        vec3 tint = mix(vec3(0.74, 0.8, 1.0), vec3(1.0, 0.82, 0.96), aStar.z);
        vColor = tint * (0.07 + 2.1 * m * m * m + 0.25 * m) * twinkle * side;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      ${SAFE_GLSL}
      void main() {
        float r = length(gl_PointCoord - 0.5);
        float a = 1.0 - smoothstep(0.0, 0.5, r);
        gl_FragColor = vec4(safeHdr(vColor * a * a), 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

// ───────────────────────────── sky (baked) ─────────────────────────────

/** equirect direction ↔ uv, shared by the bake and the sky sphere so they agree exactly */
const EQUIRECT_GLSL = /* glsl */ `
const float PI_ = 3.14159265;
vec3 dirFromUv(vec2 uv) {
  float lon = (uv.x - 0.5) * 2.0 * PI_;
  float lat = (uv.y - 0.5) * PI_;
  return vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
}
vec2 uvFromDir(vec3 d) {
  return vec2(atan(d.z, d.x) / (2.0 * PI_) + 0.5, asin(clamp(d.y, -1.0, 1.0)) / PI_ + 0.5);
}
`;

/**
 * Fullscreen bake of the galactic band + faint nebular haze. Noise is evaluated on the 3D
 * direction, so the equirect seam and poles are seamless. Deliberately low contrast and dim
 * (linear ≤ ~0.05): it should register as depth, never as a colour blob behind the text.
 */
export function createSkyBakeMaterial() {
  return new ShaderMaterial({
    uniforms: {
      uBandNormal: new Uniform(new Vector3(0.32, 0.86, -0.4).normalize()),
      uCentre: new Uniform(new Vector3(0.62, -0.05, -0.78).normalize()),
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uBandNormal;
      uniform vec3 uCentre;
      varying vec2 vUv;
      ${NOISE_GLSL}
      ${EQUIRECT_GLSL}
      float fbm(vec3 p) {
        return 0.5 * stageNoise(p) + 0.25 * stageNoise(p * 2.1 + 3.1) + 0.125 * stageNoise(p * 4.3 + 7.7)
          + 0.0625 * stageNoise(p * 8.9 + 1.3);
      }
      void main() {
        vec3 d = dirFromUv(vUv);
        float b = dot(d, uBandNormal);
        float band = exp(-b * b / 0.022);
        float wideBand = exp(-b * b / 0.12);
        float core = exp(-dot(d - uCentre, d - uCentre) * 2.4);

        float clouds = smoothstep(-0.35, 0.75, fbm(d * 3.2));
        // dark dust lanes threading along the band
        float lanes = smoothstep(0.05, 0.55, fbm(d * 7.0 + vec3(5.0, 1.0, 2.0)) + b * 2.0);

        // violet band warming to a magenta-pink heart, like an emission nebula
        vec3 cold = vec3(0.024, 0.016, 0.07);
        vec3 warm = vec3(0.085, 0.022, 0.06);
        vec3 col = mix(cold, warm, core) * band * clouds * (1.0 - 0.75 * lanes * band);
        col += vec3(0.012, 0.008, 0.032) * wideBand * clouds;
        // a very faint cool nebular wisp away from the band, for depth
        float wisp = smoothstep(0.25, 0.85, fbm(d * 1.6 + vec3(11.0, 4.0, 9.0)));
        col += vec3(0.02, 0.012, 0.05) * wisp * (1.0 - band);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });
}

/** The baked sky on a camera-centred sphere (infinitely far: no parallax, by design). */
export function createSkyMaterial(map: Texture) {
  return new ShaderMaterial({
    uniforms: {
      uSky: new Uniform(map),
      uResolution: new Uniform(new Vector2(1, 1)),
      uLeftFade: leftFade,
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uSky;
      uniform vec2 uResolution;
      varying vec3 vDir;
      ${EQUIRECT_GLSL}
      ${LEFT_FADE_GLSL}
      ${SAFE_GLSL}
      void main() {
        vec3 col = texture2D(uSky, uvFromDir(safeNormalize(vDir))).rgb;
        float ndcX = gl_FragCoord.x / max(uResolution.x, 1.0) * 2.0 - 1.0;
        gl_FragColor = vec4(safeHdr(col * sideFade(ndcX, 0.25)), 1.0);
      }
    `,
    side: BackSide,
    depthWrite: false,
  });
}

// ───────────────────────────── sun ─────────────────────────────

/** Sun glare: soft halo, small hot core, faint streak; all three swell as the camera faces it. */
export function createGlareMaterial() {
  return new ShaderMaterial({
    uniforms: {
      uIntensity: new Uniform(1),
      /** 0..1 how squarely the camera faces the sun: wider halo and a longer streak */
      uVeil: new Uniform(0),
      uColor: new Uniform(new Color("#f3e9ff")),
    },
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main() {
        vP = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uIntensity;
      uniform float uVeil;
      uniform vec3 uColor;
      varying vec2 vP;
      ${SAFE_GLSL}
      void main() {
        float r = length(vP);
        float halo = exp(-r * mix(4.2, 2.6, uVeil)) * (0.22 + 0.18 * uVeil);
        float core = exp(-r * 28.0) * 3.0;
        float streak = exp(-abs(vP.y) * 90.0) * exp(-abs(vP.x) * mix(2.2, 1.1, uVeil)) * (0.22 + 0.3 * uVeil);
        float edge = 1.0 - smoothstep(0.65, 1.0, r);
        gl_FragColor = vec4(safeHdr(uColor * (halo + core + streak) * edge * uIntensity), 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}
