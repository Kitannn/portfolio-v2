// The roof gun: magazine, reload, tracers and hit resolution.
//
// Rounds live in one pooled InstancedMesh, so a few hundred tracers cost a single draw call.
// Everything it does is driven by the run's stat block, which the upgrade cards write to — the
// weapon itself has no idea cards exist.
import * as THREE from "three";
import { clamp, damp, rand } from "./util.js";

const MAX_BULLETS = 320;
const LIFETIME = 2.6;      // seconds before a round expires

export function createWeapon(scene, car, getStats) {
  // ---- tracer pool ----
  const geo = new THREE.BoxGeometry(0.07, 0.07, 1);   // stretched along its own +Z, i.e. its travel
  const mat = new THREE.MeshBasicMaterial({ color: 0xbfe6ff, toneMapped: false });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX_BULLETS);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = MAX_BULLETS;
  scene.add(mesh);

  const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0).setPosition(0, -9999, 0);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const fwd = new THREE.Vector3(0, 0, 1);
  const scl = new THREE.Vector3();

  // free-list pool; a bullet slot is its instance index, so nothing is ever re-sorted
  const bullets = Array.from({ length: MAX_BULLETS }, () => ({
    live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(),
    life: 0, damage: 1, pierce: 0, hit: new Set(), bounces: 0,
  }));
  let cursor = 0;

  // ---- muzzle flash ----
  const flashLight = new THREE.PointLight(0xffd9a0, 0, 12, 2);
  car.muzzle.add(flashLight);
  const flashMesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.42, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe3b0, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })
  );
  flashMesh.rotation.x = Math.PI / 2;
  flashMesh.position.z = 0.18;
  car.muzzle.add(flashMesh);
  let flash = 0;

  const muzzleWorld = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

  const w = {
    mag: getStats().magazine,
    reloading: false,
    reloadLeft: 0,
    cooldown: 0,
    recoil: 0,
    // run tally, read by the HUD and the finish screen
    fired: 0, hits: 0, damageDealt: 0, kills: 0,
    kineticCount: 0,
    onHit: null,      // set by the game: (enemy, damage, crit, bulletPos) => void
    onKill: null,
  };

  w.reset = () => {
    const s = getStats();
    w.mag = s.magazine;
    w.reloading = false; w.reloadLeft = 0; w.cooldown = 0;
    w.fired = w.hits = w.damageDealt = w.kills = 0;
    w.kineticCount = 0;
    for (const b of bullets) b.live = false;
    for (let i = 0; i < MAX_BULLETS; i++) mesh.setMatrixAt(i, HIDDEN);
    mesh.instanceMatrix.needsUpdate = true;
  };

  w.startReload = () => {
    const s = getStats();
    if (w.reloading || s.infiniteBelt || w.mag >= s.magazine) return;
    w.reloading = true;
    w.reloadLeft = s.reloadTime;
  };

  // fraction of the reload still to run, for the HUD ring
  w.reloadProgress = () => (w.reloading ? 1 - w.reloadLeft / Math.max(0.01, getStats().reloadTime) : 1);

  function spawn(origin, direction, s) {
    // find a free slot; if every one is busy the oldest gets recycled
    let slot = -1;
    for (let i = 0; i < MAX_BULLETS; i++) {
      const idx = (cursor + i) % MAX_BULLETS;
      if (!bullets[idx].live) { slot = idx; break; }
    }
    if (slot < 0) slot = cursor;
    cursor = (slot + 1) % MAX_BULLETS;

    const b = bullets[slot];
    b.live = true;
    b.pos.copy(origin);
    b.vel.copy(direction).multiplyScalar(s.bulletSpeed);
    b.life = LIFETIME;
    b.pierce = s.pierce;
    b.bounces = s.ricochet;
    b.hit.clear();

    // kinetic battery: every Nth round hits far harder
    let dmg = s.damage;
    if (s.kineticEvery) {
      w.kineticCount++;
      if (w.kineticCount >= s.kineticEvery) { w.kineticCount = 0; dmg *= s.kineticMult; }
    }
    b.damage = dmg;
    return b;
  }

  function fire(aimPoint, boosting) {
    const s = getStats();
    car.muzzle.getWorldPosition(muzzleWorld);
    dir.copy(aimPoint).sub(muzzleWorld);
    dir.y = 0;                      // the gun elevates visually, but rounds travel flat
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    dir.normalize();

    const power = boosting ? s.boostDamageMult : 1;
    for (let i = 0; i < s.shots; i++) {
      const a = Math.atan2(dir.x, dir.z) + rand(-s.spread, s.spread) + (s.shots > 1 ? (i - (s.shots - 1) / 2) * s.spread * 1.4 : 0);
      tmp.set(Math.sin(a), 0, Math.cos(a));
      const b = spawn(muzzleWorld, tmp, s);
      b.damage *= power;
      w.fired++;
    }
    if (!s.infiniteBelt) w.mag--;
    w.cooldown = 1 / Math.max(0.5, s.fireRate);
    w.recoil = 1;
    flash = 1;
    if (w.mag <= 0 && !s.infiniteBelt) w.startReload();
  }

  // targets: [{ pos: Vector3, radius, alive, hit(damage, crit, point) }]
  w.update = (dt, { firing, aimPoint, boosting, targets = [] }) => {
    const s = getStats();

    if (w.reloading) {
      w.reloadLeft -= dt;
      if (w.reloadLeft <= 0) { w.reloading = false; w.mag = s.magazine; }
    }
    w.cooldown -= dt;
    if (firing && !w.reloading && w.cooldown <= 0 && (w.mag > 0 || s.infiniteBelt)) fire(aimPoint, boosting);

    // recoil kicks the cradle and settles back
    w.recoil = Math.max(0, w.recoil - dt * 9);
    car.gunPitch.position.z = -w.recoil * 0.05;

    flash = Math.max(0, flash - dt * 22);
    flashLight.intensity = flash * 26;
    flashMesh.material.opacity = flash * 0.85;
    flashMesh.scale.setScalar(0.7 + flash * 0.6);

    // ---- advance rounds and resolve hits ----
    for (let i = 0; i < MAX_BULLETS; i++) {
      const b = bullets[i];
      if (!b.live) { mesh.setMatrixAt(i, HIDDEN); continue; }

      // seeking rounds bend toward the nearest live target
      if (s.homing && targets.length) {
        let best = null, bestD = 900;
        for (const t of targets) {
          if (!t.alive || b.hit.has(t)) continue;
          const d = b.pos.distanceToSquared(t.pos);
          if (d < bestD) { bestD = d; best = t; }
        }
        if (best) {
          tmp.copy(best.pos).sub(b.pos); tmp.y = 0; tmp.normalize().multiplyScalar(s.bulletSpeed);
          b.vel.lerp(tmp, damp(s.homing, dt)).setLength(s.bulletSpeed);
        }
      }

      const step = b.vel.clone().multiplyScalar(dt);
      const travel = step.length();

      // Swept test, so a fast round cannot tunnel through a small enemy in one frame.
      // Deliberately flat: everything in this game is aimed with a reticle on the ground, so an
      // enemy is a vertical cylinder. Testing in 3D instead means a jeep's 1.5 m of body height
      // eats its whole hit radius and nothing can ever be hit.
      for (const t of targets) {
        if (!t.alive || b.hit.has(t)) continue;
        tmp.set(t.pos.x - b.pos.x, 0, t.pos.z - b.pos.z);
        const flatStep = tmp2.set(step.x, 0, step.z);
        const flatLen = flatStep.length();
        const along = clamp(tmp.dot(flatStep) / Math.max(1e-6, flatLen * flatLen), 0, 1);
        const closest = tmp.sub(flatStep.clone().multiplyScalar(along)).length();
        if (closest > t.radius) continue;

        b.hit.add(t);
        const crit = Math.random() < s.critChance;
        const dmg = b.damage * (crit ? s.critMult : 1);
        w.hits++;
        w.damageDealt += dmg;
        w.onHit?.(t, dmg, crit, b.pos.clone());
        if (b.pierce > 0) b.pierce--;
        else if (b.bounces > 0) {
          // ricochet: turn toward another nearby enemy rather than dying
          b.bounces--;
          let next = null, nd = 400;
          for (const o of targets) {
            if (!o.alive || b.hit.has(o)) continue;
            const d = b.pos.distanceToSquared(o.pos);
            if (d < nd) { nd = d; next = o; }
          }
          if (!next) { b.live = false; break; }
          b.vel.copy(next.pos).sub(b.pos).setY(0).setLength(s.bulletSpeed);
        } else { b.live = false; break; }
      }
      if (!b.live) { mesh.setMatrixAt(i, HIDDEN); continue; }

      b.pos.add(step);
      b.life -= dt;
      if (b.life <= 0 || b.pos.y < -2) { b.live = false; mesh.setMatrixAt(i, HIDDEN); continue; }

      // orient the tracer along its travel and stretch it with speed
      dir.copy(b.vel).normalize();
      q.setFromUnitVectors(fwd, dir);
      scl.set(1, 1, clamp(travel * 2.2, 0.6, 3.4));
      mesh.setMatrixAt(i, m4.compose(b.pos, q, scl));
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  w.accuracy = () => (w.fired ? w.hits / w.fired : 0);
  w.liveBullets = () => bullets.filter((b) => b.live).length;
  return w;
}
