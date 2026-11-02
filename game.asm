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
score_lo = $22
score_hi = $23
piece_i = $1A
row_start = $1B      ; clear_lines: board index of the row being checked

board = $1800        ; 200 bytes $1800-$18C7 (was $0300, which overlapped the code)

FIRST_DELAY = $0C
REPEAT_RATE = $04



*= $0200            ; program starts here

start:
    LDA #$01
    STA piece_i
    STA boxX
    STA boxHeight
    LDA #$00
    STA $22
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
    JSR draw_score


    LDX piece_i
    LDA #$01
    STA board,X
    LDX #$00
    JSR draw_box_check
    LDX piece_i
    LDA #$00
    STA board,X


    STA $D040         ; frame done runner shows it waits about 1/60 s
    JMP main_loop     ; do it all again forever


;drawing score
draw_score:
    ;draw score here
    RTS

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
    LDA piece_i
    STA $21
right_mod:
    LDA $21
    CMP #$0A
    BCC right_have_x
    SEC
    SBC #$0A
    STA $21
    JMP right_mod
right_have_x:
    LDA $21
    CMP #$09
    BCS right_arm
    INC piece_i
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
    LDA piece_i
    STA $21
left_mod:
    LDA $21
    CMP #$0A
    BCC left_have_x
    SEC
    SBC #$0A
    STA $21
    JMP left_mod
left_have_x:
    LDA $21
    CMP #$00
    BEQ left_arm
    DEC piece_i
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
    LDA piece_i
    CMP #$BE
    BCS box_stop
    CLC
    ADC #$0A
    TAX
    CPX #$C8
    BCS box_stop
    LDA board,X
    CMP #$01
    BCS box_stop
    TXA
    STA piece_i
    LDA #$3C
    STA fallTimer
    RTS

box_stop:
    LDX piece_i
    LDA #$01
    STA board,X
    JSR clear_lines   ; remove any full rows before the next piece spawns
    LDA #$04
    STA piece_i
    LDA #$3C
    STA fallTimer
    RTS

; clear full rows
; Checks rows from the bottom (index $BE = 190) up to the top (index 0).
; Full row  -> copy every row above it down by 10, empty row 0, check SAME row again
;              (a new row just slid into it).
; Not full  -> move up one row (row_start - 10). Past the top -> done.
clear_lines:
    LDA #$BE
    STA row_start          ; start at the bottom row
cl_row:
    LDX row_start          ; X = first cell of this row
    LDY #$00               ; Y = how many cells checked (0..9)
cl_cell:
    LDA board,X
    CMP #$01               ; empty (0)? carry clear
    BCC cl_not_full        ; one empty cell = row not full
    INX
    INY
    CPY #$0A               ; checked all 10?
    BNE cl_cell

    ; --- row is full: shift everything above down by 10 ---
    ; for X = row_start+9 down to 10:  board[X] = board[X-10]
    CLC
    LDA score_lo
    ADC #$64
    STA score_lo
    LDA score_hi
    ADC #$00
    STA score_hi
    LDA row_start
    CLC
    ADC #$09
    TAX                    ; X = last cell of the full row
cl_shift:
    CPX #$0A               ; X < 10? we're in row 0 now
    BCC cl_zero_top
    TXA
    SEC
    SBC #$0A
    TAY                    ; Y = the cell one row above X
    LDA board,Y
    STA board,X            ; copy it down
    DEX
    JMP cl_shift
cl_zero_top:
    LDX #$00
    LDA #$00
cl_zero_loop:
    STA board,X            ; row 0 becomes empty
    INX
    CPX #$0A
    BNE cl_zero_loop
    JMP cl_row             ; re-check the same row_start

cl_not_full:
    LDA row_start
    SEC
    SBC #$0A               ; one row up
    BCC cl_done            ; went below 0 (borrow) -> checked every row
    STA row_start
    JMP cl_row
cl_done:
    RTS


; drawing
draw_box_check:
    LDA board,X
    CMP #$01
    BCC next
    ; --- turn board index X (0..199) into grid y (row) and x (column) ---
    ; y = how many times we can subtract 10 ($0A); x = what's left over.
    ; X itself is NOT changed here (draw_box doesn't touch X either),
    ; so the loop below can keep counting with INX.
    LDA #$00
    STA drawY         ; y = 0
    TXA               ; A = copy of the index
calc_row:
    CMP #$0A          ; A < 10?  (carry clear = yes)
    BCC have_row      ; then A is the column and drawY is the row
    SEC               ; set carry before SBC (normal subtract)
    SBC #$0A          ; A = A - 10
    INC drawY         ; one more full row
    JMP calc_row
have_row:
    STA drawX         ; x = remainder (0..9)
    JSR draw_box
    JMP next

next:
    INX
    CPX #$C8
    BNE draw_box_check
    RTS

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
