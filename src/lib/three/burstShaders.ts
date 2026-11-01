import { simplexNoise } from "./noise";

/**
 * Shared "burst field": a 0..1 value per point of the model. The surface burns away
 * where field < uProgress, and the particle sampled at that point launches at the
 * same moment — both shaders call this exact function, so they never drift apart.
 * Noise gives organic islands; the vertical term makes the burn start at the crown.
 */
export const burstFieldGlsl = /* glsl */ `
${simplexNoise}
float burstField(vec3 p){
  float n = snoise(p * 4.2) * 0.5 + 0.5;
  float fromTop = clamp(0.5 - p.y, 0.0, 1.0);
  return clamp(n * 0.55 + fromTop * 0.45, 0.0, 1.0);
}`;

/** progress needed for the last particle to fully settle into the flower */
export const BURST_PROGRESS_MAX = 1.4;
/** how long (in progress units) a particle takes from launch to flower */
const FLIGHT = "0.4";

/* ───────────────────────── model (injected into MeshStandardMaterial) ───────────────────────── */

export const modelVertexPars = /* glsl */ `
varying vec3 vBurstPos;`;

export const modelVertexMain = /* glsl */ `
vBurstPos = position;`;

export const modelFragmentPars = /* glsl */ `
uniform float uProgress;
uniform float uTime;
uniform vec3 uEdgeColor;
uniform vec3 uRimColorA;
uniform vec3 uRimColorB;
varying vec3 vBurstPos;
${burstFieldGlsl}`;

/**
 * Runs after <emissivemap_fragment>: `normal` and `vViewPosition` are available,
 * and anything added to totalEmissiveRadiance glows on top of the PBR lighting.
 */
export const modelFragmentMain = /* glsl */ `
float field = burstField(vBurstPos);
float edgeDist = field - uProgress;
if (edgeDist < 0.0) discard;

// burning edge: thin, hot, accent-coloured
float edge = 1.0 - smoothstep(0.0, 0.045, edgeDist);
totalEmissiveRadiance += uEdgeColor * edge * 3.5 * step(0.001, uProgress);

// idle holographic rim: fresnel × flowing noise bands drifting up, hue cycling accent ↔ violet
vec3 viewDir = normalize(vViewPosition);
float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 2.6);
float bands = snoise(vec3(vBurstPos.xy * 3.0, uTime * 0.35) + vec3(0.0, -uTime * 0.25, 0.0)) * 0.5 + 0.5;
vec3 rimColor = mix(uRimColorA, uRimColorB, 0.5 + 0.5 * sin(uTime * 0.6 + vBurstPos.y * 6.0));
totalEmissiveRadiance += rimColor * fresnel * (0.25 + bands * 0.75) * 0.22;`;

/* ───────────────────────── particles → flower ───────────────────────── */

