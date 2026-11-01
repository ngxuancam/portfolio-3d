import * as THREE from "three";

/**
 * Main-thread side of the portrait geometry worker: packs the glTF attributes into
 * transferable messages, then wraps the worker's typed arrays in BufferGeometries.
 * Message types are shared with portrait.worker.ts.
 */

type NumericArray = Float32Array | Int8Array | Uint8Array | Int16Array | Uint16Array;

export interface RawAttribute {
  array: NumericArray;
  normalized: boolean;
  /** elements between consecutive vertices (itemSize, or the interleave stride) */
  stride: number;
  offset: number;
}

export interface PortraitBakeRequest {
  position: RawAttribute;
  normal: RawAttribute;
  uv: RawAttribute;
  index: Uint32Array | Uint16Array;
  /** node transform × facing fix, column-major */
  matrix: number[];
  normalMatrix: number[];
  count: number;
  particleCount: number;
}

export interface PortraitBakeResult {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  index: Uint32Array | Uint16Array;
  particles: {
    position: Float32Array;
    normal: Float32Array;
    uv: Float32Array;
    seed: Float32Array;
    angle: Float32Array;
    radius: Float32Array;
  };
}

export interface PortraitGeometries {
  geometry: THREE.BufferGeometry;
  particles: THREE.BufferGeometry;
}

/** Copies an attribute's backing data (interleaved or not) so it can be transferred. */
function raw(attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): RawAttribute {
  if ("isInterleavedBufferAttribute" in attribute && attribute.isInterleavedBufferAttribute) {
    const data = attribute.data;
    return {
      array: (data.array as NumericArray).slice(),
      normalized: attribute.normalized,
      stride: data.stride,
      offset: attribute.offset,
    };
  }
  const plain = attribute as THREE.BufferAttribute;
  return {
    array: (plain.array as NumericArray).slice(),
    normalized: plain.normalized,
    stride: plain.itemSize,
    offset: 0,
  };
}

export function bakePortraitInWorker(
  mesh: THREE.Mesh,
  facing: THREE.Matrix4,
  particleCount: number,
): { promise: Promise<PortraitGeometries>; cancel: () => void } {
  mesh.updateMatrix();
  const transform = facing.clone().multiply(mesh.matrix);
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(transform);
  const source = mesh.geometry;
  const sourceIndex = source.index;
  if (!sourceIndex) throw new Error("portrait mesh must be indexed");

  const request: PortraitBakeRequest = {
    position: raw(source.attributes.position),
    normal: raw(source.attributes.normal),
    uv: raw(source.attributes.uv),
    index: (sourceIndex.array as Uint32Array | Uint16Array).slice(),
    matrix: transform.elements.slice(),
    normalMatrix: normalMatrix.elements.slice(),
    count: source.attributes.position.count,
    particleCount,
  };

  // Already off the main thread (inside the stage worker)? Run the core directly — a
  // nested worker would only add a copy. Otherwise hand it to a dedicated worker.
  if (isWorkerScope()) {
    let cancelled = false;
    const promise = import("./portraitBakeCore").then(({ runPortraitBake }) => {
      if (cancelled) throw new Error("cancelled");
      return toGeometries(runPortraitBake(request));
    });
    return { promise, cancel: () => (cancelled = true) };
  }

  const worker = new Worker(new URL("./portrait.worker.ts", import.meta.url), { type: "module" });
  const promise = new Promise<PortraitGeometries>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<PortraitBakeResult>) => {
      worker.terminate();
      resolve(toGeometries(event.data));
    };
    worker.onerror = (error) => {
      worker.terminate();
      reject(error);
    };
  });

  const transfer = [
    request.position.array.buffer,
    request.normal.array.buffer,
    request.uv.array.buffer,
    request.index.buffer,
  ];
  // the same buffer can back several interleaved attributes — transfer each only once
  worker.postMessage(request, [...new Set(transfer)] as ArrayBuffer[]);
  return { promise, cancel: () => worker.terminate() };
}

/** True inside any Web Worker (the stage shims `window`, so test the worker global). */
function isWorkerScope(): boolean {
  return typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
}

/** Wraps the worker's typed arrays in BufferGeometries (no copies). */
function toGeometries(r: PortraitBakeResult): PortraitGeometries {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(r.positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(r.normals, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(r.uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(r.index, 1));
  geometry.computeBoundingSphere();

  const p = r.particles;
  const particles = new THREE.BufferGeometry();
  particles.setAttribute("position", new THREE.BufferAttribute(p.position, 3));
  particles.setAttribute("aNormal", new THREE.BufferAttribute(p.normal, 3));
  particles.setAttribute("aUv", new THREE.BufferAttribute(p.uv, 2));
  particles.setAttribute("aSeed", new THREE.BufferAttribute(p.seed, 1));
  particles.setAttribute("aAngle", new THREE.BufferAttribute(p.angle, 1));
  particles.setAttribute("aRadius", new THREE.BufferAttribute(p.radius, 1));
  particles.computeBoundingSphere();
  return { geometry, particles };
}
