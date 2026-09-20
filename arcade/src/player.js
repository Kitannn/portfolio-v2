// Player driving model and chase camera.
//
// Arcade handling, not a simulator: velocity is split into forward and lateral components, the
// engine pushes the forward one, and "grip" is just how fast the lateral one bleeds off. Dropping
// grip with the handbrake is what makes it slide, which is the whole feel of the thing.
import * as THREE from "three";
import { buildCar } from "./car.js";
import { ARENA } from "./world.js";
import { angleDelta, clamp, damp, lerp } from "./util.js";

const ACCEL = 21;          // m/s² on the throttle
const REVERSE = 10;
const BOOST_ACCEL = 30;    // extra push while boosting
const DRAG = 0.55;         // rolling + aero, applied to forward speed
const BRAKE = 26;
const GRIP = 7.2;          // how hard the tyres kill sideways speed
const GRIP_SLIDE = 1.15;   // …with the handbrake pulled
const MAX_YAW = 1.75;      // rad/s at the steering sweet spot — any higher and it pivots like a kart
const TOP_SPEED = 46;      // ~165 km/h
const BOOST_TOP = 66;

const BOOST_DRAIN = 34;      // boost per second while held
const BOOST_DELAY = 1.1;     // seconds off the boost before it starts refilling
const SAFE_AFTER = 3.0;      // seconds without a hit before "out of combat" regen kicks in

