/**
 * Thin display + MMIO only.
 * JS does NOT run game logic. It:
 *   - holds a 160×120 indexed framebuffer in CPU memory at $8000
 *   - maps plot/clear/vsync/size ports
 *   - copies that FB to the canvas when ASM writes vsync
 * All pixels and game behavior come from .asm stores.
 */
(function (global) {
  const WIDTH = 160;
  const HEIGHT = 120;
  const FB_BASE = 0x8000;           // first pixel (0,0)
  const FB_SIZE = WIDTH * HEIGHT;   // 19200 bytes → $8000..$CBFF

  // addr = FB_BASE + y * WIDTH + x
  //      = $8000 + y * 160 + x

  const PALETTE = [
    [0x00, 0x00, 0x00], // 0 black
    [0xff, 0xff, 0xff], // 1 white
    [0xe4, 0x39, 0x35], // 2 red
    [0x43, 0xa0, 0x47], // 3 green
    [0x1e, 0x88, 0xe5], // 4 blue
    [0xd8, 0x1b, 0x60], // 5 magenta
    [0x15, 0x32, 0x7a], // 6 dark blue
    [0x6d, 0x4c, 0x41], // 7 brown
    [0x42, 0x42, 0x42], // 8 dark gray
    [0xb0, 0xb0, 0xb0], // 9 light gray
    [0xfb, 0x8c, 0x00], // 10 orange
    [0xff, 0xee, 0x58], // 11 yellow
    [0x00, 0xbc, 0xd4], // 12 cyan
    [0xf4, 0x8f, 0xb1], // 13 pink
    [0x8b, 0xc3, 0x4a], // 14 lime
    [0x81, 0xd4, 0xfa], // 15 sky
  ];

  const MMIO = {
    DRAW_X: 0xd000,
    DRAW_Y: 0xd001,
    PLOT: 0xd002,
    CLEAR: 0xd003,
    WIDTH: 0xd010,
    HEIGHT: 0xd011,
    KEYS: 0xd020,
    KEY_W: 0xd021,
    KEY_A: 0xd022,
    KEY_S: 0xd023,
    KEY_D: 0xd024,
    KEY_UP: 0xd025,
    KEY_DOWN: 0xd026,
    KEY_LEFT: 0xd027,
    KEY_RIGHT: 0xd028,
    MOUSE_X: 0xd030,
    MOUSE_Y: 0xd031,
    MOUSE_BTN: 0xd032,
    VSYNC: 0xd040,
  };

  let canvas, ctx, imageData, pixels;
  let drawX = 0;
  let drawY = 0;
  let vsyncRequested = false;
  let memRef = null; // set each frame / on write so plot ports hit the same RAM ASM uses

  function init(canvasEl) {
    canvas = canvasEl;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    ctx = canvas.getContext("2d", { alpha: false });
    imageData = ctx.createImageData(WIDTH, HEIGHT);
    pixels = imageData.data;
    // black until ASM writes something
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 0; pixels[i + 1] = 0; pixels[i + 2] = 0; pixels[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
  }

  function setMemory(mem) {
    memRef = mem;
  }

  function fbIndex(x, y) {
    return FB_BASE + y * WIDTH + x;
  }

  function clearFB(mem, colorIndex) {
    const c = colorIndex & 0x0f;
    const m = mem || memRef;
    if (!m) return;
    for (let i = 0; i < FB_SIZE; i++) m[FB_BASE + i] = c;
  }

  function plotFB(mem, x, y, colorIndex) {
    const m = mem || memRef;
    if (!m) return;
    x &= 0xff;
    y &= 0xff;
    if (x >= WIDTH || y >= HEIGHT) return;
    m[fbIndex(x, y)] = colorIndex & 0x0f;
  }

  /** Copy indexed FB from CPU RAM → canvas. Call after ASM vsync. */
  function flush(mem) {
    const m = mem || memRef;
    if (!m) return;
    for (let i = 0; i < FB_SIZE; i++) {
      const c = PALETTE[m[FB_BASE + i] & 0x0f];
      const p = i * 4;
      pixels[p] = c[0];
      pixels[p + 1] = c[1];
      pixels[p + 2] = c[2];
      pixels[p + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
  }

  function isMMIO(addr) {
    return addr >= 0xd000 && addr <= 0xd040;
  }

  function isFramebuffer(addr) {
    return addr >= FB_BASE && addr < FB_BASE + FB_SIZE;
  }

  function readMMIO(addr, inputSnap) {
    switch (addr) {
      case MMIO.DRAW_X: return drawX & 0xff;
      case MMIO.DRAW_Y: return drawY & 0xff;
      case MMIO.WIDTH: return WIDTH & 0xff;
      case MMIO.HEIGHT: return HEIGHT & 0xff;
      case MMIO.KEYS: return inputSnap.bitfield & 0xff;
      case MMIO.KEY_W: return inputSnap.w;
      case MMIO.KEY_A: return inputSnap.a;
      case MMIO.KEY_S: return inputSnap.s;
      case MMIO.KEY_D: return inputSnap.d;
      case MMIO.KEY_UP: return inputSnap.up;
      case MMIO.KEY_DOWN: return inputSnap.down;
      case MMIO.KEY_LEFT: return inputSnap.left;
      case MMIO.KEY_RIGHT: return inputSnap.right;
      case MMIO.MOUSE_X: return inputSnap.mouseX & 0xff;
      case MMIO.MOUSE_Y: return inputSnap.mouseY & 0xff;
      case MMIO.MOUSE_BTN: return inputSnap.mouseButtons & 0xff;
      default: return 0;
    }
  }

  /** MMIO writes. mem is the CPU's 64KB image (required for plot/clear). */
  function writeMMIO(addr, value, mem) {
    value &= 0xff;
    if (mem) memRef = mem;
    switch (addr) {
      case MMIO.DRAW_X:
        drawX = value;
        break;
      case MMIO.DRAW_Y:
        drawY = value;
        break;
      case MMIO.PLOT:
        // shortcut: same as STA to $8000 + Y*160 + X
        plotFB(memRef, drawX, drawY, value);
        break;
      case MMIO.CLEAR:
        // hardware-style fill of the framebuffer RAM
        clearFB(memRef, value);
        break;
      case MMIO.VSYNC:
        vsyncRequested = true;
        break;
      default:
        break;
    }
  }

  function takeVsync() {
    if (!vsyncRequested) return false;
    vsyncRequested = false;
    return true;
  }

  global.AsmRuntime = {
    WIDTH,
    HEIGHT,
    FB_BASE,
    FB_SIZE,
    PALETTE,
    MMIO,
    init,
    setMemory,
    clearFB,
    plotFB,
    flush,
    isMMIO,
    isFramebuffer,
    readMMIO,
    writeMMIO,
    takeVsync,
    fbIndex,
  };
})(window);
