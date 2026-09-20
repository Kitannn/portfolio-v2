// The two overlays that interrupt a run: the level-up draw and the finish screen.
// Both are plain DOM built on demand — they only exist while the world is frozen.
import { RARITY, CARDS_BY_ID } from "./cards.js";
import { esc, fmtTime } from "./util.js";

// ---- level up ------------------------------------------------------------------
export function createLevelUp(host, { onPick }) {
  let open = false;

  return {
    get open() { return open; },

    show(cards, level, taken, lucky = false) {
      open = true;
      host.hidden = false;
      host.className = "screen level-up";
      host.innerHTML = `
        <div class="lvl-wrap">
          <p class="lvl-kicker">${lucky ? "Elite chest" : `Level <b>${level}</b>`}</p>
          <h2 class="lvl-title">${lucky ? "Salvaged upgrade" : "Pick an upgrade"}</h2>
          <div class="cards">
            ${cards.map((c, i) => {
              const owned = taken[c.id] || 0;
              return `
              <button class="card ${c.weapon ? "is-weapon" : ""}" data-i="${i}" style="--r: var(${RARITY[c.rarity].color})" type="button">
                <span class="card-rar">${RARITY[c.rarity].label}${c.weapon ? `<i class="card-wpn">Weapon</i>` : ""}</span>
                <h3>${esc(c.name)}</h3>
                <p>${esc(owned && c.levelDesc ? c.levelDesc : c.desc)}</p>
                <span class="card-foot">${owned ? `${c.weapon ? `LV ${owned} → ${owned + 1}` : `owned ${owned}/${c.max}`}` : c.weapon ? "New weapon" : `max ${c.max}`}</span>
              </button>`;
            }).join("")}
          </div>
          <p class="lvl-hint">1 · 2 · 3 or click</p>
        </div>`;

      const pick = (i) => {
        if (!open) return;
        open = false;
        const btn = host.querySelector(`[data-i="${i}"]`);
        btn?.classList.add("taken");
        host.querySelectorAll(".card").forEach((b) => { if (b !== btn) b.classList.add("dimmed"); });
        // let the choice land visually before the world starts again
        setTimeout(() => { host.hidden = true; host.innerHTML = ""; onPick(cards[i]); }, 260);
      };

      host.onclick = (e) => {
        const btn = e.target.closest("[data-i]");
        if (btn) pick(+btn.dataset.i);
      };
      host.onkeydown = null;
      this._keys = (e) => {
        const n = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code];
        if (n != null && n < cards.length) { e.preventDefault(); pick(n); }
      };
      addEventListener("keydown", this._keys);
    },

    close() {
      open = false;
      host.hidden = true;
      host.innerHTML = "";
      if (this._keys) removeEventListener("keydown", this._keys);
    },
  };
}


// ---- pause ---------------------------------------------------------------------
// Pausing used to just stop the world, which read as the game hanging. It gets a screen.
export function createPause(host, { onResume, onQuit }) {
  return {
    show(run) {
      host.hidden = false;
      host.className = "screen paused";
      host.innerHTML = `
        <div class="pause-wrap">
          <p class="pause-kicker">Paused</p>
          <h2 class="pause-title">Engine idling</h2>
          <dl class="pause-stats">
            <div><dt>Time</dt><dd>${fmtTime(run.elapsed)}</dd></div>
            <div><dt>Destroyed</dt><dd>${run.kills}</dd></div>
            <div><dt>Level</dt><dd>${run.level}</dd></div>
          </dl>
          <div class="pause-btns">
            <button class="big-btn" data-pause="resume" type="button">Resume</button>
            <button class="menu-btn" data-pause="quit" type="button">Exit run</button>
          </div>
          <p class="pause-note">Exiting abandons this run — it won't be scored or pay out credits.</p>
        </div>`;
      host.onclick = (e) => {
        const b = e.target.closest("[data-pause]");
        if (!b) return;
        host.hidden = true;
        host.innerHTML = "";
        if (b.dataset.pause === "resume") onResume();
        else onQuit();
      };
    },
    close() { host.hidden = true; host.innerHTML = ""; },
  };
}

