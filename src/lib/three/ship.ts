import { BufferAttribute, BufferGeometry, Mesh, MeshStandardMaterial, Texture, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { fetchModel, SHIP_BYTES, SHIP_URL } from "./fetchModel";
/**
 * The hull is rescaled so its largest horizontal extent (length or wingspan) spans this many world
 * units: a wide-winged ship must still fit the free area right of the text column.
 */
const SHIP_SPAN = 5;

export type ShipAsset = {
  geometry: BufferGeometry;
  map: Texture | null;
  /** min z and length of the normalised hull, for the sweep uniform */
  axisMin: number;
  axisLength: number;
  /** the twin engine exhausts (mirrored in x), found from the geometry */
  engine: EngineMount;
};

/** one exhaust of a mirrored pair: centre (±x, y, z) and nozzle radius, in hull space */
export type EngineMount = { x: number; y: number; z: number; radius: number };

/**
 * Find the engines. The hull's −z end is the tail. The exhaust is the big rear-facing block on the
 * centreline (normal.z < −0.85, in the last fifth of the hull, |x| < 0.8): its area-weighted face
 * plane gives the nozzle depth and its extent the size. The twin jets sit side by side inside it.
 * Measured, not hard-coded, so a re-export of the model still lines up.
 */
function findEngines(geometry: BufferGeometry, axisMin: number, axisLength: number): EngineMount {
  const pos = geometry.attributes.position;
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const ab = new Vector3();
  const ac = new Vector3();
  let area = 0;
  let zSum = 0;
  let xMax = 0;
  let yMin = Infinity;
  let yMax = -Infinity;
  // non-indexed: every three vertices are one triangle
  for (let i = 0; i + 2 < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    const n = ab.subVectors(b, a).cross(ac.subVectors(c, a));
    const doubleArea = n.length();
    if (doubleArea < 1e-6 || n.z / doubleArea > -0.85) continue;
    const z = (a.z + b.z + c.z) / 3;
    const x = Math.abs((a.x + b.x + c.x) / 3);
    if (z > axisMin + axisLength * 0.2 || x > 0.8) continue;
    area += doubleArea;
    zSum += z * doubleArea;
    for (const p of [a, b, c]) {
      xMax = Math.max(xMax, Math.abs(p.x));
      yMin = Math.min(yMin, p.y);
      yMax = Math.max(yMax, p.y);
    }
  }
  if (area < 0.05) return { x: 0.3, y: 0, z: axisMin + 0.5, radius: 0.25 };
  const half = Math.min(0.8, xMax);
  return {
    x: half / 2,
    y: (yMin + yMax) / 2,
    z: zSum / area,
    radius: Math.min(half / 2, (yMax - yMin) / 2) * 0.85,
  };
}

let parsed: Promise<ShipAsset | null> | null = null;

/**
 * Parse the GLB into ONE baked, normalised geometry. The sweep works in object space, so baking
 * node transforms in (and centring/scaling here) means every shader can use `position` directly.
 */
export function loadShip(onProgress: (fraction: number) => void): Promise<ShipAsset | null> {
  if (parsed) return parsed;
  parsed = (async () => {
    const buffer = await fetchModel(SHIP_URL, onProgress, SHIP_BYTES);
    if (!buffer) return null;
    try {
      const gltf = await new GLTFLoader().parseAsync(buffer, "/models/");
      gltf.scene.updateMatrixWorld(true);
      const parts: BufferGeometry[] = [];
      let map: Texture | null = null;
      gltf.scene.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        const geometry = (node.geometry as BufferGeometry).clone();
        geometry.applyMatrix4(node.matrixWorld);
        // keep only what the materials read so the merge never trips on mismatched attributes
        for (const name of Object.keys(geometry.attributes)) {
          if (name !== "position" && name !== "normal" && name !== "uv") geometry.deleteAttribute(name);
        }
        parts.push(geometry.index ? geometry.toNonIndexed() : geometry);
        const material = node.material as MeshStandardMaterial;
        if (!map && material.map) map = material.map;
      });
      if (parts.length === 0) return null;
      const geometry = parts.length === 1 ? parts[0] : mergeGeometries(parts);
      if (!geometry) return null;

      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      const size = box.getSize(new Vector3());
      const centre = box.getCenter(new Vector3());
      const scale = SHIP_SPAN / Math.max(size.x, size.z);
      geometry.translate(-centre.x, -centre.y, -centre.z);
      geometry.scale(scale, scale, scale);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      if (!geometry.attributes.normal) geometry.computeVertexNormals();

      const bounds = geometry.boundingBox!;
      const axisMin = bounds.min.z;
      const axisLength = bounds.max.z - bounds.min.z;
      return { geometry, map, axisMin, axisLength, engine: findEngines(geometry, axisMin, axisLength) };
    } catch {
      return null;
    }
  })();
  return parsed;
}

/**
 * Area-weighted surface samples of the hull for the point cloud, plus a per-point seed and a
 * random unit direction (the "unbuilt" scatter). Built once; ~7k points is ~200 KB of attributes.
 */
export function sampleHull(geometry: BufferGeometry, count: number) {
  const sampler = new MeshSurfaceSampler(new Mesh(geometry)).build();
  const positions = new Float32Array(count * 3);
  const dirs = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const p = new Vector3();
  const n = new Vector3();
  for (let i = 0; i < count; i++) {
    sampler.sample(p, n);
    p.toArray(positions, i * 3);
    // bias the scatter outward along the normal so unbuilt points hover off the skin, not inside it
    const r = new Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    r.addScaledVector(n, 1.5).normalize();
    r.toArray(dirs, i * 3);
    seeds[i] = Math.random();
  }
  const points = new BufferGeometry();
  points.setAttribute("position", new BufferAttribute(positions, 3));
  points.setAttribute("aDir", new BufferAttribute(dirs, 3));
  points.setAttribute("aSeed", new BufferAttribute(seeds, 1));
  points.computeBoundingSphere();
  // scattered points travel up to ~0.5 units off the skin
  if (points.boundingSphere) points.boundingSphere.radius += 0.6;
  return points;
}
