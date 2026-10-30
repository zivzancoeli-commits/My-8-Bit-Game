# 6502 Assembly Cheatsheet (for this browser runner)

**Division of labor:** HTML/JS is only a **monitor + keyboard/mouse**. It assembles your `.asm`, runs the CPU, copies the framebuffer to the canvas, and maps WASD / arrows / mouse into memory you can `LDA`. **You own every pixel** from Assembly — there is no game logic in JavaScript.

This is the same *idea* as real NES 6502 Assembly: tiny registers, load/store, math, bitwise ops, compares, and branches. Drawing and input go through **registers + memory** (including a big pixel grid at `$8000`).

---

## Registers (the CPU's pockets)

The 6502 mostly works with three 8-bit registers (each holds 0–255):

| Register | Role |
|----------|------|
| **A** | Accumulator — your main workspace. Most math and bitwise ops use A. |
| **X** | Index / helper. Good for counters and `address,X` indexing. |
| **Y** | Another index / helper. Same idea as X. |

Talk to the screen and input **only** through memory (and A/X/Y):

- Pixels: write color bytes into the framebuffer at `$8000 + Y*160 + X` (or use plot ports)
- Screen width / height: read `$D010` / `$D011`
- Keys and mouse: `$D021`–`$D032` (see Memory map below)

The on-screen HUD may *display* A/X/Y so you can learn — it does not move your player.

---

## Load — put a value INTO a register

| Mnemonic | Meaning |
|----------|---------|
| **LDA** | LoaD Accumulator — put a value into **A** |
| **LDX** | LoaD X — put a value into **X** |
| **LDY** | LoaD Y — put a value into **Y** |

```asm
LDA #$0A      ; A = 10   (# means "this number itself")
LDX $20       ; X = whatever is in memory address $20
LDY player_x  ; Y = value at the label player_x
```

---

## Store — copy a register OUT to memory

| Mnemonic | Meaning |
|----------|---------|
| **STA** | STore Accumulator — write **A** into memory |
| **STX** | STore X |
| **STY** | STore Y |

```asm
STA $00       ; memory[$00] = A
STX player_x  ; save X into the byte named player_x
STY $D000     ; set draw X (special graphics port)
```

---

## Transfer between registers

| Mnemonic | Meaning |
|----------|---------|
| **TAX** | Transfer A → X |
| **TAY** | Transfer A → Y |
| **TXA** | Transfer X → A |
| **TYA** | Transfer Y → A |

```asm
LDA #$05
TAX           ; X = A = 5
```

---

## Add and subtract

| Mnemonic | Meaning |
|----------|---------|
| **ADC** | ADd with Carry — `A = A + value + carry` |
| **SBC** | SuBtract with Carry — `A = A - value - (1-carry)` |

