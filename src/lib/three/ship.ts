import { BufferAttribute, BufferGeometry, Mesh, MeshStandardMaterial, Texture, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { fetchModel, SHIP_BYTES, SHIP_URL } from "./fetchModel";
/** the hull is rescaled so its long (z) axis spans this many world units */
const SHIP_LENGTH = 6;

export type ShipAsset = {
  geometry: BufferGeometry;
  map: Texture | null;
  /** min z and length of the normalised hull, for the sweep uniform */
  axisMin: number;
  axisLength: number;
};

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
      const scale = SHIP_LENGTH / size.z;
      geometry.translate(-centre.x, -centre.y, -centre.z);
      geometry.scale(scale, scale, scale);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      if (!geometry.attributes.normal) geometry.computeVertexNormals();

      const bounds = geometry.boundingBox!;
      return { geometry, map, axisMin: bounds.min.z, axisLength: bounds.max.z - bounds.min.z };
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
