// In-run HUD. Plain DOM over the canvas — the bars change a handful of times a second, so this
// is far cheaper than drawing them in the scene, and it scales to any screen for free.
//
// update() is called every frame, so it only writes to the DOM when a value has actually moved.
import { clamp, fmtTime } from "./util.js";

const BARS = [
  { key: "hp", label: "HP", cls: "b-hp" },
  { key: "shield", label: "SHLD", cls: "b-shield" },
  { key: "boost", label: "BOOST", cls: "b-boost" },
  { key: "xp", label: "XP", cls: "b-xp" },
];

export function createHud(root, { onFreeLook, onPause } = {}) {
  root.innerHTML = `
    <div class="hud-tl">
      <span class="hud-time">0:00</span>
      <span class="hud-stat"><i class="s-kill"></i><b data-k="kills">0</b> destroyed</span>
      <span class="hud-stat"><i class="s-acc"></i><b data-k="acc">—</b> accuracy</span>
      <span class="hud-stat hud-lvl">LV <b data-k="level">1</b></span>
    </div>

    <div class="hud-bars">
      ${BARS.map((b) => `
        <div class="bar ${b.cls}" data-bar="${b.key}">
          <span class="bar-label">${b.label}</span>
          <span class="bar-track"><i></i><em></em></span>
          <span class="bar-num"></span>
        </div>`).join("")}
    </div>

    <div class="hud-ammo">
      <svg class="ammo-ring" viewBox="0 0 44 44" aria-hidden="true">
        <circle class="ring-bg" cx="22" cy="22" r="19"></circle>
        <circle class="ring-fg" cx="22" cy="22" r="19"></circle>
      </svg>
      <span class="ammo-num"><b data-k="mag">20</b><i>/<span data-k="cap">20</span></i></span>
      <span class="ammo-word" data-k="ammoword">READY</span>
    </div>

    <div class="hud-boss" data-k="bossbox" hidden>
      <p class="boss-label"><span data-k="bosslabel">Colossus inbound</span><b data-k="bosseta"></b></p>
      <span class="boss-track"><i data-k="bossfill"></i><em data-k="bossshield"></em></span>
      <p class="boss-weak" data-k="bossweak" hidden></p>
    </div>

    <button class="cam-toggle" data-k="cam" type="button" aria-pressed="false">
      <i class="cam-icon"></i><span data-k="camlabel">Chase</span><em>L CTRL</em>
    </button>

    <div class="hud-toast" data-k="toast" hidden><b data-k="toasthead"></b><span data-k="toastbody"></span></div>

    <div class="hud-hint">WASD drive · SHIFT boost · SPACE handbrake · CLICK fire · R reload · L CTRL free look</div>
    <button class="pause-btn" data-k="pause" type="button" aria-label="Pause"><i></i><i></i></button>
    <div class="hud-cross" data-k="cross" hidden><i></i><i></i><i></i><i></i><b></b></div>
    <div class="hud-flash" data-k="flash"></div>`;

  const bars = {};
  for (const b of BARS) {
    const el = root.querySelector(`[data-bar="${b.key}"]`);
    bars[b.key] = {
      row: el,
      fill: el.querySelector("i"),
      ghost: el.querySelector("em"),     // lags behind a drop, so damage is legible
      num: el.querySelector(".bar-num"),
      last: -1, ghostVal: 1,
    };
  }
  const k = Object.fromEntries([...root.querySelectorAll("[data-k]")].map((e) => [e.dataset.k, e]));
  const ring = root.querySelector(".ring-fg");
  const RING = 2 * Math.PI * 19;
  ring.style.strokeDasharray = `${RING}`;

  let lastTime = -1, lastMag = -1, lastKills = -1, lastAcc = -1, lastLevel = -1, lastWord = "";
  let lastBossState = "";
  let lastFree = null;

  k.cam.addEventListener("click", () => onFreeLook?.());
  k.pause.addEventListener("click", () => onPause?.());
  let flashLeft = 0;
  let toastLeft = 0;

  const setBar = (b, value, max, dt, text) => {
    const f = max > 0 ? clamp(value / max, 0, 1) : 0;
    if (Math.abs(f - b.last) > 0.002) {
      b.fill.style.transform = `scaleX(${f})`;
      b.last = f;
    }
    // the ghost falls to meet the bar, which is what makes a hit read
    b.ghostVal = f > b.ghostVal ? f : Math.max(f, b.ghostVal - dt * 0.55);
    b.ghost.style.transform = `scaleX(${b.ghostVal})`;
    if (b.num.textContent !== text) b.num.textContent = text;
    b.row.classList.toggle("empty", max <= 0);
  };

  return {
    root,
    show: (on) => { root.hidden = !on; if (!on) { k.toast.hidden = true; toastLeft = 0; } },

    // called on damage so the screen edge pulses red
    hurt(amount) { flashLeft = Math.min(1, flashLeft + clamp(amount / 30, 0.25, 1)); },

    // A reward you drove over is worth saying loudly and in the middle of the screen — it was
    // small print in the top bar before, which is the one place a driver is not looking.
    toast(head, body, secs = 2.6, tone = "") {
      k.toasthead.textContent = head;
      k.toastbody.textContent = body;
      k.toast.className = `hud-toast${tone ? ` ${tone}` : ""}`;
      k.toast.hidden = false;
      // restart the animation even if one is already running
      k.toast.style.animation = "none";
      void k.toast.offsetWidth;
      k.toast.style.animation = "";
      toastLeft = secs;
    },

    update(dt, s) {
      setBar(bars.hp, s.hp, s.maxHp, dt, `${Math.ceil(s.hp)}`);
      setBar(bars.shield, s.shield, s.maxShield, dt, s.maxShield > 0 ? `${Math.ceil(s.shield)}` : "—");
      setBar(bars.boost, s.boost, s.maxBoost, dt, `${Math.round((s.boost / Math.max(1, s.maxBoost)) * 100)}%`);
      setBar(bars.xp, s.xp, s.xpNeeded, dt, `${Math.floor(s.xp)}/${s.xpNeeded}`);

      const t = Math.floor(s.elapsed);
      if (t !== lastTime) { k.flash.parentElement.querySelector(".hud-time").textContent = fmtTime(t); lastTime = t; }
      if (s.kills !== lastKills) { k.kills.textContent = s.kills; lastKills = s.kills; }
      if (s.level !== lastLevel) { k.level.textContent = s.level; lastLevel = s.level; }
      const acc = Math.round(s.accuracy * 100);
      if (acc !== lastAcc) { k.acc.textContent = s.fired ? `${acc}%` : "—"; lastAcc = acc; }

      if (s.mag !== lastMag) { k.mag.textContent = s.mag; lastMag = s.mag; }
      if (k.cap.textContent !== String(s.magCap)) k.cap.textContent = s.magCap;

      const word = s.infiniteBelt ? "BELT FED" : s.reloading ? "RELOADING" : s.mag === 0 ? "EMPTY" : "READY";
      if (word !== lastWord) {
        k.ammoword.textContent = word;
        root.querySelector(".hud-ammo").classList.toggle("reloading", s.reloading);
        root.querySelector(".hud-ammo").classList.toggle("empty", s.mag === 0 && !s.reloading && !s.infiniteBelt);
        lastWord = word;
      }
      const p = s.infiniteBelt ? 1 : s.reloading ? s.reloadProgress : s.mag / Math.max(1, s.magCap);
      ring.style.strokeDashoffset = `${RING * (1 - clamp(p, 0, 1))}`;

      if (s.freeLook !== lastFree) {
        k.cam.classList.toggle("on", s.freeLook);
        k.cam.setAttribute("aria-pressed", String(!!s.freeLook));
        k.camlabel.textContent = s.freeLook ? "Mouse look" : "Chase";
        k.cross.hidden = !s.freeLook;
        document.body.classList.toggle("looking", !!s.freeLook);
        lastFree = s.freeLook;
      }

      // ---- boss: a countdown bar before it lands, its health bar after ----
      const bs = s.boss;
      if (bs && bs.show) {
        k.bossbox.hidden = false;
        const fighting = bs.active;
        k.bossbox.classList.toggle("fighting", fighting);
        const frac = fighting ? bs.hp / bs.maxHp : bs.timer;
        k.bossfill.style.transform = `scaleX(${clamp(frac, 0, 1)})`;
        k.bossshield.style.transform = `scaleX(${clamp(fighting ? bs.shield / bs.maxShield : 0, 0, 1)})`;
        const label = fighting ? (bs.phase === 2 ? "GNX" : "COLOSSUS") : "Colossus inbound";
        const eta = fighting ? `${Math.ceil(bs.hp)} / ${bs.maxHp}` : fmtTime(bs.eta);
        const key = label + eta + (bs.weak || "");
        if (key !== lastBossState) {
          k.bosslabel.textContent = label;
          k.bosseta.textContent = eta;
          k.bossweak.hidden = !bs.weak;
          if (bs.weak) k.bossweak.textContent = bs.weak;
          lastBossState = key;
        }
      } else if (!k.bossbox.hidden) {
        k.bossbox.hidden = true;
        lastBossState = "";
      }

      if (toastLeft > 0) {
        toastLeft -= dt;
        if (toastLeft <= 0) k.toast.hidden = true;
      }

      if (flashLeft > 0) {
        flashLeft = Math.max(0, flashLeft - dt * 2.4);
        k.flash.style.opacity = flashLeft;
      } else if (k.flash.style.opacity !== "0") k.flash.style.opacity = "0";
    },
  };
}
