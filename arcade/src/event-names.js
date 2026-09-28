// What the analytics endpoint will accept.
//
// Free of the browser and of the game, like name-filter.js and run-bounds.js, so the Worker
// imports the same file the client does. One copy: the client cannot send a name the server would
// reject, and the server cannot silently accept something nobody meant to send.
//
// This allowlist is the whole security model for that endpoint. It is public and unauthenticated,
// and it writes a row per distinct name — so without one, anyone could post `aaa1`, `aaa2`, `aaa3`
// forever and grow the table without limit. Exact names are fixed strings; prefixed ones take a
// sanitised suffix and are additionally capped per day inside the Worker.

// Counters. Everything here is a plain tally with no value attached.
export const EXACT = new Set([
  // ---- the site ----
  "visit",              // a page load, once
  "intro_passed",       // the loader finished and the landing area is up
  "restored_windows",   // someone put the desktop windows back
  "pak_clicked",        // the arcade cartridge in the corner

  // ---- conversions: the reason any of this is worth measuring ----
  "cv_download",        // the résumé PDF
  "cv_page",            // cv.html

  // ---- the game ----
  "game_load",
  "run_started",
  "run_finished",       // reached the finish screen either way
  "boss_reached",
  "boss_killed",
  "name_set",
  "online_optin",
  "online_declined",
]);

// Prefixed names. The suffix is sanitised to [a-z0-9-] and length-capped; anything else is dropped
// rather than stored, so a malformed or hostile suffix costs one rejected row, not a table.
export const PREFIXES = new Set([
  "section",    // section:experience — scrolled far enough to see it
  "page",       // page:works — a route was opened
  "work",       // work:cosmic-carnage — a project page
  "outbound",   // outbound:github — left for somewhere else
  "quit",       // quit:menu — which screen they were on when they stopped
  "level",      // level:10-14 — bucketed, never exact, so it cannot single anyone out
  "card",       // card:hollow — which upgrade was taken when offered
  "shop",       // shop:frame — which mastery node was bought
  "ach",        // ach:colossus — which achievement landed
  "cheat",      // cheat:konami — which portfolio code was found
  "input",      // input:touch — how the game is being played
  "device",     // device:mobile
]);

// Timings. These carry a number, so they accumulate a sum and a maximum as well as a count, which
// is enough for an average and a worst case without storing a single individual figure.
export const TIMINGS = new Set([
  "dwell:title",   // seconds on the Start screen
  "dwell:menu",    // ...in the main menu
  "dwell:run",     // ...actually driving
  "dwell:site",    // ...on the portfolio
]);

const SUFFIX = /^[a-z0-9][a-z0-9-]{0,38}$/;

// Returns the name to store, or null when it is not something we asked for.
export function validEvent(raw) {
  const name = String(raw || "").slice(0, 60);
  if (EXACT.has(name)) return name;
  if (TIMINGS.has(name)) return name;
  const i = name.indexOf(":");
  if (i < 1) return null;
  const head = name.slice(0, i);
  const tail = name.slice(i + 1);
  if (!PREFIXES.has(head) || !SUFFIX.test(tail)) return null;
  return `${head}:${tail}`;
}

export const isTiming = (name) => TIMINGS.has(name);

// A run's level is banded before it leaves the browser. An exact level is a surprisingly sharp
// detail when combined with a timestamp; a band answers the same design question without it.
export function levelBand(level) {
  const n = Math.max(1, Math.floor(Number(level) || 1));
  if (n < 5) return "1-4";
  if (n < 10) return "5-9";
  if (n < 15) return "10-14";
  if (n < 20) return "15-19";
  if (n < 30) return "20-29";
  return "30-plus";
}
