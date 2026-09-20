// H[K]IT AND RUN — boot, menu flow and the main loop.
// Hidden page: nothing on kitannn.com links here.
import * as THREE from "three";
import { buildWorld } from "./world.js";
import { createPlayer, createChaseCam } from "./player.js";
import { attachInput, input } from "./input.js";
import { createWeapon } from "./weapon.js";
import { createHud } from "./hud.js";
import { createFx } from "./fx.js";
import { createEnemies } from "./enemies.js";
import { createBoss, BOSS_AT } from "./boss.js";
import { createSubWeapons } from "./subweapons.js";
import { createScatter } from "./scatter.js";
import { applyAll, baseStats, draw, CARDS } from "./cards.js";
import { createLevelUp, createFinish, createPause, creditsFor } from "./ui.js";
import { createMenus, createConsent } from "./menus.js";
import { askName, displayName } from "./name.js";
import { applyMastery } from "./shop.js";
import * as store from "./save.js";
import * as cheats from "./cheats.js";
import { clamp, damp, esc } from "./util.js";

const $ = (id) => document.getElementById(id);
const canvas = $("stage");

// ---- renderer ----------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.45;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 1600);

// A tiny hand-painted environment: without one, every metal surface renders black.
// Dark sky above, a magenta/blue horizon band, near-black ground — the scene's own palette.
function buildEnv() {
  const w = 128, h = 64;
  const data = new Uint8Array(w * h * 4);
  const blobs = [
    [0.18, 0.52, 0.16, [124, 198, 255], 1.0],
    [0.62, 0.50, 0.20, [255, 95, 143], 0.8],
    [0.86, 0.56, 0.12, [255, 201, 74], 0.5],
  ];
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);                       // 0 = top of the sky
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1);
      let r, g, b;
      if (v < 0.5) {                              // sky
        const t = v / 0.5;
        r = 6 + t * 16; g = 8 + t * 26; b = 20 + t * 58;
      } else {                                    // ground
        const t = (v - 0.5) / 0.5;
        r = 14 - t * 8; g = 14 - t * 8; b = 22 - t * 12;
      }
      for (const [bu, bv, br, col, amp] of blobs) {
        let du = Math.abs(u - bu); if (du > 0.5) du = 1 - du;
        const d = Math.hypot(du, (v - bv) * 1.6) / br;
        const k = Math.max(0, 1 - d) ** 2 * amp;
        r += col[0] * k; g += col[1] * k; b += col[2] * k;
      }
      const i = (y * w + x) * 4;
      data[i] = Math.min(255, r); data[i + 1] = Math.min(255, g); data[i + 2] = Math.min(255, b); data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();
  return env;
}

scene.environment = buildEnv();
scene.environmentIntensity = 1.0;

// ---- run state ---------------------------------------------------------------
// `taken` is the only record of what the player picked; stats are always derived from it, so a
// card's effect can never drift out of sync with the card list.
store.initSave();

// A run's stats are always rebuilt from scratch: base -> permanent mastery -> this run's cards.
// Nothing is ever mutated in place, so a stat can never drift out of sync with what earned it.
const buildStats = (taken) => applyAll(taken, applyMastery(cheats.applyCheats(baseStats()), store.masteryFor()));

const run = {
  taken: {},            // cardId -> times taken
  stats: buildStats({}),
  xp: 0, level: 1, xpNeeded: 100,
  kills: 0, elapsed: 0, pendingCards: 0,
  luckyCards: 0,        // chest picks, drawn from a luckier table than a level-up
  chestCredits: 0,      // found in the world, paid out with the rest at the end
  credits: 0,           // banked across runs this session; persistence lands with the shop
};
const getStats = () => run.stats;

const world = buildWorld(scene);
const player = createPlayer(scene, getStats);
const weapon = createWeapon(scene, player.car, getStats);
const hud = createHud($("hud"), {
  onFreeLook: () => input.setFreeLook?.(!input.freeLook),
  onPause: () => togglePause(),
});
const chase = createChaseCam(camera);
const fx = createFx(scene);
const subs = createSubWeapons(scene, fx);
const foes = createEnemies(scene, fx, {
  onPlayerHit: (n) => hud.hurt(n),
  onShake: (n) => chase.shake(n),
  onElite: () => { note("Elite inbound", 3); chase.shake(0.35); },
  onEliteDown: (at) => { note("Elite down — chest dropped", 3.5); scatter.dropCardChest(at); chase.shake(0.7); },
});

