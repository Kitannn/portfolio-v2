// ACHIEVEMENTS — the long game.
//
// Every one is a single number crossing a threshold, which is the whole trick: the rest of the
// game just keeps counters, and this file decides what any of them mean. An achievement never
// reads the world directly, so nothing here can drift out of step with what actually happened.
//
// Rewards come in two kinds. Credits are paid once, the moment it unlocks. A BUFF is permanent and
// is re-derived every run from the set of unlocked ids — never banked, never applied twice, and it
// survives any change to this list, because the stat block is rebuilt from scratch each time (see
// buildStats in main.js).
import { CARDS } from "./cards.js";

export const TIERS = {
  bronze:   { label: "Bronze",   order: 0, color: "--t-bronze" },
  silver:   { label: "Silver",   order: 1, color: "--t-silver" },
  gold:     { label: "Gold",     order: 2, color: "--t-gold" },
  platinum: { label: "Platinum", order: 3, color: "--t-plat" },
  mythic:   { label: "Mythic",   order: 4, color: "--t-myth" },
};

// `key` names a number in the context built below; `goal` is what it has to reach.
// `hidden` keeps the whole thing secret — name, description and all — until it lands.
export const ACHIEVEMENTS = [
  // ---- bronze: you will get these without trying ----
  { id: "firstblood", tier: "bronze", key: "kills", goal: 10,
    name: "First Blood", desc: "Destroy 10 enemies.", credits: 150 },
  { id: "firstrun", tier: "bronze", key: "runs", goal: 1,
    name: "Shakedown", desc: "Finish a run.", credits: 200 },
  { id: "firstchest", tier: "bronze", key: "chests", goal: 1,
    name: "Finders Keepers", desc: "Open a chest.", credits: 150 },
  { id: "level5", tier: "bronze", key: "bestLevel", goal: 5,
    name: "Warmed Up", desc: "Reach level 5 in a run.",
    buff: (s) => { s.maxHp += 10; }, buffText: "+10 max HP" },
  { id: "minute", tier: "bronze", key: "bestTime", goal: 60,
    name: "Still Here", desc: "Survive one minute.", credits: 200 },

  // ---- silver: a few evenings ----
  { id: "kills500", tier: "silver", key: "kills", goal: 500,
    name: "Body Shop", desc: "Destroy 500 enemies, all time.", credits: 400 },
  { id: "level12", tier: "silver", key: "bestLevel", goal: 12,
    name: "Well Fed", desc: "Reach level 12 in a run.",
    buff: (s) => { s.magazine += 4; }, buffText: "+4 rounds per magazine" },
  { id: "chests10", tier: "silver", key: "chests", goal: 10,
    name: "Magpie", desc: "Open 10 chests.", credits: 500 },
  { id: "survive180", tier: "silver", key: "bestTime", goal: 180,
    name: "Three Minutes", desc: "Survive three minutes.",
    buff: (s) => { s.maxShield += 15; }, buffText: "+15 max shield" },
  { id: "runs10", tier: "silver", key: "runs", goal: 10,
    name: "Regular", desc: "Finish 10 runs.", credits: 600 },
  { id: "cards50", tier: "silver", key: "cards", goal: 50,
    name: "Deck Builder", desc: "Take 50 upgrade cards, all time.",
    buff: (s) => { s.damage *= 1.05; }, buffText: "+5% weapon damage" },

  // ---- gold: you are trying now ----
  { id: "colossus", tier: "gold", key: "boss", goal: 1,
    name: "Giant Killer", desc: "Bring the Colossus down.", credits: 1200 },
  { id: "kills2500", tier: "gold", key: "kills", goal: 2500,
    name: "Scrap Merchant", desc: "Destroy 2,500 enemies, all time.",
    buff: (s) => { s.magazine += 8; }, buffText: "+8 rounds per magazine" },
  { id: "level20", tier: "gold", key: "bestLevel", goal: 20,
    name: "Overbuilt", desc: "Reach level 20 in a run.",
    buff: (s) => { s.xpMult *= 1.12; }, buffText: "+12% XP gained" },
  { id: "marksman", tier: "gold", key: "bestAccuracy", goal: 60,
    name: "Marksman", desc: "Finish a run at 60% accuracy or better, with at least 300 rounds fired.",
    buff: (s) => { s.damage *= 1.08; }, buffText: "+8% weapon damage" },
  { id: "elites10", tier: "gold", key: "elites", goal: 10,
    name: "Big Game", desc: "Destroy 10 elites.",
    buff: (s) => { s.maxShield += 25; }, buffText: "+25 max shield" },

  // ---- platinum: a real ask ----
  { id: "colossus5", tier: "platinum", key: "boss", goal: 5,
    name: "Colossus Slayer", desc: "Bring the Colossus down five times.", credits: 3000 },
  { id: "kills10000", tier: "platinum", key: "kills", goal: 10000,
    name: "Industrial", desc: "Destroy 10,000 enemies, all time.",
    buff: (s) => { s.pierce += 1; }, buffText: "Rounds pierce one extra enemy" },
  { id: "untouchable", tier: "platinum", key: "bestSafeStreak", goal: 180,
    name: "Untouchable", desc: "Go three minutes in one run without being hit.",
    buff: (s) => { s.boostPower *= 1.2; }, buffText: "+20% boost power" },
  { id: "fullhouse", tier: "platinum", key: "bestCardsInRun", goal: 12,
    name: "Full House", desc: "Take 12 upgrade cards in a single run.",
    buff: (s) => { s.maxHp += 18; }, buffText: "+18 max HP" },

  // ---- mythic: the far end ----
  { id: "flawless", tier: "mythic", key: "flawless", goal: 1,
    name: "Not A Scratch", desc: "Beat the Colossus without taking a single point of damage.",
    credits: 5000, buff: (s) => { s.maxHp += 25; s.damage *= 1.1; }, buffText: "+25 max HP, +10% damage" },
  { id: "kills25000", tier: "mythic", key: "kills", goal: 25000,
    name: "Hit And Run", desc: "Destroy 25,000 enemies, all time.",
    buff: (s) => { s.pierce += 2; }, buffText: "Rounds pierce two extra enemies" },
  { id: "collector", tier: "mythic", key: "discovered", goal: CARDS.length,
    name: "The Whole Catalogue", desc: `Discover all ${CARDS.length} upgrade cards.`,
    buff: (s) => { s.creditMult = (s.creditMult || 1) * 1.25; }, buffText: "+25% credits earned" },
  { id: "speedrun", tier: "mythic", key: "fastBoss", goal: 1,
    name: "Ahead Of Schedule", desc: "Beat the Colossus within 30 seconds of it arriving.",
    buff: (s) => { s.fireRate *= 1.15; }, buffText: "+15% fire rate" },

  // ---- hidden: no hint that these exist until they land ----
  { id: "landscaping", tier: "silver", hidden: true, key: "flora", goal: 100,
    name: "Landscaping", desc: "Flatten 100 cacti and shrubs.", credits: 400 },
  { id: "demolition", tier: "gold", hidden: true, key: "flora", goal: 1000,
    name: "Scorched Earth", desc: "Flatten 1,000 cacti and shrubs.",
    buff: (s) => { s.damage *= 1.06; }, buffText: "+6% weapon damage" },
  { id: "persistence", tier: "bronze", hidden: true, key: "deaths", goal: 25,
    name: "Persistence", desc: "Get wrecked 25 times. It happens.", credits: 800 },
  { id: "treasure", tier: "gold", hidden: true, key: "chests", goal: 50,
    name: "Tomb Raider", desc: "Open 50 chests.", credits: 1000 },
  { id: "tourist", tier: "gold", hidden: true, key: "distance", goal: 50000,
    name: "Long Way Round", desc: "Drive 50 km in total.",
    buff: (s) => { s.topSpeedMult *= 1.1; }, buffText: "+10% top speed" },
  { id: "pacifist", tier: "platinum", hidden: true, key: "bestQuiet", goal: 60,
    name: "Hold Your Fire", desc: "Survive the first minute of a run without firing a shot.",
    buff: (s) => { s.maxHp += 12; }, buffText: "+12 max HP" },
];

