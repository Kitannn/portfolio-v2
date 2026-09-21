// The opposition: robotic drones, jeeps and bikes, plus their fire and the spawner.
//
// Every model is merged down to one mesh with three material slots (hull / glow / plate), so a
// screen of forty enemies is ~80 draw calls rather than ~500. Enemies are pooled: a dead one is
// parked and reused, which keeps the GC out of the frame loop.
import * as THREE from "three";
import { mergeParts, wedge } from "./loft.js";
import { angleDelta, clamp, damp, rand, randInt, TAU } from "./util.js";
import { ARENA } from "./world.js";

// ---- tuning -------------------------------------------------------------------
const HP_STEP = 10;          // seconds per +1 HP
const HP_CAP = 50;
const XP_STEP = 5;           // seconds between XP-per-drop increases
const XP_PER_STEP = 1;       // …and how much each of those steps is worth
const RAM_CHANCE = 0.07;

// Every ELITE_EVERY seconds one of whatever spawns next comes up huge. They are slow and obvious
// on purpose — the payoff is the card chest they leave behind, so they should read as an
// opportunity rather than an ambush.
const ELITE_EVERY = 30;
const ELITE_SCALE = 3;
const ELITE_HP = 7;
const ELITE_DAMAGE = 2.5;
const ELITE_SPEED = 0.62;
const ELITE_XP = 6;
const RAM_DAMAGE = 10;
const SHOT_DAMAGE = 1;

const SHOT_SPEED_0 = 17;     // slow enough to dodge at the start…
const SHOT_SPEED_MAX = 46;   // …and genuinely dangerous later
const SHOT_RAMP = 190;       // seconds to reach the top speed

// Telegraph lines are built and ready but switched off: at this enemy count the arena filled up
// with them and nothing else could be read. Kept intact for a future use (the boss, or an elite
// variant) — flip this back to a number of seconds to bring them back.
const TELEGRAPH_FROM = Infinity;
const TELEGRAPH_LEAD = 0.62; // how long the line shows before the shot
const TELEGRAPH_HOT = 0.22;  // …and how long it burns red at the end

const TYPES = {
  jeep:  { speed: 13, turn: 1.4, range: 24, spacing: 3.4, fire: 4.4, radius: 1.7, hpMult: 1.6, y: 0.0,  xp: 1.0, contact: 12, colour: 0xff5a3c },
  bike:  { speed: 19, turn: 2.2, range: 13, spacing: 2.4, fire: 3.4, radius: 1.1, hpMult: 0.7, y: 0.0,  xp: 1.0, contact: 8,  colour: 0xff3f6e },
  drone: { speed: 11, turn: 1.9, range: 20, spacing: 3.0, fire: 3.8, radius: 1.4, hpMult: 1.0, y: 2.1,  xp: 1.2, contact: 7,  colour: 0xff8a3c },
};
const TYPE_KEYS = Object.keys(TYPES);
const POOL_PER_TYPE = 26;
const MAX_SHOTS = 420;
const MAX_TELEGRAPHS = 64;

// ---- materials ----------------------------------------------------------------
const hullMat = () => new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.62, metalness: 0.7, flatShading: true });
const plateMat = () => new THREE.MeshStandardMaterial({ color: 0x14161d, roughness: 0.9, metalness: 0.3, flatShading: true });
const glowMat = (c) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: c, emissiveIntensity: 2.6, roughness: 1, toneMapped: true });

// ---- models --------------------------------------------------------------------
// Each returns a merged geometry using slots 0 hull / 1 glow / 2 plate, built nose-down +Z.

