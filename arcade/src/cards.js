// UPGRADE CARD CATALOGUE — the tracked list.
//
// Every 100 XP the run freezes and offers three of these. Rarity decides how often a card can
// appear in that draw; `max` is how many times it can be taken in one run. Cards mutate `stats`,
// which the player, weapon and enemy code read every frame — nothing else knows cards exist.
//
// Rarity weights are the base odds. They drift toward the rarer end as the run goes on (see
// `draw`), so late picks feel like a payoff rather than another +1 damage.
//
// Adding a card: give it a unique id (the Collection saves ids, so never reuse one), a rarity,
// a one-line effect description the player reads, and an apply() that only touches `stats`.
// A card that does something the moment it is picked — a flat heal, a one-off shield — also gets
// an onPick(player), which runs once, right then. onPick must never be used for anything that
// needs to survive a re-apply, because applyAll() replays apply() and not onPick().

export const RARITY = {
  common:    { label: "Common",    weight: 46,  color: "--r-common" },
  uncommon:  { label: "Uncommon",  weight: 27,  color: "--r-uncommon" },
  rare:      { label: "Rare",      weight: 15,  color: "--r-rare" },
  epic:      { label: "Epic",      weight: 8,   color: "--r-epic" },
  legendary: { label: "Legendary", weight: 3.2, color: "--r-legendary" },
  mythic:    { label: "Mythic",    weight: 0.8, color: "--r-mythic" },
};

// Every number the run can modify. The weapon and player read these directly.
export const baseStats = () => ({
  // weapon
  damage: 1,
  magazine: 30,
  reloadTime: 2.0,
  fireRate: 8,            // rounds per second
  bulletSpeed: 78,
  spread: 0.016,          // radians
  pierce: 0,              // extra enemies a round passes through
  shots: 1,               // rounds per trigger pull
  blastRadius: 0,         // >0 makes rounds explosive
  blastDamage: 0,
  ricochet: 0,
  homing: 0,              // turn rate of seeking rounds
  burn: 0,                // damage per second applied on hit
  critChance: 0,
  critMult: 1.5,          // weak points already crit at this
  chainEvery: 0, chainTargets: 0, chainDamage: 0,
  kineticEvery: 0,        // every N hits, next shot deals kineticMult damage
  kineticMult: 3,
  clusters: 0,
  infiniteBelt: false,
  railgun: false,
  twinCannon: false,
  // Sub-weapon levels, keyed by the ids in subweapons.js. A weapon card puts a system on the
  // car; every further copy levels it. Unlike the rest of these numbers, the sub-weapons read
  // this map directly rather than having a stat each.
  weapons: {},

  // survivability
  maxHp: 100,
  regen: 0,               // HP per second, always ticking
  safeRegen: 0,           // extra HP per second once you have gone 3s without being hit
  lifesteal: 0,
  damageTaken: 1,         // multiplier
  maxShield: 0,           // regenerating shield pool
  shieldRegen: 0,         // shield per second once out of combat
  shieldDelay: 4.5,       // seconds out of combat before it starts
  boostShield: 0,         // shield per second gained while boosting
  healOnLevel: 0,         // flat HP restored on each level-up
  healPctOnLevel: 0,      // …and a share of max HP
  shieldOnLevel: 0,
  shieldFullOnLevel: false,
  bulletTime: false,
  secondWind: false,

  // driving
  maxBoost: 100,
  boostRegen: 13,         // boost per second, once the delay has passed
  boostPower: 1,          // multiplier on how hard boost shoves you
  boostTopMult: 1,        // …and on the speed it will hold
  boostDrainMult: 1,      // <1 means the bottle lasts longer
  boostFloor: 0,          // boost never drains below this
  boostArmor: 0,          // damage reduction while boosting, 0–1
  boostDamageMult: 1,
  topSpeedMult: 1,
  gripMult: 1,
  turnMult: 1,
  ramDamage: 0,
  ramKnockback: 0,
  phantomBoost: false,
  empTrail: 0,

  // economy
  pickupRadius: 9,        // the car covers 40 m/s — a tighter magnet just loses you shards
  xpMult: 1,
  bonusXpChance: 0,
});

