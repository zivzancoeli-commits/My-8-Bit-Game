# 2D Platformer From Scratch

Learn **6502-style Assembly** by writing a real `.asm` game that runs in the browser — with **WASD**, **arrow keys**, and **mouse** — ready for **itch.io** or **GitHub Pages**.

**HTML/JS = monitor + keyboard/mouse only.**  
All drawing and game logic live in Assembly. You write each screen location yourself via the **memory-mapped framebuffer** (`$8000 + Y*160 + X`) or the optional plot ports. JS never paints gameplay for you — `game.asm` starts blank; you write every pixel. JS only shows the framebuffer and feeds input into MMIO. There is no CSS file and no on-page HUD — everything visible is what your ASM wrote.

This is **not** a real NES ROM. Real NES hardware has no mouse and no WASD keyboard.  
What you *do* get: the **same instruction words** (LDA, STA, ADC, AND, ORA, EOR, BNE, `STA (ptr),Y`, …), registers A/X/Y, and a web-publishable player without writing WASM by hand.

---

## Open in VS Code

1. Open the folder:
   ```
   /Users/boys/Projects/2D Platformer From Scratch
   ```
2. Edit **`game.asm`** — that is your game source.
3. Open **`index.html`** via a local server — you should see only the game canvas.

### Run locally (pick one)

**Option A — Live Server (easiest in VS Code)**  
1. Install the **Live Server** extension (by Ritwick Dey).  
2. Right-click `index.html` → **Open with Live Server**.  
3. The page loads `game.asm` via `fetch` (needs a tiny local server — opening the file as `file://` will not work).

**Option B — Python**  
In a terminal, from this folder:

```bash
cd "/Users/boys/Projects/2D Platformer From Scratch"
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

After you save `game.asm`, click the canvas and press **R** to re-assemble and run (or refresh the page). Press **P** to pause/resume. Errors print in the browser console (DevTools). The page itself is only a black canvas — no on-screen lab UI or CSS file.

---

## Controls (built into the runner)

| Input | Memory |
|-------|--------|
| W A S D | `$D021` `$D022` `$D023` `$D024` (0 or 1) |
| Arrow Up / Down / Left / Right | `$D025` `$D026` `$D027` `$D028` |
| Mouse X / Y | `$D030` / `$D031` |
| Mouse buttons | `$D032` (bit0 = left, bit1 = right) |

Screen is **160×120** pixels, **16-color** palette. See `CHEATSHEET.md` for the full memory map and every mnemonic.

---

## Project layout

```
2D Platformer From Scratch/
  CHEATSHEET.md      ← mnemonic explanations (read this)
  README.md          ← you are here
  index.html         ← bare <canvas> only (no CSS, no HUD)
  js/
    assembler.js     ← turns .asm text into bytecode
    cpu.js           ← runs the bytecode
    runtime.js       ← FB present + MMIO (no game logic)
    input.js         ← keyboard + mouse → memory
    main.js          ← load, assemble, blit loop
  game.asm           ← YOUR game (blank stub — you draw everything)
  examples/
    lesson1.asm      ← tiny load/store/add demo
    compare.asm      ← === / !== → 0/1 demo
```

---

## Memory map (summary)

| Address | Role |
|---------|------|
| `$0000`–`$00FF` | Zero-page RAM (variables / pointers) |
| `$0100`–`$01FF` | Stack |
| `$0200`–`$7FFF` | Code + general RAM |
| **`$8000`–`$CBFF`** | **Framebuffer** (160×120, one color byte per pixel) |
| `$D000` / `$D001` / `$D002` | Optional plot X / Y / color (writes into the FB) |
| `$D003` | Fill entire FB with a color |
| `$D010` / `$D011` | Width / height (read-only: 160×120) |
| `$D021`–`$D028` | W A S D + arrows |
| `$D030`–`$D032` | Mouse X, Y, buttons |
| `$D040` | Write → wait next frame (then canvas shows the FB) |

**Pixel address:** `$8000 + Y * 160 + X` (Y rows of 160, then X). See `CHEATSHEET.md`.

---

## Publish on the web

### GitHub Pages

1. Create a GitHub repo and upload this whole folder.  
2. Settings → Pages → deploy from the `main` branch (root).  
3. Your game URL will be like `https://YOU.github.io/REPO/`.

### itch.io

1. Zip the folder contents (`index.html`, `css/`, `js/`, `game.asm`, etc.).  
2. Upload as an **HTML** project.  
3. Set the viewport / embed size as you like (canvas scales in CSS).

No build step, no npm install — static files only.

---

## Workflow tip

1. Change `game.asm` in VS Code.  
2. Save.  
3. Click **Reload ASM** (or refresh the page).  
4. Use the cheatsheet when a mnemonic looks like alphabet soup.

When you are ready for a real NES ROM later, the same words transfer; only the graphics/input hardware changes.
