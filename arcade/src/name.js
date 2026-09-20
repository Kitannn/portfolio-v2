// Player name entry, and the filter that guards it.
//
// The name exists so runs can be attributed on a leaderboard later. That means it will eventually
// be shown to other people, so it is checked here — but this check is a courtesy, not a control:
// anything client-side can be bypassed, so whatever backend ends up serving the leaderboard has to
// run the same filter again on submit. Treat this as the fast path, not the enforcement point.
import { esc } from "./util.js";
import * as store from "./save.js";

export const MIN = 3;
export const MAX = 16;

// Names are not unique, so each one carries a discriminator: kitannn#en_CA1. The locale half comes
// from the browser, the number half is a local guess — only a server can know how many kitannns
// already exist, so when the leaderboard goes live it has to hand back the authoritative number
// and we overwrite this. Until then it is a plausible placeholder, not a claim.
export function localeTag() {
  const raw = (navigator.languages && navigator.languages[0]) || navigator.language || "en";
  const parts = raw.replace(/[^A-Za-z-]/g, "").split("-");
  const lang = (parts[0] || "en").toLowerCase().slice(0, 3);
  const region = (parts[1] || "").toUpperCase().slice(0, 3);
  return region ? `${lang}_${region}` : lang;
}

export const makeTag = (n = 1) => `${localeTag()}${Math.max(1, n | 0)}`;

// name + tag, the form shown anywhere other people would see it
export const displayName = (save) => (save.name ? save.name + (save.tag ? `#${save.tag}` : "") : "");

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

// ---- the entry screen ------------------------------------------------------------
export function askName(host, onDone, { existing = "", canCancel = false } = {}) {
  host.hidden = false;
  host.className = "screen name-ask";
  host.innerHTML = `
    <form class="name-wrap" autocomplete="off">
      <p class="name-kicker">${existing ? "Garage" : "Before you drive"}</p>
      <h2 class="name-title">${existing ? "Change your name" : "Pick a player name"}</h2>
      <p class="name-note">Shown on the leaderboard when runs start being ranked. A tag
        (<b>#${esc(localeTag())}1</b>) is added so two players can share a name.</p>
      <label class="name-field">
        <input id="nameInput" type="text" maxlength="${MAX}" placeholder="player name" spellcheck="false"
               aria-label="Player name" autocapitalize="off" value="${esc(existing)}">
        <span class="name-count"><b>0</b>/${MAX}</span>
      </label>
      <p class="name-msg" role="status"></p>
      <button class="big-btn" type="submit">${existing ? "Save" : "Drive"}</button>
      ${canCancel ? `<button class="name-cancel" type="button" data-cancel>Cancel</button>` : ""}
    </form>`;

  const form = host.querySelector("form");
  const input = host.querySelector("#nameInput");
  const msg = host.querySelector(".name-msg");
  const count = host.querySelector(".name-count b");
  setTimeout(() => { input.focus(); input.select(); }, 60);

  host.querySelector("[data-cancel]")?.addEventListener("click", () => {
    host.hidden = true;
    host.innerHTML = "";
    onDone(null);
  });

  const validate = () => {
    count.textContent = input.value.length;
    const v = input.value.trim();
    if (!v) { msg.textContent = ""; msg.className = "name-msg"; return null; }
    const res = checkName(input.value);
    if (!res.ok) { msg.textContent = res.reason; msg.className = "name-msg bad"; return null; }
    const tag = store.save().tag || makeTag(1);
    if (res.masked) { msg.innerHTML = `Saved as <b>${esc(res.value)}#${esc(tag)}</b>`; msg.className = "name-msg warn"; }
    else { msg.innerHTML = `You will appear as <b>${esc(res.value)}#${esc(tag)}</b>`; msg.className = "name-msg good"; }
    return res;
  };

  input.addEventListener("input", validate);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const res = validate();
    if (!res) { input.focus(); return; }
    store.save().name = res.value;
    if (!store.save().tag) store.save().tag = makeTag(1);
    store.flush();
    host.hidden = true;
    host.innerHTML = "";
    onDone(res.value);
  });
}