function jeepGeo() {
  const P = [];
  // hull: a wedge-nosed tub sitting on four fat tyres
  P.push({ geo: wedge(1.55, 0.62, 1.20, 0.50, 2.45), pos: [0, 0.78, 0], mat: 0 });
  P.push({ geo: wedge(1.20, 0.38, 0.72, 0.26, 0.62), pos: [0, 0.70, 1.48], mat: 2 });   // snout
  P.push({ geo: new THREE.BoxGeometry(1.62, 0.16, 0.34), pos: [0, 0.52, 1.66], mat: 2 }); // ram bar
  for (const sx of [-1, 1]) {
    P.push({ geo: new THREE.BoxGeometry(0.14, 0.50, 0.14), pos: [sx * 0.62, 1.30, -0.30], mat: 2 });
    P.push({ geo: new THREE.BoxGeometry(0.14, 0.44, 0.14), pos: [sx * 0.62, 1.27, 0.75], mat: 2 });
    // wheels, merged in: enemies move fast enough that nobody reads a rolling tyre
    for (const z of [1.02, -0.98]) {
      P.push({ geo: new THREE.CylinderGeometry(0.46, 0.46, 0.34, 12), pos: [sx * 0.86, 0.46, z], rot: [0, 0, Math.PI / 2], mat: 2 });
      P.push({ geo: new THREE.CylinderGeometry(0.20, 0.20, 0.38, 8), pos: [sx * 0.86, 0.46, z], rot: [0, 0, Math.PI / 2], mat: 0 });
    }
  }
  P.push({ geo: new THREE.BoxGeometry(1.30, 0.10, 0.10), pos: [0, 1.53, 0.22], mat: 2 });   // cage spine
  // sensor bar across the snout
  P.push({ geo: new THREE.BoxGeometry(0.92, 0.10, 0.06), pos: [0, 0.80, 1.78], mat: 1 });
  for (const sx of [-1, 1]) P.push({ geo: new THREE.BoxGeometry(0.08, 0.26, 0.06), pos: [sx * 0.74, 0.95, 0.10], mat: 1 });
  return mergeParts(P);
}

function jeepTurretGeo() {
  const P = [];
  P.push({ geo: new THREE.CylinderGeometry(0.34, 0.40, 0.30, 10), pos: [0, 0, 0], mat: 0 });
  P.push({ geo: new THREE.BoxGeometry(0.34, 0.26, 0.62), pos: [0, 0.16, 0.22], mat: 0 });
  P.push({ geo: new THREE.CylinderGeometry(0.07, 0.09, 0.86, 8), pos: [0, 0.16, 0.82], rot: [Math.PI / 2, 0, 0], mat: 2 });
  P.push({ geo: new THREE.BoxGeometry(0.10, 0.10, 0.10), pos: [0, 0.31, 0.44], mat: 1 });
  return mergeParts(P);
}

function bikeGeo() {
  const P = [];
  // a long low spine slung between two big wheels
  P.push({ geo: wedge(0.46, 0.34, 0.26, 0.22, 1.70), pos: [0, 0.72, 0.05], mat: 0 });
  P.push({ geo: wedge(0.60, 0.44, 0.30, 0.16, 0.70), pos: [0, 0.80, 1.05], mat: 2 });      // fairing
  for (const z of [0.98, -0.92]) {
    P.push({ geo: new THREE.CylinderGeometry(0.52, 0.52, 0.22, 14), pos: [0, 0.52, z], rot: [0, 0, Math.PI / 2], mat: 2 });
    P.push({ geo: new THREE.TorusGeometry(0.34, 0.06, 6, 14), pos: [0, 0.52, z], rot: [0, Math.PI / 2, 0], mat: 0 });
  }
  // hunched gunner shell
  P.push({ geo: new THREE.BoxGeometry(0.42, 0.40, 0.52), pos: [0, 1.06, -0.18], mat: 0 });
  P.push({ geo: new THREE.BoxGeometry(0.30, 0.20, 0.22), pos: [0, 1.28, 0.02], mat: 0 });
  P.push({ geo: new THREE.BoxGeometry(0.22, 0.06, 0.06), pos: [0, 1.30, 0.16], mat: 1 });  // visor
  // twin guns on the fairing
  for (const sx of [-1, 1]) {
    P.push({ geo: new THREE.CylinderGeometry(0.055, 0.07, 0.68, 7), pos: [sx * 0.24, 0.84, 1.42], rot: [Math.PI / 2, 0, 0], mat: 2 });
  }
  P.push({ geo: new THREE.BoxGeometry(0.34, 0.07, 0.05), pos: [0, 0.95, 1.38], mat: 1 });  // headlight strip
  P.push({ geo: new THREE.BoxGeometry(0.06, 0.05, 1.20), pos: [0, 0.62, 0.05], mat: 1 });  // underglow
  return mergeParts(P);
}

