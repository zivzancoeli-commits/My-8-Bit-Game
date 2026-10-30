; ============================================================
;  Compare demo — leave 0/1 in zero-page "registers"
;  Copy into game.asm to try, or point main.js at this file.
;
;  $20 = (val_a === val_b)     like ===
;  $21 = (val_a !== val_b)     like !==  (NOT of $20)
;  Screen flashes green if equal, red if not.
; ============================================================

val_a       = $10
val_b       = $11
equal_flag  = $20
ne_flag     = $21

.org $0200

start:
    LDA #$05
    STA val_a
    LDA #$05
    STA val_b            ; change to #$06 to see !== path

    ; --- === → equal_flag (1 or 0) ---
    LDA val_a
    CMP val_b
    BEQ is_eq
    LDA #$00
    STA equal_flag
    JMP after_eq
is_eq:
    LDA #$01
    STA equal_flag
after_eq:

    ; --- !== → ne_flag via boolean NOT ---
    LDA equal_flag
    EOR #$01             ; NOT: 0↔1
    STA ne_flag

    LDA #$00
    STA $D003            ; clear FB

    LDA equal_flag
    CMP #$01
    BNE show_ne
    LDA #$03             ; equal → green
    STA $D003
    JMP hold
show_ne:
    LDA #$02             ; not equal → red
    STA $D003

hold:
    LDY #$78
wait:
    STA $D040
    DEY
    BNE wait
    BRK