// The scatter needs the level-up machinery, so its hooks are set after those exist (below).
const scatter = createScatter(scene, fx, {
  onCreditChest: (value) => {
    run.chestCredits += value;
    note(`Chest — ◆${value} credits`, 3);
    chase.shake(0.25);
  },
  onCardChest: () => {
    // an elite's chest is a free pick, weighted toward the good end
    run.pendingCards++;
    run.luckyCards++;
    note("Chest — free upgrade", 3);
  },
});

let weakNote = "";         // the line under the boss bar: weak points, elites, chests
let weakNoteIn = 0;
const note = (text, secs = 3) => { weakNote = text; weakNoteIn = secs; };
const boss = createBoss(scene, fx, {
  onPlayerHit: (n) => hud.hurt(n),
  onShake: (n) => chase.shake(n),
  onBossShot: (from, player, dmg) => foes.fireAt(from, player, dmg),
  // the Colossus is the only thing worth shooting: the field is cleared and the tap shut off
  onSpawn: () => { foes.clearAll(true); foes.spawnEnabled = false; chase.shake(1.1); },
  onShieldDown: () => { weakNote = "Shield down — weak points exposed"; weakNoteIn = 3.5; chase.shake(0.6); },
  onWeakPoint: (id) => {
    weakNote = { head: "Head cracked", handL: "Machine gun disabled — 30s", handR: "Rocket pod disabled — 30s", footL: "Left leg crippled — 30s", footR: "Right leg crippled — 30s" }[id] || "";
    weakNoteIn = 4;
    chase.shake(0.5);
  },
  onPhase: (n) => {
    if (n === 2) {
      // while it is a car there is room for a couple of outriders, and no more
      foes.spawnEnabled = true;
      foes.maxAlive = 2;
      foes.spawnScale = 3.5;
      foes.spawnIn = 2.5;
    } else {
      foes.clearAll(true);
      foes.spawnEnabled = false;
    }
    weakNote = n === 2 ? "It is changing shape" : "Shield restored — chest cannon online";
    weakNoteIn = 3.5;
    chase.shake(0.9);
  },
  onDeath: () => { weakNote = ""; foes.clearAll(true); foes.spawnEnabled = false; },
  onDefeated: () => endRun(true),
});

// One flat list of everything a round can hit: the enemy pool never changes length, and the boss
// parts simply flip `alive`, so this array is built once and never touched again.
const targets = [...foes.list, ...boss.targets];
chase.snap(player);

// the weapon resolves geometry; what a hit MEANS is the game's business
weapon.onHit = (enemy, damage, crit, point) => {
  if (enemy.kind === "boss" || enemy.kind === "rocket") {
    // a weak point is worth +50%, which is what makes aiming at one worth the risk
    boss.hit(enemy, damage * (enemy.weak ? 1.5 : 1), crit, point);
    if (run.stats.lifesteal) player.heal(damage * run.stats.lifesteal);
    return;
  }
  const killed = foes.hit(enemy, damage, crit, point);
  const st = run.stats;
  if (st.lifesteal) player.heal(damage * st.lifesteal);
  if (st.blastRadius) {
    // splash everything else nearby, at the blast's own damage rather than the round's
    for (const o of foes.list) {
      if (!o.alive || o === enemy) continue;
      if (o.pos.distanceTo(point) < st.blastRadius) foes.hit(o, st.blastDamage, false, o.pos);
    }
    fx.explode(point, st.blastRadius * 0.34, 0xffb04a, 8);
  }
  if (killed) { run.kills++; weapon.kills++; }
};

// ---- aiming ------------------------------------------------------------------
// The pointer is cast onto a plane at roughly enemy height, which is where the gun looks.
const ray = new THREE.Raycaster();
const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.1);
const aimPoint = new THREE.Vector3(0, 1.1, 10);
const ndc = new THREE.Vector2();

const reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.42, 0.52, 28),
  new THREE.MeshBasicMaterial({ color: 0x7cc6ff, transparent: true, opacity: 0.85, depthWrite: false })
);
reticle.rotation.x = -Math.PI / 2;
reticle.renderOrder = 5;
scene.add(reticle);
const reticleDot = new THREE.Mesh(
  new THREE.CircleGeometry(0.09, 16),
  new THREE.MeshBasicMaterial({ color: 0x7cc6ff, transparent: true, opacity: 0.9, depthWrite: false })
);
reticleDot.rotation.x = -Math.PI / 2;
reticleDot.renderOrder = 5;
scene.add(reticleDot);

function updateAim() {
  if (input.freeLook) {
    // The gun goes where the camera goes, so the crosshair stays dead centre and what you see is
    // what you shoot. No raycast: the camera IS the aim, on both axes.
    aimPoint.copy(chase.aim);
    player.aimGun(aimPoint);
    reticle.position.set(aimPoint.x, 0.06, aimPoint.z);
    reticleDot.position.set(aimPoint.x, 0.06, aimPoint.z);
    return;
  }
  if (!input.aimActive) {
    // before the pointer moves, aim straight ahead
    aimPoint.set(player.pos.x + Math.sin(player.yaw) * 22, 1.1, player.pos.z + Math.cos(player.yaw) * 22);
  } else {
    ndc.set(input.aim.x, input.aim.y);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(aimPlane, aimPoint)) {
      aimPoint.set(player.pos.x + Math.sin(player.yaw) * 40, 1.1, player.pos.z + Math.cos(player.yaw) * 40);
    }
  }
  // don't let the reticle collapse onto the car
  const dx = aimPoint.x - player.pos.x, dz = aimPoint.z - player.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 4) { aimPoint.x = player.pos.x + (dx / (d || 1)) * 4; aimPoint.z = player.pos.z + (dz / (d || 1)) * 4; }
  player.aimGun(aimPoint);
  reticle.position.set(aimPoint.x, 0.06, aimPoint.z);
  reticleDot.position.set(aimPoint.x, 0.06, aimPoint.z);
}

// ---- state machine -----------------------------------------------------------
const STATE = { BOOT: "boot", TITLE: "title", PLAYING: "playing", PAUSED: "paused", LEVELUP: "levelup", DYING: "dying", FINISH: "finish" };
let state = STATE.BOOT;
let unfreezeIn = 0;     // the half-second the world stays still after a card is taken
let dyingIn = 0;        // wreck animation before the finish screen

attachInput(canvas, {
  onPause: () => togglePause(),
  onLockLost: () => { if (state === STATE.PLAYING) togglePause(); },
  onReload: () => { if (state === STATE.PLAYING) weapon.startReload(); },
});

// idle camera for the menu: a slow orbit around the parked car
let idleAngle = 0.6;
function idleCamera(dt) {
  idleAngle += dt * 0.16;
  const r = 9.5;
  camera.position.set(Math.sin(idleAngle) * r, 3.3 + Math.sin(idleAngle * 0.7) * 0.5, Math.cos(idleAngle) * r);
  camera.lookAt(0, 0.85, 0);
  if (camera.fov !== 46) { camera.fov = 46; camera.updateProjectionMatrix(); }
  // the gun idles by tracking slowly around
  player.aimGun(new THREE.Vector3(Math.sin(idleAngle * 0.5 + 1) * 30, 1.4, Math.cos(idleAngle * 0.5 + 1) * 30));
}

// ---- menu wiring -------------------------------------------------------------
const titleScreen = $("title");
const creditsLine = $("creditsLine");
// Each active code is a button: clicking it drops that cheat. Confirmed first, because they are
// not trivial to get back — you have to go and finish the input string on the portfolio again.
$("cheatLine").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-cheat]");
  if (!btn || state !== STATE.TITLE) return;
  const id = btn.dataset.cheat;
  const info = cheats.CHEATS[id];
  menus.confirm({
    title: `Turn off ${info.name}?`,
    body: `<p>Removes <b>${esc(info.desc)}</b> from your runs.</p>
           <p class="confirm-note">Other active codes are untouched. To get this one back, finish its
           input string again on the barcodes at kitannn.com.</p>`,
    confirmLabel: "Turn it off",
    onYes: () => {
      cheats.deactivate(id);
      run.stats = buildStats(run.taken);
      refreshCredits();
    },
  });
});

