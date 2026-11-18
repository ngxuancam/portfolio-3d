/**
 * GLSL snippets shared by every stage material. Kept as plain strings so they can be spliced into
 * both `onBeforeCompile` patches and hand-written ShaderMaterials.
 *
 * three r163+ is WebGL2-only and always compiles GLSL ES 3.00, so integer hashing (uint ops) is
 * available: it is cheaper than sin-based hashes and has no precision banding on mobile GPUs.
 */

/** Integer hash + 3D gradient noise (quintic fade). Output roughly −1..1. */
export const NOISE_GLSL = /* glsl */ `
uvec3 stageHash3(uvec3 v) {
  // LCG step then three rounds of cross-mixing: enough avalanche for visual noise
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 stageGrad(ivec3 c) {
  // offset keeps small negative lattice coords positive before the uint cast
  uvec3 h = stageHash3(uvec3(c + 32768));
  return vec3(h & 0xffffu) / 32767.5 - 1.0;
}
float stageNoise(vec3 p) {
  ivec3 i = ivec3(floor(p));
  vec3 f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = dot(stageGrad(i), f);
  float n100 = dot(stageGrad(i + ivec3(1, 0, 0)), f - vec3(1.0, 0.0, 0.0));
  float n010 = dot(stageGrad(i + ivec3(0, 1, 0)), f - vec3(0.0, 1.0, 0.0));
  float n110 = dot(stageGrad(i + ivec3(1, 1, 0)), f - vec3(1.0, 1.0, 0.0));
  float n001 = dot(stageGrad(i + ivec3(0, 0, 1)), f - vec3(0.0, 0.0, 1.0));
  float n101 = dot(stageGrad(i + ivec3(1, 0, 1)), f - vec3(1.0, 0.0, 1.0));
  float n011 = dot(stageGrad(i + ivec3(0, 1, 1)), f - vec3(0.0, 1.0, 1.0));
  float n111 = dot(stageGrad(i + ivec3(1, 1, 1)), f - vec3(1.0, 1.0, 1.0));
  float x00 = mix(n000, n100, u.x);
  float x10 = mix(n010, n110, u.x);
  float x01 = mix(n001, n101, u.x);
  float x11 = mix(n011, n111, u.x);
  return mix(mix(x00, x10, u.y), mix(x01, x11, u.y), u.z) * 1.4;
}
`;

/**
 * The build sweep. `uSweep` = (axis min, 1 / axis length) along the hull's long axis (local z);
 * `uThreshold` is the already-padded front position, so CPU code owns the timeline and every
 * material agrees on where the front is. Positive distance = built.
 */
export const SWEEP_GLSL = /* glsl */ `
uniform float uThreshold;
uniform float uTime;
uniform vec2 uSweep;
const float SWEEP_WOBBLE = 0.075;
const float EDGE_WIDTH = 0.032;
float sweepDistance(vec3 p) {
  float h = (p.z - uSweep.x) * uSweep.y;
  // slow lateral drift of the noise makes the front crawl like a weld, not slide like a wipe
  h += stageNoise(p * 1.35 + vec3(uTime * 0.18, 0.0, 0.0)) * SWEEP_WOBBLE;
  return uThreshold - h;
}
float sweepEdge(float d) {
  return 1.0 - smoothstep(0.0, EDGE_WIDTH, abs(d));
}
`;

/** Squared-exponential fog as a scalar, for additive materials that must fade to black. */
export const FOG_GLSL = /* glsl */ `
uniform float uFogDensity;
float fogKeep(float depth) {
  float d = uFogDensity * depth;
  return exp(-d * d);
}
`;
