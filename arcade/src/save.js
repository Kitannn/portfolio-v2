// Saved progress, and the consent that gates it.
//
// Nothing is written to disk until the player says yes. Until then — and forever, if they say no —
// the same object lives in memory for the session, so every menu works identically either way and
// no code outside this file needs to care which mode it is in.
const KEY = "hkitandrun.save.v1";
const CONSENT_KEY = "hkitandrun.consent";

const VERSION = 2;          // saves from v2 on always carry a signature

const fresh = () => ({
  v: VERSION,
  hacked: false,      // set once the save fails its integrity check, or a debug hook is used
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

// ---- integrity ----------------------------------------------------------------
// A checksum over the fields worth faking. This is NOT security: the algorithm is right here in
// the page, so anyone determined can recompute it after editing. It exists to catch the ordinary
// case — someone opening devtools and hand-editing the stored blob — and the consequence is a
// flag on the leaderboard, never a refusal to play. The same check has to be re-run server-side
// once runs can actually be submitted, because nothing decided in this file can be trusted there.
const SALT = "hkitandrun/ledger/1";

function signature(d) {
  const canon = JSON.stringify([
    d.credits | 0, d.runs | 0, d.deaths | 0, d.bossKills | 0,
    d.bestTime | 0, d.bestKills | 0,
    Object.keys(d.discovered || {}).sort(),
    d.mastery || {}, d.name || "", d.tag || "", d.vehicle || "",
    (d.history || []).map((h) => [h.at | 0, h.t | 0, h.kills | 0, h.damage | 0, h.level | 0]),
  ]);
  // two independent 32-bit walks, so a single-field edit cannot be cancelled out by another
  let a = 0x811c9dc5, b = 0x9e3779b9;
  const s = SALT + canon;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 16777619) >>> 0;
    b = (Math.imul(b + c, 2654435761) ^ (b >>> 13)) >>> 0;
  }
  return a.toString(36) + "." + b.toString(36);
}

// Once flagged, a save stays flagged: a run edited in the console should not wash off by playing
// a clean one afterwards. Erasing all progress starts a fresh, unflagged save.
export function flagTamper(why) {
  if (data.hacked) return;
  data.hacked = true;
  if (typeof console !== "undefined") console.warn("[hkitandrun] runs will be flagged:", why);
  flush();
}

export const isTampered = () => !!data.hacked;

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
      if (raw) {
        const parsed = JSON.parse(raw);
        const sig = parsed.sig;
        delete parsed.sig;
        data = migrate({ ...fresh(), ...parsed });
        // A save written by this version and up carries a signature. Missing it, or carrying the
        // wrong one, means something other than the game wrote the file.
        const expected = signature(data);
        if ((parsed.v | 0) >= VERSION && sig !== expected) data.hacked = true;
        data.v = VERSION;
      }
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
  data.v = VERSION;
  return writeRaw(KEY, JSON.stringify({ ...data, sig: signature(data) }));
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
    codes: result.codes || 0,       // how many cheat codes were live, so the board can flag it
    hacked: !!result.hacked,        // ...and whether the save itself had been interfered with
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