// the player name on the title screen doubles as the way to change it
$("whoBtn").addEventListener("click", () => {
  if (state !== STATE.TITLE) return;
  titleScreen.hidden = true;
  askName($("modalHost"), () => { titleScreen.hidden = false; refreshCredits(); },
    { existing: store.save().name, canCancel: true });
});

function refreshCredits() {
  creditsLine.hidden = false;
  creditsLine.querySelector("b").textContent = store.save().credits.toLocaleString();
  const c = cheats.summary();
  const line = $("cheatLine");
  line.hidden = c.found === 0;
  if (c.found) {
    line.className = `cheat-line${c.all ? " all" : ""}`;
    line.innerHTML = `
      <span class="cheat-head">◈ ${c.all ? "All codes found" : `<b>${c.found}/${c.total}</b> codes active`}${
        c.all && c.invuln ? " — <b>one invulnerable run banked</b>" : ""}</span>
      <span class="cheat-chips">${c.list.map((x) =>
        `<button class="cheat-chip" type="button" data-cheat="${x.id}" title="Turn off ${esc(x.name)}">${esc(x.desc)}<i>×</i></button>`
      ).join("")}</span>
      <span class="cheat-tip">click a code to turn it off</span>`;
  }
  const who = creditsLine.parentElement.querySelector(".who");
  who.textContent = displayName(store.save());
  who.hidden = !store.save().name;
}
const startBtn = $("startBtn");
const menu = $("menu");

startBtn.addEventListener("click", () => {
  startBtn.classList.add("fade-out");
  setTimeout(() => {
    startBtn.hidden = true;
    menu.hidden = false;
    menu.classList.add("fade-in");
  }, 260);
});

const menus = createMenus($("modalHost"), { onClose: () => refreshCredits() });

menu.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-menu]");
  if (!btn) return;
  if (btn.dataset.menu === "play") play();
  else if (btn.dataset.menu === "reset") menus.resetAll(() => { refreshCredits(); menus.close(); });
  else menus.show(btn.dataset.menu);
});


const levelUp = createLevelUp($("modalHost"), {
  onPick: (card) => {
    takeCard(card);
    run.pendingCards--;
    unfreezeIn = 0.5;                 // the spec's half-second before the world starts again
    state = STATE.PLAYING;
  },
});

const finish = createFinish($("modalHost"), {
  onRetry: () => startRun(),
  onMenu: () => {
    refreshCredits();
    titleScreen.hidden = false;
    titleScreen.classList.add("fade-in");
    state = STATE.TITLE;
  },
});

function togglePause() {
  if (state === STATE.PLAYING) {
    state = STATE.PAUSED;
    input.firing = false;
    // hand the cursor back so the menu is clickable, but stay IN mouse-look
    input.releaseMouse?.(true);
    pause.show(run);
  } else if (state === STATE.PAUSED) {
    pause.close();
    state = STATE.PLAYING;
    if (input.freeLook) input.captureMouse?.();       // resuming takes the cursor again
  }
}

const pause = createPause($("pauseHost"), {
  onResume: () => { state = STATE.PLAYING; },
  onQuit: () => {
    // abandoning is not a death: nothing is recorded and nothing is paid
    hud.show(false);
    levelUp.close();
    refreshCredits();
    titleScreen.hidden = false;
    titleScreen.classList.add("fade-in");
    state = STATE.TITLE;
  },
});

function endRun(won) {
  const result = {
    won,
    name: displayName(store.save()),
    // a run that leaned on codes is marked, so the board never compares it with a clean one
    cheats: cheats.active().length + (run.invulnerable ? 1 : 0),
    elapsed: run.elapsed,
    kills: run.kills,
    level: run.level,
    damage: weapon.damageDealt,
    fired: weapon.fired,
    accuracy: weapon.accuracy(),
    taken: { ...run.taken },
    credits: 0,
  };
  result.credits = Math.round((creditsFor(result) + run.chestCredits) * (run.stats.creditMult || 1));
  store.recordRun(result);
  hud.show(false);
  levelUp.close();
  finish.show(result);
  state = STATE.FINISH;
}

