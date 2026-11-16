// Keyboard and mouse, and the pointer lock that turns the mouse into look.
// Plain browser APIs only. Buy keys, plant (E) and grenade (G) are exposed as
// edge-triggered events main.js drains once per frame, so a held key never
// buys twice or plants twice.
export function createInput(canvas, onLockChange) {
  const keys = new Set();
  const state = {
    keys,
    locked: false,
    firing: false,
    lookX: 0,
    lookY: 0,
    pressed: new Set(),
    released: new Set(),
  };

  function setKey(event, down) {
    if (down) {
      if (!keys.has(event.code)) state.pressed.add(event.code);
      keys.add(event.code);
    } else {
      keys.delete(event.code);
      state.released.add(event.code);
    }
    if (event.code === 'Space') event.preventDefault();
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    setKey(event, true);
  });
  window.addEventListener('keyup', (event) => setKey(event, false));
  window.addEventListener('blur', () => { keys.clear(); state.firing = false; });
  window.addEventListener('mousemove', (event) => {
    if (!state.locked) return;
    state.lookX += event.movementX;
    state.lookY += event.movementY;
  });
  window.addEventListener('mousedown', (event) => {
    if (state.locked && event.button === 0) state.firing = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) state.firing = false;
  });
  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === canvas;
    if (!state.locked) {
      keys.clear();
      state.firing = false;
    }
    onLockChange(state.locked);
  });

  return {
    state,
    requestLock() {
      try { canvas.requestPointerLock(); } catch { /* pointer lock is optional in captures */ }
    },
    takeLook() {
      const x = state.lookX;
      const y = state.lookY;
      state.lookX = 0;
      state.lookY = 0;
      return { x, y };
    },
    // Drain the keys pressed since the last frame; call once per frame.
    takePressed() {
      const out = state.pressed;
      state.pressed = new Set();
      return out;
    },
    clearPressed() {
      state.pressed.clear();
      state.released.clear();
    },
  };
}
