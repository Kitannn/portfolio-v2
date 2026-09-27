// The name filter, and nothing else.
//
// This file is deliberately free of the browser and of the game: no DOM, no storage, no imports.
// That is what lets the Cloudflare Worker behind the online leaderboard import the very same file
// (see server/src/worker.js) and run the identical check on submit.
//
// It has to run in both places. Client-side it is a courtesy that gives instant feedback while
// someone types; server-side it is the actual enforcement, because anything the client decides can
// be bypassed by anyone willing to open devtools. One copy, two callers, no chance of the two
// drifting apart and the server accepting a name the client would have refused.

export const MIN = 3;
export const MAX = 16;

// Roots, matched against a normalised form of the name. Kept to stems so that plurals, -er/-ing
// and the usual padding are caught without needing an entry each. Split into two lists because
// they are treated differently: SOFT gets masked, HARD is refused outright.
const SOFT = [
  "arse", "ass", "bastard", "bitch", "bollock", "bugger", "crap", "damn", "dick", "dildo",
  "douche", "fuk", "fuck", "git", "goddam", "jerk", "knob", "minge", "piss", "prick", "pussy",
  "shit", "slut", "twat", "wank", "whore", "cock", "cunt", "bollok", "tosser", "turd", "fanny",
];
// Slurs and hate terms. Deliberately not spelled out in source: each entry is the lowercase
// normalised form, split so the file itself stays readable, and rebuilt at load.
const HARD = [
  ["n", "igg", "er"], ["n", "igg", "a"], ["f", "agg", "ot"], ["f", "ag"], ["k", "ike"],
  ["s", "pic"], ["c", "hink"], ["g", "ook"], ["t", "ranny"], ["r", "etard"], ["w", "etback"],
  ["r", "apist"], ["r", "ape"], ["n", "azi"], ["h", "itler"], ["k", "kk"], ["p", "aedo"],
  ["p", "edo"], ["c", "oon"], ["w", "og"], ["s", "hemale"],
].map((p) => p.join(""));

// Leetspeak and padding are the whole game here: "f4ggot", "n1gg3r" and "shiiiit" all have to
// collapse onto the same stem before matching, or the list is decorative.
const LEET = { "4": "a", "@": "a", "8": "b", "(": "c", "3": "e", "6": "g", "9": "g", "1": "i", "!": "i", "|": "i", "0": "o", "5": "s", "$": "s", "7": "t", "+": "t", "2": "z" };

const collapse = (s) => s.replace(/(.)\1{1,}/g, "$1");

// Two forms of a name. `plain` only undoes leetspeak and punctuation; `tight` also squashes
// repeated letters to catch padding. They are kept separate because squashing is destructive —
// it turns "nigger" into "niger", so matching a stem against ONLY the tight form would miss the
// straight spelling, and matching a 3-letter stem against it would flag half the dictionary.
export function forms(raw) {
  const plain = raw
    .toLowerCase()
    .replace(/[4@8(3691!|05$7+2]/g, (c) => LEET[c] || c)
    .replace(/[^a-z0-9]/g, "");
  return { plain, tight: collapse(plain) };
}

// The Scunthorpe list. Ordinary words that happen to contain a blocked stem are removed from the
// name before it is tested, so "classic" and "Bass Player" are not casualties of banning "ass".
const ALLOW = [
  "assassin", "assassinate", "classic", "class", "bass", "grass", "pass", "password", "passing",
  "compass", "mass", "massive", "glass", "brass", "embassy", "assist", "asset", "associate",
  "assume", "assure", "cassette", "harass", "canvas", "circus", "analysis", "analyst",
  "cockpit", "cocktail", "peacock", "shuttlecock", "hancock", "cocker", "scunthorpe", "penistone",
  "shiitake", "titan", "titanium", "document", "functional", "dickens", "dickinson", "mishit",
];
const ALLOW_TIGHT = ALLOW.map(collapse);

const strip = (s, list) => list.reduce((acc, w) => acc.split(w).join(""), s);

// Returns the offending stem, or null. Short stems are only ever matched against `plain`.
function findHit(raw, list) {
  const { plain, tight } = forms(raw);
  const a = strip(plain, ALLOW);
  const b = strip(tight, ALLOW_TIGHT);
  for (const w of list) {
    if (a.includes(w)) return w;
    if (w.length >= 4 && b.includes(collapse(w))) return w;
  }
  return null;
}

// Returns { ok, reason, value } — `value` is what should actually be stored.
export function checkName(raw) {
  const name = raw.trim();
  if (name.length < MIN) return { ok: false, reason: `At least ${MIN} characters.` };
  if (name.length > MAX) return { ok: false, reason: `At most ${MAX} characters.` };
  if (!/^[A-Za-z0-9 _-]+$/.test(name)) return { ok: false, reason: "Letters, numbers, spaces, _ and - only." };
  if (!/[A-Za-z0-9]/.test(name)) return { ok: false, reason: "Needs at least one letter or number." };

  if (findHit(name, HARD)) return { ok: false, reason: "That name can't be used. Try another." };

  const soft = findHit(name, SOFT);
  if (soft) return { ok: true, value: mask(name, soft), masked: true };
  return { ok: true, value: name };
}

// Star out the offending run in the ORIGINAL string. The plain form has had characters dropped,
// so positions are mapped back by walking both strings together.
function mask(name, word) {
  const chars = [...name];
  const map = [];                       // plain-form index -> original index
  let plain = "";
  for (let i = 0; i < chars.length; i++) {
    const lower = chars[i].toLowerCase();
    const sub = LEET[lower] || lower;
    if (!/[a-z0-9]/.test(sub)) continue;
    plain += sub;
    map.push(i);
  }
  let at = plain.indexOf(word);
  if (at === -1) {
    // only the padded form matched, so blank the whole thing rather than guess at an offset
    return chars.map((c) => (/\s/.test(c) ? c : "*")).join("");
  }
  while (at !== -1) {
    const from = map[at];
    const to = at + word.length < map.length ? map[at + word.length] : chars.length;
    for (let i = from; i < to; i++) if (/\S/.test(chars[i])) chars[i] = "*";
    at = plain.indexOf(word, at + word.length);
  }
  return chars.join("");
}