export function createPlayer(scene, getStats) {
  const car = buildCar({ color: 0xeef1f6 });
  scene.add(car.root);

  const s = {
    car,
    pos: new THREE.Vector3(0, 0, 0),
    vel: new THREE.Vector3(0, 0, 0),
    yaw: 0,
    yawRate: 0,
    speed: 0,          // signed forward speed
    slip: 0,           // signed lateral speed — drives the drift smoke
    steerAngle: 0,     // visual front-wheel angle
    wheelSpin: 0,
    boosting: false,
    boost: 100,
    boostIdle: 0,
    hp: 100,
    maxHp: 100,
    shield: 0,
    maxShield: 0,
    sinceHit: 99,      // drives out-of-combat regen and the shield delay
    dead: false,
    invulnerable: false,   // the all-codes reward, granted for a single run
    aimPoint: new THREE.Vector3(0, 1.3, 10),
    gunYawWorld: 0,
    // the roll/pitch the shell leans by, smoothed
    roll: 0, pitch: 0,
  };

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();

  s.forwardVec = () => forward.set(Math.sin(s.yaw), 0, Math.cos(s.yaw)).clone();

  // Re-read the stat block after a card is taken. Max HP going up is a gift, not a heal, so the
  // current value follows the increase; max HP going down (Reactor Unsealed) must not kill you.
  s.applyStats = () => {
    const st = getStats();
    const hpGain = Math.max(0, st.maxHp - s.maxHp);
    s.maxHp = st.maxHp;
    s.hp = clamp(s.hp + hpGain, 1, s.maxHp);
    s.maxShield = st.maxShield;
    s.maxBoost = st.maxBoost;
    s.boost = Math.min(s.boost, s.maxBoost);
  };

  s.reset = () => {
    const st = getStats();
    s.pos.set(0, 0, 0); s.vel.set(0, 0, 0);
    s.yaw = 0; s.yawRate = 0; s.speed = 0; s.slip = 0;
    s.maxHp = st.maxHp; s.maxShield = st.maxShield; s.maxBoost = st.maxBoost;
    s.hp = s.maxHp; s.shield = 0; s.boost = s.maxBoost;
    s.boostIdle = 0; s.sinceHit = 99; s.dead = false;
    s.roll = s.pitch = 0;
  };

  s.heal = (n) => { s.hp = Math.min(s.maxHp, s.hp + n); };
  // A one-off shield card can push the pool past its regenerating maximum; the overflow simply
  // never comes back once spent, which is exactly what "does not come back" should feel like.
  s.addShield = (n) => { s.shield += n; };

  // returns the damage that actually landed, so the HUD can flash proportionally
  s.takeDamage = (n) => {
    const st = getStats();
    if (s.dead || s.invulnerable) return 0;
    if (s.boosting && st.phantomBoost) return 0;
    let dmg = n * st.damageTaken * (s.boosting ? 1 - st.boostArmor : 1);
    s.sinceHit = 0;
    if (s.shield > 0) {
      const absorbed = Math.min(s.shield, dmg);
      s.shield -= absorbed;
      dmg -= absorbed;
    }
    s.hp -= dmg;
    if (s.hp <= 0) {
      if (st.secondWind && !s.usedSecondWind) { s.usedSecondWind = true; s.hp = 50; return n; }
      s.hp = 0; s.dead = true;
    }
    return n;
  };

  s.update = (dt, input) => {
    forward.set(Math.sin(s.yaw), 0, Math.cos(s.yaw));
    right.set(-Math.cos(s.yaw), 0, Math.sin(s.yaw));   // the car's right-hand side

    let vf = s.vel.dot(forward);
    let vr = s.vel.dot(right);

    const st = getStats();

    // ---- boost ----
    const floor = st.boostFloor * s.maxBoost;
    const wantBoost = input.boost && s.boost > floor + 0.5 && input.throttle > 0;
    s.boosting = wantBoost;
    if (wantBoost) {
      s.boost = Math.max(floor, s.boost - BOOST_DRAIN * st.boostDrainMult * dt);
      s.boostIdle = 0;
      if (st.boostShield && s.maxShield > 0) s.shield = Math.min(s.maxShield, s.shield + st.boostShield * dt);
    } else {
      s.boostIdle += dt;
      if (s.boostIdle > BOOST_DELAY) s.boost = Math.min(s.maxBoost, s.boost + st.boostRegen * dt);
    }

    // ---- regeneration ----
    s.sinceHit += dt;
    const heal = st.regen + (s.sinceHit > SAFE_AFTER ? st.safeRegen : 0);
    if (heal && s.hp > 0) s.hp = Math.min(s.maxHp, s.hp + heal * dt);
    if (st.shieldRegen && s.sinceHit > st.shieldDelay && s.shield < s.maxShield) {
      s.shield = Math.min(s.maxShield, s.shield + st.shieldRegen * dt);
    }

    // ---- engine / brakes ----
    const top = (wantBoost ? BOOST_TOP * st.boostTopMult : TOP_SPEED) * st.topSpeedMult;
    if (input.throttle > 0) {
      const push = ACCEL + (wantBoost ? BOOST_ACCEL * st.boostPower : 0);
      // taper off near the top speed instead of clamping hard
      vf += push * input.throttle * dt * clamp(1 - Math.max(vf, 0) / top, 0, 1);
    } else if (input.throttle < 0) {
      if (vf > 0.5) vf -= BRAKE * dt;                                  // brake first
      else vf -= REVERSE * dt * clamp(1 + vf / 16, 0, 1);              // then reverse
    }
    vf -= vf * DRAG * dt;
    if (input.handbrake) vf -= vf * 1.35 * dt;
    if (vf > top) vf = lerp(vf, top, damp(3, dt));

    // ---- steering ----
    // very little bite when nearly stopped, full bite by ~12 m/s, easing off again flat out
    const sp = Math.abs(vf);
    const bite = clamp(sp / 12, 0, 1) * lerp(1, 0.62, clamp((sp - 26) / 34, 0, 1));
    // steering right turns the car toward -X, which is a DECREASING yaw
    const targetYawRate = -input.steer * MAX_YAW * st.turnMult * bite * (vf < -0.4 ? -1 : 1);
    s.yawRate = lerp(s.yawRate, targetYawRate, damp(9, dt));
    s.yaw += s.yawRate * dt;

    // ---- grip ----
    // a slide costs you speed, and pulling the handbrake mostly just stops the tyres fighting it
    const grip = input.handbrake ? GRIP_SLIDE : GRIP * st.gripMult * clamp(1 - Math.abs(vr) / 26, 0.45, 1);
    // cornering throws weight sideways: that is what starts the slide in the first place
    vr += s.yawRate * vf * dt * 0.92;
    vr -= vr * grip * dt;
    vf -= Math.abs(vr) * 0.16 * dt * Math.sign(vf || 1);

    s.vel.copy(forward).multiplyScalar(vf).addScaledVector(right, vr);
    s.pos.addScaledVector(s.vel, dt);
    s.speed = vf;
    s.slip = vr;

    // ---- arena wall: push back in and scrub speed rather than hard-stopping ----
    const r = Math.hypot(s.pos.x, s.pos.z);
    if (r > ARENA - 2.2) {
      const nx = s.pos.x / r, nz = s.pos.z / r;
      const over = r - (ARENA - 2.2);
      s.pos.x -= nx * over; s.pos.z -= nz * over;
      const into = s.vel.x * nx + s.vel.z * nz;
      if (into > 0) { s.vel.x -= nx * into * 1.35; s.vel.z -= nz * into * 1.35; }
    }

    // ---- presentation ----
    s.steerAngle = lerp(s.steerAngle, -input.steer * 0.52 * clamp(1 - sp / 70, 0.35, 1), damp(12, dt));
    s.wheelSpin += (vf / 0.315) * dt;

    // lean outward through the corner, the way weight actually transfers
    const targetRoll = clamp(s.yawRate * Math.abs(vf) * 0.012 - vr * 0.006, -0.16, 0.16);
    const targetPitch = clamp((input.throttle > 0 ? -0.022 : 0) + (input.throttle < 0 && vf > 1 ? 0.03 : 0) + (s.boosting ? -0.012 : 0), -0.05, 0.05);
    s.roll = lerp(s.roll, targetRoll, damp(7, dt));
    s.pitch = lerp(s.pitch, targetPitch, damp(6, dt));

    car.root.position.set(s.pos.x, 0, s.pos.z);
    car.root.rotation.y = s.yaw;
    car.chassis.rotation.z = s.roll;
    car.chassis.rotation.x = s.pitch;
    car.wheels.fl.steer.rotation.y = s.steerAngle;
    car.wheels.fr.steer.rotation.y = s.steerAngle;
    for (const k of ["fl", "fr", "rl", "rr"]) car.wheels[k].spin.rotation.x = s.wheelSpin;

    // brake lights on when braking or handbraking
    const lit = (input.throttle < 0 && vf > 0.5) || input.handbrake;
    for (const m of car.brakeLights) m.emissiveIntensity = lerp(m.emissiveIntensity, lit ? 4.2 : 0.9, damp(14, dt));
  };

  // Point the roof gun at a world position. Pitch is limited so it never shoots the roof.
  s.aimGun = (target) => {
    s.aimPoint.copy(target);
    const gunWorld = new THREE.Vector3();
    car.gunYaw.getWorldPosition(gunWorld);
    const dx = target.x - gunWorld.x, dz = target.z - gunWorld.z;
    const worldYaw = Math.atan2(dx, dz);
    s.gunYawWorld = worldYaw;
    car.gunYaw.rotation.y = worldYaw - s.yaw;      // gunYaw is parented to the car
    const flat = Math.hypot(dx, dz);
    car.gunPitch.rotation.x = clamp(Math.atan2(target.y - gunWorld.y, flat), -0.22, 0.42);
  };

  return s;
}

