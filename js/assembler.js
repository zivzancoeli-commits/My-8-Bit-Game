/**
 * Minimal 6502-like assembler → real-ish opcodes into a 64KB image.
 * Supports labels, #immediate, $hex, decimal, %binary, zpg/abs, ,X ,Y, A for shifts.
 */
(function (global) {
  // Opcode table: mnemonic + mode → opcode byte
  // Modes: imp, acc, imm, zpg, zpx, zpy, abs, abx, aby, izy ((zp),Y), ind (jmp only), rel
  const OP = {
    // Loads
    "LDA_imm": 0xa9, "LDA_zpg": 0xa5, "LDA_zpx": 0xb5, "LDA_abs": 0xad, "LDA_abx": 0xbd, "LDA_aby": 0xb9,
    "LDX_imm": 0xa2, "LDX_zpg": 0xa6, "LDX_zpy": 0xb6, "LDX_abs": 0xae, "LDX_aby": 0xbe,
    "LDY_imm": 0xa0, "LDY_zpg": 0xa4, "LDY_zpx": 0xb4, "LDY_abs": 0xac, "LDY_abx": 0xbc,
    // Stores
    "STA_zpg": 0x85, "STA_zpx": 0x95, "STA_abs": 0x8d, "STA_abx": 0x9d, "STA_aby": 0x99,
    "STX_zpg": 0x86, "STX_zpy": 0x96, "STX_abs": 0x8e,
    "STY_zpg": 0x84, "STY_zpx": 0x94, "STY_abs": 0x8c,
    // Transfers
    "TAX_imp": 0xaa, "TAY_imp": 0xa8, "TXA_imp": 0x8a, "TYA_imp": 0x98,
    // Math
    "ADC_imm": 0x69, "ADC_zpg": 0x65, "ADC_zpx": 0x75, "ADC_abs": 0x6d, "ADC_abx": 0x7d, "ADC_aby": 0x79,
    "SBC_imm": 0xe9, "SBC_zpg": 0xe5, "SBC_zpx": 0xf5, "SBC_abs": 0xed, "SBC_abx": 0xfd, "SBC_aby": 0xf9,
    "INC_zpg": 0xe6, "INC_zpx": 0xf6, "INC_abs": 0xee, "INC_abx": 0xfe,
    "DEC_zpg": 0xc6, "DEC_zpx": 0xd6, "DEC_abs": 0xce, "DEC_abx": 0xde,
    "INX_imp": 0xe8, "DEX_imp": 0xca, "INY_imp": 0xc8, "DEY_imp": 0x88,
    // Bitwise
    "AND_imm": 0x29, "AND_zpg": 0x25, "AND_zpx": 0x35, "AND_abs": 0x2d, "AND_abx": 0x3d, "AND_aby": 0x39,
    "ORA_imm": 0x09, "ORA_zpg": 0x05, "ORA_zpx": 0x15, "ORA_abs": 0x0d, "ORA_abx": 0x1d, "ORA_aby": 0x19,
    "EOR_imm": 0x49, "EOR_zpg": 0x45, "EOR_zpx": 0x55, "EOR_abs": 0x4d, "EOR_abx": 0x5d, "EOR_aby": 0x59,
    // Shifts
    "ASL_acc": 0x0a, "ASL_zpg": 0x06, "ASL_zpx": 0x16, "ASL_abs": 0x0e, "ASL_abx": 0x1e,
    "LSR_acc": 0x4a, "LSR_zpg": 0x46, "LSR_zpx": 0x56, "LSR_abs": 0x4e, "LSR_abx": 0x5e,
    "ROL_acc": 0x2a, "ROL_zpg": 0x26, "ROL_zpx": 0x36, "ROL_abs": 0x2e, "ROL_abx": 0x3e,
    "ROR_acc": 0x6a, "ROR_zpg": 0x66, "ROR_zpx": 0x76, "ROR_abs": 0x6e, "ROR_abx": 0x7e,
    // Compare
    "CMP_imm": 0xc9, "CMP_zpg": 0xc5, "CMP_zpx": 0xd5, "CMP_abs": 0xcd, "CMP_abx": 0xdd, "CMP_aby": 0xd9,
    "CPX_imm": 0xe0, "CPX_zpg": 0xe4, "CPX_abs": 0xec,
    "CPY_imm": 0xc0, "CPY_zpg": 0xc4, "CPY_abs": 0xcc,
    // Branches (relative)
    "BEQ_rel": 0xf0, "BNE_rel": 0xd0, "BCC_rel": 0x90, "BCS_rel": 0xb0, "BMI_rel": 0x30, "BPL_rel": 0x10,
    // Jumps
    "JMP_abs": 0x4c, "JMP_ind": 0x6c, "JSR_abs": 0x20, "RTS_imp": 0x60,
    // Flags / misc
    "CLC_imp": 0x18, "SEC_imp": 0x38, "CLV_imp": 0xb8,
    "NOP_imp": 0xea, "BRK_imp": 0x00,
    // Indirect indexed (zp),Y — classic way to walk the framebuffer
    "LDA_izy": 0xb1, "STA_izy": 0x91,
    "ADC_izy": 0x71, "SBC_izy": 0xf1,
    "AND_izy": 0x31, "ORA_izy": 0x11, "EOR_izy": 0x51,
    "CMP_izy": 0xd1,
  };

  const BRANCHES = new Set(["BEQ", "BNE", "BCC", "BCS", "BMI", "BPL"]);
  const IMPLIED = new Set([
    "TAX", "TAY", "TXA", "TYA", "INX", "DEX", "INY", "DEY",
    "CLC", "SEC", "CLV", "NOP", "BRK", "RTS",
  ]);
  const ACC_OK = new Set(["ASL", "LSR", "ROL", "ROR"]);

  const ORIGIN = 0x0200; // program start in RAM

  function stripComment(line) {
    const i = line.indexOf(";");
    return i >= 0 ? line.slice(0, i) : line;
  }

  function parseNumber(tok) {
    if (tok == null) throw new Error("Expected number");
    let s = tok.trim();
    if (s.startsWith("#")) s = s.slice(1);
    if (s.startsWith("$")) return parseInt(s.slice(1), 16);
    if (s.startsWith("%")) return parseInt(s.slice(1), 2);
    if (/^[0-9]+$/.test(s)) return parseInt(s, 10);
    return null; // label
  }

  function isImmediate(tok) {
    return tok && tok.trim().startsWith("#");
  }

  function splitArgs(rest) {
    return rest.trim() ? rest.trim() : "";
  }

  /**
   * First pass: collect labels and constants.
   * Second pass: emit bytes.
   */
  function assemble(source) {
    const lines = source.split(/\r?\n/);
    const labels = Object.create(null);
    const constants = Object.create(null);
    const errors = [];

    // Preprocess: handle label = value / .equ / .org
    let org = ORIGIN;
    const cooked = [];

    for (let li = 0; li < lines.length; li++) {
      const raw = lines[li];
      let line = stripComment(raw).trim();
      if (!line) continue;

      // label = value  OR  name .equ value
      let m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
      if (m) {
        const v = parseNumber(m[2].trim());
        if (v == null) errors.push(`Line ${li + 1}: bad constant ${m[2]}`);
        else constants[m[1]] = v & 0xffff;
        continue;
      }
      m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+\.equ\s+(.+)$/i);
      if (m) {
        const v = parseNumber(m[2].trim());
        if (v == null) errors.push(`Line ${li + 1}: bad .equ ${m[2]}`);
        else constants[m[1]] = v & 0xffff;
        continue;
      }
      m = line.match(/^\.org\s+(.+)$/i);
      if (m) {
        const v = parseNumber(m[1].trim());
        if (v == null) errors.push(`Line ${li + 1}: bad .org`);
        else org = v & 0xffff;
        continue;
      }
      // 64tass-style program counter set (same as .org)
      m = line.match(/^\*=\s*(.+)$/);
      if (m) {
        const v = parseNumber(m[1].trim());
        if (v == null) errors.push(`Line ${li + 1}: bad *=`);
        else org = v & 0xffff;
        continue;
      }
      m = line.match(/^\.db\s+(.+)$/i);
      if (m) {
        cooked.push({ li: li + 1, kind: "db", args: m[1], label: null });
        continue;
      }

      // Leading labels: foo:  or  foo: LDA ...
      let label = null;
      m = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
      if (m) {
        label = m[1];
        line = m[2].trim();
      }

      if (!line) {
        cooked.push({ li: li + 1, kind: "labelonly", label });
        continue;
      }

      const parts = line.match(/^([A-Za-z.]+)\s*(.*)$/);
      if (!parts) {
        errors.push(`Line ${li + 1}: cannot parse "${raw.trim()}"`);
        continue;
      }
      cooked.push({
        li: li + 1,
        kind: "op",
        mnemonic: parts[1].toUpperCase(),
        args: parts[2].trim(),
        label,
      });
    }

    function resolveToken(tok, lineNo) {
      if (tok == null || tok === "") throw new Error(`Line ${lineNo}: missing operand`);
      let t = tok.trim();
      // strip trailing ,X or ,Y for value parse — caller handles index
      const imm = t.startsWith("#");
      if (imm) t = t.slice(1).trim();

      let indexed = null;
      const ix = t.match(/^(.*),\s*([XxYy])$/);
      if (ix) {
        t = ix[1].trim();
        indexed = ix[2].toUpperCase();
      }

      let val = parseNumber(t);
      if (val == null) {
        if (Object.prototype.hasOwnProperty.call(constants, t)) val = constants[t];
        else if (Object.prototype.hasOwnProperty.call(labels, t)) val = labels[t];
        else return { unresolved: t, imm, indexed };
      }
      return { value: val & 0xffff, imm, indexed };
    }

    function sizeOf(item) {
      if (item.kind === "labelonly") return 0;
      if (item.kind === "db") {
        return item.args.split(",").map((s) => s.trim()).filter(Boolean).length;
      }
      const mnem = item.mnemonic;
      if (mnem === ".DB") {
        return item.args.split(",").map((s) => s.trim()).filter(Boolean).length;
      }
      if (IMPLIED.has(mnem)) return 1;
      if (BRANCHES.has(mnem)) return 2;

      const args = item.args;
      if (!args) {
        if (ACC_OK.has(mnem)) return 1; // ASL alone = accumulator
        return 1;
      }
      if (/^A$/i.test(args)) return 1;

      if (isImmediate(args)) return 2;

      // rough size: if known absolute >255 or label, use 3; else may be 2
      // First pass uses optimistic sizing with fixups — we do two address passes.
      return -1; // unknown yet
    }

    // Pass 1a: assign addresses with tentative sizes (assume abs=3 for unknowns)
    function resolveValueForSize(token) {
      let a = token.trim();
      let n = parseNumber(a);
      if (n != null) return n;
      if (Object.prototype.hasOwnProperty.call(constants, a)) return constants[a];
      if (Object.prototype.hasOwnProperty.call(labels, a)) return labels[a];
      return null;
    }

    function tentativeSize(item) {
      if (item.kind === "labelonly") return 0;
      if (item.kind === "db") {
        return item.args.split(",").map((s) => s.trim()).filter(Boolean).length;
      }
      const mnem = item.mnemonic;
      if (IMPLIED.has(mnem)) return 1;
      if (BRANCHES.has(mnem)) return 2;
      if (mnem === "JMP" || mnem === "JSR") return 3;
      const args = item.args;
      if (!args || /^A$/i.test(args)) {
        if (ACC_OK.has(mnem) || IMPLIED.has(mnem)) return 1;
      }
      if (isImmediate(args)) return 2;
      try {
        let a = args.trim();
        if (/^\(\s*[^)]+\s*\)\s*,\s*Y$/i.test(a)) return 2; // (zp),Y
        const ix = a.match(/^(.*),\s*([XxYy])$/);
        let indexed = null;
        if (ix) {
          a = ix[1].trim();
          indexed = ix[2].toUpperCase();
        }
        const n = resolveValueForSize(a);
        if (n != null && n <= 0xff) {
          if (!indexed && OP[mnem + "_zpg"] != null) return 2;
          if (indexed === "X" && OP[mnem + "_zpx"] != null) return 2;
          if (indexed === "Y" && OP[mnem + "_zpy"] != null) return 2;
        }
        if (n != null) {
          if (indexed === "X" && OP[mnem + "_abx"] != null) return 3;
          if (indexed === "Y" && OP[mnem + "_aby"] != null) return 3;
          if (!indexed && OP[mnem + "_abs"] != null) return 3;
        }
      } catch (_) { /* ignore */ }
      // Unknown forward label: assume absolute (3). Later rounds shrink if it lands in zpg.
      return 3;
    }

    // Iterate to stabilize label addresses (zpg vs abs can shrink)
    for (let round = 0; round < 4; round++) {
      let pc = org;
      for (const item of cooked) {
        if (item.label) labels[item.label] = pc;
        item.addr = pc;
        const sz = tentativeSize(item);
        item._sz = sz;
        pc = (pc + sz) & 0xffff;
      }
    }

    // Pass 2: emit
    const mem = new Uint8Array(0x10000);
    const emitAt = [];

    function emit(addr, bytes) {
      for (let i = 0; i < bytes.length; i++) {
        mem[(addr + i) & 0xffff] = bytes[i] & 0xff;
      }
    }

    function pickMode(mnem, imm, indexed, value, forceAbs) {
      if (imm) return { mode: "imm", size: 2 };
      if (ACC_OK.has(mnem) && value === undefined && !indexed) return { mode: "acc", size: 1 };

      if (indexed === "X") {
        if (!forceAbs && value != null && value <= 0xff && OP[mnem + "_zpx"] != null) {
          return { mode: "zpx", size: 2 };
        }
        return { mode: "abx", size: 3 };
      }
      if (indexed === "Y") {
        if (!forceAbs && value != null && value <= 0xff && OP[mnem + "_zpy"] != null) {
          return { mode: "zpy", size: 2 };
        }
        return { mode: "aby", size: 3 };
      }
      if (!forceAbs && value != null && value <= 0xff && OP[mnem + "_zpg"] != null) {
        return { mode: "zpg", size: 2 };
      }
      return { mode: "abs", size: 3 };
    }

    let end = org;
    for (const item of cooked) {
      const pc = item.addr;
      if (item.kind === "labelonly") continue;

      if (item.kind === "db") {
        const parts = item.args.split(",").map((s) => s.trim()).filter(Boolean);
        const bytes = [];
        for (const p of parts) {
          let v = parseNumber(p);
          if (v == null) {
            if (constants[p] != null) v = constants[p];
            else if (labels[p] != null) v = labels[p];
            else {
              errors.push(`Line ${item.li}: unknown .db value ${p}`);
              v = 0;
            }
          }
          bytes.push(v & 0xff);
        }
        emit(pc, bytes);
        end = Math.max(end, pc + bytes.length);
        continue;
      }

      const mnem = item.mnemonic;
      const args = item.args;

      if (IMPLIED.has(mnem)) {
        const op = OP[mnem + "_imp"];
        if (op == null) errors.push(`Line ${item.li}: unsupported ${mnem}`);
        else emit(pc, [op]);
        end = Math.max(end, pc + 1);
        continue;
      }

      if (BRANCHES.has(mnem)) {
        const op = OP[mnem + "_rel"];
        let target;
        const r = resolveToken("#" + args, item.li); // fake — branches aren't immediate
        // Actually branch arg is a label or address without #
        let t = args.trim();
        let val = parseNumber(t);
        if (val == null) {
          if (labels[t] != null) val = labels[t];
          else if (constants[t] != null) val = constants[t];
          else {
            errors.push(`Line ${item.li}: unknown branch target "${t}"`);
            val = (pc + 2) & 0xffff;
          }
        }
        target = val;
        const offset = (target - (pc + 2)) & 0xffff;
        let rel = offset;
        if (rel > 127 && rel < 0xff80) {
          errors.push(`Line ${item.li}: branch to ${t} out of range`);
          rel = 0;
        }
        rel &= 0xff;
        emit(pc, [op, rel]);
        end = Math.max(end, pc + 2);
        continue;
      }

      if (mnem === "JMP" || mnem === "JSR") {
        let t = args.trim();
        let indirect = false;
        if (t.startsWith("(") && t.endsWith(")")) {
          indirect = true;
          t = t.slice(1, -1).trim();
        }
        let val = parseNumber(t);
        if (val == null) {
          if (labels[t] != null) val = labels[t];
          else if (constants[t] != null) val = constants[t];
          else {
            errors.push(`Line ${item.li}: unknown jump target "${t}"`);
            val = 0;
          }
        }
        if (mnem === "JSR") {
          emit(pc, [OP.JSR_abs, val & 0xff, (val >> 8) & 0xff]);
          end = Math.max(end, pc + 3);
        } else if (indirect) {
          emit(pc, [OP.JMP_ind, val & 0xff, (val >> 8) & 0xff]);
          end = Math.max(end, pc + 3);
        } else {
          emit(pc, [OP.JMP_abs, val & 0xff, (val >> 8) & 0xff]);
          end = Math.max(end, pc + 3);
        }
        continue;
      }

      // Accumulator shifts: ASL / ASL A
      if (ACC_OK.has(mnem) && (!args || /^A$/i.test(args))) {
        emit(pc, [OP[mnem + "_acc"]]);
        end = Math.max(end, pc + 1);
        continue;
      }

      // General operand — also (zp),Y  e.g. STA ($10),Y
      let tok = args.trim();
      const imm = tok.startsWith("#");
      let indexed = null;
      let izy = false;
      let body = imm ? tok.slice(1).trim() : tok;
      const izyMatch = body.match(/^\(\s*([^)]+)\s*\)\s*,\s*Y$/i);
      if (izyMatch) {
        izy = true;
        body = izyMatch[1].trim();
      } else {
        const ix = body.match(/^(.*),\s*([XxYy])$/);
        if (ix) {
          body = ix[1].trim();
          indexed = ix[2].toUpperCase();
        }
      }

      let value = parseNumber(body);
      if (value == null) {
        if (constants[body] != null) value = constants[body];
        else if (labels[body] != null) value = labels[body];
        else {
          errors.push(`Line ${item.li}: unknown symbol "${body}"`);
          value = 0;
        }
      }

      if (imm) {
        const op = OP[mnem + "_imm"];
        if (op == null) {
          errors.push(`Line ${item.li}: ${mnem} does not support immediate`);
          continue;
        }
        emit(pc, [op, value & 0xff]);
        end = Math.max(end, pc + 2);
        continue;
      }

      if (izy) {
        const op = OP[mnem + "_izy"];
        if (op == null) {
          errors.push(`Line ${item.li}: ${mnem} does not support (zp),Y`);
          continue;
        }
        if (value > 0xff) {
          errors.push(`Line ${item.li}: (zp),Y pointer must be zero-page`);
          continue;
        }
        emit(pc, [op, value & 0xff]);
        end = Math.max(end, pc + 2);
        continue;
      }

      const { mode, size } = pickMode(mnem, false, indexed, value, false);
      const op = OP[mnem + "_" + mode];
      if (op == null) {
        // fallback to abs if possible
        const op2 = OP[mnem + "_abs"];
        if (op2 != null && !indexed) {
          emit(pc, [op2, value & 0xff, (value >> 8) & 0xff]);
          end = Math.max(end, pc + 3);
        } else if (indexed === "X" && OP[mnem + "_abx"] != null) {
          emit(pc, [OP[mnem + "_abx"], value & 0xff, (value >> 8) & 0xff]);
          end = Math.max(end, pc + 3);
        } else if (indexed === "Y" && OP[mnem + "_aby"] != null) {
          emit(pc, [OP[mnem + "_aby"], value & 0xff, (value >> 8) & 0xff]);
          end = Math.max(end, pc + 3);
        } else {
          errors.push(`Line ${item.li}: unsupported addressing for ${mnem} ${args}`);
        }
        continue;
      }

      if (size === 2) {
        emit(pc, [op, value & 0xff]);
        end = Math.max(end, pc + 2);
      } else {
        emit(pc, [op, value & 0xff, (value >> 8) & 0xff]);
        end = Math.max(end, pc + 3);
      }
    }

    if (errors.length) {
      const err = new Error(errors.join("\n"));
      err.details = errors;
      throw err;
    }

    return {
      memory: mem,
      entry: org,
      end,
      labels,
      constants,
    };
  }

  global.AsmAssembler = { assemble, ORIGIN };
})(window);
