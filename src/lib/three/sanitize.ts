import { ShaderPass } from "postprocessing";
import { ShaderMaterial, Uniform } from "three";
import { SAFE_GLSL } from "./glsl";

/**
 * Second safety net, between the scene render and bloom: rewrites any non-finite or absurd HDR
 * texel to a finite value. Materials already sanitise their own output, but a single NaN that
 * slips through (driver quirk, a material we did not write) would otherwise be blurred by the
 * bloom mip chain across the entire frame. One cheap fullscreen copy buys that guarantee.
 */
export function createSanitizePass() {
  const material = new ShaderMaterial({
    uniforms: { inputBuffer: new Uniform(null) },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 1.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D inputBuffer;
      varying vec2 vUv;
      ${SAFE_GLSL}
      void main() {
        vec4 texel = texture2D(inputBuffer, vUv);
        gl_FragColor = vec4(safeHdr(texel.rgb), 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });
  return new ShaderPass(material, "inputBuffer");
}