// First time through, get a player name before anything else — it is what a leaderboard will key on.
function play() {
  if (store.save().name) return startRun();
  titleScreen.hidden = true;
  askName($("modalHost"), () => { refreshCredits(); startRun(); });
}

function startRun() {
  titleScreen.hidden = true;
  levelUp.close();
  finish.close();
  run.taken = {};
  run.stats = buildStats(run.taken);
  run.xp = 0; run.level = 1; run.xpNeeded = 100;
  run.kills = 0; run.elapsed = 0; run.pendingCards = 0;
  run.luckyCards = 0; run.chestCredits = 0; run.invulnerable = false;
  player.car.root.visible = true;
  pause.close();

  // full clearance: one invulnerable run and a one-off pile of credits
  run.invulnerable = cheats.takeInvulnRun();
  const bonus = cheats.claimAllBonus();
  if (bonus) { store.save().credits += bonus; store.flush(); }

  player.reset();
  player.invulnerable = run.invulnerable;
  if (run.stats.startShield) player.addShield(run.stats.startShield);
  // the hotline code hands you a sub-weapon on the way out of the garage
  if (run.stats.freeWeapon) {
    const pool = CARDS.filter((c) => c.weapon);
    takeCard(pool[Math.floor(Math.random() * pool.length)]);
  }
  if (run.invulnerable) note("All codes found — invulnerable run", 6);
  else if (bonus) note(`All codes found — ◆${bonus} credits`, 6);
  weapon.reset();
  foes.reset();
  subs.reset();
  scatter.reset(player);
  input.freeLook = false;
  fx.reset();
  boss.reset();
  weakNote = ""; weakNoteIn = 0;
  chase.snap(player);
  hud.show(true);
  state = STATE.PLAYING;
}

// XP is banked as it is picked up; the level-up itself lands in the next pass, so for now the
// counter simply rolls over and the threshold grows.
function gainXp(value) {
  run.xp += value * run.stats.xpMult;
  while (run.xp >= run.xpNeeded) {
    run.xp -= run.xpNeeded;
    run.level++;
    run.xpNeeded = Math.round(100 * Math.pow(1.14, run.level - 1));
    run.pendingCards++;
  }
}

// Take a card: record it, rebuild the stat block from scratch, then let the card do its one-off.
export function takeCard(card) {
  run.taken[card.id] = (run.taken[card.id] || 0) + 1;
  store.discover(card.id);
  run.stats = buildStats(run.taken);
  player.applyStats();
  card.onPick?.(player);
  const st = run.stats;
  if (st.healOnLevel) player.heal(st.healOnLevel);
  if (st.healPctOnLevel) player.heal(st.healPctOnLevel * player.maxHp);
  if (st.shieldOnLevel) player.addShield(st.shieldOnLevel);
  if (st.shieldFullOnLevel) player.shield = Math.max(player.shield, player.maxShield);
  weapon.mag = Math.min(weapon.mag, st.magazine);
}
window.__takeCard = takeCard;

