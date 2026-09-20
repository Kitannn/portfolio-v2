// THE COLOSSUS — the five-minute boss, and the GNX it turns into halfway through.
//
// Three phases:
//   1  1000 → 500 HP   walks you down. Stomp, left-arm machine gun, right-arm homing rockets.
//                      Five weak points: head, both hands, both feet. Breaking one disables what
//                      it drives for 30 seconds.
//   2   500 → 250 HP   folds into a black '87 Buick GNX, runs out ahead of you and fires backwards.
//                      No weak points — you just have to out-drive it.
//   3   250 →   0 HP   unfolds, shield restored, and adds a sweeping chest beam.
//
// Weak points are separate hit targets rather than a damage multiplier on the body, so the
// weapon's existing hit resolution handles them with no special cases.
import * as THREE from "three";
import { mergeParts, body as loftBody, wedge } from "./loft.js";
import { angleDelta, clamp, damp, lerp, rand, TAU } from "./util.js";
import { ARENA } from "./world.js";

export const BOSS_AT = 300;        // seconds before it arrives
const MAX_HP = 1000;
const SHIELD = 250;
const PHASE2_AT = 500;
const PHASE3_AT = 250;

const STOMP_DAMAGE = 30;
const MG_DAMAGE = 5;
const ROCKET_DAMAGE = 15;
const BEAM_DAMAGE = 34;            // per second in the beam
const WEAK_HP = 130;               // damage to break one weak point
const DISABLE_TIME = 30;

const WALK_SPEED = 9.5;
const GNX_SPEED = 42;
const MAX_ROCKETS = 14;

// ---- materials ------------------------------------------------------------------
const armour = () => new THREE.MeshStandardMaterial({ color: 0x3a4050, roughness: 0.5, metalness: 0.68, flatShading: true });
const plate = () => new THREE.MeshStandardMaterial({ color: 0x1b1e26, roughness: 0.82, metalness: 0.45, flatShading: true });
const accent = () => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff3b2e, emissiveIntensity: 2.4, roughness: 1 });
const weakMat = () => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffc94a, emissiveIntensity: 2.8, roughness: 1 });

// ---- colossus pieces --------------------------------------------------------------
// Everything is built around a 16 m standing height, with the hips as the root joint.
function torsoGeo() {
  return mergeParts([
    { geo: wedge(4.4, 2.2, 5.2, 2.6, 4.6), pos: [0, 2.3, 0], mat: 0 },          // chest, wider at the top
    { geo: new THREE.BoxGeometry(4.9, 0.7, 2.9), pos: [0, 0.2, 0], mat: 2 },    // waist ring
    { geo: new THREE.BoxGeometry(2.0, 1.4, 0.5), pos: [0, 3.0, 1.45], mat: 2 }, // chest housing
    { geo: new THREE.BoxGeometry(5.6, 1.1, 2.4), pos: [0, 4.3, -0.2], mat: 0 }, // collar
    { geo: new THREE.BoxGeometry(0.7, 3.4, 0.4), pos: [0, 2.4, -1.5], mat: 2 }, // spine
    { geo: new THREE.BoxGeometry(4.2, 0.24, 0.24), pos: [0, 1.1, 1.35], mat: 1 },
    { geo: new THREE.BoxGeometry(0.24, 1.6, 0.24), pos: [-2.3, 2.6, 1.2], mat: 1 },
    { geo: new THREE.BoxGeometry(0.24, 1.6, 0.24), pos: [2.3, 2.6, 1.2], mat: 1 },
  ]);
}

function thighGeo() {
  return mergeParts([
    { geo: wedge(1.9, 1.9, 1.5, 1.5, 3.6), pos: [0, -1.8, 0], rot: [Math.PI / 2, 0, 0], mat: 0 },
    { geo: new THREE.BoxGeometry(2.2, 1.0, 2.2), pos: [0, -0.1, 0], mat: 2 },     // hip ball
    { geo: new THREE.BoxGeometry(0.22, 2.6, 0.22), pos: [0, -1.8, 0.85], mat: 1 },
  ]);
}

function shinGeo() {
  return mergeParts([
    { geo: new THREE.BoxGeometry(1.7, 1.2, 1.7), pos: [0, -0.2, 0], mat: 2 },      // knee
    { geo: wedge(1.5, 1.5, 1.2, 1.4, 3.9), pos: [0, -2.2, 0], rot: [Math.PI / 2, 0, 0], mat: 0 },
    { geo: new THREE.BoxGeometry(0.9, 0.9, 0.5), pos: [0, -1.4, 0.9], mat: 2 },
  ]);
}

function footGeo() {
  return mergeParts([
    { geo: wedge(2.4, 0.9, 2.0, 0.6, 3.6), pos: [0, 0.5, 0.5], mat: 0 },
    { geo: new THREE.BoxGeometry(2.5, 0.35, 3.4), pos: [0, 0.12, 0.4], mat: 2 },   // sole
    { geo: new THREE.BoxGeometry(1.5, 0.22, 0.22), pos: [0, 0.75, 2.05], mat: 1 }, // toe light
  ]);
}

function armGeo(len, w) {
  return mergeParts([
    { geo: new THREE.BoxGeometry(w * 1.3, w * 1.3, w * 1.3), pos: [0, 0, 0], mat: 2 },
    { geo: wedge(w, w, w * 0.82, w * 0.82, len), pos: [0, -len / 2, 0], rot: [Math.PI / 2, 0, 0], mat: 0 },
  ]);
}

