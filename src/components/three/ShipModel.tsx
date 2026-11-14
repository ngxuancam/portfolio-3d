"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { stageTheme } from "@/lib/three/stageTheme";
import { sceneSignals } from "@/lib/three/sceneSignals";
import { ANCHOR_IDS, shipAnchors, type AnchorId, type AnchorSnapshot } from "@/lib/three/shipAnchors";

/**
 * "Spaceship" by Quaternius (CC0 / public domain, 2 814 tris):
 * https://poly.pizza/m/Jqfed124pQ  — see public/models/CREDITS.md.
 */
const SHIP_URL = "/models/ship.glb";
/** longest side of the ship in scene units */
const SHIP_SIZE = 4;

/**
 * Flight: a pure function of the scroll. The camera stays on the hero shot and the ship is
 * placed on screen from the page's scroll position alone (see FLIGHT_KEYS) — no idle drift, no
 * pointer. The path snakes down the page, swinging off the left and right edges and coming back,
 * like a ship flying out and returning. Its nose follows the path's direction of travel and it
 * rolls into the bends the way three.js' `examples/webxr_vr_rollercoaster.html` (MIT) does:
 * `bank = -atan(headingChange * k)`, from the heading change between the tangents either side
 * of the current point, applied by rotating `up` about the heading before `lookAt`. See CREDITS.md.
 */
const BANK_GAIN = 1.1;
const BANK_SCALE = 0.5; // max roll = BANK_SCALE * pi/2 ≈ 45°, as in the example
const BANK_SMOOTHING = 8; // 1 - exp(-dt * k)
const STAGE_SMOOTHING = 4; // the ship trails the scroll a little: inertia, not animation
const TURN_SPAN = 0.07; // stage units either side of the ship used to measure the bend
const TANGENT_EPS = 0.02;
/** Stage at the very bottom of the page (SceneBackdropLoader makes it exactly this on any screen). */
const END_U = 5;

/**
 * [stage, screen x, screen y, distance from the camera], x/y in -1..1 (+y up); |x| > 1 is off
 * screen. The page rests at stage 0, 0.89, 1.89 … 5 (hero … contact), so those are the visible
 * parking spots; the keys between them are the swings: off the left edge, off the right edge,
 * off the left again, up out of the top (Projects covers the page), and a hook before the last
 * leg drops the ship straight down onto Contact.
 */
const FLIGHT_KEYS: readonly (readonly [number, number, number, number])[] = [
  [0.0, 0.5, 0.05, 5.7], // hero: top-down, nose to the lower left
  [0.2, 0.1, -0.1, 5.2],
  [0.45, -1.7, -0.3, 5.0], // off the left edge
  [0.65, -0.7, 0.1, 5.6],
  [0.89, 0.52, 0.18, 6.2], // about
  [1.15, 1.2, 0.4, 5.6],
  [1.4, 1.85, 0.2, 5.2], // off the right edge
  [1.65, 0.6, -0.45, 5.0],
  [1.89, 0.52, 0.12, 6.2], // skills
  [2.15, -0.5, -0.35, 5.2],
  [2.45, -1.75, -0.1, 5.0], // off the left edge
  [2.7, -0.6, 0.2, 5.6],
  [2.89, 0.52, 0.08, 6.2], // experience
  [3.2, 0.9, 0.9, 5.8],
  [3.5, 0.3, 1.55, 6.0], // up out of the top
  [3.89, 0.5, 1.6, 6.0], // projects: parked above the top edge
  [4.2, 0.35, 1.7, 6.3], // the hook
  [4.45, -0.15, 1.35, 6.6],
  [4.7, 0.0, 0.6, 7.0],
  [5.0, 0.0, 0.0, 7.6], // contact: straight down to the centre of the screen
];

