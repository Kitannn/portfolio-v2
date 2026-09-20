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
  lookDelta: 0,             // radians of yaw requested since the last frame, consumed by the camera
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

export function attachInput(canvas, { onPause, onReload, onFreeLook } = {}) {
  // Mouse-look needs the pointer captured, exactly as an FPS does: the cursor has to stop being a
  // thing on the screen and start being raw motion, or it hits the window edge and the view stops.
  // Pointer lock is the nice version: the cursor disappears and the mouse has no edges. It is not
  // always available though — an embedded or cross-origin document refuses it — and the request
  // rejects as a promise, so it has to be caught or it surfaces as an uncaught SecurityError.
  // Mouse-look still works without it, just bounded by the window, so a refusal is not fatal.
  const lock = () => {
    if (document.pointerLockElement === canvas) return;
    try { canvas.requestPointerLock?.()?.catch?.(() => {}); } catch { /* look on without it */ }
  };
  const unlock = () => {
    if (document.pointerLockElement === canvas) { try { document.exitPointerLock?.(); } catch { /* ignore */ } }
  };

  const setFreeLook = (on) => {
    input.freeLook = on;
    input.lookDelta = 0;
    if (on) lock(); else unlock();
    onFreeLook?.(on);
  };
  input.setFreeLook = setFreeLook;

  // Esc, or anything else that drops the lock, leaves mouse-look — otherwise the camera would keep
  // turning from a pointer the player can no longer see.
  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement !== canvas && input.freeLook) {
      input.freeLook = false;
      input.lookDelta = 0;
      onFreeLook?.(false);
    }
  });
  const held = { fwd: 0, back: 0, left: 0, right: 0 };

  const refresh = () => {
    input.throttle = clamp(held.fwd - held.back, -1, 1);
    input.steer = clamp(held.right - held.left, -1, 1);
    input.boost = down.has("ShiftLeft") || down.has("ShiftRight");
    input.handbrake = down.has("Space");
  };

  addEventListener("keydown", (e) => {
    // while the pointer is captured, Esc belongs to the browser: it releases the lock, which the
    // pointerlockchange handler above turns into "leave mouse-look". Pausing as well would be two
    // things happening on one key.
    if (e.code === "Escape") { if (!document.pointerLockElement) onPause?.(); return; }
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
    if (input.freeLook) lock();
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