function pauldronGeo() {
  return mergeParts([
    { geo: wedge(2.4, 2.0, 1.6, 1.3, 2.2), pos: [0, 0.2, 0], rot: [Math.PI / 2, 0, 0], mat: 0 },
    { geo: new THREE.BoxGeometry(1.6, 0.22, 0.22), pos: [0, 0.95, 0], mat: 1 },
  ]);
}

function headGeo() {
  return mergeParts([
    { geo: wedge(1.7, 1.5, 1.4, 1.2, 1.9), pos: [0, 0, 0.1], rot: [Math.PI / 2, 0, 0], mat: 0 },
    { geo: new THREE.BoxGeometry(1.5, 0.42, 0.3), pos: [0, 0.15, 0.95], mat: 3 },   // visor — the weak point
    { geo: new THREE.BoxGeometry(0.3, 1.0, 0.5), pos: [-0.85, 0.3, 0.2], mat: 2 },
    { geo: new THREE.BoxGeometry(0.3, 1.0, 0.5), pos: [0.85, 0.3, 0.2], mat: 2 },
  ]);
}

function minigunGeo() {
  const P = [
    { geo: new THREE.BoxGeometry(1.5, 1.5, 1.6), pos: [0, -0.3, 0.4], mat: 2 },
    { geo: new THREE.CylinderGeometry(0.55, 0.62, 2.6, 10), pos: [0, -0.3, 2.1], rot: [Math.PI / 2, 0, 0], mat: 0 },
    { geo: new THREE.BoxGeometry(1.2, 0.9, 1.0), pos: [0.9, -0.3, -0.1], mat: 2 },   // ammo drum
  ];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    P.push({ geo: new THREE.CylinderGeometry(0.14, 0.14, 2.9, 6), pos: [Math.cos(a) * 0.34, -0.3 + Math.sin(a) * 0.34, 2.3], rot: [Math.PI / 2, 0, 0], mat: 2 });
  }
  P.push({ geo: new THREE.SphereGeometry(0.62, 10, 8), pos: [0, -0.3, -0.5], mat: 3 });  // the hand core
  return mergeParts(P);
}

function podGeo() {
  const P = [
    { geo: new THREE.BoxGeometry(1.8, 1.6, 2.1), pos: [0, -0.3, 0.5], mat: 2 },
  ];
  for (const x of [-0.45, 0.45]) for (const y of [-0.85, -0.3, 0.25]) {
    P.push({ geo: new THREE.CylinderGeometry(0.22, 0.22, 2.0, 8), pos: [x, y, 1.0], rot: [Math.PI / 2, 0, 0], mat: 0 });
    P.push({ geo: new THREE.SphereGeometry(0.15, 6, 5), pos: [x, y, 1.9], mat: 1 });
  }
  P.push({ geo: new THREE.SphereGeometry(0.62, 10, 8), pos: [0, -0.3, -0.6], mat: 3 });
  return mergeParts(P);
}

// ---- the GNX --------------------------------------------------------------------
// 1987 Buick GNX: 5.08 m long, 1.85 wide, 1.39 tall. Squared-off everything, formal roofline,
// blistered arches, and matte black on matte black.
const GNX_SHELL = [
  [-2.60, 0.68, 0.34, 0.90, 0.10],
  [-2.48, 0.82, 0.30, 0.98, 0.12],
  [-2.20, 0.90, 0.26, 1.02, 0.13],
  [-1.90, 0.93, 0.25, 1.03, 0.13],
  [-1.72, 0.94, 0.25, 1.03, 0.13, 0.34],
  [-1.55, 0.95, 0.25, 1.03, 0.13, 0.56],
  [-1.32, 0.95, 0.25, 1.03, 0.13, 0.60],   // rear axle
  [-1.08, 0.94, 0.25, 1.03, 0.13, 0.56],
  [-0.92, 0.92, 0.24, 1.02, 0.13, 0.34],
  [-0.70, 0.90, 0.23, 1.02, 0.13],
  [ 0.10, 0.89, 0.22, 1.01, 0.13],
  [ 0.72, 0.89, 0.22, 1.00, 0.13],
  [ 0.98, 0.90, 0.23, 0.99, 0.13, 0.32],
  [ 1.20, 0.92, 0.24, 0.98, 0.13, 0.56],
  [ 1.42, 0.93, 0.25, 0.97, 0.13, 0.60],   // front axle
  [ 1.64, 0.92, 0.25, 0.96, 0.13, 0.55],
  [ 1.84, 0.90, 0.25, 0.95, 0.13, 0.32],
  [ 2.10, 0.88, 0.26, 0.93, 0.12],
  [ 2.36, 0.84, 0.28, 0.91, 0.11],
  [ 2.50, 0.74, 0.32, 0.88, 0.10],         // the nose is nearly square — that is the whole look
];

const GNX_CABIN = [
  [ 0.74, 0.80, 0.98, 1.01, 0.04],
  [ 0.46, 0.82, 0.99, 1.24, 0.06],
  [ 0.20, 0.83, 1.00, 1.38, 0.07],
  [-0.60, 0.83, 1.00, 1.39, 0.07],          // long flat roof
  [-1.05, 0.82, 1.00, 1.37, 0.07],
  [-1.30, 0.79, 0.99, 1.22, 0.06],
  [-1.52, 0.76, 0.98, 1.05, 0.05],          // near-vertical backlight
];

