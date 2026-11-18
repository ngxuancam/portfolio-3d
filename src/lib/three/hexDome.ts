import { BufferAttribute, BufferGeometry, IcosahedronGeometry, Vector3 } from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Geodesic hex dome: the DUAL of a subdivided icosahedron. Every vertex of the subdivided sphere
 * becomes one cell (a hexagon, or one of the 12 pentagons) whose corners are the centroids of the
 * triangles around it. Each cell is emitted as its own little triangle fan so per-cell attributes
 * stay constant across the cell and the rim can be found from a single interpolated value.
 *
 *   aEdge  1 at the cell centre, 0 on its rim → rim band = small aEdge
 *   aCell  (random 0..1, height 0..1 over the dome) → staggered top-down reveal
 */
export function createHexDome({ radius, detail, floor }: { radius: number; detail: number; floor: number }) {
  const ico = new IcosahedronGeometry(1, detail);
  // uv seams would stop vertices from welding; only positions matter for the topology
  ico.deleteAttribute("uv");
  ico.deleteAttribute("normal");
  const sphere = mergeVertices(ico, 1e-5);
  ico.dispose();

  const pos = sphere.attributes.position;
  const index = sphere.index!;
  const vertexCount = pos.count;
  const faceCount = index.count / 3;

  const centroids: Vector3[] = [];
  const facesOf: number[][] = Array.from({ length: vertexCount }, () => []);
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  for (let f = 0; f < faceCount; f++) {
    const ia = index.getX(f * 3);
    const ib = index.getX(f * 3 + 1);
    const ic = index.getX(f * 3 + 2);
    a.fromBufferAttribute(pos, ia);
    b.fromBufferAttribute(pos, ib);
    c.fromBufferAttribute(pos, ic);
    centroids.push(new Vector3().add(a).add(b).add(c).normalize());
    facesOf[ia].push(f);
    facesOf[ib].push(f);
    facesOf[ic].push(f);
  }

  const positions: number[] = [];
  const edges: number[] = [];
  const cells: number[] = [];
  const indices: number[] = [];
  const centre = new Vector3();
  const tangent = new Vector3();
  const bitangent = new Vector3();
  const offset = new Vector3();
  const corner = new Vector3();
  const helper = new Vector3();

  for (let v = 0; v < vertexCount; v++) {
    centre.fromBufferAttribute(pos, v).normalize();
    if (centre.y < floor) continue;

    // order the surrounding centroids by angle in the cell's tangent plane
    helper.set(0, 1, 0);
    if (Math.abs(centre.y) > 0.9) helper.set(1, 0, 0);
    tangent.crossVectors(helper, centre).normalize();
    bitangent.crossVectors(centre, tangent);
    const ring = facesOf[v]
      .map((f) => {
        offset.subVectors(centroids[f], centre);
        return { f, angle: Math.atan2(offset.dot(bitangent), offset.dot(tangent)) };
      })
      .sort((p, q) => p.angle - q.angle);

    const base = positions.length / 3;
    const random = Math.random();
    const height = (centre.y - floor) / (1 - floor);
    positions.push(centre.x * radius, centre.y * radius, centre.z * radius);
    edges.push(1);
    cells.push(random, height);
    for (const { f } of ring) {
      // pull corners in a hair so neighbouring cells read as separate plates
      corner.copy(centre).lerp(centroids[f], 0.94).normalize().multiplyScalar(radius);
      positions.push(corner.x, corner.y, corner.z);
      edges.push(0);
      cells.push(random, height);
    }
    const n = ring.length;
    for (let k = 0; k < n; k++) indices.push(base, base + 1 + k, base + 1 + ((k + 1) % n));
  }
  sphere.dispose();

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("aEdge", new BufferAttribute(new Float32Array(edges), 1));
  geometry.setAttribute("aCell", new BufferAttribute(new Float32Array(cells), 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