// ---- chase camera ------------------------------------------------------------
// Two camera modes:
//   chase      the camera sits behind the car and looks where the car is going (default)
//   mouse-look the mouse turns the camera, FPS-style, and the gun fires wherever it is pointing
//
// Mouse-look is driven by pointer-lock MOVEMENT, not by where a cursor sits on screen. That is
// what makes it feel like an FPS instead of an inverted drag: moving the mouse right turns the
// view right, without limit, and the crosshair never leaves the middle of the screen. It also
// removes the feedback problem for free — the aim is taken from the camera rather than from a
// raycast that the camera itself moves.

export function createChaseCam(camera) {
  let shake = 0;
  let camYaw = 0;
  const goal = new THREE.Vector3();
  const look = new THREE.Vector3();
  const cur = new THREE.Vector3(0, 9, -16);
  const curLook = new THREE.Vector3();
  let fov = 62;

  return {
    snap(player) {
      camYaw = player.yaw;
      const back = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw)).multiplyScalar(-10.0);
      cur.set(player.pos.x + back.x, 5.0, player.pos.z + back.z);
      curLook.set(player.pos.x, 1.4, player.pos.z);
      camera.position.copy(cur);
      camera.lookAt(curLook);
    },
    shake(amount) { shake = Math.min(2.2, shake + amount); },
    get yaw() { return camYaw; },
    update(dt, player, freeLook = false, lookDelta = 0) {
      const sp = Math.abs(player.speed);
      // sit further back and lower as speed builds; lead the car slightly into its drift
      const dist = 9.4 + clamp(sp * 0.085, 0, 3.0);
      const height = 4.5 + clamp(sp * 0.030, 0, 1.4);

      if (freeLook) {
        camYaw += lookDelta;          // 1:1 with the mouse, like any other mouse-look
      } else {
        const want = player.yaw - clamp(player.slip * 0.012, -0.30, 0.30);
        camYaw += angleDelta(camYaw, want) * damp(5.0, dt);
      }

      goal.set(
        player.pos.x - Math.sin(camYaw) * dist,
        height,
        player.pos.z - Math.cos(camYaw) * dist
      );
      look.set(
        player.pos.x + Math.sin(camYaw) * (3.0 + sp * 0.10),
        1.5,
        player.pos.z + Math.cos(camYaw) * (3.0 + sp * 0.10)
      );
      // position lags more than the look target, which reads as weight
      cur.lerp(goal, damp(player.boosting ? 6.5 : 5.2, dt));
      curLook.lerp(look, damp(9, dt));
      camera.position.copy(cur);
      if (shake > 0) {
        shake = Math.max(0, shake - dt * 1.9);
        const k = shake * shake * 1.4;
        camera.position.x += (Math.random() - 0.5) * k;
        camera.position.y += (Math.random() - 0.5) * k;
        camera.position.z += (Math.random() - 0.5) * k;
      }
      camera.lookAt(curLook);

      const targetFov = 62 + clamp(sp * 0.30, 0, 11) + (player.boosting ? 7 : 0);
      fov = lerp(fov, targetFov, damp(4, dt));
      if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    },
  };
}
