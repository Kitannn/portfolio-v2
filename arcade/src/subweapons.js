// SUB-WEAPONS — the auto-firing systems bolted to the car.
//
// These are the Vampire Survivors half of the build: you unlock one from a card, it fires itself
// forever after, and every further copy of that card levels it. The roof gun stays the thing you
// aim; everything in here works while you drive.
//
// Each weapon is a tiny state machine over a shared set of pooled visuals, so adding one is a
// table entry and an update function rather than a new renderer.
import * as THREE from "three";
import { clamp, damp, rand, TAU } from "./util.js";

const MAX_ORBS = 160;      // mines, micro-rockets and burning patches all draw from here
const MAX_BEAMS = 64;      // drone tracers and arc lightning

// level -> numbers. Index 0 is level 1.
export const WEAPONS = {
  drone: {
    name: "Sentry Drone",
    blurb: (n) => `${n} drone${n === 1 ? "" : "s"} orbit the car, firing at whatever is closest.`,
    count: (n) => Math.min(4, 1 + Math.floor((n - 1) / 2)),
    damage: (n) => 2 + n,
    interval: (n) => Math.max(0.42, 1.25 - n * 0.14),
    range: () => 34,
  },
  plumbob: {
    name: "Plumbob Reactor",
    blurb: (n) => `A green cutting beam sweeps around you for ${(3 + n * 2.5).toFixed(0)} damage a second.`,
    dps: (n) => 3 + n * 2.5,
    radius: (n) => 4.6 + n * 0.7,
    spin: (n) => 1.5 + n * 0.22,
  },
  arc: {
    name: "Arc Coil",
    blurb: (n) => `Every ${(2.4 - n * 0.22).toFixed(1)}s, lightning jumps to ${1 + n} nearby enemies.`,
    interval: (n) => 2.4 - n * 0.22,
    jumps: (n) => 1 + n,
    damage: (n) => 3 + n * 2,
    range: () => 22,
  },
  caltrop: {
    name: "Caltrop Bay",
    blurb: (n) => `Drops spikes behind you that detonate for ${4 + n * 3} in a small blast.`,
    interval: (n) => Math.max(0.5, 1.5 - n * 0.2),
    damage: (n) => 4 + n * 3,
    radius: (n) => 2.6 + n * 0.35,
    life: () => 9,
  },
  hornet: {
    name: "Hornet Pod",
    blurb: (n) => `Fires ${1 + Math.floor(n / 2)} homing micro-rocket${1 + Math.floor(n / 2) === 1 ? "" : "s"} every ${(3.2 - n * 0.3).toFixed(1)}s.`,
    interval: (n) => 3.2 - n * 0.3,
    salvo: (n) => 1 + Math.floor(n / 2),
    damage: (n) => 5 + n * 4,
    radius: () => 3.0,
  },
  scorch: {
    name: "Scorch Trail",
    blurb: (n) => `Boosting lays a burning wake dealing ${2 + n * 1.5} damage a second.`,
    dps: (n) => 2 + n * 1.5,
    interval: () => 0.22,
    life: (n) => 2.2 + n * 0.5,
    radius: (n) => 1.8 + n * 0.18,
  },
};