const pct = (n) => `${n > 0 ? "+" : ""}${Math.round(n * 100)}%`;

// Sub-weapons. These are the pieces of kit that fight for you: the first copy bolts the system
// on, every copy after that levels it. They read as a separate class of pick, which is why they
// carry a `weapon` flag the UI badges.
const weapon = (id, name, rarity, key, max, first, levelled) => ({
  id, name, rarity, max, weapon: true,
  desc: first,
  levelDesc: levelled,
  apply: (s) => { s.weapons[key] = (s.weapons[key] || 0) + 1; },
});

export const CARDS = [
  // ---------------- Sub-weapons ----------------
  weapon("guardian_drone", "Sentry Drone", "uncommon", "drone", 5,
    "A drone orbits the car and shoots whatever is closest. More copies, more drones.",
    "Adds a drone or tightens their fire."),
  weapon("wpn_arc", "Arc Coil", "uncommon", "arc", 5,
    "Lightning jumps from the car to nearby enemies every few seconds.",
    "More jumps, more damage, less delay."),
  weapon("wpn_caltrop", "Caltrop Bay", "uncommon", "caltrop", 5,
    "Drops spikes out the back that detonate on whatever runs over them.",
    "Drops more often, hits harder and wider."),
  weapon("the_plumbob", "Plumbob Reactor", "rare", "plumbob", 5,
    "A green cutting beam sweeps around the car, shredding anything it passes through.",
    "Wider sweep, faster spin, more damage."),
  weapon("wpn_hornet", "Hornet Pod", "rare", "hornet", 5,
    "Launches homing micro-rockets that chase down whatever is near.",
    "Bigger salvos, fired more often."),
  weapon("wpn_scorch", "Scorch Trail", "rare", "scorch", 5,
    "Boosting lays a burning wake that cooks anything driving through it.",
    "Burns hotter and lingers longer."),

  // ---------------- Common: small, reliable, always useful ----------------
  { id: "hollow_points", name: "Hollow Points", rarity: "common", max: 5, desc: "+1 damage per round.", apply: (s) => { s.damage += 1; } },
  { id: "extended_mag", name: "Extended Mag", rarity: "common", max: 5, desc: "+8 rounds per magazine.", apply: (s) => { s.magazine += 8; } },
  { id: "quick_hands", name: "Quick Hands", rarity: "common", max: 5, desc: "Reload 12% faster.", apply: (s) => { s.reloadTime *= 0.88; } },
  { id: "light_trigger", name: "Light Trigger", rarity: "common", max: 5, desc: "+10% fire rate.", apply: (s) => { s.fireRate *= 1.1; } },
  { id: "hot_rubber", name: "Hot Rubber", rarity: "common", max: 4, desc: "+8% grip — you hold a line better.", apply: (s) => { s.gripMult *= 1.08; } },
  { id: "roll_cage", name: "Roll Cage", rarity: "common", max: 5, desc: "+15 max HP.", apply: (s) => { s.maxHp += 15; } },
  { id: "bigger_tank", name: "Bigger Tank", rarity: "common", max: 4, desc: "+20 max boost.", apply: (s) => { s.maxBoost += 20; } },
  { id: "scrap_magnet", name: "Scrap Magnet", rarity: "common", max: 4, desc: "+35% pickup radius.", apply: (s) => { s.pickupRadius *= 1.35; } },
  { id: "data_siphon", name: "Data Siphon", rarity: "common", max: 5, desc: "+10% XP gained.", apply: (s) => { s.xpMult *= 1.1; } },
  { id: "cooling_fins", name: "Cooling Fins", rarity: "common", max: 4, desc: "Rounds travel 10% faster.", apply: (s) => { s.bulletSpeed *= 1.1; } },
  { id: "tuned_diff", name: "Tuned Diff", rarity: "common", max: 4, desc: "+8% top speed.", apply: (s) => { s.topSpeedMult *= 1.08; } },
  { id: "spare_plating", name: "Spare Plating", rarity: "common", max: 4, desc: "Take 5% less damage.", apply: (s) => { s.damageTaken *= 0.95; } },
  { id: "stabiliser", name: "Stabiliser", rarity: "common", max: 3, desc: "25% tighter spread.", apply: (s) => { s.spread *= 0.75; } },
  { id: "patch_kit", name: "Patch Kit", rarity: "common", max: 6, desc: "Repair 25 HP right now.", apply: () => {}, onPick: (p) => { p.heal(25); } },
  { id: "trickle_charge", name: "Trickle Charge", rarity: "common", max: 4, desc: "Regenerate 0.5 HP per second.", apply: (s) => { s.regen += 0.5; } },
  { id: "ablative_foam", name: "Ablative Foam", rarity: "common", max: 5, desc: "Gain a 15-point shield now. It does not come back.", apply: () => {}, onPick: (p) => { p.addShield(15); } },
  { id: "coolant_line", name: "Coolant Line", rarity: "common", max: 4, desc: "Boost drains 12% slower.", apply: (s) => { s.boostDrainMult *= 0.88; } },
  { id: "spool_valve", name: "Spool Valve", rarity: "common", max: 4, desc: "Boost shoves 12% harder.", apply: (s) => { s.boostPower *= 1.12; } },

  // ---------------- Uncommon: a small rule change, not just a number ----------------
  { id: "armour_piercing", name: "Armour Piercing", rarity: "uncommon", max: 3, desc: "Rounds pass through 1 extra enemy.", apply: (s) => { s.pierce += 1; } },
  { id: "tracer_rounds", name: "Tracer Rounds", rarity: "uncommon", max: 3, desc: "+18% fire rate.", apply: (s) => { s.fireRate *= 1.18; } },
  { id: "drum_mag", name: "Drum Mag", rarity: "uncommon", max: 3, desc: "+15 rounds, but reload takes 0.2s longer.", apply: (s) => { s.magazine += 15; s.reloadTime += 0.2; } },
  { id: "nitrous_bottle", name: "Nitrous Bottle", rarity: "uncommon", max: 3, desc: "Boost recharges 40% faster.", apply: (s) => { s.boostRegen *= 1.4; } },
  { id: "reactive_plating", name: "Reactive Plating", rarity: "uncommon", max: 3, desc: "+15 shield, recharges out of combat.", apply: (s) => { s.maxShield += 15; s.shieldRegen += 3; } },
  { id: "ram_bar", name: "Ram Bar", rarity: "uncommon", max: 3, desc: "Ramming an enemy deals 8 damage.", apply: (s) => { s.ramDamage += 8; } },
  { id: "field_repair", name: "Field Repair", rarity: "uncommon", max: 3, desc: "Heal 8 HP on every level-up.", apply: (s) => { s.healOnLevel += 8; } },
  { id: "overclock", name: "Overclock", rarity: "uncommon", max: 3, desc: "+15% damage while boosting.", apply: (s) => { s.boostDamageMult += 0.15; } },
  { id: "ricochet", name: "Ricochet", rarity: "uncommon", max: 2, desc: "Rounds bounce once to a nearby enemy.", apply: (s) => { s.ricochet += 1; } },
  { id: "salvage_rig", name: "Salvage Rig", rarity: "uncommon", max: 3, desc: "25% chance for an enemy to drop an extra XP shard.", apply: (s) => { s.bonusXpChance += 0.25; } },
  { id: "crit_optics", name: "Crit Optics", rarity: "uncommon", max: 3, desc: "+8% chance to crit anywhere, not just weak points.", apply: (s) => { s.critChance += 0.08; } },
  { id: "emergency_weld", name: "Emergency Weld", rarity: "uncommon", max: 4, desc: "+10 max HP, and repair 40 HP now.", apply: (s) => { s.maxHp += 10; }, onPick: (p) => { p.heal(40); } },
  { id: "turbo_spool", name: "Turbo Spool", rarity: "uncommon", max: 3, desc: "Boost shoves 25% harder and holds 8% more speed.", apply: (s) => { s.boostPower *= 1.25; s.boostTopMult *= 1.08; } },
  { id: "charge_coils", name: "Charge Coils", rarity: "uncommon", max: 3, desc: "Boost recovers 35% faster and starts recovering sooner.", apply: (s) => { s.boostRegen *= 1.35; } },
  { id: "deflector_mesh", name: "Deflector Mesh", rarity: "uncommon", max: 3, desc: "+20 shield, recharging 5/s out of combat.", apply: (s) => { s.maxShield += 20; s.shieldRegen += 5; } },
  { id: "bulkhead", name: "Bulkhead", rarity: "uncommon", max: 4, desc: "Gain a 40-point shield now.", apply: () => {}, onPick: (p) => { p.addShield(40); } },

  // ---------------- Rare: build-defining ----------------
  { id: "explosive_rounds", name: "Explosive Rounds", rarity: "rare", max: 3, desc: "Rounds detonate for 1 damage in a 2.5m blast.", apply: (s) => { s.blastRadius = Math.max(s.blastRadius, 2.5) + 0.6; s.blastDamage += 1; } },
  { id: "twin_feed", name: "Twin Feed", rarity: "rare", max: 2, desc: "Fire 2 rounds per shot in a tight spread.", apply: (s) => { s.shots += 1; s.spread += 0.012; } },
  { id: "auto_loader", name: "Auto-Loader", rarity: "rare", max: 2, desc: "Reload 45% faster.", apply: (s) => { s.reloadTime *= 0.55; } },
  { id: "kinetic_battery", name: "Kinetic Battery", rarity: "rare", max: 2, desc: "Every 12 hits, the next round deals triple damage.", apply: (s) => { s.kineticEvery = s.kineticEvery ? Math.max(6, s.kineticEvery - 4) : 12; } },
  { id: "thermal_rounds", name: "Thermal Rounds", rarity: "rare", max: 2, desc: "Hits burn for 1 damage/sec over 3s.", apply: (s) => { s.burn += 1; } },
  { id: "hardened_chassis", name: "Hardened Chassis", rarity: "rare", max: 2, desc: "Take 18% less damage.", apply: (s) => { s.damageTaken *= 0.82; } },
  { id: "slipstream", name: "Slipstream", rarity: "rare", max: 2, desc: "+20% top speed and +10% turn rate.", apply: (s) => { s.topSpeedMult *= 1.2; s.turnMult *= 1.1; } },
  { id: "emp_trail", name: "EMP Trail", rarity: "rare", max: 2, desc: "Boosting leaves a trail that slows enemies 40% for 2s.", apply: (s) => { s.empTrail += 1; } },
  { id: "long_barrel", name: "Long Barrel", rarity: "rare", max: 2, desc: "+35% round speed and +1 damage.", apply: (s) => { s.bulletSpeed *= 1.35; s.damage += 1; } },
  { id: "regen_weave", name: "Regenerative Weave", rarity: "rare", max: 3, desc: "Regenerate 1.5 HP per second.", apply: (s) => { s.regen += 1.5; } },
  { id: "afterburner", name: "Afterburner", rarity: "rare", max: 2, desc: "Boost holds 18% more speed and drains 15% slower.", apply: (s) => { s.boostTopMult *= 1.18; s.boostDrainMult *= 0.85; } },
  { id: "kinetic_absorber", name: "Kinetic Absorber", rarity: "rare", max: 2, desc: "Boosting builds 4 shield per second.", apply: (s) => { s.boostShield += 4; if (!s.maxShield) s.maxShield += 25; } },
  { id: "trauma_kit", name: "Trauma Kit", rarity: "rare", max: 2, desc: "Repair 25% of max HP on every level-up.", apply: (s) => { s.healPctOnLevel += 0.25; } },
  { id: "reserve_cell", name: "Reserve Cell", rarity: "rare", max: 2, desc: "+35 max boost, and it recovers 25% faster.", apply: (s) => { s.maxBoost += 35; s.boostRegen *= 1.25; } },
  { id: "field_surgeon", name: "Field Surgeon", rarity: "rare", max: 2, desc: "Regenerate 3 HP/s after 3 seconds without being hit.", apply: (s) => { s.safeRegen += 3; } },

  // ---------------- Epic ----------------
  { id: "depleted_core", name: "Depleted Core", rarity: "epic", max: 3, desc: "+3 damage per round.", apply: (s) => { s.damage += 3; } },
  { id: "belt_fed", name: "Belt Fed", rarity: "epic", max: 2, desc: "+32 rounds, but reload takes 0.4s longer.", apply: (s) => { s.magazine += 32; s.reloadTime += 0.4; } },
  { id: "seeker_rounds", name: "Seeker Rounds", rarity: "epic", max: 2, desc: "Rounds curve toward the nearest enemy.", apply: (s) => { s.homing += 2.6; } },
  { id: "vampiric_feed", name: "Vampiric Feed", rarity: "epic", max: 2, desc: "Heal for 6% of the damage you deal.", apply: (s) => { s.lifesteal += 0.06; } },
  { id: "shield_capacitor", name: "Shield Capacitor", rarity: "epic", max: 2, desc: "+40 shield and it recharges three times faster.", apply: (s) => { s.maxShield += 40; s.shieldRegen = s.shieldRegen * 3 + 6; } },
  { id: "cluster_shells", name: "Cluster Shells", rarity: "epic", max: 2, desc: "Explosions throw out 3 smaller blasts.", apply: (s) => { s.clusters += 3; if (!s.blastRadius) { s.blastRadius = 2.2; s.blastDamage += 1; } } },
  { id: "governor_off", name: "Governor Off", rarity: "epic", max: 2, desc: "+40% fire rate, 25% wider spread.", apply: (s) => { s.fireRate *= 1.4; s.spread *= 1.25; } },
  { id: "overdrive_plates", name: "Overdrive Plates", rarity: "epic", max: 2, desc: "Ramming deals 25 damage and knocks enemies back.", apply: (s) => { s.ramDamage += 25; s.ramKnockback += 18; } },
  { id: "aegis_core", name: "Aegis Core", rarity: "epic", max: 2, desc: "Gain an 80-point shield now, plus 25 more on every level-up.", apply: (s) => { s.shieldOnLevel += 25; }, onPick: (p) => { p.addShield(80); } },
  { id: "perpetual_drive", name: "Perpetual Drive", rarity: "epic", max: 1, desc: "Boost never drains below a quarter, and shoves 15% harder.", apply: (s) => { s.boostFloor = Math.max(s.boostFloor, 0.25); s.boostPower *= 1.15; } },
  { id: "ablative_drive", name: "Ablative Drive", rarity: "epic", max: 2, desc: "Take 30% less damage while boosting.", apply: (s) => { s.boostArmor = Math.min(0.75, s.boostArmor + 0.3); } },

  // ---------------- Legendary ----------------
  { id: "twin_cannons", name: "Twin Cannons", rarity: "legendary", max: 1, desc: "A second gun fires at the same target, simultaneously.", apply: (s) => { s.twinCannon = true; } },
  { id: "chain_lightning", name: "Chain Lightning", rarity: "legendary", max: 2, desc: "Every 5th hit arcs to 3 nearby enemies for 3 damage.", apply: (s) => { s.chainEvery = s.chainEvery ? Math.max(3, s.chainEvery - 2) : 5; s.chainTargets += 3; s.chainDamage += 3; } },
  { id: "nano_repair", name: "Nano Repair", rarity: "legendary", max: 2, desc: "Regenerate 2 HP per second.", apply: (s) => { s.regen += 2; } },
  { id: "bullet_time", name: "Bullet Time", rarity: "legendary", max: 1, desc: "Below 25 HP the world slows 45% for 4s. 45s cooldown.", apply: (s) => { s.bulletTime = true; } },
  { id: "railgun_mode", name: "Railgun Mode", rarity: "legendary", max: 1, desc: "Rounds pierce everything and deal triple damage. Fire rate −40%.", apply: (s) => { s.railgun = true; s.pierce += 99; s.damage *= 3; s.fireRate *= 0.6; } },
  { id: "phantom_drive", name: "Phantom Drive", rarity: "legendary", max: 1, desc: "While boosting, enemy fire passes straight through you.", apply: (s) => { s.phantomBoost = true; } },
  { id: "phase_barrier", name: "Phase Barrier", rarity: "legendary", max: 1, desc: "+50 shield. It refills completely on every level-up and recharges four times faster.", apply: (s) => { s.maxShield += 50; s.shieldRegen = s.shieldRegen * 4 + 8; s.shieldFullOnLevel = true; } },
  { id: "jet_assist", name: "Jet Assist", rarity: "legendary", max: 1, desc: "Boost is twice as strong, recovers twice as fast, and ramming while boosting hurts.", apply: (s) => { s.boostPower *= 2; s.boostRegen *= 2; s.boostTopMult *= 1.12; s.ramDamage += 20; } },

  // ---------------- Mythic: one per run, if you are lucky ----------------
  { id: "singularity_rounds", name: "Singularity Rounds", rarity: "mythic", max: 1, desc: "Explosions drag enemies in first, and hit for 4 more.", apply: (s) => { if (!s.blastRadius) s.blastRadius = 2.6; s.blastRadius += 1.4; s.blastDamage += 4; s.singularity = true; } },
  { id: "infinite_belt", name: "Infinite Belt", rarity: "mythic", max: 1, desc: "Never reload again. Fire rate −15%.", apply: (s) => { s.infiniteBelt = true; s.fireRate *= 0.85; } },
  { id: "ghost_fox", name: "Ghost Fox", rarity: "mythic", max: 1, desc: "Once per run, a killing blow instead restores 50 HP and clears the screen.", apply: (s) => { s.secondWind = true; } },
  { id: "reactor_unsealed", name: "Reactor Unsealed", rarity: "mythic", max: 1, desc: "Double damage. Your max HP is cut by 30%.", apply: (s) => { s.damage *= 2; s.maxHp = Math.round(s.maxHp * 0.7); } },
  { id: "immortal_cell", name: "Immortal Cell", rarity: "mythic", max: 1, desc: "Regenerate 5 HP/s and 10 shield/s, forever.", apply: (s) => { s.regen += 5; s.shieldRegen += 10; s.shieldDelay = 1.2; if (!s.maxShield) s.maxShield += 60; } },
];

