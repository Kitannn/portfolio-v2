// What litters the plain: destructible flora you can plough through, rare chests worth stopping
// for, and signage naming the places this whole thing came out of.
//
// Flora and chests are pooled instanced meshes with a flat distance check against the car — at
// these counts that is far cheaper than any spatial index would be, and a great deal simpler.
import * as THREE from "three";
import { mergeParts } from "./loft.js";
import { clamp, rand, randInt, TAU } from "./util.js";
import { ARENA } from "./world.js";

const FLORA = 220;
const CHESTS = 18;
const CREDIT_CHEST_CHANCE = 0.055;   // share of flora slots that are a chest instead
const REGROW = 26;                   // seconds before a cleared patch comes back

// Ground stencils only. The work history itself now lives along the route (see route.js) — these
// are the offcuts, sprayed on the tarmac between the districts the way a real site gets marked up.
const MARKS = [
  { text: "PLUMBROOK", sub: "EA MAXIS" },
  { text: "TOWN STORIES", sub: "THE SIMS" },
  { text: "COSMIC CARNAGE", sub: "ROBLOX" },
  { text: "BIRBKIT", sub: "KITANNN" },
  { text: "SECTOR 86", sub: "GR" },
  { text: "CRATER CRASHERS", sub: "GHOST FOX" },
];

// ---- a sign, drawn to a canvas and used as a texture -----------------------------
function signTexture(text, sub, { vertical = false, plate = true } = {}) {
  const c = document.createElement("canvas");
  c.width = vertical ? 256 : 1024;
  c.height = vertical ? 1024 : 256;
  const g = c.getContext("2d");
  // A banner wants a solid plate behind it; a ground stencil must not have one, or the "decal"
  // is really just a dark rectangle painted over the grid.
  if (plate) {
    g.fillStyle = "#0a0c14";
    g.fillRect(0, 0, c.width, c.height);
  }

  g.save();
  if (vertical) { g.translate(c.width / 2, c.height / 2); g.rotate(Math.PI / 2); }
  else g.translate(c.width / 2, c.height / 2);

  const w = vertical ? c.height : c.width;
  g.textAlign = "center";
  g.textBaseline = "middle";

  g.fillStyle = "#7cc6ff";
  g.font = `600 ${Math.round(w * 0.045)}px "IBM Plex Mono", monospace`;
  g.fillText(sub, 0, -w * 0.075);

  g.fillStyle = "#eeeaf5";
  g.font = `400 ${Math.round(w * 0.092)}px Silkscreen, "IBM Plex Mono", monospace`;
  g.fillText(text, 0, w * 0.012);

  // a rule under the name, and tick marks either end, so it reads as signage not a label
  g.strokeStyle = "rgba(124,198,255,.55)";
  g.lineWidth = Math.max(2, w * 0.006);
  g.beginPath();
  g.moveTo(-w * 0.3, w * 0.07);
  g.lineTo(w * 0.3, w * 0.07);
  g.stroke();
  g.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ---- geometry --------------------------------------------------------------------
function cactusGeo() {
  // a columnar cactus with two arms — the silhouette does the work at speed
  const P = [
    { geo: new THREE.CylinderGeometry(0.34, 0.42, 2.6, 7), pos: [0, 1.3, 0], mat: 0 },
    { geo: new THREE.SphereGeometry(0.34, 7, 5), pos: [0, 2.6, 0], mat: 0 },
    { geo: new THREE.CylinderGeometry(0.2, 0.22, 0.9, 6), pos: [-0.5, 1.5, 0], rot: [0, 0, 0.5], mat: 0 },
    { geo: new THREE.CylinderGeometry(0.2, 0.2, 0.8, 6), pos: [-0.66, 2.05, 0], mat: 0 },
    { geo: new THREE.SphereGeometry(0.2, 6, 5), pos: [-0.66, 2.45, 0], mat: 0 },
    { geo: new THREE.CylinderGeometry(0.18, 0.2, 0.75, 6), pos: [0.46, 1.15, 0.1], rot: [0, 0, -0.55], mat: 0 },
    { geo: new THREE.CylinderGeometry(0.18, 0.18, 0.7, 6), pos: [0.62, 1.62, 0.1], mat: 0 },
    { geo: new THREE.SphereGeometry(0.18, 6, 5), pos: [0.62, 1.97, 0.1], mat: 0 },
  ];
  // bloom lights, because everything else out here glows
  P.push({ geo: new THREE.SphereGeometry(0.1, 6, 5), pos: [0, 2.78, 0], mat: 1 });
  P.push({ geo: new THREE.SphereGeometry(0.075, 6, 5), pos: [-0.66, 2.62, 0], mat: 1 });
  return mergeParts(P);
}

function shrubGeo() {
  const P = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    const r = 0.45 + (i % 3) * 0.16;
    P.push({
      geo: new THREE.IcosahedronGeometry(0.42 + (i % 2) * 0.12, 0),
      pos: [Math.cos(a) * r, 0.38 + (i % 3) * 0.22, Math.sin(a) * r],
      mat: 0,
    });
  }
  P.push({ geo: new THREE.CylinderGeometry(0.11, 0.15, 0.5, 5), pos: [0, 0.25, 0], mat: 1 });
  return mergeParts(P);
}