export function createBoss(scene, fx, hooks = {}) {
  const A = armour(), P = plate(), C = accent(), W = weakMat();
  const mats = [A, C, P, W];   // slots: 0 armour / 1 accent / 2 plate / 3 weak point

  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  // ---- colossus rig ----
  const colossus = new THREE.Group();
  root.add(colossus);

  const hips = new THREE.Group();
  hips.position.y = 9.0;
  colossus.add(hips);

  const torso = new THREE.Mesh(torsoGeo(), mats);
  torso.castShadow = true;
  hips.add(torso);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 5.4, 0.2);
  torso.add(headPivot);
  headPivot.add(new THREE.Mesh(headGeo(), mats));

  // chest core — dark until phase 3, then it is the beam's tell
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), new THREE.MeshStandardMaterial({ color: 0x0a0b0e, emissive: 0xff2d1e, emissiveIntensity: 0.15, roughness: 0.6 }));
  core.position.set(0, 3.0, 1.55);
  torso.add(core);

  function buildArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 3.1, 4.2, 0);
    torso.add(shoulder);
    const pauldron = new THREE.Mesh(pauldronGeo(), mats);
    pauldron.rotation.z = side * 0.18;
    shoulder.add(pauldron);

    const upper = new THREE.Group();
    upper.position.y = -0.4;
    shoulder.add(upper);
    upper.add(new THREE.Mesh(armGeo(3.4, 1.05), mats));

    const fore = new THREE.Group();
    fore.position.y = -3.4;
    upper.add(fore);
    fore.add(new THREE.Mesh(armGeo(2.9, 0.92), mats));

    const hand = new THREE.Group();
    hand.position.y = -2.9;
    hand.rotation.x = -Math.PI / 2;      // the weapon points forward, not down
    fore.add(hand);
    hand.add(new THREE.Mesh(side < 0 ? minigunGeo() : podGeo(), mats));

    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, -0.3, side < 0 ? 3.4 : 2.1);
    hand.add(muzzle);

    return { shoulder, upper, fore, hand, muzzle };
  }
  const armL = buildArm(-1);
  const armR = buildArm(1);

  function buildLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 1.7, -0.3, 0);
    hips.add(hip);
    hip.add(new THREE.Mesh(thighGeo(), mats));

    const knee = new THREE.Group();
    knee.position.y = -3.6;
    hip.add(knee);
    knee.add(new THREE.Mesh(shinGeo(), mats));

    const ankle = new THREE.Group();
    ankle.position.y = -4.1;
    knee.add(ankle);
    ankle.add(new THREE.Mesh(footGeo(), mats));

    return { hip, knee, ankle };
  }
  const legL = buildLeg(-1);
  const legR = buildLeg(1);

  // ---- bubble shield ----
  const shieldMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(10.6, 3),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uHealth: { value: 1 }, uHit: { value: 0 } },
      vertexShader: `
        varying vec3 vN; varying vec3 vP;
        void main(){ vN = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        uniform float uTime, uHealth, uHit; varying vec3 vN; varying vec3 vP;
        void main(){
          // rim-lit hex weave that thins out as the shield is chewed down
          float rim = pow(1.0 - abs(vN.z), 2.6);
          float band = smoothstep(0.45, 0.55, sin(vP.y * 2.4 + uTime * 1.3) * 0.5 + 0.5);
          float a = (rim * 0.55 + band * 0.10) * (0.25 + uHealth * 0.75) + uHit * 0.45;
          vec3 col = mix(vec3(0.35, 0.72, 1.0), vec3(1.0, 0.9, 0.5), uHit);
          gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
        }
      `,
    })
  );
  shieldMesh.position.y = 9.0;
  root.add(shieldMesh);

  // ---- GNX ----
  const gnx = new THREE.Group();
  gnx.visible = false;
  root.add(gnx);
  // The GNX was famously the blackest car anyone sold. Metalness and clearcoat both had to come
  // down hard, or the environment map lands on the flat roof and turns it gold.
  const gnxPaint = new THREE.MeshPhysicalMaterial({ color: 0x0a0a0c, metalness: 0.10, roughness: 0.52, clearcoat: 0.25, clearcoatRoughness: 0.35, envMapIntensity: 0.3 });
  const gnxWell = new THREE.MeshStandardMaterial({ color: 0x08090b, roughness: 1 });
  const gnxGlass = new THREE.MeshPhysicalMaterial({ color: 0x04050a, roughness: 0.2, envMapIntensity: 0.25, side: THREE.DoubleSide });
  {
    const shell = new THREE.Mesh(loftBody(GNX_SHELL, { dark: new Set([0, 1, 2, 11, 12, 13]) }), [gnxPaint, gnxWell]);
    shell.castShadow = true;
    gnx.add(shell);
    gnx.add(new THREE.Mesh(loftBody(GNX_CABIN), gnxPaint));
    // squared-off details: quad lamps, the hood bulge, blistered arches, and the pods it fights with
    const trimM = new THREE.MeshStandardMaterial({ color: 0x0e0f12, roughness: 0.8, metalness: 0.3 });
    const lampM = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffd9a0, emissiveIntensity: 1.1, roughness: 1 });
    const tailM = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff2d3a, emissiveIntensity: 1.6, roughness: 1 });
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 0.12), trimM);
    grille.position.set(0, 0.80, 2.52);       // Object3D.position is read-only; it has to be set in place
    gnx.add(grille);
    for (const sx of [-1, 1]) for (const dx of [0.30, 0.62]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.20, 0.10), lampM);
      l.position.set(sx * dx, 0.79, 2.52);
      gnx.add(l);
    }
    const bulge = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.09, 1.30), gnxPaint);
    bulge.position.set(0, 0.99, 1.70);
    gnx.add(bulge);
    for (const sx of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.22, 0.10), tailM);
      lamp.position.set(sx * 0.42, 0.88, -2.62);
      gnx.add(lamp);
      // side-mounted machine gun (left) and missile rack (right)
      const pod = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 1.5), trimM);
      pod.position.set(sx * 1.02, 0.86, -0.3);
      gnx.add(pod);
      for (let i = 0; i < 3; i++) {
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.3, 7), trimM);
        tube.rotation.x = Math.PI / 2;
        tube.position.set(sx * 1.10, 0.74 + i * 0.18, -0.4);
        gnx.add(tube);
      }
    }
    for (const [x, z] of [[-0.93, 1.42], [0.93, 1.42], [-0.95, -1.32], [0.95, -1.32]]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.40, 0.30, 16), gnxWell);
      t.rotation.z = Math.PI / 2;
      t.position.set(x, 0.40, z);
      t.castShadow = true;
      gnx.add(t);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.32, 12), new THREE.MeshStandardMaterial({ color: 0x4a4e57, roughness: 0.4, metalness: 0.9 }));
      rim.rotation.z = Math.PI / 2;
      rim.position.set(x * 1.03, 0.40, z);
      gnx.add(rim);
    }
    const wind = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.02, 0.92), gnxGlass);
    wind.position.set(0, 1.20, 0.46);
    wind.rotation.x = 0.52;
    gnx.add(wind);
  }

  // ---- chest beam ----
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 3.4, 120, 14, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff2d1e, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false })
  );
  beam.rotation.x = Math.PI / 2;
  beam.position.z = 60;
  const beamPivot = new THREE.Group();
  beamPivot.position.set(0, 3.0, 1.6);
  beamPivot.add(beam);
  torso.add(beamPivot);

  // ---- stomp warning ring ----
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.72, 1, 40),
    new THREE.MeshBasicMaterial({ color: 0xff3b2e, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  scene.add(ring);

  // ---- rockets ----
  const rocketGeo = mergeParts([
    { geo: new THREE.CylinderGeometry(0.22, 0.22, 1.5, 8), rot: [Math.PI / 2, 0, 0], mat: 0 },
    { geo: new THREE.ConeGeometry(0.22, 0.6, 8), pos: [0, 0, 0.95], rot: [Math.PI / 2, 0, 0], mat: 0 },
    { geo: new THREE.SphereGeometry(0.2, 8, 6), pos: [0, 0, -0.85], mat: 1 },
  ]);
  const rocketMesh = new THREE.InstancedMesh(rocketGeo, [plate(), accent()], MAX_ROCKETS);
  rocketMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  rocketMesh.frustumCulled = false;
  scene.add(rocketMesh);
  const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0).setPosition(0, -9999, 0);
  for (let i = 0; i < MAX_ROCKETS; i++) rocketMesh.setMatrixAt(i, HIDDEN);

  // Rockets double as hit targets, so the weapon can shoot them down with no extra plumbing.
  const rockets = Array.from({ length: MAX_ROCKETS }, () => ({
    kind: "rocket", alive: false, radius: 1.0,
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0,
  }));

  // ---- weak points + body, as hit targets ----
  const mk = (id, node, radius, weak, offset = [0, 0, 0]) => ({
    kind: "boss", id, node, radius, weak, offset: new THREE.Vector3(...offset),
    alive: false, pos: new THREE.Vector3(), wp: WEAK_HP, disabledFor: 0,
  });
  const partBody = mk("body", torso, 5.4, false, [0, 2.4, 0]);
  const partHead = mk("head", headPivot, 1.9, true, [0, 0.2, 0.4]);
  const partHandL = mk("handL", armL.hand, 1.9, true, [0, -0.3, 0.2]);
  const partHandR = mk("handR", armR.hand, 1.9, true, [0, -0.3, 0.2]);
  const partFootL = mk("footL", legL.ankle, 2.4, true, [0, 0.5, 0.4]);
  const partFootR = mk("footR", legR.ankle, 2.4, true, [0, 0.5, 0.4]);
  const weakPoints = [partHead, partHandL, partHandR, partFootL, partFootR];
  const bodyParts = [partBody, ...weakPoints];

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();

  const b = {
    active: false,
    dying: false,
    phase: 0,
    hp: MAX_HP, maxHp: MAX_HP,
    shield: SHIELD, maxShield: SHIELD,
    pos: new THREE.Vector3(),
    yaw: 0,
    // every target the weapon should consider; boss parts flip `alive` rather than being spliced
    targets: [...bodyParts, ...rockets],

    reset() {
      b.active = false; b.dying = false; b.phase = 0;
      b.hp = MAX_HP; b.shield = SHIELD;
      b.pos.set(0, 0, 0); b.yaw = 0;
      for (const p of bodyParts) { p.alive = false; p.wp = WEAK_HP; p.disabledFor = 0; }
      for (const r of rockets) r.alive = false;
      for (let i = 0; i < MAX_ROCKETS; i++) rocketMesh.setMatrixAt(i, HIDDEN);
      rocketMesh.instanceMatrix.needsUpdate = true;
      root.visible = false;
      gnx.visible = false; colossus.visible = true; shieldMesh.visible = true;
      ring.material.opacity = 0;
      beam.material.opacity = 0;
      state = { name: "walk", t: 0 };
      mgBurst = 0; mgTimer = 0; rocketTimer = 0; stompTimer = 0; beamTimer = 0; walkCycle = 0; hitFlash = 0; morph = 0;
    },

    spawn(player) {
      b.reset();
      b.active = true;
      b.phase = 1;
      const a = rand(0, TAU);
      const r = Math.min(ARENA - 30, 60);
      b.pos.set(player.pos.x + Math.cos(a) * r, 0, player.pos.z + Math.sin(a) * r);
      if (Math.hypot(b.pos.x, b.pos.z) > ARENA - 20) b.pos.multiplyScalar((ARENA - 20) / Math.hypot(b.pos.x, b.pos.z));
      b.yaw = Math.atan2(player.pos.x - b.pos.x, player.pos.z - b.pos.z);
      root.visible = true;
      for (const p of bodyParts) p.alive = true;
      hooks.onSpawn?.();
    },

    // Damage routing. The shield eats everything until it is gone; after that a weak point's own
    // pool tracks alongside the boss's HP, and emptying it disables whatever that limb drives.
    hit(part, damage, crit, point) {
      if (!b.active || b.dying) return false;
      if (part.kind === "rocket") { killRocket(part, true); return false; }
      if (!part.alive) return false;

      hitFlash = 1;
      if (b.shield > 0) {
        b.shield = Math.max(0, b.shield - damage);
        shieldMesh.material.uniforms.uHit.value = 1;
        fx.spark(point, tmp.set(0, 1, 0), 0x7cc6ff, 3);
        if (b.shield === 0) {
          fx.explode(tmp2.copy(b.pos).setY(9.0), 3.2, 0x7cc6ff, 30);
          shieldMesh.visible = false;
          hooks.onShieldDown?.();
        }
        return false;
      }

      b.hp = Math.max(0, b.hp - damage);
      fx.spark(point, tmp.set(0, 1, 0), part.weak ? 0xffc94a : 0xff8a3c, part.weak ? 7 : 3);

      if (part.weak && part.disabledFor <= 0) {
        part.wp -= damage;
        if (part.wp <= 0) breakWeakPoint(part);
      }

      if (b.hp <= PHASE2_AT && b.phase === 1) enterPhase2();
      else if (b.hp <= PHASE3_AT && b.phase === 2) enterPhase3();
      if (b.hp <= 0) die();
      return b.hp <= 0;
    },

    update(dt, player, stats, camera) {
      if (!b.active) return;
      tick(dt, player);
      syncTargets();
      updateRockets(dt, player);
    },
  };

  // ---- internal state ----
  let state = { name: "walk", t: 0 };
  let mgBurst = 0, mgTimer = 0, rocketTimer = 0, stompTimer = 0, beamTimer = 0;
  let walkCycle = 0, hitFlash = 0, morph = 0;
  let playerRef = null;

  function breakWeakPoint(part) {
    part.disabledFor = DISABLE_TIME;
    part.wp = WEAK_HP;
    part.node.getWorldPosition(tmp);
    fx.explode(tmp, 1.9, 0xffc94a, 24);
    hooks.onWeakPoint?.(part.id);
    // a broken leg drops it to one knee: it can still shoot, but it cannot walk or stomp
    if (part.id === "footL" || part.id === "footR") state = { name: "kneel", t: 0 };
  }

  const disabled = (id) => bodyParts.find((p) => p.id === id)?.disabledFor > 0;
  const legsBroken = () => disabled("footL") || disabled("footR");

  function enterPhase2() {
    b.phase = 2;
    state = { name: "morphOut", t: 0 };
    hooks.onPhase?.(2);
  }

  function enterPhase3() {
    b.phase = 3;
    b.shield = SHIELD;                       // the shield comes back with it
    shieldMesh.visible = true;
    shieldMesh.material.uniforms.uHealth.value = 1;
    state = { name: "morphIn", t: 0 };
    core.material.emissiveIntensity = 0.6;
    hooks.onPhase?.(3);
  }

  function die() {
    b.dying = true;
    b.active = true;
    state = { name: "death", t: 0 };
    for (const p of bodyParts) p.alive = false;
    for (const r of rockets) if (r.alive) killRocket(r, false);
    hooks.onDeath?.();
  }

  // ---- rockets ----
  function fireRocket(from, player) {
    const r = rockets.find((x) => !x.alive);
    if (!r) return;
    r.alive = true;
    r.pos.copy(from);
    tmp.copy(player.pos).setY(1.0).sub(from).normalize();
    r.vel.copy(tmp).multiplyScalar(11).add(tmp2.set(rand(-6, 6), rand(4, 9), rand(-6, 6)));
    r.life = 7;
  }

  function killRocket(r, shotDown) {
    r.alive = false;
    fx.explode(r.pos, shotDown ? 0.8 : 0.6, shotDown ? 0xbfe6ff : 0xff6a3c, shotDown ? 10 : 6);
  }

  function updateRockets(dt, player) {
    for (let i = 0; i < MAX_ROCKETS; i++) {
      const r = rockets[i];
      if (!r.alive) { rocketMesh.setMatrixAt(i, HIDDEN); continue; }
      r.life -= dt;
      // steer toward the player, but only so hard — you can out-turn them
      tmp.copy(player.pos).setY(1.0).sub(r.pos).normalize().multiplyScalar(30);
      r.vel.lerp(tmp, damp(1.5, dt));
      if (r.vel.length() < 26) r.vel.setLength(lerp(r.vel.length(), 30, damp(1.2, dt)));
      r.pos.addScaledVector(r.vel, dt);

      if (r.pos.distanceTo(player.pos) < 2.6) {
        player.takeDamage(ROCKET_DAMAGE);
        hooks.onPlayerHit?.(ROCKET_DAMAGE);
        killRocket(r, false);
        rocketMesh.setMatrixAt(i, HIDDEN);
        continue;
      }
      if (r.life <= 0 || r.pos.y < 0.2) { killRocket(r, false); rocketMesh.setMatrixAt(i, HIDDEN); continue; }

      q.setFromUnitVectors(tmp.set(0, 0, 1), tmp2.copy(r.vel).normalize());
      rocketMesh.setMatrixAt(i, m4.compose(r.pos, q, scl.setScalar(1)));
    }
    rocketMesh.instanceMatrix.needsUpdate = true;
  }

  // keep every hit target's world position in step with the rig
  function syncTargets() {
    for (const p of bodyParts) {
      if (!p.alive) continue;
      p.node.updateWorldMatrix(true, false);
      p.pos.copy(p.offset).applyMatrix4(p.node.matrixWorld);
    }
  }

  // ---- the brain ----
  function tick(dt, player) {
    playerRef = player;
    state.t += dt;
    hitFlash = Math.max(0, hitFlash - dt * 3);
    shieldMesh.material.uniforms.uTime.value += dt;
    shieldMesh.material.uniforms.uHealth.value = b.shield / SHIELD;
    shieldMesh.material.uniforms.uHit.value = Math.max(0, shieldMesh.material.uniforms.uHit.value - dt * 3);
    for (const p of bodyParts) if (p.disabledFor > 0) p.disabledFor = Math.max(0, p.disabledFor - dt);

    tmp.set(player.pos.x - b.pos.x, 0, player.pos.z - b.pos.z);
    const dist = tmp.length();
    const toPlayer = Math.atan2(tmp.x, tmp.z);

    if (state.name === "death") return deathSequence(dt);
    if (state.name === "morphOut") return morphOut(dt);
    if (state.name === "morphIn") return morphIn(dt);
    if (b.phase === 2) return driveGnx(dt, player, dist, toPlayer);

    // ---- phases 1 and 3, on foot ----
    const canWalk = !legsBroken() && state.name !== "kneel" && state.name !== "beam" && state.name !== "stomp";
    if (canWalk) {
      b.yaw += clamp(angleDelta(b.yaw, toPlayer), -0.85 * dt, 0.85 * dt);
      if (dist > 16) {
        const sp = WALK_SPEED;
        b.pos.x += Math.sin(b.yaw) * sp * dt;
        b.pos.z += Math.cos(b.yaw) * sp * dt;
        walkCycle += dt * 1.55;
      } else walkCycle += dt * 0.5;
    } else if (state.name !== "beam") {
      b.yaw += clamp(angleDelta(b.yaw, toPlayer), -0.5 * dt, 0.5 * dt);
    }

    if (state.name === "kneel" && !legsBroken()) state = { name: "walk", t: 0 };

    // ---- attacks ----
    // left arm: telegraphed burst of fast rounds
    mgTimer -= dt;
    if (!disabled("handL") && mgTimer <= 0 && dist < 70 && state.name !== "beam") {
      mgBurst = 14;
      mgTimer = 4.2;
    }
    if (mgBurst > 0) {
      if (state.t % 0.08 < dt && mgBurst > 0) {
        armL.muzzle.getWorldPosition(tmp);
        hooks.onBossShot?.(tmp.clone(), player, MG_DAMAGE);
        mgBurst--;
      }
    }

    // right arm: homing rockets, in volleys
    rocketTimer -= dt;
    if (!disabled("handR") && rocketTimer <= 0 && dist < 80 && state.name !== "beam") {
      armR.muzzle.getWorldPosition(tmp);
      for (let i = 0; i < 3; i++) fireRocket(tmp, player);
      rocketTimer = 5.4;
    }

    // stomp, only if it still has legs under it
    stompTimer -= dt;
    if (state.name === "walk" && !legsBroken() && dist < 15 && stompTimer <= 0) {
      state = { name: "stomp", t: 0 };
      stompTimer = 6.0;
      ring.position.set(player.pos.x, 0.08, player.pos.z);
      ring.userData.at = { x: player.pos.x, z: player.pos.z };
    }
    if (state.name === "stomp") runStomp(dt, player);
    else ring.material.opacity = Math.max(0, ring.material.opacity - dt * 3);

    // phase 3 only: plant, charge, and sweep the chest beam
    if (b.phase === 3) {
      beamTimer -= dt;
      if (state.name === "walk" && beamTimer <= 0 && dist < 60) { state = { name: "beam", t: 0 }; beamTimer = 15; }
      if (state.name === "beam") runBeam(dt, player, toPlayer);
      else beam.material.opacity = Math.max(0, beam.material.opacity - dt * 4);
    }

    poseColossus(dt);
    applyTransform();
  }

  function runStomp(dt, player) {
    const T = state.t;
    const at = ring.userData.at;
    // 0.0–0.9s wind-up with a growing ring, impact at 0.9s, recover to 1.6s
    if (T < 0.9) {
      ring.material.opacity = 0.25 + Math.sin(T * 22) * 0.12;
      ring.scale.setScalar(lerp(9, 6.2, T / 0.9));
    } else if (T < 0.95) {
      if (!state.hit) {
        state.hit = true;
        ring.material.opacity = 0.9;
        fx.explode(tmp.set(at.x, 0.3, at.z), 2.6, 0xffb04a, 26);
        if (Math.hypot(player.pos.x - at.x, player.pos.z - at.z) < 7.5) {
          player.takeDamage(STOMP_DAMAGE);
          hooks.onPlayerHit?.(STOMP_DAMAGE);
        }
        hooks.onShake?.(1);
      }
    } else {
      ring.material.opacity = Math.max(0, ring.material.opacity - dt * 3);
      if (T > 1.7) state = { name: "walk", t: 0 };
    }
  }

  function runBeam(dt, player, toPlayer) {
    const T = state.t;
    const CHARGE = 1.8, SWEEP = 3.5;
    if (T < CHARGE) {
      // plant, face where the sweep will start, and light the core
      b.yaw += clamp(angleDelta(b.yaw, toPlayer - 0.75), -1.6 * dt, 1.6 * dt);
      core.material.emissiveIntensity = 0.6 + (T / CHARGE) * 26;
      core.scale.setScalar(1 + (T / CHARGE) * 0.5);
      beam.material.opacity = 0;
    } else if (T < CHARGE + SWEEP) {
      const k = (T - CHARGE) / SWEEP;
      b.yaw += 1.5 / SWEEP * dt;                 // turn the whole body through ~1.5 rad
      beam.material.opacity = 0.55 + Math.sin(T * 40) * 0.12;
      core.material.emissiveIntensity = 30;
      // anyone inside the cone takes damage per second
      tmp.set(player.pos.x - b.pos.x, 0, player.pos.z - b.pos.z);
      const d = tmp.length();
      if (d < 110 && Math.abs(angleDelta(b.yaw, Math.atan2(tmp.x, tmp.z))) < 0.14 + 1.6 / Math.max(6, d)) {
        player.takeDamage(BEAM_DAMAGE * dt);
        hooks.onPlayerHit?.(BEAM_DAMAGE * dt);
      }
      if (Math.random() < dt * 20) fx.spark(tmp.set(b.pos.x + Math.sin(b.yaw) * 14, 0.4, b.pos.z + Math.cos(b.yaw) * 14), tmp2.set(0, 1, 0), 0xff2d1e, 3);
    } else {
      core.material.emissiveIntensity = lerp(core.material.emissiveIntensity, 0.6, damp(6, dt));
      core.scale.setScalar(1);
      beam.material.opacity = Math.max(0, beam.material.opacity - dt * 5);
      if (T > CHARGE + SWEEP + 1.1) state = { name: "walk", t: 0 };
    }
  }

  // ---- posing ----
  function poseColossus(dt) {
    const kneeling = state.name === "kneel" || legsBroken();
    const stomping = state.name === "stomp";

    // walk: legs counter-swing, shins trail, and the hips rise and fall with the stride
    const sw = Math.sin(walkCycle) * (kneeling ? 0 : 0.55);
    const swB = Math.sin(walkCycle + Math.PI) * (kneeling ? 0 : 0.55);
    legL.hip.rotation.x = lerp(legL.hip.rotation.x, kneeling ? 0.95 : sw, damp(8, dt));
    legR.hip.rotation.x = lerp(legR.hip.rotation.x, kneeling ? 0.2 : swB, damp(8, dt));
    legL.knee.rotation.x = lerp(legL.knee.rotation.x, kneeling ? -1.5 : Math.max(0, -sw) * 0.9, damp(8, dt));
    legR.knee.rotation.x = lerp(legR.knee.rotation.x, kneeling ? -0.3 : Math.max(0, -swB) * 0.9, damp(8, dt));
    legL.ankle.rotation.x = lerp(legL.ankle.rotation.x, kneeling ? 0.6 : sw * -0.3, damp(8, dt));
    legR.ankle.rotation.x = lerp(legR.ankle.rotation.x, kneeling ? 0.1 : swB * -0.3, damp(8, dt));

    // the stomp is one leg driven up then slammed down
    if (stomping) {
      const T = state.t;
      const lift = T < 0.9 ? Math.sin((T / 0.9) * Math.PI * 0.5) : Math.max(0, 1 - (T - 0.9) * 9);
      legR.hip.rotation.x = -1.15 * lift;
      legR.knee.rotation.x = 1.5 * lift;
    }

    const bob = kneeling ? -3.4 : Math.abs(Math.sin(walkCycle)) * 0.45;
    hips.position.y = lerp(hips.position.y, 9.0 + bob - (stomping ? 0.5 : 0), damp(7, dt));
    torso.rotation.z = lerp(torso.rotation.z, kneeling ? 0.12 : Math.sin(walkCycle) * 0.045, damp(6, dt));
    torso.rotation.x = kneeling ? 0.18 : 0;

    // arms track the player unless that hand has been shot off line
    const aimL = disabled("handL") ? 0.5 : -1.35;
    const aimR = disabled("handR") ? 0.5 : -1.2;
    armL.upper.rotation.x = lerp(armL.upper.rotation.x, aimL, damp(4, dt));
    armR.upper.rotation.x = lerp(armR.upper.rotation.x, aimR, damp(4, dt));
    armL.fore.rotation.x = lerp(armL.fore.rotation.x, disabled("handL") ? 0.3 : 0.45, damp(4, dt));
    armR.fore.rotation.x = lerp(armR.fore.rotation.x, disabled("handR") ? 0.3 : 0.35, damp(4, dt));
    armL.shoulder.rotation.z = lerp(armL.shoulder.rotation.z, disabled("handL") ? 0.4 : 0.12, damp(4, dt));
    armR.shoulder.rotation.z = lerp(armR.shoulder.rotation.z, disabled("handR") ? -0.4 : -0.12, damp(4, dt));

    // a broken weak point goes dark and stops glowing
    W.emissiveIntensity = 2.8 + hitFlash * 6;
    C.emissiveIntensity = 2.4 + hitFlash * 4;
  }

  function applyTransform() {
    root.position.set(b.pos.x, 0, b.pos.z);
    root.rotation.y = b.yaw;
    shieldMesh.position.set(0, 9.0, 0);
    shieldMesh.rotation.y += 0.002;
  }

  // ---- transformation ----
  function morphOut(dt) {
    morph = Math.min(1, morph + dt / 1.1);
    colossus.scale.setScalar(lerp(1, 0.15, morph));
    colossus.rotation.x = morph * 1.4;
    hips.position.y = lerp(9.0, 1.2, morph);
    shieldMesh.visible = false;
    if (morph === 1) {
      colossus.visible = false;
      colossus.scale.setScalar(1);
      colossus.rotation.x = 0;
      gnx.visible = true;
      gnx.scale.setScalar(0.1);
      for (const p of bodyParts) p.alive = false;
      partBody.alive = true;                 // in the car, only the car can be shot
      partBody.node = gnx;
      partBody.offset.set(0, 0.9, 0);
      partBody.radius = 2.6;
      partBody.weak = false;
      fx.explode(tmp.copy(b.pos).setY(2), 2.4, 0xff3b2e, 26);
      state = { name: "drive", t: 0 };
      morph = 0;
    }
    applyTransform();
  }

  function morphIn(dt) {
    morph = Math.min(1, morph + dt / 1.1);
    gnx.scale.setScalar(lerp(1, 0.1, morph));
    if (morph === 1) {
      gnx.visible = false;
      gnx.scale.setScalar(1);
      colossus.visible = true;
      hips.position.y = 9.0;
      for (const p of bodyParts) { p.alive = true; p.wp = WEAK_HP; p.disabledFor = 0; }
      partBody.node = torso;
      partBody.offset.set(0, 2.4, 0);
      partBody.radius = 5.4;
      fx.explode(tmp.copy(b.pos).setY(6), 3.4, 0xff3b2e, 34);
      hooks.onShake?.(1);
      state = { name: "walk", t: 0 };
      morph = 0;
    }
    applyTransform();
  }

  // ---- phase 2: run ahead and shoot backwards ----
  function driveGnx(dt, player, dist, toPlayer) {
    if (gnx.scale.x < 1) gnx.scale.setScalar(Math.min(1, gnx.scale.x + dt * 2.4));

    // aim for a point out in front of the player, so it is always the one being chased
    const lead = 26;
    const tx = player.pos.x + player.vel.x * 0.8 + Math.sin(player.yaw) * lead;
    const tz = player.pos.z + player.vel.z * 0.8 + Math.cos(player.yaw) * lead;
    const want = Math.atan2(tx - b.pos.x, tz - b.pos.z);
    b.yaw += clamp(angleDelta(b.yaw, want), -2.1 * dt, 2.1 * dt);
    const sp = GNX_SPEED * (dist > 40 ? 1.15 : dist < 16 ? 1.25 : 0.92);
    b.pos.x += Math.sin(b.yaw) * sp * dt;
    b.pos.z += Math.cos(b.yaw) * sp * dt;

    const rr = Math.hypot(b.pos.x, b.pos.z);
    if (rr > ARENA - 8) { b.pos.x *= (ARENA - 8) / rr; b.pos.z *= (ARENA - 8) / rr; }

    // the pods on its flanks fire back down its own tail
    mgTimer -= dt;
    if (mgTimer <= 0) {
      tmp.set(b.pos.x - Math.sin(b.yaw) * 2.4, 0.9, b.pos.z - Math.cos(b.yaw) * 2.4);
      hooks.onBossShot?.(tmp.clone(), player, MG_DAMAGE);
      mgTimer = 0.16;
    }
    rocketTimer -= dt;
    if (rocketTimer <= 0) {
      tmp.set(b.pos.x - Math.sin(b.yaw) * 2.4, 1.0, b.pos.z - Math.cos(b.yaw) * 2.4);
      for (let i = 0; i < 2; i++) fireRocket(tmp, player);
      rocketTimer = 4.0;
    }

    gnx.position.y = 0;
    gnx.rotation.z = lerp(gnx.rotation.z, clamp(-angleDelta(b.yaw, want) * 2.4, -0.2, 0.2), damp(5, dt));
    applyTransform();
  }

  // ---- death: tear the limbs off, then go up ----
  function deathSequence(dt) {
    const T = state.t;
    if (!state.stage) state.stage = 0;
    const pops = [
      [0.15, armL.hand, 2.0], [0.55, armR.hand, 2.0],
      [1.0, legL.ankle, 2.2], [1.45, legR.ankle, 2.2],
      [1.9, headPivot, 2.4],
    ];
    for (let i = state.stage; i < pops.length; i++) {
      if (T >= pops[i][0]) {
        pops[i][1].getWorldPosition(tmp);
        fx.explode(tmp, pops[i][2], 0xffb04a, 26);
        pops[i][1].visible = false;
        hooks.onShake?.(0.7);
        state.stage = i + 1;
      }
    }
    // it sags as the legs go, then the torso lets go
    hips.position.y = lerp(hips.position.y, 2.0, damp(1.6, dt));
    torso.rotation.x = lerp(torso.rotation.x, 0.9, damp(1.4, dt));
    torso.rotation.z = lerp(torso.rotation.z, 0.45, damp(1.2, dt));

    if (T > 2.6 && !state.blew) {
      state.blew = true;
      for (let i = 0; i < 5; i++) {
        fx.explode(tmp.copy(b.pos).setY(rand(2, 12)).add(tmp2.set(rand(-4, 4), 0, rand(-4, 4))), rand(2.4, 4.0), i % 2 ? 0xffd07a : 0xff4d3a, 34);
      }
      hooks.onShake?.(1.4);
    }
    if (T > 3.4) {
      b.active = false;
      root.visible = false;
      for (const [, node] of pops.map((p) => [0, p[1]])) node.visible = true;
      hooks.onDefeated?.();
    }
    applyTransform();
  }

  b.reset();
  return b;
}
