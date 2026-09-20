// Saved progress, and the consent that gates it.
//
// Nothing is written to disk until the player says yes. Until then — and forever, if they say no —
// the same object lives in memory for the session, so every menu works identically either way and
// no code outside this file needs to care which mode it is in.
const KEY = "hkitandrun.save.v1";
const CONSENT_KEY = "hkitandrun.consent";

const fresh = () => ({
  name: "",
  tag: "",            // locale + discriminator, e.g. "en_CA1"
  credits: 0,
  runs: 0,
  bestTime: 0,
  bestKills: 0,
  bossKills: 0,
  deaths: 0,
  history: [],        // one entry per finished run, newest first — what the leaderboard ranks
  vehicle: "gr86",
  discovered: {},     // cardId -> true, for the Collection
  mastery: {},        // vehicleId -> { nodeId: level } — mastery is bought per vehicle
});

let data = fresh();
let consent = null;   // null = not asked yet, true = storing, false = memory only

// localStorage throws in a private window with site data blocked, so every touch is guarded.
const readRaw = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const writeRaw = (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } };

// Mastery used to be one flat { nodeId: level } map shared across vehicles. Reshape any save
// written before it became per-vehicle so nobody loses what they bought.
function migrate(d) {
  const m = d.mastery || {};
  const flat = Object.values(m).some((v) => typeof v === "number");
  if (flat) d.mastery = { [d.vehicle || "gr86"]: m };
  return d;
}

export function initSave() {
  const c = readRaw(CONSENT_KEY);
  consent = c === "yes" ? true : c === "no" ? false : null;
  if (consent === true) {
    try {
      const raw = readRaw(KEY);
      if (raw) data = migrate({ ...fresh(), ...JSON.parse(raw) });
    } catch { data = fresh(); }
  }
  return { consent, data };
}

export const needsConsent = () => consent === null;
export const storing = () => consent === true;

export function setConsent(yes) {
  consent = yes;
  writeRaw(CONSENT_KEY, yes ? "yes" : "no");
  if (yes) flush();
}

export function flush() {
  if (consent !== true) return false;
  return writeRaw(KEY, JSON.stringify(data));
}

export const save = () => data;

// The mastery map for one vehicle, created on demand so the caller can just write into it.
export function masteryFor(vehicle = data.vehicle || "gr86") {
  data.mastery = data.mastery || {};
  data.mastery[vehicle] = data.mastery[vehicle] || {};
  return data.mastery[vehicle];
}

// Fold a finished run into the save: credits, records, and anything newly discovered.
const HISTORY_MAX = 60;

export function recordRun(result) {
  data.runs++;
  data.credits += result.credits;
  data.bestTime = Math.max(data.bestTime, Math.floor(result.elapsed));
  data.bestKills = Math.max(data.bestKills, result.kills);
  if (result.won) data.bossKills++; else data.deaths++;
  for (const id of Object.keys(result.taken)) data.discovered[id] = true;

  data.history = data.history || [];
  data.history.unshift({
    at: Date.now(),
    t: Math.floor(result.elapsed),
    kills: result.kills,
    damage: Math.round(result.damage),
    level: result.level,
    accuracy: Math.round(result.accuracy * 100),
    won: !!result.won,
    cheats: result.cheats || 0,     // how many codes were live, so the board can flag the run
  });
  // a leaderboard only ever shows the top of a list, so there is no reason to keep every run
  if (data.history.length > HISTORY_MAX) data.history.length = HISTORY_MAX;
  flush();
}

export function spend(amount) {
  if (data.credits < amount) return false;
  data.credits -= amount;
  flush();
  return true;
}

export function discover(id) {
  if (data.discovered[id]) return;
  data.discovered[id] = true;
  flush();
}

export function wipe() {
  data = fresh();
  flush();
}
