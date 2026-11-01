/**
 * Bare runner: load game.asm → assemble → run → blit framebuffer to canvas.
 * Nothing on screen comes from HTML/JS chrome — only ASM pixels.
 * Keys: Ctrl+R or F5-style reload via Ctrl+Shift+R may refresh the page;
 *       press "R" (with no modifiers) to re-fetch/assemble game.asm.
 *       Press "P" to pause/resume. Errors go to the browser console only.
 */
(function () {
  const canvas = document.getElementById("screen");

  // Size canvas from JS (no CSS file). Integer scale to fit the window.
  function layoutCanvas() {
    const w = AsmRuntime.WIDTH;
    const h = AsmRuntime.HEIGHT;
    const scale = Math.max(1, Math.floor(Math.min(window.innerWidth / w, window.innerHeight / h)));
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w * scale + "px";
    canvas.style.height = h * scale + "px";
    canvas.style.imageRendering = "pixelated";
    canvas.style.display = "block";
    canvas.style.margin = "0 auto";
  }

  document.documentElement.style.margin = "0";
  document.documentElement.style.height = "100%";
  document.body.style.margin = "0";
  document.body.style.background = "#000";
  document.body.style.minHeight = "100%";
  document.body.style.display = "flex";
  document.body.style.alignItems = "center";
  document.body.style.justifyContent = "center";

  AsmRuntime.init(canvas);
  layoutCanvas();
  window.addEventListener("resize", layoutCanvas);

  AsmInput.attach(canvas, AsmRuntime.WIDTH, AsmRuntime.HEIGHT);
  canvas.focus();
  canvas.addEventListener("click", () => canvas.focus());

  let cpu = null;
  let memory = null;
  let entry = 0x0200;
  let paused = false;
  let running = false;
  let raf = 0;

  function makeCpu(image) {
    memory = image.memory;
    entry = image.entry;
    AsmRuntime.setMemory(memory);
    AsmRuntime.clearFB(memory, 0);
    return AsmCPU.createCPU({
      memory,
      entry,
      readHook(addr) {
        if (AsmRuntime.isMMIO(addr)) {
          return AsmRuntime.readMMIO(addr, AsmInput.snapshot());
        }
        return null;
      },
      writeHook(addr, val) {
        if (AsmRuntime.isMMIO(addr)) {
          AsmRuntime.writeMMIO(addr, val, memory);
          return true;
        }
        return false;
      },
    });
  }

  async function loadAndRun() {
    try {
      const res = await fetch("game.asm?ts=" + Date.now());
      if (!res.ok) {
        throw new Error(
          "Could not fetch game.asm (" + res.status + "). Use Live Server or python3 -m http.server."
        );
      }
      const source = await res.text();
      const image = AsmAssembler.assemble(source);
      cpu = makeCpu(image);
      cpu.reset(entry);
      AsmRuntime.flush(memory);
      paused = false;
      if (!running) startLoop();
      console.log("Assembled game.asm @ $" + entry.toString(16).toUpperCase().padStart(4, "0"));
    } catch (e) {
      console.error(e);
    }
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!cpu || paused) return;
    try {
      const result = cpu.runUntil(() => AsmRuntime.takeVsync(), 300000);
      AsmRuntime.flush(memory);
      if (result === "halt") {
        console.warn("CPU halted (BRK or illegal opcode).");
        paused = true;
      } else if (result === "limit") {
        console.warn("Instruction limit before STA $D040 (vsync).");
      }
    } catch (e) {
      console.error(e);
      paused = true;
    }
  }

  function startLoop() {
    running = true;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  window.addEventListener("keydown", (e) => {
    if (e.target && e.target.tagName === "INPUT") return;
    // R = reload ASM (ignore if Ctrl/Meta so browser refresh still works)
    if ((e.key === "r" || e.key === "R") && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      loadAndRun();
      return;
    }
    if ((e.key === "p" || e.key === "P") && !e.ctrlKey && !e.metaKey && !e.altKey) {
      paused = !paused;
      console.log(paused ? "paused" : "resumed");
    }
  });

  loadAndRun();
})();
