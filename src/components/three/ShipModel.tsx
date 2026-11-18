"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { stageTheme } from "@/lib/three/stageTheme";
import { sceneSignals } from "@/lib/three/sceneSignals";
import { damp, dampQ } from "maath/easing";
import { SimplexNoise } from "three/examples/jsm/math/SimplexNoise.js";
import { cinema } from "@/lib/three/cinema";
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
const TURN_SPAN = 0.07; // stage units either side of the ship used to measure the bend
const TANGENT_EPS = 0.02;
/** Stage at the very bottom of the page (SceneBackdropLoader makes it exactly this on any screen). */
const END_U = 5;

/**
 * Smoothness, after the animation principles "slow in and slow out", "arcs" and "follow through"
 * (Thomas & Johnston, The Illusion of Life). The ship does not copy the scroll: it chases it
 * through maath's `damp` (pmndrs, MIT) — a critically damped spring with a speed cap — so it
 * eases away, cruises and settles in its own time. Its attitude follows through `dampQ`.
 */
const FOLLOW_TIME = 0.75; // s to catch up with the scroll
const FOLLOW_MAX_SPEED = 1.3; // sections per second, however hard the page is flung
const TURN_TIME = 0.4; // s for the hull to come round to a new heading
const BANK_TIME = 0.5;
/** handheld sway while flying, as a fraction of the screen (simplex noise, like drei's CameraShake) */
const SWAY = 0.012;
const noise = new SimplexNoise();

/**
 * [stage, screen x, screen y, distance from the camera], x/y in -1..1 (+y up); |x| > 1 is off
 * screen. The page rests at stage 0, 0.89, 1.89 … 5 (hero … contact), so those are the visible
 * parking spots; the keys between them are the swings: off the left edge, off the right edge,
 * off the left again, up out of the top (Projects covers the page), and a hook before the last
 * leg drops the ship straight down onto Contact.
 */
const FLIGHT_KEYS: readonly (readonly [number, number, number, number])[] = [
  [0.0, 0.5, 0.05, 5.7], // hero: top-down, nose to the lower left
  [0.45, -0.95, -0.25, 4.4], // one wide arc out to the left edge
  [0.89, 0.52, 0.18, 6.2], // about
  [1.4, 1.15, -0.2, 4.4], // out past the right edge
  [1.89, 0.52, 0.12, 6.2], // skills
  [2.4, -1.0, 0.15, 4.4], // left again
  [2.89, 0.52, 0.08, 6.2], // experience
  [3.4, 0.75, 1.2, 5.4], // climbing out of the top
  [3.89, 0.5, 1.6, 6.0], // projects: parked above the top edge
  [4.45, -0.25, 1.25, 5.2], // the hook
  [4.75, 0.0, 0.75, 4.6], // lined up: the last stretch is a straight drop
  [5.0, 0.0, 0.05, 3.7], // contact: down to the centre and in close, filling the frame
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
const _pose = new THREE.Quaternion();
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
  speed: 0,
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
function ShipModelImpl({ calm }: { calm: boolean }) {
  useEffect(() => {
    cinema.calm = calm;
  }, [calm]);
  const group = useRef<THREE.Group>(null);
  const flight = useRef({
    t: 0,
    stage: 0,
    bank: 0,
    heading: 1,
    dir: new THREE.Vector3(-1, -1, 0).normalize(),
    quat: new THREE.Quaternion(),
    seeded: false,
    posed: false,
  });
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
        frame.speed = 0;
        cinema.speed = 0;
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
    // the ship chases the scroll through a critically damped spring with a speed cap (see FOLLOW_*)
    const prevStage = f.stage;
    damp(f, "stage", THREE.MathUtils.clamp(sceneSignals.stage, 0, END_U), FOLLOW_TIME, dt, FOLLOW_MAX_SPEED, undefined, 1e-4);
    const u = THREE.MathUtils.clamp(f.stage, 0, END_U);
    const velocity = (f.stage - prevStage) / Math.max(dt, 1e-3); // sections per second, signed
    const speed = Math.min(Math.abs(velocity) / FOLLOW_MAX_SPEED, 1);
    if (Math.abs(velocity) > 0.02) f.heading = Math.sign(velocity); // scrolling back up turns the ship around
    const aspect = (state.camera as THREE.PerspectiveCamera).aspect;

    planPoint(u, _plan);
    // a slow handheld sway while flying, none at rest
    const sway = calm ? 0 : SWAY * speed * speed;
    _plan.x += noise.noise(f.t * 0.45, 1) * sway;
    _plan.y += noise.noise(f.t * 0.4, 7) * sway;
    // portrait screens: a smaller ship, perched in the upper part of the screen above the copy
    const portrait = THREE.MathUtils.clamp((1 - aspect) / 0.5, 0, 1); // 0 on landscape, 1 on a phone
    _plan.y += 0.5 * portrait;
    g.scale.setScalar(THREE.MathUtils.clamp(aspect / 1.3, 0.4, 1));
    placeOnScreen(state.camera, _plan.x, _plan.y, _plan.z, g.position);

    // nose along the direction of travel
    const angle = pathAngle(u, aspect) + (f.heading < 0 ? Math.PI : 0);
    f.dir.set(Math.cos(angle), Math.sin(angle), 0);

    // banking, as in three.js' rollercoaster example: heading change between the tangents either
    // side — here eased in, and levelled out again as the ship slows to a stop
    let headingChange = pathAngle(u + TURN_SPAN, aspect) - pathAngle(u - TURN_SPAN, aspect);
    if (headingChange > Math.PI) headingChange -= Math.PI * 2;
    if (headingChange < -Math.PI) headingChange += Math.PI * 2;
    const roll = -Math.atan(headingChange * BANK_GAIN) * BANK_SCALE * f.heading * Math.min(speed * 2.5, 1);
    damp(f, "bank", roll, BANK_TIME, dt);

    g.up.copy(FACE_CAMERA); // top of the hull toward the camera: a plan view, like a drawing sheet
    _bank.setFromAxisAngle(f.dir, f.bank);
    g.up.applyQuaternion(_bank);
    g.lookAt(_look.copy(g.position).add(f.dir)); // a non-camera Object3D points +Z at its target: nose first
    g.rotateX(0.2); // a touch of pitch so the hull keeps some depth
    // follow-through: the hull comes round to that pose through a spring instead of snapping to it
    _pose.copy(g.quaternion);
    if (!f.posed) {
      f.quat.copy(_pose);
      f.posed = true;
    }
    dampQ(f.quat, _pose, TURN_TIME, dt);
    g.quaternion.copy(f.quat);

    // engine flames: longer under thrust, a short flicker at rest
    const flame = g.userData.flame as FlameUniforms;
    flame.uTime.value = f.t;
    flame.uLen.value = THREE.MathUtils.damp(flame.uLen.value, 0.55 + speed * 1.2, 6, dt);
    flame.uFade.value = THREE.MathUtils.smoothstep(stageTheme.shape, 0.8, 1);

    // cinema signals: how fast the flight is (0..1) and the roll, for the camera and the page overlay
    damp(cinema, "speed", speed, 0.45, dt);
    cinema.bank = f.bank;
    frame.speed = cinema.speed;

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