export function createSubWeapons(scene, fx) {
  // ---- shared pools ----
  const orbMat = new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.72, depthWrite: false });
  const orbMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), orbMat, MAX_ORBS);
  orbMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_ORBS * 3), 3);
  orbMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  orbMesh.frustumCulled = false;
  scene.add(orbMesh);

  const beamMat = new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
  const beamMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.12, 1), beamMat, MAX_BEAMS);
  beamMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_BEAMS * 3), 3);
  beamMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  beamMesh.frustumCulled = false;
  scene.add(beamMesh);

  const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0).setPosition(0, -9999, 0);
  for (let i = 0; i < MAX_ORBS; i++) orbMesh.setMatrixAt(i, HIDDEN);
  for (let i = 0; i < MAX_BEAMS; i++) beamMesh.setMatrixAt(i, HIDDEN);

  // kind: "mine" | "rocket" | "fire"
  const orbs = Array.from({ length: MAX_ORBS }, () => ({
    live: false, kind: "mine", pos: new THREE.Vector3(), vel: new THREE.Vector3(),
    life: 0, max: 1, size: 1, damage: 0, radius: 0, col: new THREE.Color(), tick: 0,
  }));
  const beams = Array.from({ length: MAX_BEAMS }, () => ({
    live: false, a: new THREE.Vector3(), b: new THREE.Vector3(), life: 0, max: 1, col: new THREE.Color(),
  }));

  // ---- the two orbiting bodies ----
  const droneGroup = new THREE.Group();
  scene.add(droneGroup);
  const droneMat = new THREE.MeshStandardMaterial({ color: 0x2a303c, roughness: 0.5, metalness: 0.7, flatShading: true });
  const droneEye = new THREE.MeshBasicMaterial({ color: 0x7cc6ff, toneMapped: false });
  const drones = Array.from({ length: 4 }, () => {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), droneMat);
    hull.scale.set(1, 0.7, 1.2);
    g.add(hull);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), droneEye);
    eye.position.z = 0.3;
    g.add(eye);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.4, 6), droneMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.45;
    g.add(barrel);
    g.visible = false;
    droneGroup.add(g);
    return { node: g, cool: rand(0, 0.6) };
  });

  const plumb = new THREE.Group();
  scene.add(plumb);
  const plumbGem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.5).scale(0.8, 1.5, 0.8),
    new THREE.MeshBasicMaterial({ color: 0x56d06d, toneMapped: false })
  );
  plumbGem.position.y = 1.9;
  plumb.add(plumbGem);
  // the cutting edge itself: a flat blade sweeping at car height
  const plumbBlade = new THREE.Mesh(
    new THREE.RingGeometry(0.88, 1, 48, 1, 0, 1.15),
    new THREE.MeshBasicMaterial({ color: 0x56d06d, toneMapped: false, transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: false })
  );
  plumbBlade.rotation.x = -Math.PI / 2;
  plumbBlade.position.y = 0.9;
  plumb.add(plumbBlade);
  plumb.visible = false;

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const col = new THREE.Color();
  const FWD = new THREE.Vector3(0, 0, 1);

  const timers = { drone: 0, arc: 0, caltrop: 0, hornet: 0, scorch: 0 };
  let plumbAngle = 0;

  const freeOrb = () => orbs.find((o) => !o.live);
  const freeBeam = () => beams.find((b) => !b.live);

  function spark(a, b, colour, life = 0.12) {
    const s = freeBeam();
    if (!s) return;
    s.live = true; s.a.copy(a); s.b.copy(b); s.life = s.max = life; s.col.setHex(colour);
  }

  // nearest live enemies to a point, closest first
  function nearest(list, point, range, max, skip) {
    const out = [];
    for (const e of list) {
      if (!e.alive || (skip && skip.has(e))) continue;
      const d = Math.hypot(e.pos.x - point.x, e.pos.z - point.z);
      if (d <= range) out.push({ e, d });
    }
    out.sort((a, b) => a.d - b.d);
    return out.slice(0, max).map((o) => o.e);
  }

  const sys = {
    reset() {
      for (const o of orbs) o.live = false;
      for (const b of beams) b.live = false;
      for (let i = 0; i < MAX_ORBS; i++) orbMesh.setMatrixAt(i, HIDDEN);
      for (let i = 0; i < MAX_BEAMS; i++) beamMesh.setMatrixAt(i, HIDDEN);
      orbMesh.instanceMatrix.needsUpdate = beamMesh.instanceMatrix.needsUpdate = true;
      for (const d of drones) { d.node.visible = false; d.cool = rand(0, 0.6); }
      plumb.visible = false;
      for (const k of Object.keys(timers)) timers[k] = 0;
      plumbAngle = 0;
    },

    // hit(enemy, damage, crit, point) — the same one the roof gun uses, so lifesteal, explosive
    // rounds and kill tracking all apply to sub-weapon damage too.
    update(dt, player, stats, enemies, hit) {
      const W = stats.weapons || {};

      // ---------- Sentry Drone ----------
      const dn = W.drone | 0;
      const dCount = dn ? WEAPONS.drone.count(dn) : 0;
      drones.forEach((d, i) => {
        const on = i < dCount;
        d.node.visible = on;
        if (!on) return;
        const a = plumbAngle * 0.7 + (i / dCount) * TAU;
        const r = 3.4;
        d.node.position.set(player.pos.x + Math.cos(a) * r, 1.6 + Math.sin(plumbAngle * 2 + i) * 0.18, player.pos.z + Math.sin(a) * r);
        const target = nearest(enemies, d.node.position, WEAPONS.drone.range(), 1)[0];
        if (target) d.node.lookAt(target.pos.x, 1.0, target.pos.z);
        else d.node.rotation.y = -a;
        d.cool -= dt;
        if (target && d.cool <= 0) {
          d.cool = WEAPONS.drone.interval(dn);
          tmp.set(target.pos.x, 1.0, target.pos.z);
          spark(d.node.position, tmp, 0x7cc6ff);
          hit(target, WEAPONS.drone.damage(dn), false, tmp.clone());
        }
      });

      // ---------- Plumbob Reactor ----------
      const pn = W.plumbob | 0;
      plumb.visible = pn > 0;
      if (pn) {
        const spec = WEAPONS.plumbob;
        const rad = spec.radius(pn);
        plumbAngle += spec.spin(pn) * dt;
        plumb.position.set(player.pos.x, 0, player.pos.z);
        plumb.rotation.y = plumbAngle;
        plumbGem.rotation.y = plumbAngle * 3;
        plumbBlade.scale.setScalar(rad);
        // the blade is a 66° arc, so only what it is sweeping over right now takes damage
        for (const e of enemies) {
          if (!e.alive) continue;
          const dx = e.pos.x - player.pos.x, dz = e.pos.z - player.pos.z;
          const d = Math.hypot(dx, dz);
          if (d > rad || d < rad * 0.75) continue;
          let rel = (Math.atan2(dz, dx) + plumbAngle) % TAU;
          if (rel < 0) rel += TAU;
          if (rel < 1.15) hit(e, spec.dps(pn) * dt, false, e.pos.clone());
        }
      }

      // ---------- Arc Coil ----------
      const an = W.arc | 0;
      if (an) {
        const spec = WEAPONS.arc;
        timers.arc -= dt;
        if (timers.arc <= 0) {
          timers.arc = spec.interval(an);
          const skip = new Set();
          let from = tmp2.set(player.pos.x, 1.2, player.pos.z).clone();
          for (let j = 0; j < spec.jumps(an); j++) {
            const target = nearest(enemies, from, spec.range(), 1, skip)[0];
            if (!target) break;
            skip.add(target);
            tmp.set(target.pos.x, 1.1, target.pos.z);
            spark(from, tmp, 0xa98bff, 0.2);
            hit(target, spec.damage(an), false, tmp.clone());
            from = tmp.clone();
          }
        }
      }

      // ---------- Caltrop Bay ----------
      const cn = W.caltrop | 0;
      if (cn) {
        const spec = WEAPONS.caltrop;
        timers.caltrop -= dt;
        if (timers.caltrop <= 0 && Math.abs(player.speed) > 4) {
          timers.caltrop = spec.interval(cn);
          const o = freeOrb();
          if (o) {
            o.live = true; o.kind = "mine";
            o.pos.set(player.pos.x - Math.sin(player.yaw) * 3, 0.4, player.pos.z - Math.cos(player.yaw) * 3);
            o.life = o.max = spec.life();
            o.size = 0.34; o.damage = spec.damage(cn); o.radius = spec.radius(cn);
            o.col.setHex(0xffc94a);
          }
        }
      }

      // ---------- Hornet Pod ----------
      const hn = W.hornet | 0;
      if (hn) {
        const spec = WEAPONS.hornet;
        timers.hornet -= dt;
        if (timers.hornet <= 0 && nearest(enemies, player.pos, 60, 1).length) {
          timers.hornet = spec.interval(hn);
          for (let i = 0; i < spec.salvo(hn); i++) {
            const o = freeOrb();
            if (!o) break;
            o.live = true; o.kind = "rocket";
            o.pos.set(player.pos.x, 1.3, player.pos.z);
            const a = player.yaw + rand(-1, 1);
            o.vel.set(Math.sin(a) * 16, rand(3, 6), Math.cos(a) * 16);
            o.life = o.max = 4.5;
            o.size = 0.22; o.damage = spec.damage(hn); o.radius = spec.radius();
            o.col.setHex(0xff8a3c);
          }
        }
      }

      // ---------- Scorch Trail ----------
      const sn = W.scorch | 0;
      if (sn) {
        const spec = WEAPONS.scorch;
        timers.scorch -= dt;
        if (timers.scorch <= 0 && player.boosting) {
          timers.scorch = spec.interval();
          const o = freeOrb();
          if (o) {
            o.live = true; o.kind = "fire";
            o.pos.set(player.pos.x - Math.sin(player.yaw) * 2.6, 0.25, player.pos.z - Math.cos(player.yaw) * 2.6);
            o.life = o.max = spec.life(sn);
            o.size = spec.radius(sn); o.damage = spec.dps(sn); o.radius = spec.radius(sn);
            o.col.setHex(0xff5a3c);
          }
        }
      }

      // ---------- advance the pooled bodies ----------
      for (let i = 0; i < MAX_ORBS; i++) {
        const o = orbs[i];
        if (!o.live) { orbMesh.setMatrixAt(i, HIDDEN); continue; }
        o.life -= dt;
        const k = o.life / o.max;

        if (o.kind === "rocket") {
          const target = nearest(enemies, o.pos, 70, 1)[0];
          if (target) {
            tmp.set(target.pos.x - o.pos.x, 0.8 - o.pos.y, target.pos.z - o.pos.z).normalize().multiplyScalar(30);
            o.vel.lerp(tmp, damp(3.2, dt));
          }
          o.pos.addScaledVector(o.vel, dt);
          const near = nearest(enemies, o.pos, 1.6, 1)[0];
          if (near || o.life <= 0 || o.pos.y < 0.15) {
            for (const e of nearest(enemies, o.pos, o.radius, 6)) hit(e, o.damage, false, e.pos.clone());
            fx.explode(o.pos, 0.7, 0xff8a3c, 9);
            o.live = false; orbMesh.setMatrixAt(i, HIDDEN); continue;
          }
          q.setFromUnitVectors(FWD, tmp2.copy(o.vel).normalize());
          scl.setScalar(o.size);
        } else if (o.kind === "mine") {
          const near = nearest(enemies, o.pos, 2.2, 1)[0];
          if (near || o.life <= 0) {
            if (near) {
              for (const e of nearest(enemies, o.pos, o.radius, 8)) hit(e, o.damage, false, e.pos.clone());
              fx.explode(o.pos, 0.9, 0xffc94a, 11);
            }
            o.live = false; orbMesh.setMatrixAt(i, HIDDEN); continue;
          }
          q.setFromAxisAngle(tmp.set(0, 1, 0), o.life * 3);
          scl.setScalar(o.size * (1 + Math.sin(o.life * 9) * 0.12));
        } else {  // fire
          o.tick -= dt;
          if (o.tick <= 0) {
            o.tick = 0.25;
            for (const e of nearest(enemies, o.pos, o.radius, 6)) hit(e, o.damage * 0.25, false, e.pos.clone());
          }
          if (o.life <= 0) { o.live = false; orbMesh.setMatrixAt(i, HIDDEN); continue; }
          q.setFromAxisAngle(tmp.set(0, 1, 0), o.life * 1.4);
          scl.set(o.size * 0.5 * k, 0.08, o.size * 0.5 * k);
        }

        orbMesh.setMatrixAt(i, m4.compose(o.pos, q, scl));
        col.copy(o.col).multiplyScalar(o.kind === "fire" ? 0.22 + k * 0.3 : 1);
        orbMesh.setColorAt(i, col);
      }
      orbMesh.instanceMatrix.needsUpdate = true;
      if (orbMesh.instanceColor) orbMesh.instanceColor.needsUpdate = true;
      orbMat.opacity = 1;

      // ---------- tracers and lightning ----------
      for (let i = 0; i < MAX_BEAMS; i++) {
        const b = beams[i];
        if (!b.live) { beamMesh.setMatrixAt(i, HIDDEN); continue; }
        b.life -= dt;
        if (b.life <= 0) { b.live = false; beamMesh.setMatrixAt(i, HIDDEN); continue; }
        const len = b.a.distanceTo(b.b);
        tmp.copy(b.a).add(b.b).multiplyScalar(0.5);
        q.setFromUnitVectors(FWD, tmp2.copy(b.b).sub(b.a).normalize());
        const k = b.life / b.max;
        scl.set(k, k, len);
        beamMesh.setMatrixAt(i, m4.compose(tmp, q, scl));
        col.copy(b.col).multiplyScalar(k);
        beamMesh.setColorAt(i, col);
      }
      beamMesh.instanceMatrix.needsUpdate = true;
      if (beamMesh.instanceColor) beamMesh.instanceColor.needsUpdate = true;
    },
  };

  sys.reset();
  return sys;
}