function droneGeo() {
  const P = [];
  // fuselage
  P.push({ geo: new THREE.OctahedronGeometry(0.62, 0), pos: [0, 0, 0], scale: [0.9, 0.62, 1.5], mat: 0 });
  P.push({ geo: new THREE.BoxGeometry(0.30, 0.20, 0.44), pos: [0, -0.20, 0.42], mat: 2 });   // chin gun housing
  P.push({ geo: new THREE.CylinderGeometry(0.055, 0.07, 0.66, 7), pos: [0, -0.22, 0.86], rot: [Math.PI / 2, 0, 0], mat: 2 });
  // single eye, the thing you learn to shoot at
  P.push({ geo: new THREE.SphereGeometry(0.16, 10, 8), pos: [0, 0.05, 0.72], mat: 1 });
  // four arms and their rotor rings
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * 0.78, z = sz * 0.74;
    P.push({ geo: new THREE.BoxGeometry(0.11, 0.09, 0.11), pos: [x * 0.6, 0.02, z * 0.6], rot: [0, Math.atan2(x, z), 0], scale: [1, 1, 9], mat: 2 });
    P.push({ geo: new THREE.TorusGeometry(0.34, 0.05, 6, 14), pos: [x, 0.10, z], rot: [Math.PI / 2, 0, 0], mat: 0 });
    P.push({ geo: new THREE.BoxGeometry(0.10, 0.10, 0.10), pos: [x, 0.16, z], mat: 1 });
  }
  return mergeParts(P);
}

function bladesGeo() {
  const P = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (const rot of [0, Math.PI / 2]) {
      P.push({ geo: new THREE.BoxGeometry(0.60, 0.015, 0.07), pos: [sx * 0.78, 0.10, sz * 0.74], rot: [0, rot, 0], mat: 0 });
    }
  }
  return mergeParts(P);
}

