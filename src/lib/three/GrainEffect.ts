import { BlendFunction, Effect } from "postprocessing";
import { Uniform, type WebGLRenderer, type WebGLRenderTarget } from "three";

const fragmentShader = /* glsl */ `
uniform float uSeed;
uniform float uAmount;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // per-pixel integer hash; reseeded only on grain ticks so it reads as film, not TV static
  uvec2 p = uvec2(gl_FragCoord.xy) + uvec2(uint(uSeed * 4096.0));
  uint h = p.x * 1973u + p.y * 9277u + 26699u;
  h = (h ^ (h >> 15u)) * 2246822519u;
  h = (h ^ (h >> 13u)) * 3266489917u;
  h ^= h >> 16u;
  float n = float(h & 0xffffu) / 65535.0 - 0.5;
  // stronger in the mid-tones, almost none in the void: grain should not lift the blacks
  float luma = dot(inputColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  float weight = 0.35 + 0.65 * smoothstep(0.0, 0.35, luma);
  outputColor = vec4(inputColor.rgb + n * uAmount * weight, inputColor.a);
}
`;

/**
 * Film grain whose pattern only changes at `fps` (12 by default) — the stepped cadence of the
 * design's "frames" motion language, and far less shimmer than per-frame noise.
 */
export class GrainEffect extends Effect {
  private elapsed = 0;
  private readonly step: number;

  constructor({ amount = 0.035, fps = 12 }: { amount?: number; fps?: number } = {}) {
    super("GrainEffect", fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ["uSeed", new Uniform(0)],
        ["uAmount", new Uniform(amount)],
      ]),
    });
    this.step = 1 / fps;
  }

  update(_renderer: WebGLRenderer, _input: WebGLRenderTarget, deltaTime?: number) {
    const before = Math.floor(this.elapsed / this.step);
    this.elapsed += deltaTime ?? 0;
    if (Math.floor(this.elapsed / this.step) !== before) {
      this.uniforms.get("uSeed")!.value = Math.random();
    }
  }
}
