// Cheat codes, earned on the portfolio and spent here.
//
// Every barcode on kitannn.com hides a controller sequence. Light one up and it writes its id into
// localStorage; this reads that list and folds the effects into the run's base stats.
//
// These are session effects, not progress: they change how a run plays but nothing about them is
// saved as an achievement, and they are re-read from scratch on every load. The one exception is
// the all-codes bonus, which has to remember it was claimed so it cannot be farmed.
const KEY = "hkitandrun.cheats";

// Must stay in step with CODES in the portfolio's app.js — same ids, same descriptions.
export const CHEATS = {
  konami:     { name: "Konami code",        desc: "+50 max HP",                        apply: (s) => { s.maxHp += 50; } },
  hadouken:   { name: "Hadouken",           desc: "+20% weapon damage",                apply: (s) => { s.damage *= 1.2; } },
  shoryuken:  { name: "Shoryuken",          desc: "+25% fire rate",                    apply: (s) => { s.fireRate *= 1.25; } },
  tatsumaki:  { name: "Tatsumaki",          desc: "Rounds pierce one extra enemy",     apply: (s) => { s.pierce += 1; } },
  sims:       { name: "Sims cheat console", desc: "Start with a 100 shield",           apply: (s) => { s.startShield = (s.startShield || 0) + 100; } },
  motherlode: { name: "Motherlode",         desc: "+35% credits earned",               apply: (s) => { s.creditMult = (s.creditMult || 1) * 1.35; } },
  iddqd:      { name: "IDDQD",              desc: "Take 40% less damage",              apply: (s) => { s.damageTaken *= 0.6; } },
  sonic:      { name: "Sonic level select", desc: "+25% top speed",                    apply: (s) => { s.topSpeedMult *= 1.25; } },
  gta:        { name: "Cheat hotline",      desc: "Start with a free sub-weapon",      apply: (s) => { s.freeWeapon = true; } },
  rainbow:    { name: "Rainbow flick",      desc: "+35% grip, +20% turn rate",         apply: (s) => { s.gripMult *= 1.35; s.turnMult *= 1.2; } },
  overdrive:  { name: "Overdrive",          desc: "Boost never drops below a third",   apply: (s) => { s.boostFloor = Math.max(s.boostFloor, 0.33); } },
  scanline:   { name: "Scanline",           desc: "+40% XP gained",                    apply: (s) => { s.xpMult *= 1.4; } },
  nitro:      { name: "Nitro prime",        desc: "+40% boost power and recovery",     apply: (s) => { s.boostPower *= 1.4; s.boostRegen *= 1.4; } },
  wombo:      { name: "Wombo combo",        desc: "+15 rounds per magazine",           apply: (s) => { s.magazine += 15; } },
};

export const ALL_IDS = Object.keys(CHEATS);
export const ALL_BONUS_CREDITS = 2000;

const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
};
const write = (d) => {
  try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch { return false; }
};

// The ids that are both unlocked and known to this build, de-duplicated.
// A cheat is a switch, not a stack: finishing the same code a second time must not double its
// effect, so the list is collapsed to a Set before anything reads it. Different codes still all
// apply together in the same run.
export function active() {
  const ids = read().ids || [];
  return [...new Set(ids)].filter((id) => CHEATS[id]);
}

export const allFound = () => ALL_IDS.every((id) => active().includes(id));

// Drop a single code. The unlock lives in storage, so this really does remove it — finishing
// that input string again on the portfolio brings it straight back.
export function deactivate(id) {
  const d = read();
  d.ids = (d.ids || []).filter((x) => x !== id);
  d.all = false;
  write(d);
}

export function applyCheats(stats) {
  for (const id of active()) CHEATS[id].apply(stats);
  return stats;
}

// The all-codes prize: a pile of credits, once, and one invulnerable run. Both are consumed so
// neither can be repeated — the codes stay unlocked, the reward does not come back.
export function claimAllBonus() {
  const d = read();
  if (!allFound() || d.bonusClaimed) return 0;
  d.bonusClaimed = true;
  write(d);
  return ALL_BONUS_CREDITS;
}

export function takeInvulnRun() {
  const d = read();
  if (!allFound() || d.invulnUsed) return false;
  d.invulnUsed = true;
  write(d);
  return true;
}

export const invulnAvailable = () => allFound() && !read().invulnUsed;

// for the title screen
export function summary() {
  const ids = active();
  return {
    found: ids.length,
    total: ALL_IDS.length,
    all: allFound(),
    invuln: invulnAvailable(),
    list: ids.map((id) => ({ id, ...CHEATS[id] })),
  };
}
