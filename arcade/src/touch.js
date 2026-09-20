// Touch controls.
//
//   left half   a floating virtual stick — it appears wherever the thumb lands rather than sitting
//               in a fixed spot, because a fixed one is only ever in the right place for one hand
//               size. Up/down is throttle, left/right is steer.
//   right half  chase mode: FIRE, BOOST and DRIFT buttons.
//               mouse-look: dragging aims the camera, and firing is automatic for as long as a
//               finger is down — there is no spare thumb to hold a trigger while aiming.
//
// Everything here only writes into the shared `input` object, exactly as the keyboard does, so the
// game itself never learns there is such a thing as a touchscreen.
import { clamp } from "./util.js";

const STICK_R = 62;        // px from the stick's origin that counts as full deflection
const DEAD = 0.14;         // below this the thumb has not really moved
const LOOK_SENS = 0.0065;  // radians per pixel — a thumb travels far less than a mouse

export function createTouch(host, input) {
  host.innerHTML = `
    <div class="tc-zone tc-zone-left" data-k="zoneL"></div>
    <div class="tc-zone tc-zone-right" data-k="zoneR"></div>
    <div class="tc-stick" data-k="stick" hidden><i class="tc-base"></i><i class="tc-nub" data-k="nub"></i></div>
    <div class="tc-buttons">
      <button class="tc-btn tc-brake" data-hold="handbrake" type="button">DRIFT</button>
      <button class="tc-btn tc-boost" data-hold="boost" type="button">BOOST</button>
      <button class="tc-btn tc-fire" data-hold="firing" data-k="fire" type="button">FIRE</button>
    </div>
    <p class="tc-hint" data-k="hint">drag right side to aim · auto-fire</p>`;

  const k = Object.fromEntries([...host.querySelectorAll("[data-k]")].map((e) => [e.dataset.k, e]));
  let shown = false;

  // Keeps following a finger that slides off the element it started on. It throws if the pointer
  // has already gone — which must not take the handler down with it, or the control it belongs to
  // would be left stuck on.
  const grab = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch { /* it is already gone */ } };

  // ---- floating stick ----
  let stickId = null, ox = 0, oy = 0;

  const clearStick = () => {
    stickId = null;
    k.stick.hidden = true;
    input.throttle = 0;
    input.steer = 0;
  };

  k.zoneL.addEventListener("pointerdown", (e) => {
    if (stickId !== null) return;
    stickId = e.pointerId;
    ox = e.clientX; oy = e.clientY;
    k.stick.style.left = `${ox}px`;
    k.stick.style.top = `${oy}px`;
    k.stick.hidden = false;
    k.nub.style.transform = "translate(-50%, -50%)";
    grab(k.zoneL, e);
    e.preventDefault();
  });

  k.zoneL.addEventListener("pointermove", (e) => {
    if (e.pointerId !== stickId) return;
    const dx = clamp((e.clientX - ox) / STICK_R, -1, 1);
    const dy = clamp((e.clientY - oy) / STICK_R, -1, 1);
    const band = (v) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));
    input.steer = band(dx);
    input.throttle = band(-dy);                 // thumb up is forward
    k.nub.style.transform = `translate(calc(-50% + ${dx * STICK_R}px), calc(-50% + ${dy * STICK_R}px))`;
    e.preventDefault();
  });

  for (const ev of ["pointerup", "pointercancel"]) {
    k.zoneL.addEventListener(ev, (e) => { if (e.pointerId === stickId) clearStick(); });
  }

  // ---- right side: aiming, when mouse-look is on ----
  let lookId = null, lx = 0, ly = 0;

  const clearLook = () => {
    lookId = null;
    input.firing = false;
    input.lookDelta = input.lookDeltaY = 0;
  };

  k.zoneR.addEventListener("pointerdown", (e) => {
    if (!input.freeLook || lookId !== null) return;
    lookId = e.pointerId;
    lx = e.clientX; ly = e.clientY;
    input.firing = true;                        // any aiming input is also the trigger
    input.aimActive = true;
    grab(k.zoneR, e);
    e.preventDefault();
  });

  k.zoneR.addEventListener("pointermove", (e) => {
    if (e.pointerId !== lookId) return;
    input.lookDelta += (e.clientX - lx) * LOOK_SENS;
    input.lookDeltaY += (e.clientY - ly) * LOOK_SENS;
    lx = e.clientX; ly = e.clientY;
    e.preventDefault();
  });

  for (const ev of ["pointerup", "pointercancel"]) {
    k.zoneR.addEventListener(ev, (e) => { if (e.pointerId === lookId) clearLook(); });
  }

  // ---- hold buttons ----
  for (const btn of host.querySelectorAll("[data-hold]")) {
    const flag = btn.dataset.hold;
    const set = (on) => { input[flag] = on; btn.classList.toggle("on", on); };
    btn.addEventListener("pointerdown", (e) => { set(true); grab(btn, e); e.preventDefault(); });
    for (const ev of ["pointerup", "pointercancel"]) btn.addEventListener(ev, () => set(false));
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  // ---- orientation ----
  // Portrait leaves no room for a stick and a button cluster without one covering the other, so
  // the game asks to be turned rather than shipping a layout that does not work.
  const rotate = document.createElement("div");
  rotate.className = "tc-rotate";
  rotate.innerHTML = `<div><span class="tc-phone"></span><p>Turn your device sideways</p></div>`;
  rotate.hidden = true;
  document.body.appendChild(rotate);

  const portrait = matchMedia("(orientation: portrait)");
  const syncOrientation = () => { rotate.hidden = !(shown && portrait.matches); };
  portrait.addEventListener("change", syncOrientation);

  const api = {
    get active() { return shown; },

    // mouse-look swaps the FIRE button for drag-to-aim, so the button would just be a lie
    syncMode() {
      k.fire.hidden = !!input.freeLook;
      k.hint.hidden = !input.freeLook;
      k.zoneR.classList.toggle("armed", !!input.freeLook);
    },

    show(on) {
      shown = on;
      host.hidden = !on;
      if (!on) { clearStick(); clearLook(); }
      api.syncMode();
      syncOrientation();
    },
  };

  api.syncMode();
  return api;
}

// A touchscreen is anything with a coarse pointer. Checked once at load and then again on the
// first real touch, because a laptop with a touchscreen reports coarse only sometimes.
export const looksLikeTouch = () =>
  matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0 || "ontouchstart" in window;