export const CARDS_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

// Rarity odds shift toward the top end as levels stack up, so late draws feel earned.
function weightFor(rarity, level) {
  const base = RARITY[rarity].weight;
  const tilt = { common: -0.055, uncommon: -0.012, rare: 0.02, epic: 0.05, legendary: 0.075, mythic: 0.09 }[rarity];
  return Math.max(0.15, base * (1 + tilt * Math.min(level, 22)));
}

// Three distinct cards the player has not maxed out. Falls back to a refund card if somehow
// everything is exhausted, so the level-up can always be dismissed.
export function draw(taken, level, count = 3) {
  const pool = CARDS.filter((c) => (taken[c.id] || 0) < c.max);
  const picked = [];
  const left = pool.slice();
  while (picked.length < count && left.length) {
    let total = 0;
    for (const c of left) total += weightFor(c.rarity, level);
    let r = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < left.length; i++) {
      r -= weightFor(left[i].rarity, level);
      if (r <= 0) { idx = i; break; }
    }
    picked.push(left.splice(idx, 1)[0]);
  }
  return picked;
}

// Fold a run's picks into a stat block. Order does not matter for additive cards; the
// multiplicative ones are written so repeated picks compound rather than overwrite.
// `base` lets the caller hand in a block that already has permanent mastery folded into it.
export function applyAll(taken, base = null) {
  const s = base || baseStats();
  for (const [id, n] of Object.entries(taken)) {
    const card = CARDS_BY_ID[id];
    if (!card) continue;
    for (let i = 0; i < n; i++) card.apply(s);
  }
  return s;
}

export const CARD_COUNT = CARDS.length;
export { pct };