// ---- finish --------------------------------------------------------------------
const STAT_ROWS = [
  ["Time survived", (r) => fmtTime(r.elapsed)],
  ["Enemies destroyed", (r) => r.kills],
  ["Damage dealt", (r) => Math.round(r.damage).toLocaleString()],
  ["Rounds fired", (r) => r.fired.toLocaleString()],
  ["Weapon accuracy", (r) => `${Math.round(r.accuracy * 100)}%`],
  ["Level reached", (r) => r.level],
];

export function createFinish(host, { onMenu, onRetry }) {
  return {
    show(result) {
      host.hidden = false;
      host.className = `screen finish ${result.won ? "won" : "lost"}`;

      // group repeat picks so a five-stack of Hollow Points is one chip, not five
      const counts = {};
      for (const [id, n] of Object.entries(result.taken)) counts[id] = n;
      const chips = Object.entries(counts).map(([id, n]) => {
        const c = CARDS_BY_ID[id];
        if (!c) return "";
        return `<button class="chip" type="button" style="--r: var(${RARITY[c.rarity].color})" data-desc="${esc(c.desc)}" data-name="${esc(c.name)}" data-rar="${RARITY[c.rarity].label}">
            ${esc(c.name)}${n > 1 ? `<i>×${n}</i>` : ""}
          </button>`;
      }).join("");

      host.innerHTML = `
        <div class="fin-wrap">
          <p class="fin-kicker">${result.name ? `${esc(result.name)} · ` : ""}${result.won ? "Colossus down" : "Run over"}</p>
          <h2 class="fin-title">${result.won ? "SURVIVED" : "WRECKED"}</h2>

          <dl class="fin-stats">
            ${STAT_ROWS.map(([label, fn]) => `<div><dt>${label}</dt><dd>${fn(result)}</dd></div>`).join("")}
          </dl>

          <div class="fin-cards">
            <p class="fin-sub">Upgrades taken${chips ? "" : " — none"}</p>
            <div class="chips">${chips}</div>
            <p class="chip-info" hidden></p>
          </div>

          <p class="fin-credits">◆ <b>+${result.credits}</b> credits</p>

          <div class="fin-btns">
            <button class="menu-btn" data-fin="retry" type="button">Try Again</button>
            <button class="menu-btn" data-fin="menu" type="button">Main Menu</button>
          </div>
        </div>`;

      // hover on a pointer, tap on touch — both land on the same line of text
      const info = host.querySelector(".chip-info");
      const showInfo = (btn) => {
        if (!btn) { info.hidden = true; return; }
        info.hidden = false;
        info.innerHTML = `<b style="color:var(${RARITY[btn.dataset.rar.toLowerCase()]?.color || "--fg"})">${esc(btn.dataset.name)}</b> — ${esc(btn.dataset.desc)}`;
      };
      host.querySelectorAll(".chip").forEach((btn) => {
        btn.addEventListener("pointerenter", () => showInfo(btn));
        btn.addEventListener("click", () => showInfo(btn));
      });
      host.querySelector(".chips")?.addEventListener("pointerleave", () => showInfo(null));

      host.onclick = (e) => {
        const b = e.target.closest("[data-fin]");
        if (!b) return;
        host.hidden = true;
        host.innerHTML = "";
        if (b.dataset.fin === "retry") onRetry();
        else onMenu();
      };
    },

    close() { host.hidden = true; host.innerHTML = ""; },
  };
}

// Credits are the run's payout: mostly kills, with time and the boss on top.
export function creditsFor(result) {
  return Math.round(result.kills * 4 + result.elapsed * 0.6 + (result.won ? 400 : 0));
}
