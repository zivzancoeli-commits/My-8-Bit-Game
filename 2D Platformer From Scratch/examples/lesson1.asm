; ============================================================
;  Lesson 1 — Load, store, add + touch the framebuffer
;  Copy into game.asm (or temporarily change main.js fetch path).
; ============================================================

.org $0200

start:
    LDA #$10
    STA $00
    LDA $00
    CLC
    ADC #$01
    STA $00               ; $00 = 17

    LDA #$00
    STA $D003             ; clear FB

    ; Direct FB poke: pixel (0,0) is exactly address $8000
    LDA #$02              ; red
    STA $8000

    ; Also a short line via plot ports (same FB)
    LDA #$3C
    STA $D001
    LDX #$00
line:
    STX $D000
    LDA $00
    AND #$0F
    STA $D002
    INX
    CPX #$28
    BNE line

    LDY #$3C
wait:
    STA $D040
    DEY
    BNE wait
    BRK
