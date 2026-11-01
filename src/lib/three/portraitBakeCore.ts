/**
 * Pure portrait geometry work (no three.js, no DOM): de-quantize the glTF attributes,
 * apply the node transform + facing fix, then area-sample the flower particles.
 * Runs inside portrait.worker.ts on the main-thread path, or directly inside the stage
 * worker when the whole scene already lives off the main thread.
 */
import type { PortraitBakeRequest, PortraitBakeResult, RawAttribute } from "./portraitBake";

const NORMALIZE: Record<string, number> = {
  Int8Array: 127,
  Uint8Array: 255,
  Int16Array: 32767,
  Uint16Array: 65535,
};

/** Reads component `c` of vertex `i`, honouring interleaving and glTF normalization. */
function reader(attr: RawAttribute) {
  const divisor = attr.normalized ? (NORMALIZE[attr.array.constructor.name] ?? 1) : 1;
  return (i: number, c: number) => {
    const value = attr.array[i * attr.stride + attr.offset + c] / divisor;
    return attr.normalized ? Math.max(value, -1) : value;
  };
}

function bake({ position, normal, uv, matrix, normalMatrix, count }: PortraitBakeRequest) {
  const m = matrix;
  const n = normalMatrix;
  const readP = reader(position);
  const readN = reader(normal);
  const readUv = reader(uv);
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);

  for (let i = 0; i < count; i++) {
    const x = readP(i, 0);
    const y = readP(i, 1);
    const z = readP(i, 2);
    // column-major Matrix4 (three.js `elements`)
    positions[i * 3] = m[0] * x + m[4] * y + m[8] * z + m[12];
    positions[i * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    positions[i * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];

    const nx = readN(i, 0);
    const ny = readN(i, 1);
    const nz = readN(i, 2);
    let tx = n[0] * nx + n[3] * ny + n[6] * nz;
    let ty = n[1] * nx + n[4] * ny + n[7] * nz;
    let tz = n[2] * nx + n[5] * ny + n[8] * nz;
    const len = Math.hypot(tx, ty, tz) || 1;
    tx /= len;
    ty /= len;
    tz /= len;
    normals[i * 3] = tx;
    normals[i * 3 + 1] = ty;
    normals[i * 3 + 2] = tz;

    uvs[i * 2] = readUv(i, 0);
    uvs[i * 2 + 1] = readUv(i, 1);
  }
  return { positions, normals, uvs };
}

/** Area-weighted surface sampling with uniform barycentrics (sqrt trick). */
function sample(
  positions: Float32Array,
  normals: Float32Array,
  uvs: Float32Array,
  index: Uint32Array | Uint16Array,
  particleCount: number,
) {
  const triangles = index.length / 3;
  const cumulative = new Float64Array(triangles);
  let total = 0;
  for (let t = 0; t < triangles; t++) {
    const a = index[t * 3] * 3;
    const b = index[t * 3 + 1] * 3;
    const c = index[t * 3 + 2] * 3;
    const abx = positions[b] - positions[a];
    const aby = positions[b + 1] - positions[a + 1];
    const abz = positions[b + 2] - positions[a + 2];
    const acx = positions[c] - positions[a];
    const acy = positions[c + 1] - positions[a + 1];
    const acz = positions[c + 2] - positions[a + 2];
    const cx = aby * acz - abz * acy;
    const cy = abz * acx - abx * acz;
    const cz = abx * acy - aby * acx;
    total += Math.hypot(cx, cy, cz) * 0.5;
    cumulative[t] = total;
  }

  const out = {
    position: new Float32Array(particleCount * 3),
    normal: new Float32Array(particleCount * 3),
    uv: new Float32Array(particleCount * 2),
    seed: new Float32Array(particleCount),
    angle: new Float32Array(particleCount),
    radius: new Float32Array(particleCount),
  };

  for (let i = 0; i < particleCount; i++) {
    // pick a triangle proportional to its area (binary search the CDF)
    const target = Math.random() * total;
    let lo = 0;
    let hi = triangles - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    const ia = index[lo * 3];
    const ib = index[lo * 3 + 1];
    const ic = index[lo * 3 + 2];
    const r1 = Math.sqrt(Math.random());
    const r2 = Math.random();
    const wa = 1 - r1;
    const wb = r1 * (1 - r2);
    const wc = r1 * r2;

    for (let k = 0; k < 3; k++) {
      out.position[i * 3 + k] = positions[ia * 3 + k] * wa + positions[ib * 3 + k] * wb + positions[ic * 3 + k] * wc;
      out.normal[i * 3 + k] = normals[ia * 3 + k] * wa + normals[ib * 3 + k] * wb + normals[ic * 3 + k] * wc;
    }
    const nl = Math.hypot(out.normal[i * 3], out.normal[i * 3 + 1], out.normal[i * 3 + 2]) || 1;
    out.normal[i * 3] /= nl;
    out.normal[i * 3 + 1] /= nl;
    out.normal[i * 3 + 2] /= nl;
    for (let k = 0; k < 2; k++) {
      out.uv[i * 2 + k] = uvs[ia * 2 + k] * wa + uvs[ib * 2 + k] * wb + uvs[ic * 2 + k] * wc;
    }
    out.seed[i] = Math.random();
    out.angle[i] = Math.random() * Math.PI * 2;
    out.radius[i] = Math.random();
  }
  return out;
}

export function runPortraitBake(request: PortraitBakeRequest): PortraitBakeResult {
  const baked = bake(request);
  const particles = sample(baked.positions, baked.normals, baked.uvs, request.index, request.particleCount);
  return { ...baked, index: request.index, particles };
}

/** Every buffer in a result, for zero-copy postMessage transfer. */
export function resultTransferables(result: PortraitBakeResult): ArrayBuffer[] {
  return [
    result.positions.buffer,
    result.normals.buffer,
    result.uvs.buffer,
    result.index.buffer,
    ...Object.values(result.particles).map((array) => array.buffer),
  ] as ArrayBuffer[];
}
