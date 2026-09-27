// Player name entry, and the filter that guards it.
//
// The name exists so runs can be attributed on a leaderboard later. That means it will eventually
// be shown to other people, so it is checked here — but this check is a courtesy, not a control:
// anything client-side can be bypassed, so whatever backend ends up serving the leaderboard has to
// run the same filter again on submit. Treat this as the fast path, not the enforcement point.
import { esc } from "./util.js";
import * as store from "./save.js";
import { MIN, MAX, checkName } from "./name-filter.js";

// Re-exported so callers keep importing names from one place; the filter itself lives in
// name-filter.js because the leaderboard Worker has to run exactly the same code.
export { MIN, MAX, checkName, forms } from "./name-filter.js";

// Names are not unique, so each one carries a discriminator: kitannn#en_CA1. The locale half comes
// from the browser, the number half is a local guess — only a server can know how many kitannns
// already exist, so when the leaderboard goes live it has to hand back the authoritative number
// and we overwrite this. Until then it is a plausible placeholder, not a claim.
export function localeTag() {
  const raw = (navigator.languages && navigator.languages[0]) || navigator.language || "en";
  const parts = raw.replace(/[^A-Za-z0-9-]/g, "").split("-");
  const lang = (parts[0] || "en").toLowerCase().slice(0, 3);
  // The region is not simply the second subtag. BCP 47 puts an optional four-letter script in
  // between, so zh-Hans-CN's region is CN, not "Han" — a region is two letters or three digits,
  // and anything else in that slot is skipped.
  const region = parts.slice(1).find((p) => /^[A-Za-z]{2}$/.test(p) || /^[0-9]{3}$/.test(p));
  return region ? `${lang}_${region.toUpperCase()}` : lang;
}

export const makeTag = (n = 1) => `${localeTag()}${Math.max(1, n | 0)}`;

// whatever tag this player already carries, or the one they are about to be given
const tagNow = () => store.save().tag || makeTag(1);

// name + tag, the form shown anywhere other people would see it
export const displayName = (save) => (save.name ? save.name + (save.tag ? `#${save.tag}` : "") : "");

// ---- the entry screen ------------------------------------------------------------
export function askName(host, onDone, { existing = "", canCancel = false } = {}) {
  host.hidden = false;
  host.className = "screen name-ask";
  host.innerHTML = `
    <form class="name-wrap" autocomplete="off">
      <p class="name-kicker">${existing ? "Garage" : "Before you drive"}</p>
      <h2 class="name-title">${existing ? "Change your name" : "Pick a player name"}</h2>
      <p class="name-note">Shown on the leaderboard when runs start being ranked.</p>
      <label class="name-field">
        <input id="nameInput" type="text" maxlength="${MAX}" placeholder="player name" spellcheck="false"
               aria-label="Player name" autocapitalize="off" value="${esc(existing)}">
        <span class="name-ghost" aria-hidden="true"><i></i><b>#${esc(tagNow())}</b></span>
        <span class="name-count"><b>0</b>/${MAX}</span>
      </label>
      <p class="name-msg" role="status"></p>
      <button class="big-btn" type="submit">${existing ? "Save" : "Drive"}</button>
      <button class="name-cancel" type="button" data-cancel>${canCancel ? "Cancel" : "Back"}</button>
    </form>`;

  const form = host.querySelector("form");
  const input = host.querySelector("#nameInput");
  const msg = host.querySelector(".name-msg");
  const count = host.querySelector(".name-count b");
  // The tag is never described in words — it just trails whatever is typed, in the field itself,
  // sitting on a transparent copy of the text so it lands exactly where the caret leaves off.
  const ghost = host.querySelector(".name-ghost i");
  setTimeout(() => { input.focus(); input.select(); }, 60);
  validateLater();

  host.querySelector("[data-cancel]")?.addEventListener("click", () => {
    host.hidden = true;
    host.innerHTML = "";
    onDone(null);
  });

  const validate = () => {
    count.textContent = input.value.length;
    ghost.textContent = input.value;
    const v = input.value.trim();
    if (!v) { msg.textContent = ""; msg.className = "name-msg"; return null; }
    const res = checkName(input.value);
    if (!res.ok) { msg.textContent = res.reason; msg.className = "name-msg bad"; return null; }
    const tag = store.save().tag || makeTag(1);
    if (res.masked) { msg.innerHTML = `Saved as <b>${esc(res.value)}#${esc(tag)}</b>`; msg.className = "name-msg warn"; }
    else { msg.innerHTML = `You will appear as <b>${esc(res.value)}#${esc(tag)}</b>`; msg.className = "name-msg good"; }
    return res;
  };

  function validateLater() { ghost.textContent = input.value; }
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
