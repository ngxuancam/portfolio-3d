import {
  AdditiveBlending,
  Color,
  DoubleSide,
  MeshStandardMaterial,
  ShaderMaterial,
  Uniform,
  type Texture,
} from "three";
import { FOG_GLSL, NOISE_GLSL, SAFE_GLSL, SWEEP_GLSL } from "./glsl";
import { shared } from "./state";

/** Palette (docs/DESIGN.md). Colors are authored in sRGB; three converts them to linear. */
export const SIGNAL = new Color("#ff7a2f");
export const SHIELD = new Color("#bfefff");
export const VOID = new Color("#050607");

/** HDR multiplier on the burning edge: well above the bloom threshold (1.0) so only it blooms hard */
const EDGE_INTENSITY = 7;

/**
 * The BUILT hull: a stock MeshStandardMaterial (so it keeps real lighting, shadows-free metal and
 * fog) patched to discard everything the front has not reached yet, glow along the front, and
 * carry a faint cool rim so the dark hull separates from the dark room.
 */
export function createHullMaterial(map: Texture | null) {
  const material = new MeshStandardMaterial({
    color: new Color("#2a2e33"),
    map,
    metalness: 0.65,
    roughness: 0.42,
  });
  const uniforms = {
    uEdgeColor: new Uniform(SIGNAL),
    uEdgeIntensity: new Uniform(EDGE_INTENSITY),
    uRimColor: new Uniform(SHIELD),
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, {
      uTime: shared.uTime,
      uThreshold: shared.uThreshold,
      uSweep: shared.uSweep,
      uDim: shared.uDim,
    });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSweepPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSweepPos = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vSweepPos;
        uniform vec3 uEdgeColor;
        uniform float uEdgeIntensity;
        uniform vec3 uRimColor;
        uniform float uDim;
        ${NOISE_GLSL}
        ${SWEEP_GLSL}
        ${SAFE_GLSL}`,
      )
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
        float sweepD = sweepDistance(vSweepPos);
        if (sweepD < 0.0) discard;
        float sweepE = sweepEdge(sweepD);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += uEdgeColor * sweepE * uEdgeIntensity;
        // freshly built metal is still warm just behind the front: a short cooling tail
        totalEmissiveRadiance += uEdgeColor * (1.0 - smoothstep(0.0, 0.14, sweepD)) * 0.35;
        float rimF = pow(1.0 - saturate(dot(normal, safeNormalize(vViewPosition))), 3.0);
        totalEmissiveRadiance += uRimColor * rimF * 0.09;`,
      )
      .replace("#include <tonemapping_fragment>", "gl_FragColor.rgb = safeHdr(gl_FragColor.rgb * uDim);\n#include <tonemapping_fragment>");
  };
  material.customProgramCacheKey = () => "stage-hull";
  return material;
}

/**
 * The UNBUILT hull: an additive hologram. Fresnel rim + an axis grid scrolling upward, antialiased
 * with fwidth and weighted by the local normal so a face never lights up as a solid sheet when it
 * lies flat along a grid plane. Discards what is already built, so it never doubles the solid.
 */
