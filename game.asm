; COL_BG is the background
;  $10 is boxX
;  $11 is boxHeight
COL_BG = $00
boxX = $10
boxHeight = $11
fallTimer = $12
drawX = $13
drawY = $14
old_right = $15
old_left = $16

*= $0200            ; program starts here

start:
    LDA #$01
    STA boxX
    LDA #$01
    STA boxHeight
    LDA #$00
    STA old_left
    STA old_right

main_loop:
    LDA #COL_BG       ; A = black
    STA $D003         ; clear the whole screen to A

    JSR fall_check
    JSR arrow_check
    JSR fall_check

    ; JSR draw_background
    JSR draw_box

    STA $D040         ; frame done → runner shows it, waits ~1/60 s
    JMP main_loop     ; do it all again forever


; arrow checks

arrow_check:
    JSR right_arrow_check
    JSR left_arrow_check
    JSR down_arrow_check
    JSR up_arrow_check
    RTS

right_arrow_check:
   LDA $D028
   CMP old_right
   BEQ right_done
   STA old_right
   CMP #$01
   BNE right_done
   LDA boxX
   CMP #$09
   BCC increase
   RTS
increase:
   INC boxX
   RTS
right_done:
    RTS

left_arrow_check:
    LDA $D027
    CMP old_left
    BEQ left_done
    STA old_left
    CMP #$01
    BNE left_done
    LDA boxX
    CMP #$01
    BCC left_done
    DEC boxX
    RTS
left_done:
    RTS

down_arrow_check:
    LDA $D026
    CMP #$01
    BNE not_down
    LDA #$01
    STA $12
not_down:
    RTS

up_arrow_check:
    LDA $D025
    CMP #$01
    BNE not_up
    ;rotate
not_up:
    RTS
; box falling
fall_check:
    LDA $12
    CMP #$00
    BEQ fall
    BCC fall
    RTS

fall:
    ;check if there's a block under it if so say so if not continue
    ;DEC $11
    RTS

; drawing
draw_box:
    LDA $10 ; takes the box x and puts it in draw x
    STA $13
    LDA $11 ; takes the box y and puts it in draw y
    STA $14
 ; multiplies by 8
    LDA $13 ; x
    ASL A
    ASL A
    ASL A
    STA $13
    LDA $14 ; y
    ASL A
    ASL A
    ASL A
    STA $14

 ; adds the border size
    LDA $13 ; x
    CLC
    ADC #$28
    STA $13

    LDA $14 ; y
    CLC
    ADC #$28
    STA $14
    JSR square
    JSR square
    JSR square
    JSR square
    JSR square
    JSR square
    JSR square
    JSR square

    LDA $14
    CLC
    ADC #$08
    STA $14


    RTS

square:
    JSR draw
    INC $13
    JSR draw
    INC $13
    JSR draw
    INC $13
    JSR draw
    INC $13
    JSR draw
    INC $13
    JSR draw
    INC $13
    JSR draw
    INC $13
    JSR draw

    DEC $13
    DEC $13
    DEC $13
    DEC $13
    DEC $13
    DEC $13
    DEC $13
    DEC $14
    RTS
draw:
    LDA $13
    STA $D000
    LDA $14
    STA $D001
    LDA #$04
    STA $D002
    RTS