**Carry (C flag), briefly:**  
Before a normal add of two numbers, clear carry with `CLC`. Before a normal subtract, set carry with `SEC`. (That's how real 6502 does multi-byte math; for small games, just remember: `CLC` then `ADC`, `SEC` then `SBC`.)

```asm
CLC
LDA #$05
ADC #$03      ; A = 8

SEC
LDA #$0A
SBC #$04      ; A = 6
```

Also:

| Mnemonic | Meaning |
|----------|---------|
| **CLC** | CLear Carry (C = 0) — use before ADC |
| **SEC** | SEt Carry (C = 1) — use before SBC |
| **CLV** | CLear oVerflow flag (rarely needed here) |

---

## Increment and decrement

| Mnemonic | Meaning |
|----------|---------|
| **INC** | INCrement memory — memory = memory + 1 |
| **DEC** | DECrement memory — memory = memory - 1 |
| **INX** | X = X + 1 |
| **DEX** | X = X - 1 |
| **INY** | Y = Y + 1 |
| **DEY** | Y = Y - 1 |

```asm
INX           ; walk X forward
DEC player_x  ; move left by 1 in memory
```

There is no `INA` / `DEA` on real 6502 — to change A by 1 you usually `CLC` / `ADC #$01` or `SEC` / `SBC #$01`.

---

## Bitwise: AND, OR, XOR

| Mnemonic | Meaning | Everyday idea |
|----------|---------|----------------|
| **AND** | Bitwise AND | Keep bits that are 1 in *both* |
| **ORA** | Bitwise OR (OR Accumulator) | Turn bits on if either side has them |
| **EOR** | Exclusive OR (this is **XOR**) | Flip bits where they differ |

```asm
LDA #%00001111
AND #%00110011   ; A = %00000011  (only overlapping 1s)

LDA #%00000001
ORA #%00000100   ; A = %00000101  (bits combined)

LDA #%00001111
EOR #%00000101   ; A = %00001010  (XOR / EOR — bits that differ)
```

`EOR` is the 6502 name for XOR. Same operation you may have seen as `xor` in other languages.

---

## Shifts (brief)

| Mnemonic | Meaning |
|----------|---------|
| **ASL** | Arithmetic Shift Left — multiply by 2 (bits slide left, 0 enters right) |
| **LSR** | Logical Shift Right — divide by 2 (bits slide right, 0 enters left) |
| **ROL** | ROtate Left — like ASL but the carry bit rotates in |
| **ROR** | ROtate Right — like LSR but carry rotates in |

```asm
LDA #$05      ; %00000101
ASL A         ; A = $0A (%00001010)  — doubled
LSR A         ; A = $05 again        — halved
```

This runner supports `ASL A`, `LSR A`, and `ASL` / `LSR` on memory addresses. ROL/ROR are optional extras if present in your assembler version.

---

## Compare (sets flags, does not change A/X/Y)

| Mnemonic | Meaning |
|----------|---------|
| **CMP** | CoMPare A with a value |
| **CPX** | ComPare X |
| **CPY** | ComPare Y |

A compare is basically a subtract that **throws away the result** but updates flags so branches know what happened.

```asm
LDA player_x
CMP #$50
BEQ at_center   ; if player_x == 80, go to at_center
```

---

## Flags (the CPU's sticky notes)

After many instructions, the CPU updates flags. You don't store them yourself — branches read them.

| Flag | Name | Simple meaning |
|------|------|----------------|
| **Z** | Zero | Result was 0 → Z=1. Used by BEQ / BNE. |
| **C** | Carry | Unsigned overflow / "borrow" helper. Used by BCC / BCS and ADC / SBC. |
| **N** | Negative | High bit of result was 1 (value ≥ 128). Used by BMI / BPL. |

Examples that set Z:

```asm
LDA #$00      ; Z becomes 1 (A is zero)
LDA #$05
CMP #$05      ; Z becomes 1 (they were equal)
```

---

## Branches (ifs that jump)

Real 6502 does **not** have `jne` — that name is from x86. The 6502 version of "jump if not equal" is **BNE**.

| Mnemonic | Meaning | Reads |
|----------|---------|-------|
| **BEQ** | Branch if EQual | Z=1 |
| **BNE** | Branch if Not Equal | Z=0 |
| **BCC** | Branch if Carry Clear | C=0 |
| **BCS** | Branch if Carry Set | C=1 |
| **BMI** | Branch if MInus (negative) | N=1 |
| **BPL** | Branch if PLus (non-negative) | N=0 |

```asm
loop:
    DEX
    BNE loop      ; if X is not zero yet, jump back to loop
```

That's the famous `BNE loop` pattern: count down with X/Y until zero.

```asm
LDA lives
CMP #$00
BEQ game_over   ; if lives == 0, go to game_over
```

---

## Jumps and subroutines

| Mnemonic | Meaning |
|----------|---------|
| **JMP** | JuMP — go to a label forever (no return) |
| **JSR** | Jump to SubRoutine — call a labeled chunk; comes back later |
| **RTS** | ReTurn from Subroutine — go back after JSR |

```asm
JSR draw_player
; ... later ...
draw_player:
    ; draw code here
    RTS
```

---

## Misc

| Mnemonic | Meaning |
|----------|---------|
| **NOP** | No OPeration — do nothing (padding / timing) |
| **BRK** | BReaK — in this runner, **halt** the program |

---

## Symbols (the "random" punctuation)

| Symbol | Meaning |
|--------|---------|
| `#` | **Immediate** — use this haxadecimal, don't look in the memory. `LDA #$10` → A=16. |
| `$` | **Hexadecimal** (base 16). `$10` = 16 decimal. `$FF` = 255. (Full hex guide below.) |
| `%` | Binary (optional). `%00001111` = 15. |
| `label:` | A name for an address (code or data). |
| `;` | Comment — everything after `;` on that line is ignored. |
| `,X` / `,Y` | Indexed addressing: base address + X or Y. |

Without `#`, a number is an **address**:

```asm
LDA #$10      ; A = 16 (the number 16)
LDA $10       ; A = contents of memory address $10
```

---

## Hexadecimal (what `$1A` and `$04` mean)

Computers love powers of two. **Hexadecimal** (“hex”) is **base 16**: each digit can be 0–15, written with:

| Digit | Value |
|-------|-------|
| `0`–`9` | 0–9 (same as decimal) |
| `A` or `a` | 10 |
| `B` or `b` | 11 |
| `C` or `c` | 12 |
| `D` or `d` | 13 |
| `E` or `e` | 14 |
| `F` or `f` | 15 |

In this Assembly dialect, a **`$` in front means “this number is hex.”**  
So `$0A` is hex. Plain `10` with no `$` is decimal ten.

**Case does not matter:** `$1A` and `$1a` are the same value.

### Place values (two-digit hex)

For `$XY` (two hex digits):

```
value = X*16 + Y
```

Examples you’ll see a lot:

| Hex | Math | Decimal |
|-----|------|---------|
| `$04` | 0×16 + 4 | **4** (a palette color index) |
| `$0A` / `$0a` | 0×16 + 10 | **10** |
| `$0F` | 0×16 + 15 | **15** (last palette color) |
| `$10` | 1×16 + 0 | **16** |
| `$1A` | 1×16 + 10 | **26** |
| `$50` | 5×16 + 0 | **80** (player start X in `game.asm`) |
| `$A0` | 10×16 + 0 | **160** (screen width) |
| `$FF` | 15×16 + 15 | **255** (largest 8-bit byte) |

Bigger addresses use more digits. `$8000` is the start of the framebuffer:

```
$8000 = 8×4096 = 32768 decimal
```

You don’t need to memorize every address — remember: **`$` = hex**, and **A–F are digits past 9**.

### Quick intuition for this project

- Colors are **0–15** → hex `$00`–`$0F`
- Screen width **160** → `$A0` (10×16 = 160)
- Screen height **120** → `$78` (7×16 + 8 = 120)
- Framebuffer base **`$8000`**
- Zero-page variables often look like `$10`, `$11`, …

```asm
LDA #$0A      ; A = 10 (hex A)
LDA #$A0      ; A = 160 (screen width)
LDA #$FF      ; A = 255
```

---

## Comparing two values → 0 or 1 (`===` / `!==`)

6502 has **no** `==` operator that leaves `1` or `0` in a register by itself.  
You **compare**, then **branch**, and (if you want a bool) **load `$01` or `$00`** into A and often `STA` it into a zero-page “result register.”

`CMP` compares **A** to a value (or memory). It sets flags like a subtract but **does not change A**.  
`CPX` / `CPY` do the same for X / Y.

After `CMP`:
- **Equal** → Zero flag Z = 1 → `BEQ` taken  
- **Not equal** → Z = 0 → `BNE` taken

### Style A — branch `if` (no bool stored)

```asm
LDA player_x
CMP #$50          ; === 80?
BEQ was_equal     ; if equal, jump
; not equal path
JMP after
was_equal:
; equal path
after:
```

### Style B — leave `1` or `0` in a result byte (bool-in-register style)

Pick a zero-page address as your flag, e.g. `$20` = `equal_flag`.

**Equal → 1, not equal → 0** (like `===` → boolean)

```asm
equal_flag = $20

LDA player_x      ; first value in A
CMP wall_x        ; compare to second value in memory
BEQ set_one       ; if A === wall_x
LDA #$00          ; false
STA equal_flag
JMP cmp_done
set_one:
LDA #$01          ; true
STA equal_flag
cmp_done:
; equal_flag is now 0 or 1 — later: LDA equal_flag / BNE ...
```

Comparing **two registers** (is A === X?): save one, then CMP:

```asm
STA $21           ; save A
TXA               ; A = X
CMP $21           ; compare X (in A) against saved original A
; then BEQ / LDA #$01 or #$00 as above
```

Or compare X to a constant:

```asm
CPX #$05
BEQ set_one
LDA #$00
STA equal_flag
JMP cmp_done
set_one:
LDA #$01
STA equal_flag
cmp_done:
```

**Not equal → 1, equal → 0** (like `!==`)

Flip which branch sets `$01`:

```asm
LDA player_x
CMP wall_x
BNE set_one       ; not equal → 1
LDA #$00
STA equal_flag
JMP cmp_done
set_one:
LDA #$01
STA equal_flag
cmp_done:
```

…or build the `===` result first, then **NOT** it (next section).

Keep the bool in **A** only (no `STA`) if you need it for the very next test:

```asm
LDA a_val
CMP b_val
BNE load_false
LDA #$01
JMP got_bool
load_false:
LDA #$00
got_bool:
; A is now 0 or 1
```

---

## NOT (boolean and bitwise)

6502 has **no** `NOT` opcode. You fake it with **`EOR`** (XOR).

### Boolean NOT of a 0/1 flag — `EOR #$01`

If a byte is only `0` or `1`, flipping the low bit turns `0→1` and `1→0`:

```asm
LDA equal_flag    ; 0 or 1 from a === compare
EOR #$01          ; boolean NOT
STA not_equal     ; now the !== result
```

So: **`===` result → `EOR #$01` → `!==` result.**

```asm
; $20 = (player_x === wall_x),  $21 = (player_x !== wall_x)
LDA player_x
CMP wall_x
BEQ eq1
LDA #$00
JMP store_eq
eq1:
LDA #$01
store_eq:
STA $20
EOR #$01
STA $21
```

### Bitwise NOT of a full byte — `EOR #$FF`

Flips **every** bit (`0↔1` in all 8 positions):

```asm
LDA flags
EOR #$FF          ; bitwise NOT
STA flags
```

`$FF` = 255 = `%11111111` — XOR with all ones inverts the byte.

| Goal | Pattern |
|------|---------|
| Boolean NOT (0↔1) | `EOR #$01` |
| Bitwise NOT (invert byte) | `EOR #$FF` |
| Turn `===` bool into `!==` | `EOR #$01` after the compare result |

See also `examples/compare.asm`.

---

## Memory map (this runner)

64 KB address space. **Screen pixels are just bytes in RAM** starting at `$8000`.

| Range / address | Purpose |
|-----------------|--------|
| `$0000`–`$00FF` | Zero page — game variables + pointers |
| `$0100`–`$01FF` | Stack (JSR / RTS) |
| `$0200`–`$7FFF` | Code / general RAM (programs start at `$0200`) |
| **`$8000`–`$CBFF`** | **Framebuffer** — one byte per pixel, color 0–15 |
| `$D000` | Plot port: draw X (optional shortcut) |
| `$D001` | Plot port: draw Y |
| `$D002` | Plot port: write color → sets FB byte at (X,Y) |
| `$D003` | Fill entire framebuffer with this color |
| `$D010` | Screen width (read-only) = **160** |
| `$D011` | Screen height (read-only) = **120** |
| `$D020` | Key bitfield |
| `$D021`–`$D024` | W A S D (0 or 1) |
| `$D025`–`$D028` | Arrow Up Down Left Right |
| `$D030` / `$D031` | Mouse X / Y |
| `$D032` | Mouse buttons (bit0 left, bit1 right) |
| `$D040` | Write → wait for next frame (then JS shows the FB) |

### Framebuffer formula (per-pixel control)

Screen size: **160 × 120**.

```
address = $8000 + Y * 160 + X
        = $8000 + Y * $A0 + X
```

Examples:
- Pixel (0,0) → `$8000`
- Pixel (1,0) → `$8001`
- Pixel (0,1) → `$8000 + 160` = `$80A0`
- Pixel (40, 10) → `$8000 + 10*160 + 40` = `$8000 + 1600 + 40` = `$8688`

Store a color with `STA` to that address, or walk a row with a zero-page pointer:

```asm
; ptr_lo/ptr_hi already point at $8000 + y*160 + x
LDA #$04          ; blue
STA (ptr_lo),Y    ; write FB[ptr + Y]
```

`(ptr_lo),Y` means: read the 16-bit address stored at zero-page `ptr_lo`/`ptr_hi`, add Y, store there. That is how you paint many pixels without hard-coding every address.

### Plot ports (optional shortcut — same FB)

```asm
LDA #$40
STA $D000     ; X = 64
LDA #$30
STA $D001     ; Y = 48
LDA #$02
STA $D002     ; color → memory[$8000 + 48*160 + 64]
```

### Clear the screen

```asm
LDA #$00
STA $D003     ; fill all FB bytes with black
; Or loop yourself from $8000 for 19200 bytes — slower but educational
```

### Read a key

```asm
LDA $D024     ; D key?
CMP #$01
BNE not_d
; D is held
not_d:
```

### Wait one frame

```asm
STA $D040     ; JS then copies $8000..$CBFF onto the canvas
```

### Palette (colors 0–15)

| # | Color | # | Color |
|---|-------|---|-------|
| 0 | Black | 8 | Dark gray |
| 1 | White | 9 | Light gray |
| 2 | Red | 10 | Orange |
| 3 | Green | 11 | Yellow |
| 4 | Blue | 12 | Cyan |
| 5 | Magenta | 13 | Pink |
| 6 | Dark blue | 14 | Lime |
| 7 | Brown | 15 | Sky blue |

---

## Tiny examples by group

**Load / store / add**

```asm
LDA #$10
STA $00
LDA $00
CLC
ADC #$01
STA $00       ; $00 now holds 17
```

**XOR / EOR / NOT**

```asm
LDA flags
EOR #$01
STA flags     ; flip bit 0 (boolean NOT if flags is 0/1)

LDA flags
EOR #$FF
STA flags     ; bitwise NOT (invert all bits)
```

**Compare → 0/1 (`===`)**

```asm
LDA $10
CMP $11
BEQ yes
LDA #$00
STA $20
JMP done
yes:
LDA #$01
STA $20       ; $20 = 1 if $10 === $11 else 0
done:
```

**AND to test a bit**

```asm
LDA $D032     ; mouse buttons
AND #$01      ; keep only left-button bit
BNE left_down
```

**ORA to set a bit**

```asm
LDA flags
ORA #$80
STA flags     ; turn on high bit
```

**Loop with BNE**

```asm
LDX #$0A
countdown:
    DEX
    BNE countdown
```

**Draw then wait a frame**

```asm
LDA #$00
STA $D003           ; clear black
; ... draw player ...
LDA #$00
STA $D040           ; vsync
JMP main_loop
```

---

## Quick "x86 → 6502" name map

If you've seen other Assembly online:

| Other name | Here (6502) |
|------------|-------------|
| `mov a, 10` | `LDA #$0A` |
| `xor` | `EOR` |
| `not` (bool 0/1) | `EOR #$01` |
| `not` (bitwise) | `EOR #$FF` |
| `a === b` → 0/1 | `CMP` + `BEQ`/`BNE` + `LDA #$00/#$01` |
| `or` | `ORA` |
| `jne` / `jnz` | `BNE` |
| `je` / `jz` | `BEQ` |
| `jmp` | `JMP` |
| `call` | `JSR` |
| `ret` | `RTS` |

---

Edit `game.asm`, hit **Reload ASM**, and experiment. JS only shows the FB you filled. Every line is "verb + register/memory" — that's the whole language.

Also see **`(zp),Y`**: `STA (ptr_lo),Y` stores A into the address `(ptr_lo/ptr_hi) + Y` — perfect for painting a row of the framebuffer.