// ---- loop --------------------------------------------------------------------
let last = performance.now();
let elapsed = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min((now - last) / 1000, 0.05);     // clamp so an alt-tab doesn't teleport anything
  last = now;
  elapsed += dt;

  // A level-up interrupts the run the moment one is banked, but only between frames — never
  // mid-collision — so nothing can die while the cards are up.
  if (state === STATE.PLAYING && run.pendingCards > 0 && !levelUp.open) {
    // a chest pick rolls as though you were much further into the run, which is what the rarity
    // tilt in draw() keys off — so chests skew rare and up without needing a second table
    const lucky = run.luckyCards > 0;
    if (lucky) run.luckyCards--;
    levelUp.show(draw(run.taken, run.level + (lucky ? 14 : 0)), run.level, run.taken, lucky);
    state = STATE.LEVELUP;
  }

  if (state === STATE.DYING) {
    dyingIn -= dt;
    // the world keeps moving through the wreck, it just no longer takes input
    boss.update(dt, player, run.stats, camera);
    foes.update(dt, run.elapsed, player, run.stats, camera);
    fx.update(dt, player, 0, () => {});
    chase.update(dt, player);
    if (dyingIn <= 0) endRun(false);
  }

  if (state === STATE.PLAYING) {
    // the pause after a card is spent standing still, so the pick has a beat to land
    if (unfreezeIn > 0) { unfreezeIn = Math.max(0, unfreezeIn - dt); dt = 0; }
    run.elapsed += dt;
    player.update(dt, input);
    updateAim();
    foes.update(dt, run.elapsed, player, run.stats, camera);
    boss.update(dt, player, run.stats, camera);
    // sub-weapons route their damage through the same hit path as the roof gun, so lifesteal,
    // explosive rounds and the kill tally all apply to them too
    subs.update(dt, player, run.stats, targets, weapon.onHit);
    scatter.update(dt, player);
    if (!boss.active && !boss.dying && run.elapsed >= BOSS_AT) boss.spawn(player);
    weapon.update(dt, { firing: input.firing, aimPoint, boosting: player.boosting, targets });
    fx.update(dt, player, run.stats.pickupRadius, gainXp);
    chase.update(dt, player, input.freeLook, input.lookDelta, input.lookDeltaY);
    input.lookDelta = input.lookDeltaY = 0;
    reticle.visible = reticleDot.visible = true;
    if (player.dead) wreckPlayer();

    hud.update(dt, {
      hp: player.hp, maxHp: player.maxHp,
      shield: player.shield, maxShield: Math.max(player.maxShield, player.shield),
      boost: player.boost, maxBoost: player.maxBoost,
      xp: run.xp, xpNeeded: run.xpNeeded, level: run.level,
      kills: run.kills, elapsed: run.elapsed,
      mag: weapon.mag, magCap: run.stats.magazine, reloading: weapon.reloading,
      reloadProgress: weapon.reloadProgress(), infiniteBelt: run.stats.infiniteBelt,
      fired: weapon.fired, accuracy: weapon.accuracy(),
      freeLook: input.freeLook,
      boss: {
        show: true,
        active: boss.active,
        phase: boss.phase,
        hp: boss.hp, maxHp: boss.maxHp,
        shield: boss.shield, maxShield: boss.maxShield,
        timer: run.elapsed / BOSS_AT,
        eta: Math.max(0, BOSS_AT - run.elapsed),
        weak: weakNoteIn > 0 ? weakNote : "",
      },
    });
    if (weakNoteIn > 0) weakNoteIn -= dt;
  } else {
    reticle.visible = reticleDot.visible = false;
    if (state === STATE.TITLE || state === STATE.BOOT) idleCamera(dt);
  }

  world.update(dt, elapsed, camera, player.pos);
  renderer.render(scene, camera);
}

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
});

// ---- boot --------------------------------------------------------------------
const bootScreen = $("boot");
const bootFill = bootScreen.querySelector(".boot-bar i");
const bootNote = bootScreen.querySelector(".boot-note");

function boot() {
  let p = 0;
  bootNote.textContent = "warming up";
  const tick = setInterval(() => {
    p = Math.min(1, p + 0.13 + Math.random() * 0.12);
    bootFill.style.width = `${p * 100}%`;
    if (p >= 1) {
      clearInterval(tick);
      bootNote.textContent = "ready";
      setTimeout(() => {
        bootScreen.classList.add("fade-out");
        setTimeout(() => {
          bootScreen.hidden = true;
          titleScreen.hidden = false;
          titleScreen.classList.add("fade-in");
          state = STATE.TITLE;
        }, 280);
      }, 220);
    }
  }, 110);
}

refreshCredits();
createConsent(() => refreshCredits());

requestAnimationFrame(frame);
// one render before the boot bar finishes, so the first frame the player sees is already warm
renderer.compile(scene, camera);
boot();

// The player's own death: blow the car up, let the camera sit in it for a moment, then score it.
function wreckPlayer() {
  if (state !== STATE.PLAYING) return;
  state = STATE.DYING;
  dyingIn = 1.7;
  hud.hurt(60);
  fx.explode(player.car.root.position, 2.6, 0xffd07a, 34);
  fx.explode(player.car.root.position, 1.6, 0xff4d3a, 22);
  player.car.root.visible = false;
  input.firing = false;
}

// handy while building
window.GAME = { scene, camera, renderer, player, weapon, hud, fx, foes, boss, subs, scatter, chase, run, input, levelUp, finish, menus, store, endRun, BOSS_AT, get state() { return state; } };
