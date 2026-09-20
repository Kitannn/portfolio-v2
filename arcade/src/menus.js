// Change Vehicle, Collection and Shop — the three panels reachable from the title menu, plus the
// cookie consent bar. They all share one host element and one close affordance.
import { CARDS, RARITY } from "./cards.js";
import { MASTERY, TIERS, VEHICLES, nextCost, refundValue, tierUnlocked, levelsToUnlock, totalLevels } from "./shop.js";
import * as store from "./save.js";
import { displayName } from "./name.js";
import { esc, fmtTime } from "./util.js";

const shell = (title, sub, inner, extra = "") => `
  <div class="panel">
    <header class="panel-head">
      <div><p class="panel-kicker">${esc(sub)}</p><h2 class="panel-title">${esc(title)}</h2></div>
      ${extra}
      <button class="panel-x" data-close type="button" aria-label="Close">✕</button>
    </header>
    ${inner}
  </div>`;

const creditPill = () => `<p class="panel-credits">◆ <b>${store.save().credits.toLocaleString()}</b></p>`;

export function createMenus(host, { onClose, onVehicle } = {}) {
  let refresh = null;
  // The host element is shared with the name prompt, the level-up draw and the finish screen.
  // Without this flag, closing "the panel" on a click-out or on Escape would wipe whichever of
  // those happened to be showing instead — Escape during a run was clearing the name prompt.
  let mine = false;

  const open = () => {
    mine = true;
    host.hidden = false;
    host.className = "screen panel-host";
  };

  const close = () => {
    if (!mine) return;
    mine = false;
    host.hidden = true;
    host.innerHTML = "";
    host.className = "screen";
    refresh = null;
    onClose?.();
  };

  host.addEventListener("click", (e) => {
    if (!mine) return;
    if (e.target.closest("[data-close]") || e.target === host) close();
  });
  addEventListener("keydown", (e) => {
    if (e.code === "Escape" && mine) { e.preventDefault(); close(); }
  });

  // A destructive action always asks first, and the prompt spells out what it takes with it —
  // "are you sure?" on its own tells the player nothing about what they are about to lose.
  function confirmDialog({ title, body, confirmLabel, danger = true, onYes }) {
    const box = document.createElement("div");
    box.className = "confirm";
    box.innerHTML = `
      <div class="confirm-box">
        <h3>${esc(title)}</h3>
        <div class="confirm-body">${body}</div>
        <div class="confirm-btns">
          <button class="menu-btn" data-yes type="button">${esc(confirmLabel)}</button>
          <button class="menu-btn" data-no type="button">Cancel</button>
        </div>
      </div>`;
    if (danger) box.classList.add("danger");
    box.addEventListener("click", (e) => {
      if (e.target.closest("[data-yes]")) { box.remove(); onYes(); }
      else if (e.target.closest("[data-no]") || e.target === box) box.remove();
    });
    document.body.appendChild(box);   // fixed-position, so it works even with the panel host hidden
  }

  // ---- Change Vehicle ----------------------------------------------------------
  function vehicles() {
    const cur = store.save().vehicle;
    open();
    host.innerHTML = shell("Change Vehicle", "Garage", `
      <div class="veh-grid">
        ${VEHICLES.map((v) => `
          <button class="veh ${v.owned ? "" : "locked"} ${v.id === cur ? "on" : ""}" data-veh="${v.id}" type="button" ${v.owned ? "" : "disabled"}>
            <span class="veh-art" aria-hidden="true">${v.owned ? carSvg() : silhouetteSvg()}</span>
            <b>${esc(v.name)}</b>
            <small>${v.owned ? `${esc(v.maker)} · ${esc(v.year)}` : "Locked"}</small>
            <p>${esc(v.blurb)}</p>
            ${v.id === cur ? `<span class="veh-tag">Selected</span>` : ""}
          </button>`).join("")}
      </div>`);

    host.querySelectorAll("[data-veh]").forEach((btn) => btn.addEventListener("click", () => {
      store.save().vehicle = btn.dataset.veh;
      store.flush();
      onVehicle?.(btn.dataset.veh);
      vehicles();
    }));
  }

  // ---- Collection --------------------------------------------------------------
  function collection() {
    const found = store.save().discovered;
    const total = CARDS.length;
    const have = CARDS.filter((c) => found[c.id]).length;

    const byRarity = {};
    for (const c of CARDS) (byRarity[c.rarity] ||= []).push(c);

    open();
    host.innerHTML = shell("Collection", `${have} of ${total} discovered`, `
      <div class="coll-scroll">
        ${Object.keys(RARITY).map((r) => {
          const list = byRarity[r] || [];
          const n = list.filter((c) => found[c.id]).length;
          return `
          <section class="coll-group" style="--r: var(${RARITY[r].color})">
            <p class="coll-head">${RARITY[r].label}<i>${n}/${list.length}</i></p>
            <div class="coll-grid">
              ${list.map((c) => found[c.id]
                ? `<button class="coll-card ${c.weapon ? "is-weapon" : ""}" type="button" data-desc="${esc(c.desc)}" data-name="${esc(c.name)}"><b>${esc(c.name)}${c.weapon ? `<i class="coll-wpn">WPN</i>` : ""}</b><span>${esc(c.desc)}</span></button>`
                : `<div class="coll-card unknown" aria-label="Undiscovered"><b>?????</b><span>Take this card in a run to add it.</span></div>`
              ).join("")}
            </div>
          </section>`;
        }).join("")}
      </div>`, `<p class="panel-progress"><i style="width:${(have / total) * 100}%"></i></p>`);
  }

  // ---- Shop --------------------------------------------------------------------
  function shop() {
    const s = store.save();
    const m = store.masteryFor();
    const car = VEHICLES.find((v) => v.id === s.vehicle) || VEHICLES[0];

    open();
    host.innerHTML = shell("Shop", "Vehicle mastery", `
      <p class="shop-scope">
        <span class="shop-scope-art">${carSvg()}</span>
        <b>These upgrades apply to the ${esc(car.name)} only.</b>
        <i>Every vehicle keeps its own mastery tree — nothing here carries across to another car.</i>
      </p>
      <div class="shop-scroll">
        ${TIERS.map((tierName, tier) => {
          const open = tierUnlocked(tier, m);
          const need = levelsToUnlock(tier, m);
          return `
          <section class="shop-tier ${open ? "" : "shut"}">
            <p class="shop-head">${esc(tierName)}${open ? "" : `<i>${need} more upgrade${need === 1 ? "" : "s"} to unlock</i>`}</p>
            <div class="shop-grid">
              ${MASTERY.filter((n) => n.tier === tier).map((node) => {
                const lvl = m[node.id] || 0;
                const cost = nextCost(node, m);
                const maxed = cost === null;
                const afford = !maxed && s.credits >= cost;
                return `
                <button class="shop-node ${maxed ? "maxed" : ""} ${open && afford ? "afford" : ""}" type="button"
                        data-buy="${node.id}" ${open && afford && !maxed ? "" : "disabled"}>
                  <b>${esc(node.name)}</b>
                  <span class="shop-pips">${Array.from({ length: node.max }, (_, i) => `<i class="${i < lvl ? "on" : ""}"></i>`).join("")}</span>
                  <small>${lvl ? esc(node.desc(lvl)) : `<em>${esc(node.desc(1))}</em> at level 1`}</small>
                  <span class="shop-cost">${maxed ? "MAX" : `◆ ${cost.toLocaleString()}`}</span>
                </button>`;
              }).join("")}
            </div>
          </section>`;
        }).join("")}
      </div>
      ${refundValue(m) > 0 ? `
        <div class="shop-reset">
          <button class="menu-btn" data-refund type="button">Reset ${esc(car.name)} mastery</button>
          <p>Sells every upgrade on this tree back and returns <b>◆ ${refundValue(m).toLocaleString()}</b> — the full amount you paid.</p>
        </div>` : ""}`, creditPill());

    host.querySelector("[data-refund]")?.addEventListener("click", () => {
      const own = store.masteryFor();
      const back = refundValue(own);
      confirmDialog({
        title: `Reset ${car.name} mastery?`,
        body: `<p>Every upgrade on this vehicle's tree is sold back and you get <b>◆${back.toLocaleString()}</b> returned —
               the full amount you paid, nothing lost.</p>
               <p class="confirm-note">Only affects the ${esc(car.name)}. Other vehicles, your collection, records and player name are untouched.</p>`,
        confirmLabel: `Reset and refund ◆${back.toLocaleString()}`,
        onYes: () => {
          store.save().credits += back;
          for (const k of Object.keys(own)) delete own[k];
          store.flush();
          shop();
        },
      });
    });

    host.querySelectorAll("[data-buy]").forEach((btn) => btn.addEventListener("click", () => {
      const node = MASTERY.find((n) => n.id === btn.dataset.buy);
      const own = store.masteryFor();
      const cost = nextCost(node, own);
      if (cost === null || !store.spend(cost)) return;
      own[node.id] = (own[node.id] || 0) + 1;
      store.flush();
      shop();
    }));
    refresh = shop;
  }


  // ---- Leaderboard --------------------------------------------------------------
  // There is no server yet, so every row here is this browser's own run history. The shape is the
  // shape a real board would return — name, value, a flag — so swapping the source for a fetch
  // later is a change of one function, not of the panel.
  const TABS = [
    {
      id: "time", label: "Time Survived",
      value: (r) => fmtTime(r.t), sort: (r) => r.t,
      note: "Longest runs. ★ means the Colossus went down; CHEATS means codes were active.",
    },
    {
      id: "kills", label: "Enemies Destroyed",
      value: (r) => r.kills.toLocaleString(), sort: (r) => r.kills,
      note: "Most wrecks in a single run.",
    },
    {
      id: "damage", label: "Damage Dealt",
      value: (r) => r.damage.toLocaleString(), sort: (r) => r.damage,
      note: "Most damage put out in a single run.",
    },
    {
      id: "level", label: "Highest Level",
      value: (r) => `LV ${r.level}`, sort: (r) => r.level,
      note: "Furthest up the upgrade curve in one run.",
    },
    { id: "deaths", label: "Deaths", accumulated: true, note: "Wrecks across every run, all time." },
  ];

  let tab = "time";

  function board() {
    const s = store.save();
    const me = displayName(s) || "You";
    const spec = TABS.find((t) => t.id === tab) || TABS[0];
    const history = s.history || [];

    let rows;
    if (spec.accumulated) {
      rows = [`<li class="lb-row me">
          <span class="lb-rank">1</span>
          <span class="lb-name">${esc(me)}</span>
          <span class="lb-val">${s.deaths || 0}</span>
        </li>`];
      if (!s.runs) rows = [];
    } else {
      rows = history
        .map((r, i) => ({ r, i }))
        .sort((a, b) => spec.sort(b.r) - spec.sort(a.r) || a.i - b.i)
        .slice(0, 10)
        .map(({ r }, i) => `
          <li class="lb-row me">
            <span class="lb-rank">${i + 1}</span>
            <span class="lb-name">${esc(me)}${r.won ? `<i class="lb-star" title="Beat the Colossus">★</i>` : ""}${r.cheats ? `<i class="lb-cheat" title="${r.cheats} cheat code${r.cheats === 1 ? "" : "s"} were active">CHEATS</i>` : ""}</span>
            <span class="lb-val">${spec.value(r)}</span>
          </li>`);
    }

    open();
    host.innerHTML = shell("Leaderboard", `${s.runs || 0} run${s.runs === 1 ? "" : "s"} recorded`, `
      <nav class="lb-tabs">
        ${TABS.map((t) => `<button class="lb-tab ${t.id === tab ? "on" : ""}" data-tab="${t.id}" type="button">${esc(t.label)}</button>`).join("")}
      </nav>
      <p class="lb-note">${esc(spec.note)}</p>
      <ol class="lb-list">
        ${rows.length ? rows.join("") : `<li class="lb-empty">No runs yet. Go and get wrecked.</li>`}
      </ol>
      <p class="lb-local">Local records only — these are your runs on this browser. The online board
        opens once runs can be submitted, and your <b>#${esc(s.tag || "")}</b> tag is what will carry over.</p>`);

    host.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => {
      tab = b.dataset.tab;
      board();
    }));
    refresh = board;
  }

  // ---- Reset progress -------------------------------------------------------------
  function resetAll(afterWipe) {
    const s = store.save();
    const cars = Object.keys(s.mastery || {}).length;
    confirmDialog({
      title: "Erase all progress?",
      body: `<p>This wipes everything saved on this browser and cannot be undone:</p>
        <ul class="confirm-list">
          <li><b>◆ ${(s.credits || 0).toLocaleString()}</b> credits</li>
          <li>Every <b>Shop</b> upgrade${cars ? ` across ${cars} vehicle tree${cars === 1 ? "" : "s"}` : ""} — no refund</li>
          <li>Your <b>Collection</b> — ${Object.keys(s.discovered || {}).length} discovered cards forgotten</li>
          <li><b>Vehicles</b> back to the starting GR 86</li>
          <li>All <b>records</b> — ${s.runs || 0} runs, ${s.deaths || 0} deaths, every leaderboard entry</li>
          <li>Your <b>player name</b></li>
        </ul>
        <p class="confirm-note">Cheat codes found on the portfolio are not stored here and stay unlocked.</p>`,
      confirmLabel: "Erase everything",
      onYes: () => { store.wipe(); close(); afterWipe?.(); },
    });
  }

  return {
    close,
    confirm: confirmDialog,
    get open() { return !host.hidden; },
    resetAll,
    show(which) {
      if (which === "vehicle") vehicles();
      else if (which === "collection") collection();
      else if (which === "shop") shop();
      else if (which === "board") board();
    },
    refresh: () => refresh?.(),
  };
}

