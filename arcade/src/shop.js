// The mastery tree — permanent, per-vehicle upgrades bought with credits between runs.
//
// Unlike cards, these apply BEFORE a run starts, to the base stat block. They are deliberately
// flat and small: mastery should make a bad run survivable, not replace the card draw.
//
// Nodes unlock by total levels already bought in the tree, so the first row is always affordable
// and the back row is something to work toward.
export const VEHICLES = [
  {
    id: "gr86", name: "GR 86", year: "2025", maker: "Toyota",
    blurb: "Light, rear-drive and happy sideways. The one you start with.",
    owned: true, colour: 0xeef1f6,
  },
  { id: "locked_a", name: "???", blurb: "Something heavier.", owned: false },
  { id: "locked_b", name: "???", blurb: "Something faster.", owned: false },
  { id: "locked_c", name: "???", blurb: "Something that should not be road legal.", owned: false },
];

// cost(level) is what the NEXT level costs, so the first is cheap and the last stings
const ramp = (base) => (level) => Math.round(base * Math.pow(1.85, level));

export const MASTERY = [
  { id: "frame", name: "Reinforced Frame", tier: 0, max: 5, cost: ramp(120), desc: (n) => `+${n * 10} max HP`, apply: (s, n) => { s.maxHp += n * 10; } },
  { id: "rounds", name: "Heavy Rounds", tier: 0, max: 4, cost: ramp(160), desc: (n) => `+${(n * 0.5).toFixed(1)} damage`, apply: (s, n) => { s.damage += n * 0.5; } },
  { id: "belt", name: "Extended Belt", tier: 0, max: 4, cost: ramp(130), desc: (n) => `+${n * 4} magazine`, apply: (s, n) => { s.magazine += n * 4; } },
  { id: "magnet", name: "Salvage Magnet", tier: 0, max: 3, cost: ramp(110), desc: (n) => `+${n * 14}% pickup radius`, apply: (s, n) => { s.pickupRadius *= 1 + n * 0.14; } },

  { id: "cycling", name: "Rapid Cycling", tier: 1, max: 4, cost: ramp(200), desc: (n) => `+${n * 5}% fire rate`, apply: (s, n) => { s.fireRate *= 1 + n * 0.05; } },
  { id: "quickchange", name: "Quick Change", tier: 1, max: 4, cost: ramp(190), desc: (n) => `−${n * 6}% reload time`, apply: (s, n) => { s.reloadTime *= Math.pow(0.94, n); } },
  { id: "plating", name: "Ablative Plating", tier: 1, max: 4, cost: ramp(220), desc: (n) => `−${n * 3}% damage taken`, apply: (s, n) => { s.damageTaken *= Math.pow(0.97, n); } },
  { id: "bottle", name: "Bigger Bottle", tier: 1, max: 4, cost: ramp(150), desc: (n) => `+${n * 15} max boost`, apply: (s, n) => { s.maxBoost += n * 15; } },

  { id: "pump", name: "Charge Pump", tier: 2, max: 4, cost: ramp(240), desc: (n) => `+${n * 10}% boost recovery`, apply: (s, n) => { s.boostRegen *= 1 + n * 0.10; } },
  { id: "scholar", name: "Data Scholar", tier: 2, max: 3, cost: ramp(260), desc: (n) => `+${n * 8}% XP gained`, apply: (s, n) => { s.xpMult *= 1 + n * 0.08; } },
  { id: "cell", name: "Shield Cell", tier: 2, max: 3, cost: ramp(300), desc: (n) => `Start each run with a ${n * 12}-point shield`, apply: (s, n) => { s.startShield = (s.startShield || 0) + n * 12; } },
  { id: "salvage", name: "Scrap Broker", tier: 2, max: 3, cost: ramp(280), desc: (n) => `+${n * 8}% credits earned`, apply: (s, n) => { s.creditMult = (s.creditMult || 1) * (1 + n * 0.08); } },

  { id: "sump", name: "Dry Sump", tier: 3, max: 3, cost: ramp(420), desc: (n) => `+${n * 5}% top speed and grip`, apply: (s, n) => { s.topSpeedMult *= 1 + n * 0.05; s.gripMult *= 1 + n * 0.05; } },
  { id: "medic", name: "Onboard Medic", tier: 3, max: 3, cost: ramp(460), desc: (n) => `Regenerate ${(n * 0.4).toFixed(1)} HP/sec`, apply: (s, n) => { s.regen += n * 0.4; } },
  { id: "core", name: "Depleted Core", tier: 3, max: 2, cost: ramp(620), desc: (n) => `+${n} damage`, apply: (s, n) => { s.damage += n; } },
];

export const MASTERY_BY_ID = Object.fromEntries(MASTERY.map((m) => [m.id, m]));
export const TIERS = ["Chassis", "Gunnery", "Systems", "Prototype"];

// how many levels must already be bought before a tier opens
const TIER_GATE = [0, 4, 10, 18];

export const totalLevels = (mastery) => Object.values(mastery).reduce((a, b) => a + b, 0);
export const tierUnlocked = (tier, mastery) => totalLevels(mastery) >= TIER_GATE[tier];
export const levelsToUnlock = (tier, mastery) => Math.max(0, TIER_GATE[tier] - totalLevels(mastery));

// Everything already sunk into a tree, so a reset can hand it all back rather than guessing.
export function refundValue(mastery) {
  let total = 0;
  for (const node of MASTERY) {
    const n = mastery[node.id] || 0;
    for (let i = 0; i < n; i++) total += node.cost(i);
  }
  return total;
}

export const nextCost = (node, mastery) => {
  const n = mastery[node.id] || 0;
  return n >= node.max ? null : node.cost(n);
};

// Layer mastery onto a fresh stat block. Called before applyAll() folds in the run's cards.
export function applyMastery(stats, mastery) {
  for (const node of MASTERY) {
    const n = mastery[node.id] || 0;
    if (n > 0) node.apply(stats, n);
  }
  return stats;
}
