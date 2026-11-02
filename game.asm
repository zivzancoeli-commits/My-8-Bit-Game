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
block_under = $17
right_timer = $18
left_timer = $19
spawn_new = $20
sub_amount = $21

board = $0300

FIRST_DELAY = $0C
REPEAT_RATE = $04



*= $0200            ; program starts here

start:
    LDA #$01
    STA boxX
    LDA #$01
    STA boxHeight
    LDA #$00
    STA old_left
    STA old_right
    STA right_timer
    STA left_timer
    LDX #$00
 clear_board:
    LDA #$00
    STA board,X
    INX
    CPX #$C8
    BNE clear_board

main_loop:
    LDA #COL_BG       ; A = black
    STA $D003         ; clear the whole screen to A

    JSR fall_check
    JSR arrow_check
    JSR fall_check
    LDX #$00
    JSR row_check

    ; JSR draw_background
    LDX #$00
    JSR draw_box_check

    STA $D040         ; frame done runner shows it waits about 1/60 s
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
    CMP #$01
    BEQ right_held
    LDA #$00
    STA right_timer
    STA old_right
    RTS
right_held:
    LDA right_timer
    BEQ right_move
    DEC right_timer
    RTS
right_move:
    LDA boxX
    CMP #$09
    BCS right_arm
    INC boxX
right_arm:
    LDA old_right
    CMP #$01
    BEQ right_fast
    LDA #FIRST_DELAY
    STA right_timer
    LDA #$01
    STA old_right
    RTS
right_fast:
    LDA #REPEAT_RATE
    STA right_timer
    RTS



left_arrow_check:
    LDA $D027
    CMP #$01
    BEQ left_held
    LDA #$00
    STA left_timer
    STA old_left
    RTS
left_held:
    LDA left_timer
    BEQ left_move
    DEC left_timer
    RTS
left_move:
    LDA boxX
    CMP #$01
    BCC left_arm
    DEC boxX
left_arm:
    LDA old_left
    CMP #$01
    BEQ left_fast
    LDA #FIRST_DELAY
    STA left_timer
    LDA #$01
    STA old_left
    RTS
left_fast:
    LDA #REPEAT_RATE
    STA left_timer
    RTS


down_arrow_check:
    LDA $D026
    CMP #$01
    BNE not_down
    LDA $12
    SEC
    SBC #$14
    STA $12
    RTS
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
    CMP #$3D
    BCS fall
    DEC $12
    RTS

fall:
    LDA #$19
    CMP #$13
    BCS box_stop
    ;check if there's a block under it, if so say so, if not continue
    INC $11
    LDA #$3C
    STA $12
    RTS

box_stop:
    LDA #$01
    STA $20

; clear row
row_check:
    LDA board,X
    CMP #$01
    BNE not_ones
    INX
    CPX #$0A
    BNE row_check
    ;clear row
    RTS
not_ones:
    RTS


; drawing
draw_box_check:
    LDA board,X
    CMP #$01
    BCC next
    CPX #$0A
    BCC yIsZero
    CPX #$14
    BCC yIsOne
    CPX #$1E
    BCC yIsTwo
    CPX #$28
    BCC yIsThree
    CPX #$32
    BCC yIsFour
    CPX #$3C
    BCC yIsFive
    CPX #$46
    BCC yIsSix
    CPX #$50
    BCC yIsSeven
    CPX #$5A
    BCC yIsEight
    CPX #$64
    BCC yIsNine
    CPX #$6E
    BCC yIsTen
    CPX #$78
    BCC yIsEleven
    CPX #$82
    BCC yIsTwelve
    CPX #$8C
    BCC yIsThirteen
    CPX #$96
    BCC yIsFourteen
    CPX #$A0
    BCC yIsFifteen
    CPX #$AA
    BCC yIsSixteen
    CPX #$B4
    BCC yIsSeventeen
    CPX #$BE
    BCC yIsEightteen
    CPX #$C8
    BCC yIsNineteen
    JMP next
    
    ; use x to make coridinates on the 10x20 screen for x/$13

next:
    INX
    CPX #$C8
    BNE draw_box_check
    RTS

yIsZero:
    LDA #$00
    STA $14
    JMP calcX
yIsOne:
    LDA #$01
    STA $14
    JMP calcX
yIsTwo:
    LDA #$02
    STA $14
    JMP calcX
yIsThree:
    LDA #$03
    STA $14
    JMP calcX
yIsFour:
    LDA #$04
    STA $14
    JMP calcX
yIsFive:
    LDA #$05
    STA $14
    JMP calcX
yIsSix:
    LDA #$06
    STA $14
    JMP calcX
yIsSeven:
    LDA #$07
    STA $14
    JMP calcX
yIsEight:
    LDA #$08
    STA $14
    JMP calcX
yIsNine:
    LDA #$09
    STA $14
    JMP calcX
yIsTen:
    LDA #$0A
    STA $14
    JMP calcX
yIsEleven:
    LDA #$0B
    STA $14
    JMP calcX
yIsTwelve:
    LDA #$0C
    STA $14
    JMP calcX
yIsThirteen:
    LDA #$0D
    STA $14
    JMP calcX
yIsFourteen:
    LDA #$0E
    STA $14
    JMP calcX
yIsFifteen:
    LDA #$0F
    STA $14
    JMP calcX
yIsSixteen:
    LDA #$10
    STA $14
    JMP calcX
yIsSeventeen:
    LDA #$11
    STA $14
    JMP calcX
yIsEightteen:
    LDA #$12
    STA $14
    JMP calcX
yIsNineteen:
    LDA #$13
    STA $14
    JMP calcX

calcX:
    LDA $14
    CLC
    ADC $14
    CLC
    ADC $14
    CLC
    ADC $14
    CLC
    ADC $14
    CLC
    ADC $14
    CLC
    ADC $14
    CLC
    ADC $14
    CLC
    ADC $14
    STA $21
    TXA
    SEC
    SBC $21
    STA $13
    JSR draw_box
    JMP next

draw_box:
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