// ---- cookie consent --------------------------------------------------------------
export function createConsent(onDone) {
  if (!store.needsConsent()) return;
  const bar = document.createElement("div");
  bar.className = "consent";
  bar.innerHTML = `
    <p class="consent-head">Cookies &amp; storage</p>
    <p>To remember your player name, credits, records and card collection, this page keeps them on your
       device using your browser's local storage — the same kind of cookie-style store a site uses to
       remember you. It stays on this device and is never sent anywhere.</p>
    <div class="consent-btns">
      <button class="menu-btn" data-consent="yes" type="button">Accept &amp; save progress</button>
      <button class="menu-btn" data-consent="no" type="button">Decline</button>
    </div>
    <p class="consent-fine">Decline and the game still works — progress just resets when you leave.</p>`;
  bar.addEventListener("click", (e) => {
    const b = e.target.closest("[data-consent]");
    if (!b) return;
    store.setConsent(b.dataset.consent === "yes");
    bar.classList.add("fade-out");
    setTimeout(() => bar.remove(), 300);
    onDone?.(b.dataset.consent === "yes");
  });
  document.body.appendChild(bar);
}

// ---- tiny inline art for the garage ------------------------------------------------
const carSvg = () => `<svg viewBox="0 0 120 52" aria-hidden="true">
  <path class="c-body" d="M6 40c0-6 4-9 10-11l10-12c3-4 8-6 14-6h22c7 0 12 2 17 7l9 11c8 2 14 5 14 11v4H6z"/>
  <path class="c-glass" d="M36 27l7-9c2-2 4-3 7-3h19c4 0 7 1 9 4l6 8z"/>
  <circle class="c-wheel" cx="32" cy="42" r="8"/><circle class="c-wheel" cx="90" cy="42" r="8"/>
</svg>`;

const silhouetteSvg = () => `<svg viewBox="0 0 120 52" aria-hidden="true">
  <path class="c-shadow" d="M6 40c0-6 4-9 10-11l10-12c3-4 8-6 14-6h22c7 0 12 2 17 7l9 11c8 2 14 5 14 11v4H6z"/>
  <circle class="c-shadow" cx="32" cy="42" r="8"/><circle class="c-shadow" cx="90" cy="42" r="8"/>
  <text class="c-q" x="60" y="36" text-anchor="middle">?</text>
</svg>`;
