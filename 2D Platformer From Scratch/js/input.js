/**
 * Keyboard (WASD + arrows) and mouse → values the CPU reads from MMIO.
 */
(function (global) {
  const keys = {
    w: false, a: false, s: false, d: false,
    up: false, down: false, left: false, right: false,
  };

  let mouseX = 0;
  let mouseY = 0;
  let mouseButtons = 0; // bit0 left, bit1 right
  let width = 160;
  let height = 120;

  const codeMap = {
    KeyW: "w", KeyA: "a", KeyS: "s", KeyD: "d",
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  };

  function attach(canvas, screenW, screenH) {
    width = screenW;
    height = screenH;

    window.addEventListener("keydown", (e) => {
      const k = codeMap[e.code];
      if (!k) return;
      keys[k] = true;
      e.preventDefault();
    });

    window.addEventListener("keyup", (e) => {
      const k = codeMap[e.code];
      if (!k) return;
      keys[k] = false;
      e.preventDefault();
    });

    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = ((e.clientX - rect.left) / rect.width) * width;
      const sy = ((e.clientY - rect.top) / rect.height) * height;
      mouseX = Math.max(0, Math.min(width - 1, Math.floor(sx)));
      mouseY = Math.max(0, Math.min(height - 1, Math.floor(sy)));
    });

    canvas.addEventListener("mousedown", (e) => {
      canvas.focus();
      if (e.button === 0) mouseButtons |= 1;
      if (e.button === 2) mouseButtons |= 2;
      e.preventDefault();
    });

    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) mouseButtons &= ~1;
      if (e.button === 2) mouseButtons &= ~2;
    });

    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    // Lose keys when tabbing away
    window.addEventListener("blur", () => {
      for (const k of Object.keys(keys)) keys[k] = false;
      mouseButtons = 0;
    });
  }

  function bitfield() {
    let b = 0;
    if (keys.w) b |= 1;
    if (keys.a) b |= 2;
    if (keys.s) b |= 4;
    if (keys.d) b |= 8;
    if (keys.up) b |= 16;
    if (keys.down) b |= 32;
    if (keys.left) b |= 64;
    if (keys.right) b |= 128;
    return b;
  }

  function snapshot() {
    return {
      w: keys.w ? 1 : 0,
      a: keys.a ? 1 : 0,
      s: keys.s ? 1 : 0,
      d: keys.d ? 1 : 0,
      up: keys.up ? 1 : 0,
      down: keys.down ? 1 : 0,
      left: keys.left ? 1 : 0,
      right: keys.right ? 1 : 0,
      bitfield: bitfield(),
      mouseX,
      mouseY,
      mouseButtons,
    };
  }

  function label() {
    const parts = [];
    if (keys.w) parts.push("W");
    if (keys.a) parts.push("A");
    if (keys.s) parts.push("S");
    if (keys.d) parts.push("D");
    if (keys.up) parts.push("↑");
    if (keys.down) parts.push("↓");
    if (keys.left) parts.push("←");
    if (keys.right) parts.push("→");
    return parts.length ? parts.join(" ") : "(none)";
  }

  global.AsmInput = { attach, snapshot, label, get mouseX() { return mouseX; }, get mouseY() { return mouseY; }, get mouseButtons() { return mouseButtons; } };
})(window);
