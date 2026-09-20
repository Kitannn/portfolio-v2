// Keyboard, mouse and (later) touch, collected into one polled state object.
// Nothing here knows about the game — main.js reads `input` once per frame.
import { clamp } from "./util.js";

export const input = {
  throttle: 0,     // -1 reverse … 1 forward
  steer: 0,        // -1 left … 1 right
  boost: false,
  handbrake: false,
  firing: false,
  aim: { x: 0, y: 0 },      // pointer in normalised device coords
  aimActive: false,         // false until the pointer has moved / touched once
  freeLook: false,          // mouse-look: the camera turns with the mouse and the gun follows it
  lookDelta: 0,             // yaw requested since the last frame, in radians, consumed by the camera
  lookDeltaY: 0,            // …and pitch
  pointerLocked: false,
  paused: false,
};

const down = new Set();
const KEYMAP = {
  KeyW: "fwd", ArrowUp: "fwd",
  KeyS: "back", ArrowDown: "back",
  KeyA: "left", ArrowLeft: "left",
  KeyD: "right", ArrowRight: "right",
};

const LOOK_SENS = 0.0022;   // radians of yaw per pixel of mouse travel

export function attachInput(canvas, { onPause, onReload, onFreeLook, onLockLost } = {}) {
  // Mouse-look needs the pointer captured, exactly as an FPS does: the cursor stops being a thing
  // on the screen, parks in the middle, and becomes raw motion — otherwise it walks to the window
  // edge and the view stops turning. Pointer lock can be refused (an embedded or cross-origin
  // document says no) and the request rejects as a promise, so it is caught; mouse-look still
  // works without it, just bounded by the window, and a refusal must not be fatal.
  //
  // Capture and MODE are deliberately separate. Pausing hands the cursor back so the menu is
  // clickable, but you are still in mouse-look — resuming simply takes the cursor again.
  let releasingOnPurpose = false;

  const capture = () => {
    if (document.pointerLockElement === canvas) return;
    try { canvas.requestPointerLock?.()?.catch?.(() => {}); } catch { /* look on without it */ }
  };
  const release = (onPurpose = true) => {
    releasingOnPurpose = onPurpose;
    if (document.pointerLockElement === canvas) { try { document.exitPointerLock?.(); } catch { /* ignore */ } }
    else releasingOnPurpose = false;
  };
  input.captureMouse = capture;
  input.releaseMouse = release;

  const setFreeLook = (on) => {
    input.freeLook = on;
    input.lookDelta = input.lookDeltaY = 0;
    if (on) capture(); else release(true);
    onFreeLook?.(on);
  };
  input.setFreeLook = setFreeLook;

  document.addEventListener("pointerlockchange", () => {
    const locked = document.pointerLockElement === canvas;
    input.pointerLocked = locked;
    if (locked) return;
    input.lookDelta = input.lookDeltaY = 0;
    // Losing the cursor without asking — Esc, alt-tab — means the player has stopped playing, so
    // pause rather than silently dropping out of mouse-look.
    if (!releasingOnPurpose && input.freeLook) onLockLost?.();
    releasingOnPurpose = false;
  });
  const held = { fwd: 0, back: 0, left: 0, right: 0 };

  const refresh = () => {
    input.throttle = clamp(held.fwd - held.back, -1, 1);
    input.steer = clamp(held.right - held.left, -1, 1);
    input.boost = down.has("ShiftLeft") || down.has("ShiftRight");
    input.handbrake = down.has("Space");
  };

  addEventListener("keydown", (e) => {
    // Esc always pauses. When the pointer is captured the browser also releases it on Esc, which
    // is fine — pausing releases it anyway, and the release is marked deliberate so the handler
    // above does not try to pause a second time.
    if (e.code === "Escape") { onPause?.(); return; }
    if (e.code === "KeyR") { onReload?.(); return; }
    if (e.code === "ControlLeft" || e.code === "ControlRight") {
      e.preventDefault();
      if (e.repeat) return;
      setFreeLook(!input.freeLook);
      return;
    }
    // Space and the arrows would otherwise scroll the page
    if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
    if (e.repeat) return;
    down.add(e.code);
    const k = KEYMAP[e.code];
    if (k) held[k] = 1;
    refresh();
  });

  addEventListener("keyup", (e) => {
    down.delete(e.code);
    const k = KEYMAP[e.code];
    if (k) held[k] = 0;
    refresh();
  });

  // losing focus mid-corner otherwise leaves the throttle stuck on
  addEventListener("blur", () => {
    down.clear();
    held.fwd = held.back = held.left = held.right = 0;
    input.firing = false;
    refresh();
  });

  const setAim = (e) => {
    // Mouse-look reads movement, not position — that holds whether or not the lock was granted.
    if (input.freeLook) {
      input.lookDelta += (e.movementX || 0) * LOOK_SENS;
      input.lookDeltaY += (e.movementY || 0) * LOOK_SENS;
      input.aimActive = true;
      return;
    }
    input.aim.x = (e.clientX / innerWidth) * 2 - 1;
    input.aim.y = -(e.clientY / innerHeight) * 2 + 1;
    input.aimActive = true;
  };

  addEventListener("pointermove", setAim);
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    // clicking back into the canvas re-captures the pointer if mouse-look is still on
    if (input.freeLook) capture();
    setAim(e);
    input.firing = true;
  });
  addEventListener("pointerup", (e) => { if (e.button === 0) input.firing = false; });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  return {
    setFreeLook,
    reset: () => { down.clear(); held.fwd = held.back = held.left = held.right = 0; input.firing = false; refresh(); },
  };
}
