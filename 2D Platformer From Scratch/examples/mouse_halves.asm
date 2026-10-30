; ============================================================
;  Mouse halves demo — learn by reading every line
;
;  What you see each frame:
;    LEFT  half (X = 0..79):
;      brighter if left mouse button is held, else dimmer
;    RIGHT half (X = 80..159):
;      brighter if mouse X >= 80 (cursor on the right), else dimmer
;
;  HTML/JS only shows the framebuffer. All painting is here.
;
;  Reminder — hex with $ :
;    $50 = 5*16 + 0 = 80 decimal   ← middle of 160-wide screen
;    $A0 = 160                      ← screen width / one row of FB
;    $78 = 120                      ← screen height
;
;  NOTE: A backup of this file lives at examples/mouse_halves.asm
; ============================================================

; --- Zero-page "variables" (named bytes in $00-$FF) ---
left_color  = $10     ; color for the left half this frame
right_color = $11     ; color for the right half this frame
ptr_lo      = $12     ; low byte of a pointer into the framebuffer
ptr_hi      = $13     ; high byte of that pointer
row         = $14     ; which Y row we are filling (0..119)

; Palette picks (0-15). Brighter vs dimmer pairs:
COL_LEFT_DIM     = $08 ; dark gray
COL_LEFT_BRIGHT  = $09 ; light gray
COL_RIGHT_DIM    = $06 ; dark blue
COL_RIGHT_BRIGHT = $04 ; blue

; Useful sizes
HALF_W = $50          ; 80  — first X of the right half / width of left half
WIDTH  = $A0          ; 160 — full row width in the framebuffer
HEIGHT = $78          ; 120 — number of rows

; Framebuffer starts at $8000.
; Formula for one pixel:  address = $8000 + Y * 160 + X

.org $0200            ; code begins here in this runner

; ------------------------------------------------------------
start:
; We jump straight into the forever loop.
; (No separate init needed — we decide colors every frame.)

main_loop:

    ; ========================================================
    ; 1) DECIDE left_color from the left mouse button
    ;
    ; $D032 = mouse buttons. Bit 0 = left button.
    ; AND #$01 keeps ONLY that bit (masks away bit 1 = right btn).
    ;   result 1 → button down → BNE (Not Equal to zero) fires
    ;   result 0 → button up   → Z flag set → BNE skipped
    ; ========================================================
    LDA $D032             ; A = mouse button byte
    AND #$01              ; A = A & 1  → 0 or 1 (left button only)
    BNE left_is_bright    ; if A !== 0, button is down

    ; button UP → dimmer left
    LDA #COL_LEFT_DIM     ; # means "the number itself", not an address
    STA left_color
    JMP left_done

left_is_bright:
    LDA #COL_LEFT_BRIGHT
    STA left_color

left_done:

    ; ========================================================
    ; 2) DECIDE right_color from mouse X
    ;
    ; $D030 = mouse X (0..159).
    ; CMP #$50 compares A to 80 WITHOUT changing A.
    ; After CMP:
    ;   BCS = Branch if Carry Set    → A >= value   (unsigned)
    ;   BCC = Branch if Carry Clear  → A <  value
    ; So "mouse X >= 80?" is CMP #$50 then BCS.
    ; ========================================================
    LDA $D030             ; A = mouse X
    CMP #$50              ; compare to 80 ($50). Sets flags; A unchanged
    BCS right_is_bright   ; if mouse X >= 80, cursor is on the right half

    ; mouse on LEFT half of screen → right panel stays dim
    LDA #COL_RIGHT_DIM
    STA right_color
    JMP right_done

right_is_bright:
    LDA #COL_RIGHT_BRIGHT
    STA right_color

right_done:

    ; ========================================================
    ; 3) PAINT both halves into the framebuffer
    ;
    ; Why every frame? The screen does not "remember" widgets.
    ; Each frame we rewrite every pixel we care about, then
    ; STA $D040 so JS copies $8000..$CBFF onto the canvas.
    ;
    ; Plan:
    ;   ptr = $8000
    ;   for row = 0 .. 119:
    ;       fill X=0..79   with left_color   via STA (ptr_lo),Y
    ;       fill X=80..159 with right_color
    ;       ptr += 160     (move to next scanline)
    ;
    ; (ptr_lo),Y  means: address = word_at(ptr_lo/ptr_hi) + Y
    ; ========================================================

    ; ptr = $8000  (low byte $00, high byte $80)
    LDA #$00
    STA ptr_lo
    LDA #$80
    STA ptr_hi

    LDA #$00
    STA row                 ; row = 0

row_loop:
    ; --- left half: Y index 0 .. 79 ---
    LDY #$00
left_cols:
    LDA left_color          ; A = color for left
    STA (ptr_lo),Y          ; FB[ptr + Y] = A
    INY                     ; Y = Y + 1
    CPY #HALF_W             ; Y === 80?
    BNE left_cols           ; if not, keep painting left pixels

    ; --- right half: Y index 80 .. 159 ---
    ; Y is already 80 here. Keep going until 160.
right_cols:
    LDA right_color
    STA (ptr_lo),Y
    INY
    CPY #WIDTH              ; Y === 160?
    BNE right_cols

    ; next row: ptr += 160 ($A0)
    CLC                     ; clear carry before ADC (normal add)
    LDA ptr_lo
    ADC #WIDTH              ; ptr_lo = ptr_lo + 160
    STA ptr_lo
    LDA ptr_hi
    ADC #$00                ; add carry into high byte if lo wrapped
    STA ptr_hi

    INC row                 ; row = row + 1
    LDA row
    CMP #HEIGHT             ; row === 120?
    BNE row_loop            ; if not, paint another scanline

    ; ========================================================
    ; 4) VSYNC — tell the runner "frame finished, show the FB"
    ; ========================================================
    STA $D040               ; value in A does not matter

    JMP main_loop           ; forever — go decide colors again

; (end of file — no BRK; we loop forever on purpose)