function chestGeo() {
  return mergeParts([
    { geo: new THREE.BoxGeometry(1.3, 0.78, 0.95), pos: [0, 0.4, 0], mat: 0 },
    { geo: new THREE.BoxGeometry(1.36, 0.16, 1.0), pos: [0, 0.82, 0], mat: 2 },     // lid rim
    { geo: new THREE.BoxGeometry(0.2, 0.34, 1.0), pos: [0, 0.5, 0], mat: 2 },       // strap
    { geo: new THREE.BoxGeometry(1.36, 0.1, 0.16), pos: [0, 0.2, 0], mat: 2 },      // banding
    { geo: new THREE.BoxGeometry(0.26, 0.26, 0.12), pos: [0, 0.52, 0.5], mat: 1 },  // lock light
    { geo: new THREE.BoxGeometry(1.1, 0.05, 0.05), pos: [0, 0.9, 0], mat: 1 },
  ]);
}

export function createScatter(scene, fx, hooks = {}) {
  // ---- flora ----
  const floraMats = [
    new THREE.MeshStandardMaterial({ color: 0x2c4a39, roughness: 0.85, metalness: 0.1, flatShading: true }),
    new THREE.MeshBasicMaterial({ color: 0xff9cc0, toneMapped: false }),
  ];
  const shrubMats = [
    new THREE.MeshStandardMaterial({ color: 0x24402f, roughness: 0.92, metalness: 0.05, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x1b1f18, roughness: 1, metalness: 0 }),
  ];
  const cactus = new THREE.InstancedMesh(cactusGeo(), floraMats, FLORA);
  const shrub = new THREE.InstancedMesh(shrubGeo(), shrubMats, FLORA);
  for (const m of [cactus, shrub]) {
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.castShadow = true;
    scene.add(m);
  }

  // ---- chests ----
  const chestMats = [
    new THREE.MeshStandardMaterial({ color: 0x3b2f1c, roughness: 0.7, metalness: 0.35, flatShading: true }),
    new THREE.MeshBasicMaterial({ color: 0xffc94a, toneMapped: false }),
    new THREE.MeshStandardMaterial({ color: 0x14161d, roughness: 0.8, metalness: 0.5, flatShading: true }),
  ];
  const cardChestMats = [
    new THREE.MeshStandardMaterial({ color: 0x2a2140, roughness: 0.6, metalness: 0.45, flatShading: true }),
    new THREE.MeshBasicMaterial({ color: 0xc07bff, toneMapped: false }),
    new THREE.MeshStandardMaterial({ color: 0x14161d, roughness: 0.8, metalness: 0.5, flatShading: true }),
  ];
  const geoChest = chestGeo();
  const chestMesh = new THREE.InstancedMesh(geoChest, chestMats, CHESTS);
  const cardMesh = new THREE.InstancedMesh(geoChest, cardChestMats, CHESTS);
  for (const m of [chestMesh, cardMesh]) {
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.castShadow = true;
    scene.add(m);
  }

  // An InstancedMesh starts with identity matrices on every instance, so without this the whole
  // pool renders stacked at the origin — 220 cacti growing through the car on the title screen.
  const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0).setPosition(0, -9999, 0);
  for (const m of [cactus, shrub]) {
    for (let i = 0; i < FLORA; i++) m.setMatrixAt(i, HIDDEN);
    m.instanceMatrix.needsUpdate = true;
  }
  for (const m of [chestMesh, cardMesh]) {
    for (let i = 0; i < CHESTS; i++) m.setMatrixAt(i, HIDDEN);
    m.instanceMatrix.needsUpdate = true;
  }

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  const flora = Array.from({ length: FLORA }, () => ({
    live: false, kind: 0, x: 0, z: 0, yaw: 0, size: 1, regrow: 0, radius: 1.4,
  }));
  const chests = Array.from({ length: CHESTS }, () => ({
    live: false, kind: "credits", x: 0, z: 0, yaw: 0, bob: 0, value: 0,
  }));

  // Always placed relative to the car: 220 plants sprinkled evenly over a 260 m circle is a
  // desert with nothing in it, whereas a band that travels with you is always worth ploughing.
  const placeFlora = (f, near, initial = false) => {
    const a = rand(0, TAU);
    const r = initial ? rand(16, 120) : rand(45, 130);
    const ox = near ? near.x : 0, oz = near ? near.z : 0;
    f.x = clamp(ox + Math.cos(a) * r, -(ARENA - 8), ARENA - 8);
    f.z = clamp(oz + Math.sin(a) * r, -(ARENA - 8), ARENA - 8);
    f.kind = Math.random() < 0.45 ? 0 : 1;          // cactus or shrub
    f.yaw = rand(0, TAU);
    f.size = f.kind === 0 ? rand(0.75, 1.25) : rand(0.8, 1.5);
    f.radius = (f.kind === 0 ? 1.1 : 1.3) * f.size;
    f.live = true;
    f.regrow = 0;
  };

  // ---- signage ---------------------------------------------------------------------
  const signs = new THREE.Group();
  scene.add(signs);
  MARKS.forEach((s, i) => {
    const a = (i / MARKS.length) * TAU + 0.4;
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 6.5),
      new THREE.MeshBasicMaterial({
        map: signTexture(s.text, s.sub, { plate: false }), transparent: true, opacity: 0.42,
        depthWrite: false, toneMapped: false,
      })
    );
    const da = a + rand(-0.7, 0.7);
    const dr = rand(40, ARENA * 0.8);
    decal.rotation.x = -Math.PI / 2;
    decal.rotation.z = rand(0, TAU);
    decal.position.set(Math.cos(da) * dr, 0.05, Math.sin(da) * dr);
    signs.add(decal);
  });

  const sys = {
    chestsFound: 0,

    reset(player) {
      for (const f of flora) placeFlora(f, player?.pos, true);
      for (const c of chests) c.live = false;
      sys.chestsFound = 0;
      // a handful of credit chests salted around from the start
      let placed = 0;
      for (const c of chests) {
        if (placed >= 4) break;
        const a = rand(0, TAU), r = rand(45, ARENA - 20);
        c.live = true; c.kind = "credits";
        c.x = Math.cos(a) * r; c.z = Math.sin(a) * r;
        c.yaw = rand(0, TAU); c.bob = rand(0, TAU);
        c.value = randInt(40, 110);
        placed++;
      }
    },

    // an elite death leaves one of these behind
    dropCardChest(at) {
      const c = chests.find((x) => !x.live);
      if (!c) return;
      c.live = true; c.kind = "card";
      c.x = at.x; c.z = at.z;
      c.yaw = rand(0, TAU); c.bob = 0; c.value = 0;
    },

    update(dt, player) {
      const px = player.pos.x, pz = player.pos.z;
      const fast = Math.abs(player.speed) > 3;

      // ---- flora: plough through it ----
      let ci = 0, si = 0;
      for (const f of flora) {
        if (!f.live) {
          f.regrow -= dt;
          // regrow somewhere new, well away from the car so nothing pops up under you
          if (f.regrow <= 0) placeFlora(f, player.pos);
          continue;
        }
        const dx = f.x - px, dz = f.z - pz;
        if (fast && dx * dx + dz * dz < (f.radius + 1.7) ** 2) {
          f.live = false;
          f.regrow = REGROW * rand(0.7, 1.3);
          pos.set(f.x, 0.6 * f.size, f.z);
          fx.explode(pos, 0.5 * f.size, f.kind === 0 ? 0x4fd16a : 0x7fae62, 9);
          hooks.onFlora?.(f.kind);
          continue;
        }
        pos.set(f.x, 0, f.z);
        q.setFromAxisAngle(UP, f.yaw);
        scl.setScalar(f.size);
        m4.compose(pos, q, scl);
        if (f.kind === 0) cactus.setMatrixAt(ci++, m4);
        else shrub.setMatrixAt(si++, m4);
      }
      for (let i = ci; i < FLORA; i++) cactus.setMatrixAt(i, HIDDEN);
      for (let i = si; i < FLORA; i++) shrub.setMatrixAt(i, HIDDEN);
      cactus.instanceMatrix.needsUpdate = shrub.instanceMatrix.needsUpdate = true;

      // ---- chests: drive through to open ----
      let gi = 0, ki = 0;
      for (const c of chests) {
        if (!c.live) continue;
        c.bob += dt;
        const dx = c.x - px, dz = c.z - pz;
        if (dx * dx + dz * dz < 9) {
          c.live = false;
          pos.set(c.x, 0.7, c.z);
          fx.explode(pos, 1.1, c.kind === "card" ? 0xc07bff : 0xffc94a, 20);
          sys.chestsFound++;
          if (c.kind === "card") hooks.onCardChest?.(pos.clone());
          else hooks.onCreditChest?.(c.value, pos.clone());
          continue;
        }
        pos.set(c.x, Math.sin(c.bob * 1.6) * 0.1, c.z);
        q.setFromAxisAngle(UP, c.yaw + c.bob * 0.35);
        scl.setScalar(c.kind === "card" ? 1.25 : 1);
        m4.compose(pos, q, scl);
        if (c.kind === "card") cardMesh.setMatrixAt(ki++, m4);
        else chestMesh.setMatrixAt(gi++, m4);
      }
      for (let i = gi; i < CHESTS; i++) chestMesh.setMatrixAt(i, HIDDEN);
      for (let i = ki; i < CHESTS; i++) cardMesh.setMatrixAt(i, HIDDEN);
      chestMesh.instanceMatrix.needsUpdate = cardMesh.instanceMatrix.needsUpdate = true;

      // ---- the occasional new credit chest, kept rare ----
      if (Math.random() < CREDIT_CHEST_CHANCE * dt) {
        const c = chests.find((x) => !x.live);
        if (c) {
          const a = rand(0, TAU), r = rand(55, 120);
          c.live = true; c.kind = "credits";
          c.x = clamp(px + Math.cos(a) * r, -(ARENA - 10), ARENA - 10);
          c.z = clamp(pz + Math.sin(a) * r, -(ARENA - 10), ARENA - 10);
          c.yaw = rand(0, TAU); c.bob = rand(0, TAU);
          c.value = randInt(40, 110);
        }
      }
    },
  };

  return sys;
}