const vertexShader = /* glsl */ `
varying vec3 vP;
void main(){
  vP = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/** Both layers are cut by the same expanding sphere, so the drawing "plots" outward from the centre. */
const fragmentShader = (alpha: string, front: string) => /* glsl */ `
uniform vec3 uColor;
uniform float uReveal;
varying vec3 vP;
void main(){
  float d = length(vP);
  if (d > uReveal) discard;
  float edge = smoothstep(0.4, 0.0, uReveal - d);
  gl_FragColor = vec4(mix(uColor, vec3(1.0), edge * ${front}), ${alpha});
  #include <colorspace_fragment>
}`;

/**
 * Flattens every mesh of the glTF into one centred, normalised set of position-only
 * geometries, and finds the landmarks the page callouts point at (canopy, wing tips, tail).
 */
function bake(scene: THREE.Object3D) {
  scene.updateMatrixWorld(true);
  const geometries: THREE.BufferGeometry[] = [];
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", mesh.geometry.getAttribute("position").clone());
    if (mesh.geometry.index) g.setIndex(mesh.geometry.index.clone());
    g.applyMatrix4(mesh.matrixWorld);
    geometries.push(g);
  });
  const box = new THREE.Box3();
  geometries.forEach((g) => {
    g.computeBoundingBox();
    box.union(g.boundingBox!);
  });
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const k = SHIP_SIZE / Math.max(size.x, size.y, size.z);

  let radius = 0;
  const v = new THREE.Vector3();
  const anchors = Object.fromEntries(ANCHOR_IDS.map((id) => [id, new THREE.Vector3()])) as Record<AnchorId, THREE.Vector3>;
  let maxY = -Infinity;
  let maxX = -Infinity;
  let minX = Infinity;
  let rearZ = Infinity;
  for (const g of geometries) {
    g.translate(-center.x, -center.y, -center.z).scale(k, k, k);
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      radius = Math.max(radius, v.length());
      if (v.y > maxY) {
        maxY = v.y;
        anchors.cupola.copy(v);
      }
      if (v.x > maxX) {
        maxX = v.x;
        anchors.wingR.copy(v);
      }
      if (v.x < minX) {
        minX = v.x;
        anchors.wingL.copy(v);
      }
      // rearmost point near the centreline: the engine end of the hull
      if (Math.abs(v.x) < 0.2 * SHIP_SIZE * 0.25 && v.z < rearZ) rearZ = v.z;
    }
  }
  // tail = centroid of the centreline vertices within a hand's width of the rearmost one
  const tail = new THREE.Vector3();
  let n = 0;
  for (const g of geometries) {
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      if (Math.abs(v.x) < 0.2 * SHIP_SIZE * 0.25 && v.z < rearZ + 0.22) {
        tail.add(v);
        n++;
      }
    }
  }
  anchors.tail.copy(tail.divideScalar(Math.max(n, 1)));
  return { geometries, radius, anchors };
}

const PLAN = new THREE.CatmullRomCurve3(
  FLIGHT_KEYS.map(([, x, y, d]) => new THREE.Vector3(x, y, d)),
  false,
  "centripetal",
);

// scratch objects, reused every frame (no per-frame allocation)
const _plan = new THREE.Vector3();
const _p0 = new THREE.Vector3();
const _p1 = new THREE.Vector3();
const _ray = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _look = new THREE.Vector3();
const _bank = new THREE.Quaternion();
const _v = new THREE.Vector3();
const FACE_CAMERA = new THREE.Vector3(0, 0, 1);

/** point of the flight path at scroll stage `u` (screen x, screen y, depth) */
function planPoint(u: number, out: THREE.Vector3) {
  let i = 0;
  while (i < FLIGHT_KEYS.length - 2 && u >= FLIGHT_KEYS[i + 1][0]) i++;
  const u0 = FLIGHT_KEYS[i][0];
  const u1 = FLIGHT_KEYS[i + 1][0];
  const frac = THREE.MathUtils.clamp((u - u0) / (u1 - u0), 0, 1);
  // CatmullRomCurve3.getPoint is indexed by control point, so this honours the uneven stage spacing
  return PLAN.getPoint((i + frac) / (FLIGHT_KEYS.length - 1), out);
}

/** direction of travel on screen at stage `u`, as an angle (x scaled to pixels via the aspect) */
function pathAngle(u: number, aspect: number) {
  const c = THREE.MathUtils.clamp(u, TANGENT_EPS, END_U - TANGENT_EPS);
  planPoint(c + TANGENT_EPS, _p1);
  planPoint(c - TANGENT_EPS, _p0);
  return Math.atan2(_p1.y - _p0.y, (_p1.x - _p0.x) * aspect);
}

interface FlameUniforms {
  uTime: { value: number };
  uLen: { value: number };
  uFade: { value: number };
}

/** screen position (x, y in -1..1) at `depth` in front of the camera -> world, written to `out` */
function placeOnScreen(camera: THREE.Camera, x: number, y: number, depth: number, out: THREE.Vector3) {
  camera.getWorldDirection(_fwd);
  _ray.set(x, y, 0.5).unproject(camera).sub(camera.position).normalize();
  return out.copy(camera.position).addScaledVector(_ray, depth / Math.max(_ray.dot(_fwd), 1e-3));
}

/** a frame of landmark positions; reused, the stage posts a structured clone of it */
const frame: AnchorSnapshot = {
  visible: false,
  points: { cupola: [0, 0], wingL: [0, 0], wingR: [0, 0], tail: [0, 0] },
};

/**
 * The blueprint spaceship: the CC0 model drawn as line art (hull edges over a faint fill),
 * plotted outward from its centre as the theme's `shape` goes 0 → 1, then flying across the
 * screen with the scroll (FLIGHT_KEYS), banking into each turn. Also reports where its landmarks are on screen so
 * the page callouts can follow it. Hidden while the portrait + flower are showing.
 * ponytail: the first reveal compiles two shader programs on the spot; precompile them
 * (gl.compileAsync) if that hitch is ever visible. Callouts ignore occlusion by the hull.
 */
function ShipModelImpl() {
  const group = useRef<THREE.Group>(null);
  const flight = useRef({ t: 0, stage: 0, bank: 0, dir: new THREE.Vector3(-1, -1, 0).normalize(), seeded: false });
  const wasVisible = useRef(false);
  const { scene } = useGLTF(SHIP_URL, false, false);

  const { root, radius, anchors, dispose } = useMemo(() => {
    const { geometries, radius, anchors } = bake(scene);
    const lineMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: stageTheme.current.inkA }, uReveal: { value: 0 } },
      vertexShader,
      fragmentShader: fragmentShader("0.95", "1.0"),
      transparent: true,
      depthWrite: false,
    });
    const fillMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: stageTheme.current.inkB }, uReveal: lineMat.uniforms.uReveal },
      vertexShader,
      fragmentShader: fragmentShader("0.3", "0.0"),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const root = new THREE.Group();
    const owned: THREE.BufferGeometry[] = [];
    for (const g of geometries) {
      const edges = new THREE.EdgesGeometry(g, 28);
      owned.push(g, edges);
      root.add(new THREE.Mesh(g, fillMat), new THREE.LineSegments(edges, lineMat));
    }

    // Engine flames: two nested wire cones tapering backward from each nozzle. Length and flicker
    // are driven per frame through these shared uniforms (a longer flame while the page scrolls).
    const flame: FlameUniforms = { uTime: { value: 0 }, uLen: { value: 0.55 }, uFade: { value: 0 } };
    root.userData.flame = flame;
    const flameMats: THREE.ShaderMaterial[] = [];
    const flameVertex = /* glsl */ `
      uniform float uTime;
      uniform float uLen;
      uniform float uLenK;
      uniform float uPhase;
      varying float vT;
      void main(){
        vec3 p = position;
        float t = clamp(-p.z, 0.0, 1.0);
        float flick = 1.0 + 0.12 * sin(uTime * 31.0 + uPhase) + 0.07 * sin(uTime * 53.0 + t * 5.0 + uPhase * 2.0);
        p.z *= uLen * uLenK * flick;
        p.xy *= 1.0 + 0.1 * sin(uTime * 41.0 + t * 8.0 + uPhase);
        vT = t;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`;
    const flameFragment = (alpha: string) => /* glsl */ `
      uniform vec3 uColor;
      uniform float uFade;
      varying float vT;
      void main(){
        float a = uFade * (1.0 - vT * 0.85) * ${alpha};
        gl_FragColor = vec4(mix(uColor, vec3(1.0), (1.0 - vT) * 0.5), a);
        #include <colorspace_fragment>
      }`;
    // nozzle positions measured from the model's rear vertices (scene units, nose = +Z)
    const NOZZLES: readonly (readonly [number, number, number])[] = [
      [-0.16, 0.04, -1.4],
      [0.16, 0.04, -1.4],
    ];
    const LAYERS = [
      { radius: 0.1, lenK: 1, color: stageTheme.current.inkD },
      { radius: 0.045, lenK: 0.6, color: stageTheme.current.inkA },
    ] as const;
    NOZZLES.forEach(([x, y, z], n) => {
      LAYERS.forEach((layer) => {
        const cone = new THREE.ConeGeometry(layer.radius, 1, 10, 5, true).rotateX(-Math.PI / 2).translate(0, 0, -0.5);
        const wire = new THREE.WireframeGeometry(cone);
        owned.push(cone, wire);
        const make = (alpha: string, side: THREE.Side) => {
          const mat = new THREE.ShaderMaterial({
            uniforms: { ...flame, uLenK: { value: layer.lenK }, uPhase: { value: n * 2.1 }, uColor: { value: layer.color } },
            vertexShader: flameVertex,
            fragmentShader: flameFragment(alpha),
            transparent: true,
            depthWrite: false,
            side,
          });
          flameMats.push(mat);
          return mat;
        };
        const lines = new THREE.LineSegments(wire, make("0.9", THREE.FrontSide));
        const fill = new THREE.Mesh(cone, make("0.3", THREE.DoubleSide));
        lines.position.set(x, y, z);
        fill.position.set(x, y, z);
        root.add(fill, lines);
      });
    });

    return {
      root,
      radius,
      anchors,
      dispose: () => {
        owned.forEach((g) => g.dispose());
        lineMat.dispose();
        fillMat.dispose();
        flameMats.forEach((m) => m.dispose());
      },
    };
  }, [scene]);
  useEffect(() => dispose, [dispose]);

  useFrame((state, rawDelta) => {
    const g = group.current;
    if (!g) return;
    const reveal = THREE.MathUtils.smoothstep(stageTheme.shape, 0.25, 1) * (radius + 0.5);
    // every material in the ship shares the one reveal uniform
    ((g.children[0] as THREE.Mesh).material as THREE.ShaderMaterial).uniforms.uReveal.value = reveal;
    g.visible = reveal > 0.001;
    if (!g.visible) {
      if (wasVisible.current) {
        wasVisible.current = false;
        frame.visible = false;
        shipAnchors.emit(frame);
      }
      return;
    }
    wasVisible.current = true;

    const dt = Math.min(rawDelta, 0.05); // a long frame must not jump the ship
    const f = flight.current;
    if (!f.seeded) {
      f.stage = sceneSignals.stage; // switch on mid-page: start where the page is, not at the hero
      f.seeded = true;
    }
    f.t += dt * stageTheme.tempo;
    // the ship is a function of the scroll alone; damping only gives it a little inertia
    const prevStage = f.stage;
    f.stage = THREE.MathUtils.damp(f.stage, sceneSignals.stage, STAGE_SMOOTHING, dt);
    const u = THREE.MathUtils.clamp(f.stage, 0, END_U);
    const aspect = (state.camera as THREE.PerspectiveCamera).aspect;

    planPoint(u, _plan);
    // portrait screens: a smaller ship, perched in the upper part of the screen above the copy
    const portrait = THREE.MathUtils.clamp((1 - aspect) / 0.5, 0, 1); // 0 on landscape, 1 on a phone
    _plan.y += 0.5 * portrait;
    g.scale.setScalar(THREE.MathUtils.clamp(aspect / 1.3, 0.4, 1));
    placeOnScreen(state.camera, _plan.x, _plan.y, _plan.z, g.position);

    // nose along the path's direction of travel (so scrolling back up retraces the flight)
    const angle = pathAngle(u, aspect);
    f.dir.set(Math.cos(angle), Math.sin(angle), 0);

    // banking, as in three.js' rollercoaster example: heading change between the tangents either side
    let headingChange = pathAngle(u + TURN_SPAN, aspect) - pathAngle(u - TURN_SPAN, aspect);
    if (headingChange > Math.PI) headingChange -= Math.PI * 2;
    if (headingChange < -Math.PI) headingChange += Math.PI * 2;
    const target = -Math.atan(headingChange * BANK_GAIN) * BANK_SCALE;
    f.bank += (target - f.bank) * (1 - Math.exp(-dt * BANK_SMOOTHING));

    g.up.copy(FACE_CAMERA); // top of the hull toward the camera: a plan view, like a drawing sheet
    _bank.setFromAxisAngle(f.dir, f.bank);
    g.up.applyQuaternion(_bank);
    g.lookAt(_look.copy(g.position).add(f.dir)); // a non-camera Object3D points +Z at its target: nose first
    g.rotateX(0.2); // a touch of pitch so the hull keeps some depth

    // engine flames: longer while the page scrolls (thrust), a short flicker at rest
    const speed = Math.abs(f.stage - prevStage) / Math.max(dt, 1e-3);
    const flame = g.userData.flame as FlameUniforms;
    flame.uTime.value = f.t;
    flame.uLen.value = THREE.MathUtils.damp(flame.uLen.value, 0.55 + Math.min(speed, 1.5) * 0.9, 6, dt);
    flame.uFade.value = THREE.MathUtils.smoothstep(stageTheme.shape, 0.8, 1);

    // landmarks → screen, for the page callouts
    g.updateMatrixWorld(true);
    state.camera.updateMatrixWorld();
    for (const id of ANCHOR_IDS) {
      _v.copy(anchors[id]);
      g.localToWorld(_v);
      _v.project(state.camera);
      frame.points[id][0] = (_v.x + 1) / 2;
      frame.points[id][1] = (1 - _v.y) / 2;
    }
    frame.visible = stageTheme.shape > 0.8;
    shipAnchors.emit(frame);
  });

  return <primitive ref={group} object={root} visible={false} />;
}

export const ShipModel = memo(ShipModelImpl);

useGLTF.preload(SHIP_URL, false, false);
