// The online leaderboard, from the client's side.
//
// Everything here is optional and everything here can fail. The game has worked offline for its
// whole life and still does: if this endpoint is unset, unreachable, slow or broken, the board
// falls back to the local records it has always shown and the run is unaffected. Nothing in this
// file is ever awaited on a path the player is waiting on.
//
// Going online is a SEPARATE choice from the cookie consent. Storing your name on your own machine
// and publishing it to strangers are not the same decision, so they are not the same checkbox.
import * as store from "./save.js";
import { localeTag } from "./name.js";

// Set this to the Worker's URL after deploying server/ — see server/README.md. While it is empty
// the whole feature stays inert and the panel says so, rather than pretending to be offline.
const BUILT_IN = "https://hkitandrun-board.hkitannn.workers.dev";

// A per-browser override, so a Worker can be pointed at without editing and redeploying the site:
//   localStorage.setItem("hkitandrun.endpoint", "https://…workers.dev")
// It only ever affects the browser it is typed into, which is the same browser whose console was
// already open — it grants nothing that was not already available there.
const OVERRIDE = (() => {
  try { return localStorage.getItem("hkitandrun.endpoint") || ""; } catch { return ""; }
})();

export const ENDPOINT = (OVERRIDE || BUILT_IN).replace(/\/+$/, "");

const KEY = "hkitandrun.online";
const TIMEOUT = 6000;
const BOARD_TTL = 30_000;     // a leaderboard does not need to be fresher than this

export const configured = () => !!ENDPOINT;

const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
};
const write = (d) => {
  try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch { return false; }
};

export const state = () => {
  const d = read();
  return { consent: !!d.consent, id: d.id || "", name: d.name || "", tag: d.tag || "" };
};
export const enrolled = () => { const s = state(); return !!(s.consent && s.id); };
export const optedOut = () => read().consent === false;

// Turning it off keeps the id: their rows stay on the board under the same name, and turning it
// back on later does not mint them a second identity or a second #tag.
export function setConsent(yes) {
  const d = read();
  d.consent = !!yes;
  write(d);
}

export function forget() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to forget */ }
}

async function call(path, body) {
  if (!ENDPOINT) throw new Error("offline");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(ENDPOINT + path, {
      method: body ? "POST" : "GET",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
      mode: "cors",
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || `http ${res.status}`), { status: res.status, data });
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// ---- identity --------------------------------------------------------------------
// The server hands back the authoritative discriminator. Up to now the #1 in kitannn#en_US1 has
// been a local guess, because only something that can see every other player knows whether this is
// the first kitannn or the fourth. Once enrolled, that guess is replaced by the real one.
export async function enroll(name) {
  const res = await call("/v1/register", { name, locale: localeTag() });
  const d = read();
  d.consent = true;
  d.id = res.id;
  d.name = res.name;
  d.tag = res.tag;
  write(d);
  // the local save follows the server, so every screen shows the same name
  store.save().name = res.name;
  store.save().tag = res.tag;
  store.flush();
  return res;
}

// ---- submitting ------------------------------------------------------------------
// Called from endRun and never awaited. A rejected or unreachable submission is recorded for the
// panel to explain and otherwise ignored: the run is already banked locally either way.
let lastError = "";
export const lastSubmitError = () => lastError;

export function submitRun(result) {
  if (!enrolled() || !ENDPOINT) return;
  const { id } = state();
  call("/v1/submit", {
    id,
    run: {
      elapsed: result.elapsed,
      kills: result.kills,
      level: result.level,
      damage: result.damage,
      fired: result.fired,
      accuracy: result.accuracy,
      won: !!result.won,
      codes: result.codes || 0,
      hacked: !!result.hacked,
    },
  }).then(
    () => { lastError = ""; invalidate(); },
    (e) => {
      // The server refusing a run is worth saying out loud; a dropped connection is not.
      lastError = e.status === 422 ? "That run was refused as out of range."
        : e.status === 429 ? "Submitting too quickly — try again in a minute."
        : "";
    }
  );
}

// ---- reading the board -----------------------------------------------------------
let cache = null, cachedAt = 0, inflight = null;
export const invalidate = () => { cache = null; cachedAt = 0; };

export async function fetchBoard() {
  if (!ENDPOINT) return null;
  if (cache && Date.now() - cachedAt < BOARD_TTL) return cache;
  if (inflight) return inflight;
  inflight = call("/v1/board").then(
    (data) => { cache = data.board; cachedAt = Date.now(); inflight = null; return cache; },
    (e) => { inflight = null; throw e; }
  );
  return inflight;
}

// what the panel has on hand right now, without going near the network
export const cached = () => cache;