export const flowerVertexShader = /* glsl */ `
uniform float uProgress;
uniform float uTime;
uniform float uPixelRatio;
uniform float uFlowerRadius;
uniform vec3 uFlowerCenter;
uniform sampler2D uMap;
uniform float uBlur;        // depth-of-field strength for the current camera shot (0..1)
attribute vec3 aNormal;
attribute vec2 aUv;
attribute float aSeed;
attribute float aAngle;
attribute float aRadius;
varying vec3 vColor;
varying float vGlow;
varying float vVisible;
varying float vSeed;
varying float vBokeh;
${burstFieldGlsl}

const float PETALS = 6.0;
const float PI = 3.14159265359;
// linear-space palette, normal blending over the ecru canvas
const vec3 BRASS = vec3(0.54, 0.38, 0.2);      // #C2A679
const vec3 BURGUNDY = vec3(0.17, 0.012, 0.02); // a touch lighter than #4A0E17 so petals read
const vec3 NAVY = vec3(0.012, 0.018, 0.03);    // #1B2430
const vec3 OLIVE = vec3(0.1, 0.08, 0.03);      // brass deepened toward navy — leaf green, on-palette

// stem: a gently S-curved stalk hanging from the flower's heart (model units)
const float STEM_LENGTH = 1.3;
vec3 stemPoint(float s, float time){
  float sway = sin(time * 0.6 + s * 2.0) * 0.025 * s;
  return vec3(sin(s * 2.4) * 0.14 + sway, -s * STEM_LENGTH, -0.06 * s - 0.04);
}

void main(){
  float field = burstField(position);
  float t = clamp((uProgress - field) / ${FLIGHT}, 0.0, 1.0);
  float e = 1.0 - pow(1.0 - t, 3.0);

  // five populations, partitioned by seed: stem, leaves, outer petals, an inner petal
  // ring rotated half a petal, and a stamen core
  float stem = 1.0 - step(0.12, aSeed);
  float leaf = step(0.12, aSeed) * (1.0 - step(0.24, aSeed));
  float stamen = step(0.94, aSeed);
  float inner = step(0.6, aSeed) * (1.0 - stamen);

  float breathe = 1.0 + sin(uTime * 0.9) * 0.035;
  float petal = abs(cos(PETALS * 0.5 * aAngle));       // rose curve: |cos(3θ)| → 6 petals
  float layerScale = mix(1.0, 0.56, inner);
  float r = uFlowerRadius * layerScale * (0.1 + 0.9 * petal) * sqrt(aRadius) * breathe;
  r = mix(r, uFlowerRadius * 0.11 * aRadius, stamen);

  float spin = uTime * 0.1 + e * 1.4;                 // keeps turning slowly once bloomed
  float a = aAngle + inner * (PI / PETALS) + spin * mix(1.0, -0.6, inner); // inner ring counter-rotates

  // real bloom depth for the orbiting camera: petals cup upward toward their tips and curl,
  // the inner ring sits higher, the stamen is a small dome
  float rn = r / uFlowerRadius;
  float cup = rn * rn * 0.75 + sin(rn * PI) * 0.06 * petal;
  float z = cup + inner * 0.1 + stamen * sqrt(max(0.0, 1.0 - aRadius)) * 0.14;
  z += snoise(vec3(aAngle * 2.0, aRadius * 3.0, uTime * 0.35)) * 0.035;
  vec3 target = uFlowerCenter + vec3(cos(a) * r, sin(a) * r, z);

  // stem: points along the stalk, wrapped in a thin tube that tapers toward the end.
  // Built without the spin, so the stalk stays put while the bloom turns.
  float sStem = aRadius;
  vec3 stalk = stemPoint(sStem, uTime);
  float girth = 0.024 * (1.0 - 0.5 * sStem);
  vec3 stemTarget = uFlowerCenter + stalk + vec3(cos(aAngle) * girth, 0.0, sin(aAngle) * girth);

  // leaves: two, alternating sides; a lens-shaped blade with a sin() profile, curving up
  float side = step(0.5, fract(aSeed * 37.0)) * 2.0 - 1.0;
  float attach = side > 0.0 ? 0.48 : 0.72;
  vec3 base = uFlowerCenter + stemPoint(attach, uTime);
  float u = aRadius;                                   // along the blade
  float w = (aAngle / PI - 1.0);                        // -1..1 across the blade
  vec2 dir = normalize(vec2(side, 0.55));
  vec2 perp = vec2(-dir.y, dir.x);
  float bladeWidth = sin(u * PI) * 0.12;
  vec2 bend = dir * u * 0.5 + perp * (w * bladeWidth) + vec2(0.0, u * u * 0.14);
  float flutterLeaf = sin(uTime * 0.8 + side * 2.0 + u * 3.0) * 0.02 * u;
  vec3 leafTarget = base + vec3(bend.x, bend.y + flutterLeaf, 0.04 * u + w * 0.015);

  target = mix(target, stemTarget, stem);
  target = mix(target, leafTarget, leaf);

  // launch along the surface normal first, then curve into the flower
  vec3 p = mix(position, target, e) + aNormal * sin(e * PI) * (0.18 + aSeed * 0.22);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float twinkle = 0.7 + 0.3 * sin(uTime * (1.5 + aSeed * 3.0) + aSeed * 40.0);
  float size = mix(1.4, (3.2 + aSeed * 2.4 + stamen * 2.5) * twinkle, e);
  // depth of field: points close to the lens swell into soft bokeh discs; distant ones
  // stay sharp riso dots. Only active while uBlur > 0 (the close-up Projects shot).
  float nearLens = 1.0 - smoothstep(0.6, 3.2, -mv.z);
  float bokeh = uBlur * (0.25 + 0.75 * nearLens);
  gl_PointSize = size * uPixelRatio * (4.0 / -mv.z) * step(0.0001, t) * (1.0 + bokeh * 3.5);
  vBokeh = bokeh;

  vec3 skin = texture2D(uMap, aUv).rgb;
  vec3 petalColor = mix(BURGUNDY, BRASS, smoothstep(0.35, 1.0, rn));  // burgundy heart → brass tips
  petalColor = mix(petalColor, mix(NAVY, BURGUNDY, rn), inner * 0.8);   // navy inner ring
  petalColor = mix(petalColor, BRASS, stamen);
  petalColor = mix(petalColor, mix(NAVY, OLIVE, 0.35), stem);
  petalColor = mix(petalColor, mix(OLIVE, BRASS, 0.2 + 0.3 * (1.0 - abs(w))), leaf);  // lighter midrib
  vColor = mix(skin, petalColor, e * 0.85);
  vGlow = 1.0 - smoothstep(0.0, 0.25, t);  // brass flash at launch, fading in flight
  vVisible = step(0.0001, t);
  vSeed = aSeed;
}`;

/**
 * Risograph print: no soft glow. Each sprite is a disc of solid ink, stippled by a
 * per-pixel hash against its radial falloff — dense in the middle, breaking into grainy
 * specks at the edge, like ink on a riso drum.
 */
export const flowerFragmentShader = /* glsl */ `
varying vec3 vColor;
varying float vGlow;
varying float vVisible;
varying float vSeed;
varying float vBokeh;

float hash(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main(){
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5 || vVisible < 0.5) discard;
  // in focus: stippled solid ink; out of focus: a soft, faint bokeh disc
  float coverage = smoothstep(0.5, 0.05, d);
  float stipple = step(hash(gl_FragCoord.xy + vSeed * 97.0), coverage * 1.15) * 0.92;
  float soft = smoothstep(0.5, 0.0, d) * 0.3;
  float alpha = mix(stipple, soft, clamp(vBokeh * 1.6, 0.0, 1.0));
  if (alpha < 0.01) discard;
  vec3 ink = mix(vColor, vec3(0.54, 0.38, 0.2), vGlow * 0.6);
  gl_FragColor = vec4(ink, alpha);
  #include <colorspace_fragment>
}`;