export function createHologramMaterial() {
  return new ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uThreshold: shared.uThreshold,
      uSweep: shared.uSweep,
      uDim: shared.uDim,
      uFogDensity: shared.uFogDensity,
      uHoloColor: new Uniform(SHIELD),
      uEdgeColor: new Uniform(SIGNAL),
      uEdgeIntensity: new Uniform(EDGE_INTENSITY),
    },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      varying vec3 vNormalLocal;
      varying vec3 vNormalView;
      varying vec3 vView;
      void main() {
        vPos = position;
        vNormalLocal = normal;
        vNormalView = normalMatrix * normal;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uHoloColor;
      uniform vec3 uEdgeColor;
      uniform float uEdgeIntensity;
      uniform float uDim;
      varying vec3 vPos;
      varying vec3 vNormalLocal;
      varying vec3 vNormalView;
      varying vec3 vView;
      ${NOISE_GLSL}
      ${SWEEP_GLSL}
      ${FOG_GLSL}
      ${SAFE_GLSL}
      float gridLines(vec3 p, vec3 n) {
        vec3 dist = 0.5 - abs(fract(p) - 0.5);
        // epsilon: smoothstep is undefined when its edges meet (fwidth is 0 on flat faces)
        vec3 fw = fwidth(p) + 1e-4;
        vec3 lines = 1.0 - smoothstep(0.035 - fw, 0.035 + fw, dist);
        vec3 weight = 1.0 - abs(n);
        return max(max(lines.x * weight.x, lines.y * weight.y), lines.z * weight.z);
      }
      void main() {
        float d = sweepDistance(vPos);
        if (d >= 0.0) discard;
        vec3 n = safeNormalize(vNormalView);
        vec3 v = safeNormalize(vView);
        float fres = pow(clamp(1.0 - abs(dot(n, v)), 0.0, 1.0), 2.4);
        float grid = gridLines(vPos * 2.6 + vec3(0.0, uTime * 0.35, 0.0), safeNormalize(vNormalLocal));
        // faint interference shimmer — reads as projected light rather than a painted surface
        float shimmer = 0.9 + 0.1 * sin(uTime * 37.0 + vPos.y * 42.0);
        vec3 col = uHoloColor * (fres * 0.75 + grid * 0.32 + 0.02) * 0.6 * shimmer;
        float e = sweepEdge(d);
        col += uEdgeColor * e * uEdgeIntensity;
        // the hologram just ahead of the front warms up: the weld is coming
        col += uEdgeColor * smoothstep(-0.12, 0.0, d) * 0.12;
        col *= fogKeep(length(vView)) * uDim;
        gl_FragColor = vec4(safeHdr(col), 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

/**
 * Hull point cloud: visible over the unbuilt zone (scattered off the skin), swelling and burning
 * in the edge band, gone once built. Shares the sweep so it lines up with the meshes exactly.
 */
export function createHullPointsMaterial() {
  return new ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uThreshold: shared.uThreshold,
      uSweep: shared.uSweep,
      uDim: shared.uDim,
      uFogDensity: shared.uFogDensity,
      uPointScale: shared.uPointScale,
      uActivity: new Uniform(0),
      uCold: new Uniform(SHIELD),
      uHot: new Uniform(SIGNAL),
    },
    vertexShader: /* glsl */ `
      uniform float uPointScale;
      uniform float uActivity;
      attribute vec3 aDir;
      attribute float aSeed;
      varying float vAlpha;
      varying float vEdge;
      varying float vDepth;
      ${NOISE_GLSL}
      ${SWEEP_GLSL}
      void main() {
        float d = sweepDistance(position);
        float built = smoothstep(0.0, 0.05, d);
        float edge = sweepEdge(d);
        // unbuilt points hover off the skin and breathe; they are pulled home as the front arrives
        float pull = 1.0 - smoothstep(-0.25, 0.0, d);
        float breathe = 0.5 + 0.5 * sin(uTime * 0.9 + aSeed * 6.2832);
        vec3 p = position + aDir * pull * (0.08 + 0.22 * breathe);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float size = (0.022 + 0.018 * aSeed) * (1.0 + edge * 3.0);
        gl_PointSize = clamp(size * uPointScale / max(-mv.z, 0.05), 1.0, 64.0);
        vAlpha = (1.0 - built) * (0.28 + 0.5 * aSeed * aSeed) * uActivity;
        vEdge = edge;
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uCold;
      uniform vec3 uHot;
      uniform float uDim;
      varying float vAlpha;
      varying float vEdge;
      varying float vDepth;
      ${FOG_GLSL}
      ${SAFE_GLSL}
      void main() {
        float r = length(gl_PointCoord - 0.5);
        float disc = 1.0 - smoothstep(0.15, 0.5, r);
        vec3 col = mix(uCold * 0.7, uHot * 6.0, vEdge);
        float a = vAlpha * disc * (1.0 + vEdge * 1.5);
        if (a < 0.003) discard;
        gl_FragColor = vec4(safeHdr(col * a * fogKeep(vDepth) * uDim), 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

/**
 * Hex shield. Each cell is a triangle fan carrying `aEdge` (1 at the centre, 0 on the rim) and
 * `aCell` = (random, normalised height). The reveal is per CELL: the coordinate is the cell's
 * height jittered by its random, so whole cells pop in a staggered top-down order, flash at the
 * front, then settle to a faint rim modulated by a slow noisy energy field.
 *
 * The settled dome is BACKGROUND (it sits behind the project cards): thin rims only, almost no
 * body fill, and dimmer still while the camera is inside it (`uInside`), where it fills the view.
 * Only the moving reveal front is allowed to be bright.
 */
export function createShieldMaterial() {
  return new ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uFogDensity: shared.uFogDensity,
      uProgress: new Uniform(0),
      uInside: new Uniform(0),
      uColor: new Uniform(SHIELD),
    },
    vertexShader: /* glsl */ `
      attribute float aEdge;
      attribute vec2 aCell;
      varying float vEdge;
      varying vec2 vCell;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      varying float vDepth;
      void main() {
        vEdge = aEdge;
        vCell = aCell;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormalW = mat3(modelMatrix) * position;
        vec4 mv = viewMatrix * world;
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uProgress;
      uniform float uInside;
      uniform vec3 uColor;
      varying float vEdge;
      varying vec2 vCell;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      varying float vDepth;
      ${NOISE_GLSL}
      ${FOG_GLSL}
      ${SAFE_GLSL}
      void main() {
        const float PAD = 0.12;
        float coord = vCell.y + (vCell.x - 0.5) * 0.1;
        float thresh = (1.0 + PAD) - uProgress * (1.0 + 2.0 * PAD);
        float d = coord - thresh;
        if (d < -0.06) discard;
        float revealed = smoothstep(0.0, 0.01, d);
        float flash = 1.0 - smoothstep(0.0, 0.06, abs(d));

        // energy: two scrolling octaves, remapped and sharpened into drifting bright patches
        vec3 q = vWorld * 0.09;
        float e1 = stageNoise(q + vec3(0.0, uTime * 0.05, uTime * 0.03));
        float e2 = stageNoise(q * 2.3 - vec3(uTime * 0.07, 0.0, 0.0));
        float energy = pow(clamp((0.6 * e1 + 0.4 * e2) * 0.5 + 0.5, 0.0, 1.0), 3.5);

        float aa = fwidth(vEdge) + 1e-4;
        float rim = 1.0 - smoothstep(0.04, 0.04 + aa * 1.5, vEdge);
        vec3 v = safeNormalize(cameraPosition - vWorld);
        float graze = 0.3 + 0.7 * pow(clamp(1.0 - abs(dot(safeNormalize(vNormalW), v)), 0.0, 1.0), 2.0);

        // settled: hairline rims, energy patches only brighten the rims, body fill near zero
        vec3 col = uColor * revealed * (rim * (0.05 + 0.45 * energy) + 0.002 + 0.006 * energy) * graze;
        col *= mix(1.0, 0.35, uInside);
        // the reveal front: rims flare hard (blooms), cell bodies only glimmer
        col += uColor * flash * (1.5 + 6.0 * energy) * (0.06 + rim) * mix(1.0, 0.6, uInside);
        col *= fogKeep(vDepth);
        gl_FragColor = vec4(safeHdr(col), 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
  });
}
