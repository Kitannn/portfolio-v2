// What a run is allowed to look like.
//
// Like name-filter.js, this file is free of the browser and of the game so the leaderboard Worker
// can import the very same rules (see server/src/worker.js). The client uses them to flag its own
// save; the server uses them to refuse a submission outright. One copy, so the two can never
// disagree about what is possible.
//
// These bounds are deliberately far outside anything the game can actually produce. They exist to
// catch a number that was WRITTEN from outside it, not to second-guess a good run — a genuinely
// excellent player should never come close to tripping one.

export const BOSS_AT_SECONDS = 300;     // when the Colossus lands; a run is not over until it does
export const MAX_RUN_SECONDS = 3 * 60 * 60;

// Returns the rule that was broken, or null when the run is possible.
export function implausible(r) {
  const n = (v) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
  const t = n(r.elapsed), kills = n(r.kills), level = n(r.level);
  const damage = n(r.damage), fired = n(r.fired), accuracy = n(r.accuracy);

  if ([t, kills, level, damage, fired, accuracy].some(Number.isNaN)) return "non-numeric field";
  if (t < 0 || kills < 0 || level < 1 || damage < 0 || fired < 0) return "negative value";
  if (t > MAX_RUN_SECONDS) return "run longer than three hours";

  // The spawner caps the field, so there is a ceiling on how fast things can die. The +60 covers
  // the wave that is already on screen at second zero.
  if (kills > t * 12 + 60) return "more kills than the spawner can supply";

  // XP per level climbs 14% a level, so the curve flattens hard. This allows several times the
  // fastest possible climb.
  if (level > 10 + t / 2.5) return "level beyond the XP curve";

  // Accuracy is a ratio. Anything above 1 means more hits than rounds.
  if (accuracy > 1.001) return "accuracy above 100%";

  // Even with every damage card stacked, a round cannot do four hundred.
  if (damage > (fired + 40) * 400) return "damage beyond what was fired";

  return null;
}

// A run that claims the boss went down has to have lasted long enough to have met it.
export function inconsistent(r) {
  if (r.won && n(r.elapsed) < BOSS_AT_SECONDS) return "won before the Colossus arrives";
  return null;
  function n(v) { return typeof v === "number" && Number.isFinite(v) ? v : NaN; }
}
