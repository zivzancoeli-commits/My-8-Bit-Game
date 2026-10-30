; ============================================================
;  Moving box — arrow keys only, no gravity
;
;  Each frame:
;    1. clear the screen
;    2. read the 4 arrow keys, move the box 1 pixel (stay on screen)
;    3. draw an 8x8 box at (player_x, player_y)
;    4. STA $D040 (show the frame), loop
;
;  Arrow key ports (each reads 0 = up / not held, 1 = held):
;    $D025 Up   $D026 Down   $D027 Left   $D028 Right
;  Plot ports: $D000 = X, $D001 = Y, writing a color to $D002 draws a pixel
; ============================================================

; --- Zero-page variables (named bytes) ---
player_x = $10        ; box left edge X
player_y = $11        ; box top edge Y
row      = $12        ; draw loop: which row of the box (0..7)
col      = $13        ; draw loop: which column (0..7)

; --- Constants ---
SIZE     = $08        ; box is 8x8 pixels
MAX_X    = $98        ; 160 - 8 = 152 ($98) → furthest right X
MAX_Y    = $70        ; 120 - 8 = 112 ($70) → furthest down Y
COL_BG   = $00        ; black background
COL_BOX  = $0B        ; yellow box

.org $0200            ; program starts here

start:
    LDA #$4C          ; # = the number itself. $4C = 76 → (160-8)/2
    STA player_x      ; save as starting X (centered)
    LDA #$38          ; $38 = 56 → (120-8)/2
    STA player_y      ; starting Y (centered)

main_loop:
    LDA #COL_BG       ; A = black
    STA $D003         ; clear the whole screen to A

    JSR move_box      ; read arrows, change player_x / player_y
    JSR draw_box      ; paint the 8x8 box

    STA $D040         ; frame done → runner shows it, waits ~1/60 s
    JMP main_loop     ; do it all again forever

; ------------------------------------------------------------
; move_box — one check per arrow key
; LDA port → A is 0 or 1. BEQ skips if 0 (key not held).
; ------------------------------------------------------------
move_box:
    LDA $D025         ; Up arrow held?
    BEQ check_down    ; 0 → no, skip ahead
    LDA player_y      ; yes: look at Y
    BEQ check_down    ; already 0 (top edge)? don't move
    DEC player_y      ; Y = Y - 1 (up)

check_down:
    LDA $D026         ; Down arrow held?
    BEQ check_left
    LDA player_y
    CMP #MAX_Y        ; compare Y to 112
    BCS check_left    ; Carry set = Y >= 112 → at bottom, skip
    INC player_y      ; Y = Y + 1 (down)

check_left:
    LDA $D027         ; Left arrow held?
    BEQ check_right
    LDA player_x
    BEQ check_right   ; X is 0 → left edge, skip
    DEC player_x      ; X = X - 1

check_right:
    LDA $D028         ; Right arrow held?
    BEQ move_done
    LDA player_x
    CMP #MAX_X        ; X >= 152?
    BCS move_done     ; yes → right edge, skip
    INC player_x      ; X = X + 1

move_done:
    RTS               ; return to main_loop (after the JSR)

; ------------------------------------------------------------
; draw_box — nested loops: for row 0..7, for col 0..7, plot pixel
; ------------------------------------------------------------
draw_box:
    LDA #$00
    STA row           ; row = 0

row_loop:
    LDA #$00
    STA col           ; col = 0 (start of this row)

col_loop:
    CLC               ; clear carry before adding
    LDA player_x
    ADC col           ; A = player_x + col
    STA $D000         ; pixel X

    CLC
    LDA player_y
    ADC row           ; A = player_y + row
    STA $D001         ; pixel Y

    LDA #COL_BOX
    STA $D002         ; write color → pixel drawn at (X, Y)

    INC col           ; next column
    LDA col
    CMP #SIZE         ; done 8 columns?
    BNE col_loop      ; not equal → keep going

    INC row           ; next row
    LDA row
    CMP #SIZE         ; done 8 rows?
    BNE row_loop

    RTS
