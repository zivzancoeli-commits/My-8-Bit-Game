/**
 * 6502-subset interpreter over a 64KB memory image + MMIO hooks.
 */
(function (global) {
  function createCPU(options) {
    const mem = options.memory; // Uint8Array(65536)
    const readHook = options.readHook || null;  // (addr) => number|null
    const writeHook = options.writeHook || null; // (addr, val) => bool consumed

    let a = 0, x = 0, y = 0, sp = 0xfd, pc = options.entry || 0x0200;
    let cf = 0, zf = 0, nf = 0, vf = 0; // carry, zero, negative, overflow
    let halted = false;
    let cycles = 0;

    function setZN(v) {
      v &= 0xff;
      zf = v === 0 ? 1 : 0;
      nf = v & 0x80 ? 1 : 0;
      return v;
    }

    function read8(addr) {
      addr &= 0xffff;
      if (readHook) {
        const h = readHook(addr);
        if (h != null) return h & 0xff;
      }
      return mem[addr];
    }

    function write8(addr, val) {
      addr &= 0xffff;
      val &= 0xff;
      if (writeHook && writeHook(addr, val)) return;
      // Don't let programs clobber ROM-ish high MMIO reads; still allow RAM
      if (addr >= 0xd010 && addr <= 0xd011) return; // width/height RO
      if (addr >= 0xd020 && addr <= 0xd032) return; // input RO
      mem[addr] = val;
    }

    function read16(addr) {
      const lo = read8(addr);
      const hi = read8((addr + 1) & 0xffff);
      return lo | (hi << 8);
    }

    // 6502 bug-compatible JMP indirect on page wrap
    function read16Bug(addr) {
      const lo = read8(addr);
      const hi = read8((addr & 0xff00) | ((addr + 1) & 0xff));
      return lo | (hi << 8);
    }

    function push(val) {
      write8(0x0100 | (sp & 0xff), val);
      sp = (sp - 1) & 0xff;
    }

    function pull() {
      sp = (sp + 1) & 0xff;
      return read8(0x0100 | sp);
    }

    function imm() {
      const v = read8(pc);
      pc = (pc + 1) & 0xffff;
      return v;
    }

    function zpg() { return imm(); }
    function zpx() { return (imm() + x) & 0xff; }
    function zpy() { return (imm() + y) & 0xff; }

    function abs() {
      const a = read16(pc);
      pc = (pc + 2) & 0xffff;
      return a;
    }
    function abx() { return (abs() + x) & 0xffff; }
    function aby() { return (abs() + y) & 0xffff; }

    // Indirect indexed: pointer in zero page (lo, hi), then + Y
    function izy() {
      const zp = imm();
      const base = read8(zp) | (read8((zp + 1) & 0xff) << 8);
      return (base + y) & 0xffff;
    }

    function rel() {
      let off = imm();
      if (off & 0x80) off -= 256;
      return (pc + off) & 0xffff;
    }

    function branch(cond) {
      const tgt = rel();
      if (cond) pc = tgt;
    }

    function adc(val) {
      const sum = a + val + cf;
      vf = (~(a ^ val) & (a ^ sum) & 0x80) ? 1 : 0;
      cf = sum > 0xff ? 1 : 0;
      a = setZN(sum & 0xff);
    }

    function sbc(val) {
      adc((val ^ 0xff) & 0xff);
    }

    function cmp(reg, val) {
      const r = (reg - val) & 0x1ff;
      cf = reg >= val ? 1 : 0;
      setZN(r & 0xff);
    }

    function step() {
      if (halted) return false;
      const op = read8(pc);
      pc = (pc + 1) & 0xffff;
      cycles++;

      switch (op) {
        // BRK
        case 0x00:
          halted = true;
          return false;

        // ORA
        case 0x09: a = setZN(a | imm()); break;
        case 0x05: a = setZN(a | read8(zpg())); break;
        case 0x15: a = setZN(a | read8(zpx())); break;
        case 0x0d: a = setZN(a | read8(abs())); break;
        case 0x1d: a = setZN(a | read8(abx())); break;
        case 0x19: a = setZN(a | read8(aby())); break;
        case 0x11: a = setZN(a | read8(izy())); break; // ORA (zp),Y

        // AND
        case 0x29: a = setZN(a & imm()); break;
        case 0x25: a = setZN(a & read8(zpg())); break;
        case 0x35: a = setZN(a & read8(zpx())); break;
        case 0x2d: a = setZN(a & read8(abs())); break;
        case 0x3d: a = setZN(a & read8(abx())); break;
        case 0x39: a = setZN(a & read8(aby())); break;
        case 0x31: a = setZN(a & read8(izy())); break; // AND (zp),Y

        // EOR
        case 0x49: a = setZN(a ^ imm()); break;
        case 0x45: a = setZN(a ^ read8(zpg())); break;
        case 0x55: a = setZN(a ^ read8(zpx())); break;
        case 0x4d: a = setZN(a ^ read8(abs())); break;
        case 0x5d: a = setZN(a ^ read8(abx())); break;
        case 0x59: a = setZN(a ^ read8(aby())); break;
        case 0x51: a = setZN(a ^ read8(izy())); break; // EOR (zp),Y

        // ADC
        case 0x69: adc(imm()); break;
        case 0x65: adc(read8(zpg())); break;
        case 0x75: adc(read8(zpx())); break;
        case 0x6d: adc(read8(abs())); break;
        case 0x7d: adc(read8(abx())); break;
        case 0x79: adc(read8(aby())); break;
        case 0x71: adc(read8(izy())); break; // ADC (zp),Y

        // SBC
        case 0xe9: sbc(imm()); break;
        case 0xe5: sbc(read8(zpg())); break;
        case 0xf5: sbc(read8(zpx())); break;
        case 0xed: sbc(read8(abs())); break;
        case 0xfd: sbc(read8(abx())); break;
        case 0xf9: sbc(read8(aby())); break;
        case 0xf1: sbc(read8(izy())); break; // SBC (zp),Y

        // LDA
        case 0xa9: a = setZN(imm()); break;
        case 0xa5: a = setZN(read8(zpg())); break;
        case 0xb5: a = setZN(read8(zpx())); break;
        case 0xad: a = setZN(read8(abs())); break;
        case 0xbd: a = setZN(read8(abx())); break;
        case 0xb9: a = setZN(read8(aby())); break;
        case 0xb1: a = setZN(read8(izy())); break; // LDA (zp),Y

        // LDX
        case 0xa2: x = setZN(imm()); break;
        case 0xa6: x = setZN(read8(zpg())); break;
        case 0xb6: x = setZN(read8(zpy())); break;
        case 0xae: x = setZN(read8(abs())); break;
        case 0xbe: x = setZN(read8(aby())); break;

        // LDY
        case 0xa0: y = setZN(imm()); break;
        case 0xa4: y = setZN(read8(zpg())); break;
        case 0xb4: y = setZN(read8(zpx())); break;
        case 0xac: y = setZN(read8(abs())); break;
        case 0xbc: y = setZN(read8(abx())); break;

        // STA
        case 0x85: write8(zpg(), a); break;
        case 0x95: write8(zpx(), a); break;
        case 0x8d: write8(abs(), a); break;
        case 0x9d: write8(abx(), a); break;
        case 0x99: write8(aby(), a); break;
        case 0x91: write8(izy(), a); break; // STA (zp),Y

        // STX
        case 0x86: write8(zpg(), x); break;
        case 0x96: write8(zpy(), x); break;
        case 0x8e: write8(abs(), x); break;

        // STY
        case 0x84: write8(zpg(), y); break;
        case 0x94: write8(zpx(), y); break;
        case 0x8c: write8(abs(), y); break;

        // Transfers
        case 0xaa: x = setZN(a); break; // TAX
        case 0xa8: y = setZN(a); break; // TAY
        case 0x8a: a = setZN(x); break; // TXA
        case 0x98: a = setZN(y); break; // TYA

        // INC / DEC mem
        case 0xe6: { const ad = zpg(); const v = setZN(read8(ad) + 1); write8(ad, v); break; }
        case 0xf6: { const ad = zpx(); const v = setZN(read8(ad) + 1); write8(ad, v); break; }
        case 0xee: { const ad = abs(); const v = setZN(read8(ad) + 1); write8(ad, v); break; }
        case 0xfe: { const ad = abx(); const v = setZN(read8(ad) + 1); write8(ad, v); break; }
        case 0xc6: { const ad = zpg(); const v = setZN(read8(ad) - 1); write8(ad, v); break; }
        case 0xd6: { const ad = zpx(); const v = setZN(read8(ad) - 1); write8(ad, v); break; }
        case 0xce: { const ad = abs(); const v = setZN(read8(ad) - 1); write8(ad, v); break; }
        case 0xde: { const ad = abx(); const v = setZN(read8(ad) - 1); write8(ad, v); break; }

        case 0xe8: x = setZN(x + 1); break; // INX
        case 0xca: x = setZN(x - 1); break; // DEX
        case 0xc8: y = setZN(y + 1); break; // INY
        case 0x88: y = setZN(y - 1); break; // DEY

        // ASL
        case 0x0a: { cf = a & 0x80 ? 1 : 0; a = setZN((a << 1) & 0xff); break; }
        case 0x06: { const ad = zpg(); let v = read8(ad); cf = v & 0x80 ? 1 : 0; v = setZN((v << 1) & 0xff); write8(ad, v); break; }
        case 0x16: { const ad = zpx(); let v = read8(ad); cf = v & 0x80 ? 1 : 0; v = setZN((v << 1) & 0xff); write8(ad, v); break; }
        case 0x0e: { const ad = abs(); let v = read8(ad); cf = v & 0x80 ? 1 : 0; v = setZN((v << 1) & 0xff); write8(ad, v); break; }
        case 0x1e: { const ad = abx(); let v = read8(ad); cf = v & 0x80 ? 1 : 0; v = setZN((v << 1) & 0xff); write8(ad, v); break; }

        // LSR
        case 0x4a: { cf = a & 1; a = setZN(a >> 1); break; }
        case 0x46: { const ad = zpg(); let v = read8(ad); cf = v & 1; v = setZN(v >> 1); write8(ad, v); break; }
        case 0x56: { const ad = zpx(); let v = read8(ad); cf = v & 1; v = setZN(v >> 1); write8(ad, v); break; }
        case 0x4e: { const ad = abs(); let v = read8(ad); cf = v & 1; v = setZN(v >> 1); write8(ad, v); break; }
        case 0x5e: { const ad = abx(); let v = read8(ad); cf = v & 1; v = setZN(v >> 1); write8(ad, v); break; }

        // ROL
        case 0x2a: { const c = cf; cf = a & 0x80 ? 1 : 0; a = setZN(((a << 1) | c) & 0xff); break; }
        case 0x26: { const ad = zpg(); let v = read8(ad); const c = cf; cf = v & 0x80 ? 1 : 0; v = setZN(((v << 1) | c) & 0xff); write8(ad, v); break; }
        case 0x36: { const ad = zpx(); let v = read8(ad); const c = cf; cf = v & 0x80 ? 1 : 0; v = setZN(((v << 1) | c) & 0xff); write8(ad, v); break; }
        case 0x2e: { const ad = abs(); let v = read8(ad); const c = cf; cf = v & 0x80 ? 1 : 0; v = setZN(((v << 1) | c) & 0xff); write8(ad, v); break; }
        case 0x3e: { const ad = abx(); let v = read8(ad); const c = cf; cf = v & 0x80 ? 1 : 0; v = setZN(((v << 1) | c) & 0xff); write8(ad, v); break; }

        // ROR
        case 0x6a: { const c = cf; cf = a & 1; a = setZN((a >> 1) | (c << 7)); break; }
        case 0x66: { const ad = zpg(); let v = read8(ad); const c = cf; cf = v & 1; v = setZN((v >> 1) | (c << 7)); write8(ad, v); break; }
        case 0x76: { const ad = zpx(); let v = read8(ad); const c = cf; cf = v & 1; v = setZN((v >> 1) | (c << 7)); write8(ad, v); break; }
        case 0x6e: { const ad = abs(); let v = read8(ad); const c = cf; cf = v & 1; v = setZN((v >> 1) | (c << 7)); write8(ad, v); break; }
        case 0x7e: { const ad = abx(); let v = read8(ad); const c = cf; cf = v & 1; v = setZN((v >> 1) | (c << 7)); write8(ad, v); break; }

        // CMP / CPX / CPY
        case 0xc9: cmp(a, imm()); break;
        case 0xc5: cmp(a, read8(zpg())); break;
        case 0xd5: cmp(a, read8(zpx())); break;
        case 0xcd: cmp(a, read8(abs())); break;
        case 0xdd: cmp(a, read8(abx())); break;
        case 0xd9: cmp(a, read8(aby())); break;
        case 0xd1: cmp(a, read8(izy())); break; // CMP (zp),Y
        case 0xe0: cmp(x, imm()); break;
        case 0xe4: cmp(x, read8(zpg())); break;
        case 0xec: cmp(x, read8(abs())); break;
        case 0xc0: cmp(y, imm()); break;
        case 0xc4: cmp(y, read8(zpg())); break;
        case 0xcc: cmp(y, read8(abs())); break;

        // Branches
        case 0xf0: branch(zf === 1); break; // BEQ
        case 0xd0: branch(zf === 0); break; // BNE
        case 0x90: branch(cf === 0); break; // BCC
        case 0xb0: branch(cf === 1); break; // BCS
        case 0x30: branch(nf === 1); break; // BMI
        case 0x10: branch(nf === 0); break; // BPL

        // JMP / JSR / RTS
        case 0x4c: pc = abs(); break;
        case 0x6c: { const ind = abs(); pc = read16Bug(ind); break; }
        case 0x20: {
          const tgt = abs();
          const ret = (pc - 1) & 0xffff;
          push((ret >> 8) & 0xff);
          push(ret & 0xff);
          pc = tgt;
          break;
        }
        case 0x60: {
          const lo = pull();
          const hi = pull();
          pc = ((lo | (hi << 8)) + 1) & 0xffff;
          break;
        }

        // Flags
        case 0x18: cf = 0; break; // CLC
        case 0x38: cf = 1; break; // SEC
        case 0xb8: vf = 0; break; // CLV

        case 0xea: break; // NOP

        default:
          halted = true;
          throw new Error("Illegal opcode $" + op.toString(16).padStart(2, "0") + " at $" + ((pc - 1) & 0xffff).toString(16).padStart(4, "0"));
      }
      return !halted;
    }

    /** Run until vsync hook fires or maxIns instructions (safety). */
    function runUntil(shouldStop, maxIns) {
      const limit = maxIns || 200000;
      for (let i = 0; i < limit; i++) {
        if (halted) return "halt";
        if (shouldStop && shouldStop()) return "vsync";
        try {
          if (!step()) return "halt";
        } catch (e) {
          halted = true;
          throw e;
        }
      }
      return "limit";
    }

    function reset(entry) {
      a = 0; x = 0; y = 0; sp = 0xfd;
      pc = entry & 0xffff;
      cf = 0; zf = 0; nf = 0; vf = 0;
      halted = false;
      cycles = 0;
    }

    function getState() {
      return {
        a, x, y, sp, pc, cf, zf, nf, vf, halted, cycles,
        flags: `N${nf} V${vf} Z${zf} C${cf}`,
      };
    }

    return { step, runUntil, reset, getState, get halted() { return halted; } };
  }

  global.AsmCPU = { createCPU };
})(window);