// ---- the system -----------------------------------------------------------------
export function createEnemies(scene, fx, hooks = {}) {
  const geoms = { jeep: jeepGeo(), bike: bikeGeo(), drone: droneGeo() };
  const turret = jeepTurretGeo();
  const blades = bladesGeo();

  // one material set per type so the accent colour differs, shared across that type's pool
  const mats = {};
  for (const k of TYPE_KEYS) mats[k] = [hullMat(), glowMat(TYPES[k].colour), plateMat()];
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4b, roughness: 0.5, metalness: 0.6, transparent: true, opacity: 0.55 });

  const list = [];         // every enemy, alive or parked — the weapon filters on .alive
  const pools = {};

  for (const type of TYPE_KEYS) {
    pools[type] = [];
    for (let i = 0; i < POOL_PER_TYPE; i++) {
      const root = new THREE.Group();
      const mesh = new THREE.Mesh(geoms[type], mats[type]);
      mesh.castShadow = true;
      root.add(mesh);

      let turretGrp = null, bladeMesh = null;
      if (type === "jeep") {
        turretGrp = new THREE.Group();
        turretGrp.position.set(0, 1.18, -0.05);
        turretGrp.add(new THREE.Mesh(turret, mats[type]));
        root.add(turretGrp);
      }
      if (type === "drone") {
        bladeMesh = new THREE.Mesh(blades, bladeMat);
        root.add(bladeMesh);
      }
      root.visible = false;
      scene.add(root);

      const e = {
        type, cfg: TYPES[type], root, mesh, turret: turretGrp, blades: bladeMesh,
        pos: new THREE.Vector3(), vel: new THREE.Vector3(),
        yaw: 0, alive: false, radius: TYPES[type].radius,
        hp: 1, maxHp: 1, xp: 1,
        fireIn: 0, telegraphing: 0, aimYaw: 0,
        rammer: false, elite: false, orbitDir: 1, bob: 0, lean: 0, flash: 0,
      };
      pools[type].push(e);
      list.push(e);
    }
  }

  // ---- enemy fire: slow glowing orbs, pooled ----
  // tinted per instance via instanceColor — see the note in fx.js about why vertexColors stays off
  const shotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const shotMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.26, 8, 6), shotMat, MAX_SHOTS);
  shotMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_SHOTS * 3), 3);
  shotMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  shotMesh.frustumCulled = false;
  scene.add(shotMesh);
  const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0).setPosition(0, -9999, 0);
  for (let i = 0; i < MAX_SHOTS; i++) shotMesh.setMatrixAt(i, HIDDEN);

  const shots = Array.from({ length: MAX_SHOTS }, () => ({
    live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, col: new THREE.Color(),
    dmg: SHOT_DAMAGE, big: false,
  }));
  let shotCursor = 0;

  // ---- telegraph lines ----
  const tgMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
  const tgMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.01, 1), tgMat, MAX_TELEGRAPHS);
  tgMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_TELEGRAPHS * 3), 3);
  tgMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  tgMesh.frustumCulled = false;
  scene.add(tgMesh);
  for (let i = 0; i < MAX_TELEGRAPHS; i++) tgMesh.setMatrixAt(i, HIDDEN);

  // ---- health bars ----
  // Two instanced quads billboarded to the camera. They only appear once an enemy has actually
  // been hit, so an untouched wave stays clean and a damaged one is instantly readable.
  const BARS = POOL_PER_TYPE * TYPE_KEYS.length;
  const barGeo = new THREE.PlaneGeometry(1, 1);
  const barBgMesh = new THREE.InstancedMesh(barGeo, new THREE.MeshBasicMaterial({ color: 0x0b0c11, transparent: true, opacity: 0.8, depthWrite: false, depthTest: false, toneMapped: false }), BARS);
  const barFgMesh = new THREE.InstancedMesh(barGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, depthTest: false, toneMapped: false }), BARS);
  barFgMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(BARS * 3), 3);
  for (const b of [barBgMesh, barFgMesh]) {
    b.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    b.frustumCulled = false;
    b.renderOrder = 4;
    scene.add(b);
  }
  // Same trap as the flora pool: an InstancedMesh starts every instance on an identity matrix,
  // so without this the whole bar pool renders as one unit quad at the origin — a black square
  // sitting under the car on the title screen, visible only from the front because the plane is
  // single-sided.
  for (const b of [barBgMesh, barFgMesh]) {
    for (let i = 0; i < BARS; i++) b.setMatrixAt(i, HIDDEN);
    b.instanceMatrix.needsUpdate = true;
  }

  const BAR_W = 1.7, BAR_H = 0.17;
  const BAR_TOP = { jeep: 2.25, bike: 1.85, drone: 1.05 };
  const COL_FULL = new THREE.Color(0x6de08a);
  const COL_ELITE = new THREE.Color(0xc07bff);
  const COL_LOW = new THREE.Color(0xff3b4d);

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const barCol = new THREE.Color();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const COL_WARN = new THREE.Color(0xffc94a);
  const COL_HOT = new THREE.Color(0xff2d3a);

  const sys = {
    list,
    spawnIn: 3.0,
    wave: 0,
    spawnScale: 1,       // the boss turns the tap down so the fight stays readable
    spawnEnabled: true,
    maxAlive: 30,
    eliteIn: ELITE_EVERY,
    // read by the finish screen
    killsByType: { jeep: 0, bike: 0, drone: 0 },

    shotSpeed: (t) => SHOT_SPEED_0 + (SHOT_SPEED_MAX - SHOT_SPEED_0) * clamp(t / SHOT_RAMP, 0, 1),
    enemyHp: (t) => Math.min(HP_CAP, 1 + Math.floor(t / HP_STEP)),
    xpValue: (t) => 1 + XP_PER_STEP * Math.floor(t / XP_STEP),

    reset() {
      for (const e of list) { e.alive = false; e.elite = false; e.root.visible = false; e.root.scale.setScalar(1); e.radius = e.cfg.radius; }
      for (const s of shots) s.live = false;
      for (let i = 0; i < MAX_SHOTS; i++) shotMesh.setMatrixAt(i, HIDDEN);
      shotMesh.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < MAX_TELEGRAPHS; i++) tgMesh.setMatrixAt(i, HIDDEN);
      tgMesh.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < BARS; i++) { barBgMesh.setMatrixAt(i, HIDDEN); barFgMesh.setMatrixAt(i, HIDDEN); }
      barBgMesh.instanceMatrix.needsUpdate = barFgMesh.instanceMatrix.needsUpdate = true;
      sys.spawnIn = 3.0;
      sys.wave = 0;
      sys.spawnScale = 1;
      sys.spawnEnabled = true;
      sys.maxAlive = 30;
      sys.eliteIn = ELITE_EVERY;
      sys.killsByType = { jeep: 0, bike: 0, drone: 0 };
    },

    aliveCount: () => list.reduce((n, e) => n + (e.alive ? 1 : 0), 0),

    // Wipe the field. The boss is meant to be the only thing on screen, so its arrival takes
    // everything else with it — they still pay out, since you did the work to get there.
    clearAll(payOut = true) {
      for (const e of list) {
        if (!e.alive) continue;
        if (payOut) sys.kill(e);
        else { e.alive = false; e.root.visible = false; }
      }
    },

    // A round landed. Returns true if this killed it.
    hit(e, damage, crit, point) {
      if (!e.alive) return false;
      e.hp -= damage;
      e.flash = 1;
      fx.spark(point || e.pos, tmp.set(0, 1, 0), crit ? 0xffc94a : 0xbfe6ff, crit ? 7 : 3);
      if (e.hp > 0) return false;
      sys.kill(e);
      return true;
    },

    kill(e, silent = false) {
      if (!e.alive) return;
      const wasElite = e.elite;
      e.alive = false;
      e.elite = false;
      e.root.visible = false;
      e.root.scale.setScalar(1);
      e.radius = e.cfg.radius;
      if (!silent) {
        const base = e.type === "jeep" ? 1.25 : e.type === "drone" ? 1.0 : 0.85;
        fx.explode(e.pos, base * (wasElite ? 2.4 : 1), e.cfg.colour, wasElite ? 34 : e.type === "jeep" ? 18 : 13);
        fx.dropXp(e.pos, e.xp);
        sys.killsByType[e.type]++;
      }
      if (wasElite) hooks.onEliteDown?.(e.pos.clone());
    },

    spawnWave(t, player, withElite = false) {
      sys.wave++;
      const size = Math.min(clamp(3 + Math.floor(t / 60), 3, 6), sys.maxAlive - sys.aliveCount());
      if (size <= 0) return;
      const hp = sys.enemyHp(t);
      const xp = sys.xpValue(t);
      // the whole group arrives from roughly one direction, so a wave reads as a wave
      const base = rand(0, TAU);
      for (let i = 0; i < size; i++) {
        const type = pickType(t);
        const e = pools[type].find((p) => !p.alive);
        if (!e) continue;
        const a = base + rand(-0.55, 0.55);
        const r = clamp(rand(64, 86), 0, ARENA - 6);
        let x = player.pos.x + Math.cos(a) * r;
        let z = player.pos.z + Math.sin(a) * r;
        // keep spawns inside the arena, or a wave can appear behind the fence
        const d = Math.hypot(x, z);
        if (d > ARENA - 8) { x *= (ARENA - 8) / d; z *= (ARENA - 8) / d; }

        // the first slot of a flagged wave is the elite
        const elite = withElite && i === 0;
        e.elite = elite;
        e.alive = true;
        e.root.visible = true;
        e.root.scale.setScalar(elite ? ELITE_SCALE : 1);
        e.radius = e.cfg.radius * (elite ? ELITE_SCALE * 0.8 : 1);
        e.pos.set(x, e.cfg.y * (elite ? ELITE_SCALE * 0.7 : 1), z);
        e.vel.set(0, 0, 0);
        e.yaw = Math.atan2(player.pos.x - x, player.pos.z - z);
        e.aimYaw = e.yaw;
        e.maxHp = e.hp = Math.max(1, Math.round(hp * e.cfg.hpMult * (elite ? ELITE_HP : 1)));
        e.xp = Math.max(1, Math.round(xp * e.cfg.xp * (elite ? ELITE_XP : 1)));
        e.fireIn = rand(0.9, 2.4);
        e.telegraphing = 0;
        e.rammer = !elite && Math.random() < RAM_CHANCE;
        e.orbitDir = Math.random() < 0.5 ? -1 : 1;
        e.bob = rand(0, TAU);
        e.lean = 0;
        e.flash = 0;
        e.root.position.copy(e.pos);
        e.root.rotation.set(0, e.yaw, 0);
      }
    },

    update(dt, t, player, stats, camera) {
      // ---- spawning ----
      sys.spawnIn -= dt;
      if (sys.spawnEnabled) sys.eliteIn -= dt;
      if (sys.spawnEnabled && sys.spawnIn <= 0 && sys.aliveCount() < sys.maxAlive) {
        const withElite = sys.eliteIn <= 0;
        if (withElite) { sys.eliteIn = ELITE_EVERY; hooks.onElite?.(); }
        sys.spawnWave(t, player, withElite);
        sys.spawnIn = clamp(6.5 - t / 110, 2.8, 6.5) * rand(0.85, 1.15) * sys.spawnScale;
      }

      const speed = sys.shotSpeed(t);
      const telegraphOn = t > TELEGRAPH_FROM;
      let tgCount = 0;
      let barCount = 0;

      // ---- enemies ----
      for (const e of list) {
        if (!e.alive) continue;
        const c = e.cfg;
        tmp.set(player.pos.x - e.pos.x, 0, player.pos.z - e.pos.z);
        const dist = tmp.length();
        const toPlayer = Math.atan2(tmp.x, tmp.z);

        // --- steering ---
        let want = toPlayer;
        let throttle = 1;
        if (e.rammer) {
          throttle = 1.5;
        } else if (dist < c.range * 0.72) {
          want = toPlayer + Math.PI * 0.62 * e.orbitDir;      // peel away, keep circling
        } else if (dist < c.range * 1.15) {
          want = toPlayer + Math.PI * 0.42 * e.orbitDir;      // strafe at its preferred range
          throttle = 0.8;
        }
        e.yaw += clamp(angleDelta(e.yaw, want), -c.turn * dt, c.turn * dt);

        const target = c.speed * throttle * (e.elite ? ELITE_SPEED : 1);
        tmp2.set(Math.sin(e.yaw) * target, 0, Math.cos(e.yaw) * target);
        e.vel.lerp(tmp2, damp(2.6, dt));
        e.pos.addScaledVector(e.vel, dt);

        // keep them off each other so a wave does not collapse into one point
        for (const o of list) {
          if (o === e || !o.alive) continue;
          const dx = e.pos.x - o.pos.x, dz = e.pos.z - o.pos.z;
          const dd = dx * dx + dz * dz;
          const min = c.spacing;
          if (dd < min * min && dd > 1e-4) {
            const d = Math.sqrt(dd);
            const push = (min - d) / d * 0.5;
            e.pos.x += dx * push; e.pos.z += dz * push;
          }
        }

        // stay inside the fence
        const rr = Math.hypot(e.pos.x, e.pos.z);
        if (rr > ARENA - 3) { e.pos.x *= (ARENA - 3) / rr; e.pos.z *= (ARENA - 3) / rr; }

        // --- contact ---
        // Anything that actually reaches the car goes up on it. Rammers hit hardest because that
        // was the whole plan; everything else still hurts, so a crowd is dangerous to sit inside.
        if (dist < c.radius + 2.0) {
          const dmg = (e.rammer ? RAM_DAMAGE : c.contact) * (e.elite ? ELITE_DAMAGE : 1);
          player.takeDamage(dmg);
          hooks.onPlayerHit?.(dmg);
          fx.explode(e.pos, (e.rammer ? 1.5 : 1.15) * (e.elite ? 2.2 : 1), e.rammer ? 0xffc94a : c.colour, e.rammer ? 18 : 14);
          sys.kill(e, true);                 // silent: the blast above replaces the usual one
          fx.dropXp(e.pos, e.xp);            // it still died, so it still pays
          sys.killsByType[e.type]++;
          hooks.onShake?.(e.rammer ? 0.5 : 0.28);
          continue;
        }

        // --- firing ---
        if (!e.rammer) {
          e.fireIn -= dt;
          e.aimYaw += clamp(angleDelta(e.aimYaw, toPlayer), -4.5 * dt, 4.5 * dt);
          const lead = telegraphOn ? TELEGRAPH_LEAD : 0;
          e.telegraphing = telegraphOn && e.fireIn < lead && e.fireIn > 0 ? 1 - e.fireIn / lead : 0;

          if (e.telegraphing > 0 && tgCount < MAX_TELEGRAPHS && dist < 70) {
            // a line from the muzzle out past the player, going red just before the shot
            const hot = e.fireIn < TELEGRAPH_HOT;
            const len = dist + 6;
            tmp2.set(e.pos.x + Math.sin(e.aimYaw) * len * 0.5, (e.cfg.y || 0) + 0.95, e.pos.z + Math.cos(e.aimYaw) * len * 0.5);
            q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), e.aimYaw);
            scl.set(hot ? 2.4 : 1, 1, len);
            tgMesh.setMatrixAt(tgCount, m4.compose(tmp2, q, scl));
            // a Color, not the Vector3 scratch — setColorAt reads .r/.g/.b
            barCol.copy(hot ? COL_HOT : COL_WARN).multiplyScalar(hot ? 1.5 : 0.45 + e.telegraphing * 0.5);
            tgMesh.setColorAt(tgCount, barCol);
            tgCount++;
          }

          if (e.fireIn <= 0 && dist < 62) {
            fire(e, player, speed);
            e.fireIn = c.fire * rand(0.8, 1.3);
            e.telegraphing = 0;
          }
        }

        // --- presentation ---
        e.bob += dt;
        e.root.position.set(e.pos.x, c.y + (e.type === "drone" ? Math.sin(e.bob * 2.2) * 0.22 : 0), e.pos.z);
        e.root.rotation.y = e.yaw;
        if (e.type === "bike") {
          // lean into the turn
          const turning = angleDelta(e.yaw, want);
          e.lean += (clamp(turning * 1.6, -0.55, 0.55) - e.lean) * damp(5, dt);
          e.root.rotation.z = e.lean;
        }
        if (e.type === "drone") {
          e.root.rotation.x = Math.sin(e.bob * 1.7) * 0.06 - 0.10;
          e.blades.rotation.y += dt * 34;
        }
        if (e.turret) e.turret.rotation.y = e.aimYaw - e.yaw;

        // hit flash: punch the emissive up, then let it fall back
        if (e.flash > 0) {
          e.flash = Math.max(0, e.flash - dt * 4.5);
          e.mesh.material[1].emissiveIntensity = 2.6 + e.flash * 9;
        }

        // health bar, once it has been hurt
        if (camera && e.hp < e.maxHp && barCount < BARS) {
          const frac = clamp(e.hp / e.maxHp, 0, 1);
          const grow = e.elite ? ELITE_SCALE : 1;
          const y = e.root.position.y + BAR_TOP[e.type] * grow;
          q.copy(camera.quaternion);                       // billboard
          tmp.set(e.pos.x, y, e.pos.z);
          const bw = BAR_W * (e.elite ? 2 : 1), bh = BAR_H * (e.elite ? 1.7 : 1);
          scl.set(bw, bh, 1);
          barBgMesh.setMatrixAt(barCount, m4.compose(tmp, q, scl));
          // the fill shrinks from the right, so it has to slide left as it goes
          tmp2.set(-(1 - frac) * bw * 0.5, 0, 0).applyQuaternion(q);
          tmp.set(e.pos.x + tmp2.x, y + tmp2.y, e.pos.z + tmp2.z);
          scl.set(Math.max(0.001, bw * frac - 0.06), bh - 0.06, 1);
          barFgMesh.setMatrixAt(barCount, m4.compose(tmp, q, scl));
          barFgMesh.setColorAt(barCount, e.elite ? barCol.copy(COL_ELITE) : barCol.copy(COL_LOW).lerp(COL_FULL, frac));
          barCount++;
        }
      }

      // park unused telegraph and health-bar slots
      for (let i = tgCount; i < MAX_TELEGRAPHS; i++) tgMesh.setMatrixAt(i, HIDDEN);
      tgMesh.instanceMatrix.needsUpdate = true;
      if (tgMesh.instanceColor) tgMesh.instanceColor.needsUpdate = true;
      for (let i = barCount; i < BARS; i++) { barBgMesh.setMatrixAt(i, HIDDEN); barFgMesh.setMatrixAt(i, HIDDEN); }
      barBgMesh.instanceMatrix.needsUpdate = barFgMesh.instanceMatrix.needsUpdate = true;
      if (barFgMesh.instanceColor) barFgMesh.instanceColor.needsUpdate = true;

      // ---- enemy fire ----
      for (let i = 0; i < MAX_SHOTS; i++) {
        const s = shots[i];
        if (!s.live) { shotMesh.setMatrixAt(i, HIDDEN); continue; }
        s.life -= dt;
        s.pos.addScaledVector(s.vel, dt);
        const dx = s.pos.x - player.pos.x, dz = s.pos.z - player.pos.z, dy = s.pos.y - 0.8;
        if (dx * dx + dz * dz < 4.2 && Math.abs(dy) < 1.9) {
          const dealt = player.takeDamage(s.dmg);
          if (dealt > 0) hooks.onPlayerHit?.(s.dmg);
          fx.spark(s.pos, tmp.set(0, 1, 0), 0xff5a3c, 5);
          s.live = false;
          shotMesh.setMatrixAt(i, HIDDEN);
          continue;
        }
        if (s.life <= 0) { s.live = false; shotMesh.setMatrixAt(i, HIDDEN); continue; }
        scl.setScalar(s.big ? 1.9 : 1);
        shotMesh.setMatrixAt(i, m4.compose(s.pos, q.identity(), scl));
        shotMesh.setColorAt(i, s.col);
      }
      shotMesh.instanceMatrix.needsUpdate = true;
      if (shotMesh.instanceColor) shotMesh.instanceColor.needsUpdate = true;
    },
  };

  // lead the player a little, so standing still is never safe
  function fire(e, player, speed) {
    let slot = -1;
    for (let i = 0; i < MAX_SHOTS; i++) {
      const idx = (shotCursor + i) % MAX_SHOTS;
      if (!shots[idx].live) { slot = idx; break; }
    }
    if (slot < 0) slot = shotCursor;
    shotCursor = (slot + 1) % MAX_SHOTS;

    const s = shots[slot];
    const muzzleY = (e.cfg.y || 0) + (e.type === "drone" ? 0.6 : e.type === "jeep" ? 1.34 : 0.84);
    s.pos.set(e.pos.x + Math.sin(e.aimYaw) * 1.3, muzzleY, e.pos.z + Math.cos(e.aimYaw) * 1.3);

    tmp.copy(player.pos).setY(0.8).sub(s.pos);
    const flight = tmp.length() / speed;
    tmp.x += player.vel.x * flight * 0.55;
    tmp.z += player.vel.z * flight * 0.55;
    s.vel.copy(tmp).normalize().multiplyScalar(speed);
    s.life = 4.2;
    s.col.setHex(e.cfg.colour);
    s.dmg = SHOT_DAMAGE;
    s.big = false;
    s.live = true;
  }

  // The boss borrows this pool so its fire looks and collides exactly like everything else.
  sys.fireAt = (from, player, damage, speed = 62, colour = 0xffb04a) => {
    let slot = -1;
    for (let i = 0; i < MAX_SHOTS; i++) {
      const idx = (shotCursor + i) % MAX_SHOTS;
      if (!shots[idx].live) { slot = idx; break; }
    }
    if (slot < 0) slot = shotCursor;
    shotCursor = (slot + 1) % MAX_SHOTS;
    const s = shots[slot];
    s.pos.copy(from);
    tmp.copy(player.pos).setY(0.9).sub(from);
    const flight = tmp.length() / speed;
    tmp.x += player.vel.x * flight * 0.7;
    tmp.z += player.vel.z * flight * 0.7;
    // a little scatter, or a 14-round burst is an unavoidable laser
    s.vel.copy(tmp).normalize().applyAxisAngle(UP, rand(-0.045, 0.045)).multiplyScalar(speed);
    s.life = 3.2;
    s.col.setHex(colour);
    s.dmg = damage;
    s.big = true;
    s.live = true;
  };

  function pickType(t) {
    // bikes and jeeps open the run; drones join once there is something to dodge
    const wDrone = t < 25 ? 0.12 : 0.30;
    const r = Math.random();
    if (r < wDrone) return "drone";
    return r < wDrone + (1 - wDrone) * 0.52 ? "jeep" : "bike";
  }

  return sys;
}