export const BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

// Fresh totals. Anything added here later starts at zero for existing saves, which is the correct
// behaviour — an achievement nobody could have been tracking should not retroactively unlock.
export const freshTotals = () => ({
  kills: 0, flora: 0, chests: 0, elites: 0, cards: 0, distance: 0,
  bestLevel: 0, bestAccuracy: 0, bestSafeStreak: 0, bestQuiet: 0, bestCardsInRun: 0,
  flawless: 0, fastBoss: 0,
});

// Every number an achievement is allowed to look at, in one flat object.
export function context(save) {
  const t = { ...freshTotals(), ...(save.totals || {}) };
  return {
    ...t,
    runs: save.runs || 0,
    deaths: save.deaths || 0,
    boss: save.bossKills || 0,
    bestTime: save.bestTime || 0,
    bestKills: save.bestKills || 0,
    discovered: Object.keys(save.discovered || {}).length,
  };
}

export const isUnlocked = (save, id) => !!(save.ach || {})[id];

export const value = (save, a) => context(save)[a.key] || 0;

// Returns the definitions that have just crossed their line, and marks them. The caller pays out
// the credits — this file does not touch the wallet, so there is one place that does.
export function evaluate(save) {
  const ctx = context(save);
  save.ach = save.ach || {};
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (save.ach[a.id]) continue;
    if ((ctx[a.key] || 0) >= a.goal) {
      save.ach[a.id] = 1;
      fresh.push(a);
    }
  }
  return fresh;
}

// The permanent half of the rewards, folded into the run's stat block.
export function applyAchievements(stats, save) {
  const owned = save.ach || {};
  for (const a of ACHIEVEMENTS) if (owned[a.id] && a.buff) a.buff(stats);
  return stats;
}

// For the panel: every achievement with where it stands. Hidden ones that are still locked are
// returned as a placeholder so the panel can show the count without giving the game away.
export function roster(save) {
  const ctx = context(save);
  const owned = save.ach || {};
  return ACHIEVEMENTS.map((a) => {
    const done = !!owned[a.id];
    const secret = !!a.hidden && !done;
    return {
      def: a, done, secret,
      value: Math.min(ctx[a.key] || 0, a.goal),
      goal: a.goal,
      pct: Math.min(1, (ctx[a.key] || 0) / a.goal),
    };
  });
}

export const earned = (save) => ACHIEVEMENTS.filter((a) => (save.ach || {})[a.id]).length;
export const total = () => ACHIEVEMENTS.length;

// A one-line summary of what an achievement pays, for the panel and the finish screen.
export const rewardText = (a) => {
  const bits = [];
  if (a.credits) bits.push(`◆ ${a.credits.toLocaleString()}`);
  if (a.buffText) bits.push(a.buffText);
  return bits.join(" · ");
};
