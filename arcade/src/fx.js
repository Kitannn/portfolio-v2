// Particles and pickups. Everything here is pooled into a handful of InstancedMeshes, because a
// screen full of exploding drones would otherwise be hundreds of draw calls.
//
// Fading is done by scaling each instance's colour toward black under additive blending — that
// gives a per-particle fade without a per-particle material.
import * as THREE from "three";
import { clamp, damp, rand, TAU } from "./util.js";

const DEBRIS = 900;     // shards across every simultaneous explosion
const FLASHES = 40;     // blast shells
const SHARDS = 260;     // XP diamonds waiting to be collected

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0).setPosition(0, -9999, 0);

function pooledMesh(geo, count, { additive = true, color = 0xffffff } = {}) {
    // NB: no vertexColors here. InstancedMesh tints via instanceColor (USE_INSTANCING_COLOR);
    // switching vertexColors on as well defines USE_COLOR, whose `color` attribute this
    // geometry does not have — the shader then multiplies by an unbound attribute and every
    // instance renders black.
  const mat = new THREE.MeshBasicMaterial({
    color, toneMapped: false,
    transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, HIDDEN);
  return mesh;
}

export function createFx(scene) {
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const tmpCol = new THREE.Color();

  // ---- debris shards ----
  const debrisMesh = pooledMesh(new THREE.TetrahedronGeometry(0.5), DEBRIS);
  scene.add(debrisMesh);
  const debris = Array.from({ length: DEBRIS }, () => ({
    live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(),
    life: 0, max: 1, size: 1, spin: new THREE.Vector3(), rot: new THREE.Euler(),
    col: new THREE.Color(),
  }));
  let dCursor = 0;

  // ---- blast shells ----
  const flashMesh = pooledMesh(new THREE.IcosahedronGeometry(1, 1), FLASHES);
  scene.add(flashMesh);
  const flashes = Array.from({ length: FLASHES }, () => ({
    live: false, pos: new THREE.Vector3(), life: 0, max: 1, size: 1, col: new THREE.Color(),
  }));
  let fCursor = 0;

  // ---- XP diamonds ----
  // A stretched octahedron reads as a cut gem; an even one just looks like a lump. Unlit and
  // un-tonemapped so it stays bright against the dark plain and never gets lost in the grid.
  const gem = new THREE.OctahedronGeometry(0.30);
  gem.scale(0.82, 1.55, 0.82);
  const shardMesh = pooledMesh(gem, SHARDS, { additive: false });
  shardMesh.material.opacity = 1;
  scene.add(shardMesh);

  // a soft additive halo behind each gem so they read from across the arena
  const haloMesh = pooledMesh(new THREE.OctahedronGeometry(0.62), SHARDS);
  scene.add(haloMesh);
  const shards = Array.from({ length: SHARDS }, () => ({
    live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(),
    value: 1, phase: 0, age: 0, pulling: false,
    colour: new THREE.Color(), halo: new THREE.Color(), size: 1,
  }));
  let sCursor = 0;

  // XP comes out as coins, not one lump: the value is broken into denominations so a big drop
  // reads as a little pile you can see the worth of at a glance.
  const XP_TIERS = [
    { value: 20, colour: 0xc07bff, halo: 0x6a3fa0, size: 1.5 },   // purple
    { value: 10, colour: 0xff5f6e, halo: 0x9c2b3a, size: 1.28 },  // red
    { value: 5,  colour: 0x56d06d, halo: 0x247a3c, size: 1.1 },   // green
    { value: 1,  colour: 0x8fe3ff, halo: 0x2f9fd8, size: 0.88 },  // blue
  ];
  const MAX_GEMS_PER_DROP = 12;      // a huge payout stays a pile, not a carpet
  const nextFree = (arr, cur) => {
    for (let i = 0; i < arr.length; i++) {
      const idx = (cur + i) % arr.length;
      if (!arr[idx].live) return idx;
    }
    return cur;       // everything is busy: recycle the oldest slot
  };

  const fx = {
    // A death: a bright shell plus a burst of glowing shrapnel.
    explode(pos, scale = 1, color = 0xff6a4a, count = 14) {
      const c = new THREE.Color(color);
      const fi = nextFree(flashes, fCursor);
      fCursor = (fi + 1) % FLASHES;
      const f = flashes[fi];
      f.live = true; f.pos.copy(pos); f.life = f.max = 0.26 * scale; f.size = 0.52 * scale;
      f.col.copy(c).lerp(new THREE.Color(0xffffff), 0.3);

      for (let i = 0; i < count; i++) {
        const di = nextFree(debris, dCursor);
        dCursor = (di + 1) % DEBRIS;
        const d = debris[di];
        const a = rand(0, TAU), up = rand(0.1, 1.0);
        d.live = true;
        d.pos.copy(pos);
        d.vel.set(Math.cos(a) * rand(4, 15) * scale, up * rand(4, 13) * scale, Math.sin(a) * rand(4, 15) * scale);
        d.life = d.max = rand(0.5, 1.15) * scale;
        d.size = rand(0.14, 0.42) * scale;
        d.spin.set(rand(-9, 9), rand(-9, 9), rand(-9, 9));
        d.rot.set(rand(0, TAU), rand(0, TAU), rand(0, TAU));
        d.col.copy(c).multiplyScalar(rand(0.7, 1.5));
      }
    },

    // A round landing: a couple of sparks kicked back along the surface normal.
    spark(pos, dir, color = 0xbfe6ff, count = 4) {
      const c = new THREE.Color(color);
      for (let i = 0; i < count; i++) {
        const di = nextFree(debris, dCursor);
        dCursor = (di + 1) % DEBRIS;
        const d = debris[di];
        d.live = true;
        d.pos.copy(pos);
        d.vel.copy(dir).multiplyScalar(rand(3, 9)).add(new THREE.Vector3(rand(-4, 4), rand(0, 6), rand(-4, 4)));
        d.life = d.max = rand(0.14, 0.3);
        d.size = rand(0.07, 0.15);
        d.spin.set(rand(-14, 14), rand(-14, 14), rand(-14, 14));
        d.rot.set(rand(0, TAU), rand(0, TAU), rand(0, TAU));
        d.col.copy(c);
      }
    },

    // Break `value` into gems, biggest denomination first. Anything left over once the gem budget
    // is spent is folded into the last gem, so no XP is ever lost to rounding.
    dropXp(pos, value = 1) {
      let left = Math.max(1, Math.round(value));
      const plan = [];
      for (const tier of XP_TIERS) {
        while (left >= tier.value && plan.length < MAX_GEMS_PER_DROP) {
          plan.push(tier);
          left -= tier.value;
        }
      }
      if (!plan.length) plan.push(XP_TIERS[XP_TIERS.length - 1]);
      const spare = left;

      plan.forEach((tier, i) => {
        const si = nextFree(shards, sCursor);
        sCursor = (si + 1) % SHARDS;
        const s = shards[si];
        s.live = true;
        s.pos.set(pos.x + rand(-0.5, 0.5), 0.7, pos.z + rand(-0.5, 0.5));
        const a = rand(0, TAU);
        s.vel.set(Math.cos(a) * rand(1.5, 4.5), rand(4, 7), Math.sin(a) * rand(1.5, 4.5));
        s.value = tier.value + (i === plan.length - 1 ? spare : 0);
        s.colour.setHex(tier.colour);
        s.halo.setHex(tier.halo);
        s.size = tier.size;
        s.phase = rand(0, TAU);
        s.age = 0;
        s.pulling = false;
      });
    },

    reset() {
      for (const a of [debris, flashes, shards]) for (const o of a) o.live = false;
      for (let i = 0; i < DEBRIS; i++) debrisMesh.setMatrixAt(i, HIDDEN);
      for (let i = 0; i < FLASHES; i++) flashMesh.setMatrixAt(i, HIDDEN);
      for (let i = 0; i < SHARDS; i++) { shardMesh.setMatrixAt(i, HIDDEN); haloMesh.setMatrixAt(i, HIDDEN); }
      debrisMesh.instanceMatrix.needsUpdate = flashMesh.instanceMatrix.needsUpdate = shardMesh.instanceMatrix.needsUpdate = haloMesh.instanceMatrix.needsUpdate = true;
    },

    // onPickup(value) is called once per diamond collected
    update(dt, player, pickupRadius, onPickup) {
      // debris: ballistic, tumbling, fading to black
      for (let i = 0; i < DEBRIS; i++) {
        const d = debris[i];
        if (!d.live) { debrisMesh.setMatrixAt(i, HIDDEN); continue; }
        d.life -= dt;
        if (d.life <= 0) { d.live = false; debrisMesh.setMatrixAt(i, HIDDEN); continue; }
        d.vel.y -= 26 * dt;
        d.pos.addScaledVector(d.vel, dt);
        if (d.pos.y < 0.12) { d.pos.y = 0.12; d.vel.y = Math.abs(d.vel.y) * 0.34; d.vel.multiplyScalar(0.7); }
        d.rot.x += d.spin.x * dt; d.rot.y += d.spin.y * dt; d.rot.z += d.spin.z * dt;
        const k = d.life / d.max;
        q.setFromEuler(d.rot);
        scl.setScalar(d.size * (0.5 + k * 0.5));
        debrisMesh.setMatrixAt(i, m4.compose(d.pos, q, scl));
        // setColorAt reads .r/.g/.b — handing it a Vector3 silently writes NaN and the particle
        // vanishes, which is exactly how an explosion goes missing without erroring.
        tmpCol.copy(d.col).multiplyScalar(k * k);
        debrisMesh.setColorAt(i, tmpCol);
      }
      debrisMesh.instanceMatrix.needsUpdate = true;
      if (debrisMesh.instanceColor) debrisMesh.instanceColor.needsUpdate = true;

      // flashes: expand hard, then vanish
      for (let i = 0; i < FLASHES; i++) {
        const f = flashes[i];
        if (!f.live) { flashMesh.setMatrixAt(i, HIDDEN); continue; }
        f.life -= dt;
        if (f.life <= 0) { f.live = false; flashMesh.setMatrixAt(i, HIDDEN); continue; }
        const k = f.life / f.max;
        const grow = 1 - k;
        scl.setScalar(f.size * (0.45 + grow * 2.0));
        flashMesh.setMatrixAt(i, m4.compose(f.pos, q.identity(), scl));
        tmpCol.copy(f.col).multiplyScalar(k * k * 1.15);
        flashMesh.setColorAt(i, tmpCol);
      }
      flashMesh.instanceMatrix.needsUpdate = true;
      if (flashMesh.instanceColor) flashMesh.instanceColor.needsUpdate = true;

      // XP: pop out, settle, then get dragged in once the player is close enough
      for (let i = 0; i < SHARDS; i++) {
        const s = shards[i];
        if (!s.live) { shardMesh.setMatrixAt(i, HIDDEN); haloMesh.setMatrixAt(i, HIDDEN); continue; }
        s.age += dt;
        // shards do not litter the arena forever; they fade out if nothing collects them
        if (s.age > 30) { s.live = false; shardMesh.setMatrixAt(i, HIDDEN); haloMesh.setMatrixAt(i, HIDDEN); continue; }
        const dx = player.pos.x - s.pos.x, dz = player.pos.z - s.pos.z;
        const dist = Math.hypot(dx, dz);

        if (!s.pulling && dist < pickupRadius) s.pulling = true;
        if (s.pulling) {
          // accelerate toward the car so a pickup feels like a magnet, not a teleport
          const pull = clamp(34 + (pickupRadius - dist) * 6, 20, 130);
          s.vel.x += (dx / (dist || 1)) * pull * dt;
          s.vel.z += (dz / (dist || 1)) * pull * dt;
          s.vel.y += ((1.0 - s.pos.y) * 10 - s.vel.y) * damp(6, dt);
          s.vel.x *= 1 - damp(2.0, dt);
          s.vel.z *= 1 - damp(2.0, dt);
          if (dist < 1.9) {
            s.live = false;
            shardMesh.setMatrixAt(i, HIDDEN);
            haloMesh.setMatrixAt(i, HIDDEN);
            onPickup(s.value);
            continue;
          }
        } else {
          s.vel.y -= 22 * dt;
          s.vel.x *= 1 - damp(3.2, dt);
          s.vel.z *= 1 - damp(3.2, dt);
        }
        s.pos.addScaledVector(s.vel, dt);
        if (s.pos.y < 0.62 && !s.pulling) { s.pos.y = 0.62; s.vel.y = Math.abs(s.vel.y) * 0.3; }

        // spin on the spot, and bob gently once it has settled
        e.set(0, s.age * 2.6 + s.phase, 0);
        q.setFromEuler(e);
        const bob = s.pulling ? 0 : Math.sin(s.age * 3 + s.phase) * 0.12;
        v.set(s.pos.x, s.pos.y + bob, s.pos.z);
        scl.setScalar(s.size);
        shardMesh.setMatrixAt(i, m4.compose(v, q, scl));
        shardMesh.setColorAt(i, s.colour);
        // the halo breathes, which is what catches the eye at a distance
        const pulseK = 0.72 + Math.sin(s.age * 4.4 + s.phase) * 0.14;
        scl.setScalar(s.size * pulseK);
        haloMesh.setMatrixAt(i, m4.compose(v, q, scl));
        tmpCol.copy(s.halo).multiplyScalar(0.55);
        haloMesh.setColorAt(i, tmpCol);
      }
      shardMesh.instanceMatrix.needsUpdate = true;
      haloMesh.instanceMatrix.needsUpdate = true;
      if (shardMesh.instanceColor) shardMesh.instanceColor.needsUpdate = true;
      if (haloMesh.instanceColor) haloMesh.instanceColor.needsUpdate = true;
    },

    liveXp: () => shards.reduce((n, s) => n + (s.live ? 1 : 0), 0),
  };

  return fx;
}
