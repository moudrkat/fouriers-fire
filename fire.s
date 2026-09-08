# FIRE.COM -- the heat equation for a 486, in real mode, straight into video memory.
#
#   dT/dt = D d2T/dx2  -  v dT/dy  -  kT        (Fourier 1822, with an updraft and a loss)
#
# The screen IS the temperature field: 320 x 200 bytes at A000:0000, one byte per
# cell, and the palette turns a temperature into a colour. There is no second
# buffer. The equation is solved in place, bottom to top, so a cell reads the
# row below it before that row is overwritten. That trick is the whole program.
#
# Build:  as --32 fire.s -o fire.o && ld -m elf_i386 -Ttext=0x100 --oformat binary fire.o -o FIRE.COM
# Run:    DOSBox, or any DOS. ESC quits.

        .code16
        .intel_syntax noprefix
        .text
        .globl _start
_start:
        mov     al, 0x13                # mode 13h: 320x200, 256 colours, one byte per pixel
        int     0x10
        push    0xa000                  # es -> the screen, i.e. the temperature field T(x,y)
        pop     es

# --- the palette: T -> colour.  black -> red (T=31) -> yellow (T=63) -> white (T=159).  6-bit DAC, 0..63
        mov     dx, 0x3c8               # "start at colour 0"
        xor     al, al
        out     dx, al
        inc     dx                      # 3c9h takes r, g, b, r, g, b, ...
        xor     cx, cx                  # cl = colour index 0..255
pal:    mov     al, cl                  # red   = min(2T, 62)
        cmp     al, 31
        jbe     1f
        mov     al, 31
1:      add     al, al
        out     dx, al
        mov     al, cl                  # green = clamp(2(T - 32), 0, 62)
        sub     al, 32
        jnc     2f
        xor     al, al
2:      cmp     al, 31
        jbe     3f
        mov     al, 31
3:      add     al, al
        out     dx, al
        mov     al, cl                  # blue  = clamp(T - 96, 0, 63)
        sub     al, 96
        jnc     4f
        xor     al, al
4:      cmp     al, 63
        jbe     5f
        mov     al, 63
5:      out     dx, al
        inc     cl
        jnz     pal

# --- one frame
frame:
# boundary condition: the bottom two rows are embers, each cell hot or cold at random.
# Two rows, because every cell averages the two rows below it.
# The random number is a 16-bit linear congruential generator living in bp.
        mov     di, 198*320
        mov     cx, 640
ember:  imul    bp, bp, 25173
        add     bp, 13849
        mov     ax, bp
        mov     al, ah                  # take the good bits
        cmp     al, 128                 # hot with probability 128/256. This byte is the ember density.
        sbb     al, al                  # borrow -> 255, no borrow -> 0
        stosb
        loop    ember

# the equation, one cell at a time, for every cell from row 1 down to row 197.
# T(x, y-1)  <-  ( T(x-1,y) + T(x+1,y) + T(x,y+1) + T(x,y+2) ) / 4  -  loss
#   the two side neighbours   = diffusion, D d2T/dx2
#   reading below, writing above = the updraft, v dT/dy, at one row per frame
#   the subtraction           = the loss, kT, here a constant so it fits in one instruction
        mov     di, 320
cell:   xor     ax, ax
        mov     al, es:[di-1]
        mov     bl, es:[di+1]
        xor     bh, bh
        add     ax, bx
        mov     bl, es:[di+320]
        add     ax, bx
        mov     bl, es:[di+640]
        add     ax, bx
        shr     ax, 2                   # the average
        sub     al, 1                   # the loss. This byte is the flame height: about (mean source)/loss rows.
        jnc     6f
        xor     al, al                  # temperature does not go below zero
6:      mov     es:[di-320], al         # written one row UP: that is the updraft
        inc     di
        cmp     di, 198*320
        jb      cell

        in      al, 0x60                # keyboard: scancode 1 is ESC
        dec     al
        jnz     frame

        mov     ax, 0x0003              # text mode back, and return to DOS
        int     0x10
        ret
