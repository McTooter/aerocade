// Game Boy / Game Boy Color Emulator Core
// Self-contained JavaScript - no imports

class GBCPU {
  constructor(bus) {
    this.bus = bus;
    this.reset();
  }

  reset() {
    this.a = 0; this.f = 0; this.b = 0; this.c = 0;
    this.d = 0; this.e = 0; this.h = 0; this.l = 0;
    this.sp = 0; this.pc = 0;
    this.ime = false;
    this.imeScheduled = false;
    this.halted = false;
    this.cycles = 0;
  }

  get af() { return (this.a << 8) | (this.f & 0xF0); }
  set af(v) { this.a = (v >> 8) & 0xFF; this.f = v & 0xF0; }
  get bc() { return (this.b << 8) | this.c; }
  set bc(v) { this.b = (v >> 8) & 0xFF; this.c = v & 0xFF; }
  get de() { return (this.d << 8) | this.e; }
  set de(v) { this.d = (v >> 8) & 0xFF; this.e = v & 0xFF; }
  get hl() { return (this.h << 8) | this.l; }
  set hl(v) { this.h = (v >> 8) & 0xFF; this.l = v & 0xFF; }

  get flagZ() { return (this.f >> 7) & 1; }
  get flagN() { return (this.f >> 6) & 1; }
  get flagH() { return (this.f >> 5) & 1; }
  get flagC() { return (this.f >> 4) & 1; }

  setFlag(bit, val) {
    if (val) this.f |= (1 << bit);
    else this.f &= ~(1 << bit);
    this.f &= 0xF0;
  }

  setFlags(z, n, h, c) {
    this.f = ((z ? 1 : 0) << 7) | ((n ? 1 : 0) << 6) | ((h ? 1 : 0) << 5) | ((c ? 1 : 0) << 4);
  }

  pushWord(val) {
    this.sp = (this.sp - 2) & 0xFFFF;
    this.bus.memWrite(this.sp, val & 0xFF);
    this.bus.memWrite(this.sp + 1, (val >> 8) & 0xFF);
  }

  popWord() {
    const lo = this.bus.memRead(this.sp);
    const hi = this.bus.memRead(this.sp + 1);
    this.sp = (this.sp + 2) & 0xFFFF;
    return (hi << 8) | lo;
  }

  readByte() {
    const v = this.bus.memRead(this.pc);
    this.pc = (this.pc + 1) & 0xFFFF;
    return v;
  }

  readWord() {
    const lo = this.readByte();
    const hi = this.readByte();
    return (hi << 8) | lo;
  }

  handleInterrupts() {
    const ie = this.bus.io[0xFF];
    const iflag = this.bus.io[0x0F];
    const pending = ie & iflag & 0x1F;
    if (pending) {
      this.halted = false;
      if (this.ime) {
        this.ime = false;
        for (let i = 0; i < 5; i++) {
          if (pending & (1 << i)) {
            this.bus.io[0x0F] &= ~(1 << i);
            this.pushWord(this.pc);
            this.pc = 0x40 + (i * 8);
            this.cycles += 20;
            return;
          }
        }
      }
    }
  }

  step() {
    if (this.imeScheduled) {
      this.ime = true;
      this.imeScheduled = false;
    }
    this.handleInterrupts();

    if (this.halted) {
      this.cycles += 4;
      return 4;
    }

    const opcode = this.readByte();
    return this.execute(opcode);
  }

  execute(op) {
    let cycles = 4;
    switch (op) {

      // NOP
      case 0x00: break;

      // LD BC,d16
      case 0x01: this.bc = this.readWord(); cycles = 12; break;
      // LD (BC),A
      case 0x02: this.bus.memWrite(this.bc, this.a); break;
      // INC BC
      case 0x03: this.bc = (this.bc + 1) & 0xFFFF; cycles = 8; break;
      // INC B
      case 0x04: this.b = this.inc8(this.b); break;
      // DEC B
      case 0x05: this.b = this.dec8(this.b); break;
      // LD B,d8
      case 0x06: this.b = this.readByte(); cycles = 8; break;
      // RLCA
      case 0x07: {
        const c = (this.a >> 7) & 1;
        this.a = ((this.a << 1) | c) & 0xFF;
        this.setFlags(false, false, false, !!c);
        break;
      }
      // LD (a16),SP
      case 0x08: {
        const addr = this.readWord();
        this.bus.memWrite(addr, this.sp & 0xFF);
        this.bus.memWrite(addr + 1, (this.sp >> 8) & 0xFF);
        cycles = 20;
        break;
      }
      // ADD HL,BC
      case 0x09: this.addHL(this.bc); cycles = 8; break;
      // LD A,(BC)
      case 0x0A: this.a = this.bus.memRead(this.bc); break;
      // DEC BC
      case 0x0B: this.bc = (this.bc - 1) & 0xFFFF; cycles = 8; break;
      // INC C
      case 0x0C: this.c = this.inc8(this.c); break;
      // DEC C
      case 0x0D: this.c = this.dec8(this.c); break;
      // LD C,d8
      case 0x0E: this.c = this.readByte(); cycles = 8; break;
      // RRCA
      case 0x0F: {
        const c = this.a & 1;
        this.a = ((this.a >> 1) | (c << 7)) & 0xFF;
        this.setFlags(false, false, false, !!c);
        break;
      }

      // STOP
      case 0x10: this.readByte(); break;

      // LD DE,d16
      case 0x11: this.de = this.readWord(); cycles = 12; break;
      // LD (DE),A
      case 0x12: this.bus.memWrite(this.de, this.a); break;
      // INC DE
      case 0x13: this.de = (this.de + 1) & 0xFFFF; cycles = 8; break;
      // INC D
      case 0x14: this.d = this.inc8(this.d); break;
      // DEC D
      case 0x15: this.d = this.dec8(this.d); break;
      // LD D,d8
      case 0x16: this.d = this.readByte(); cycles = 8; break;
      // RLA
      case 0x17: {
        const oldC = this.flagC;
        const c = (this.a >> 7) & 1;
        this.a = ((this.a << 1) | oldC) & 0xFF;
        this.setFlags(false, false, false, !!c);
        break;
      }
      // JR r8
      case 0x18: {
        const r8 = this.readByte();
        this.pc = (this.pc + ((r8 ^ 0x80) - 0x80)) & 0xFFFF;
        cycles = 12;
        break;
      }
      // ADD HL,DE
      case 0x19: this.addHL(this.de); cycles = 8; break;
      // LD A,(DE)
      case 0x1A: this.a = this.bus.memRead(this.de); break;
      // DEC DE
      case 0x1B: this.de = (this.de - 1) & 0xFFFF; cycles = 8; break;
      // INC E
      case 0x1C: this.e = this.inc8(this.e); break;
      // DEC E
      case 0x1D: this.e = this.dec8(this.e); break;
      // LD E,d8
      case 0x1E: this.e = this.readByte(); cycles = 8; break;
      // RRA
      case 0x1F: {
        const oldC = this.flagC;
        const c = this.a & 1;
        this.a = ((this.a >> 1) | (oldC << 7)) & 0xFF;
        this.setFlags(false, false, false, !!c);
        break;
      }

      // JR NZ,r8
      case 0x20: {
        const r8 = this.readByte();
        if (!this.flagZ) {
          this.pc = (this.pc + ((r8 ^ 0x80) - 0x80)) & 0xFFFF;
          cycles = 12;
        }
        break;
      }
      // LD HL,d16
      case 0x21: this.hl = this.readWord(); cycles = 12; break;
      // LD (HL+),A
      case 0x22: {
        this.bus.memWrite(this.hl, this.a);
        this.hl = (this.hl + 1) & 0xFFFF;
        break;
      }
      // INC HL
      case 0x23: this.hl = (this.hl + 1) & 0xFFFF; cycles = 8; break;
      // INC H
      case 0x24: this.h = this.inc8(this.h); break;
      // DEC H
      case 0x25: this.h = this.dec8(this.h); break;
      // LD H,d8
      case 0x26: this.h = this.readByte(); cycles = 8; break;
      // DAA
      case 0x27: {
        let a = this.a;
        if (this.flagN) {
          if (this.flagH) a = (a - 6) & 0xFF;
          if (this.flagC) a = (a - 0x60) & 0xFF;
        } else {
          if (this.flagH || (a & 0xF) > 9) a += 6;
          if (this.flagC || a > 0x9F) { a += 0x60; this.setFlag(4, true); }
        }
        this.a = a & 0xFF;
        this.setFlag(7, this.a === 0);
        this.setFlag(5, false);
        break;
      }
      // JR Z,r8
      case 0x28: {
        const r8 = this.readByte();
        if (this.flagZ) {
          this.pc = (this.pc + ((r8 ^ 0x80) - 0x80)) & 0xFFFF;
          cycles = 12;
        }
        break;
      }
      // ADD HL,HL
      case 0x29: this.addHL(this.hl); cycles = 8; break;
      // LD A,(HL+)
      case 0x2A: {
        this.a = this.bus.memRead(this.hl);
        this.hl = (this.hl + 1) & 0xFFFF;
        break;
      }
      // DEC HL
      case 0x2B: this.hl = (this.hl - 1) & 0xFFFF; cycles = 8; break;
      // INC L
      case 0x2C: this.l = this.inc8(this.l); break;
      // DEC L
      case 0x2D: this.l = this.dec8(this.l); break;
      // LD L,d8
      case 0x2E: this.l = this.readByte(); cycles = 8; break;
      // CPL
      case 0x2F: this.a = (~this.a) & 0xFF; this.setFlag(6, true); this.setFlag(5, true); break;

      // JR NC,r8
      case 0x30: {
        const r8 = this.readByte();
        if (!this.flagC) {
          this.pc = (this.pc + ((r8 ^ 0x80) - 0x80)) & 0xFFFF;
          cycles = 12;
        }
        break;
      }
      // LD SP,d16
      case 0x31: this.sp = this.readWord(); cycles = 12; break;
      // LD (HL-),A
      case 0x32: {
        this.bus.memWrite(this.hl, this.a);
        this.hl = (this.hl - 1) & 0xFFFF;
        break;
      }
      // INC SP
      case 0x33: this.sp = (this.sp + 1) & 0xFFFF; cycles = 8; break;
      // INC (HL)
      case 0x34: {
        const val = this.inc8(this.bus.memRead(this.hl));
        this.bus.memWrite(this.hl, val);
        cycles = 12;
        break;
      }
      // DEC (HL)
      case 0x35: {
        const val = this.dec8(this.bus.memRead(this.hl));
        this.bus.memWrite(this.hl, val);
        cycles = 12;
        break;
      }
      // LD (HL),d8
      case 0x36: this.bus.memWrite(this.hl, this.readByte()); cycles = 12; break;
      // SCF
      case 0x37: this.setFlag(6, false); this.setFlag(5, false); this.setFlag(4, true); break;
      // JR C,r8
      case 0x38: {
        const r8 = this.readByte();
        if (this.flagC) {
          this.pc = (this.pc + ((r8 ^ 0x80) - 0x80)) & 0xFFFF;
          cycles = 12;
        }
        break;
      }
      // ADD HL,SP
      case 0x39: this.addHL(this.sp); cycles = 8; break;
      // LD A,(HL-)
      case 0x3A: {
        this.a = this.bus.memRead(this.hl);
        this.hl = (this.hl - 1) & 0xFFFF;
        break;
      }
      // DEC SP
      case 0x3B: this.sp = (this.sp - 1) & 0xFFFF; cycles = 8; break;
      // INC A
      case 0x3C: this.a = this.inc8(this.a); break;
      // DEC A
      case 0x3D: this.a = this.dec8(this.a); break;
      // LD A,d8
      case 0x3E: this.a = this.readByte(); cycles = 8; break;
      // CCF
      case 0x3F: this.setFlag(6, false); this.setFlag(5, false); this.setFlag(4, !this.flagC); break;

      // LD B,B / C / D / E / H / L / (HL) / A
      case 0x40: break;
      case 0x41: this.b = this.c; break;
      case 0x42: this.b = this.d; break;
      case 0x43: this.b = this.e; break;
      case 0x44: this.b = this.h; break;
      case 0x45: this.b = this.l; break;
      case 0x46: this.b = this.bus.memRead(this.hl); cycles = 8; break;
      case 0x47: this.b = this.a; break;

      case 0x48: this.c = this.b; break;
      case 0x49: break;
      case 0x4A: this.c = this.d; break;
      case 0x4B: this.c = this.e; break;
      case 0x4C: this.c = this.h; break;
      case 0x4D: this.c = this.l; break;
      case 0x4E: this.c = this.bus.memRead(this.hl); cycles = 8; break;
      case 0x4F: this.c = this.a; break;

      case 0x50: this.d = this.b; break;
      case 0x51: this.d = this.c; break;
      case 0x52: break;
      case 0x53: this.d = this.e; break;
      case 0x54: this.d = this.h; break;
      case 0x55: this.d = this.l; break;
      case 0x56: this.d = this.bus.memRead(this.hl); cycles = 8; break;
      case 0x57: this.d = this.a; break;

      case 0x58: this.e = this.b; break;
      case 0x59: this.e = this.c; break;
      case 0x5A: this.e = this.d; break;
      case 0x5B: break;
      case 0x5C: this.e = this.h; break;
      case 0x5D: this.e = this.l; break;
      case 0x5E: this.e = this.bus.memRead(this.hl); cycles = 8; break;
      case 0x5F: this.e = this.a; break;

      case 0x60: this.h = this.b; break;
      case 0x61: this.h = this.c; break;
      case 0x62: this.h = this.d; break;
      case 0x63: this.h = this.e; break;
      case 0x64: break;
      case 0x65: this.h = this.l; break;
      case 0x66: this.h = this.bus.memRead(this.hl); cycles = 8; break;
      case 0x67: this.h = this.a; break;

      case 0x68: this.l = this.b; break;
      case 0x69: this.l = this.c; break;
      case 0x6A: this.l = this.d; break;
      case 0x6B: this.l = this.e; break;
      case 0x6C: this.l = this.h; break;
      case 0x6D: break;
      case 0x6E: this.l = this.bus.memRead(this.hl); cycles = 8; break;
      case 0x6F: this.l = this.a; break;

      // LD (HL),r
      case 0x70: this.bus.memWrite(this.hl, this.b); cycles = 8; break;
      case 0x71: this.bus.memWrite(this.hl, this.c); cycles = 8; break;
      case 0x72: this.bus.memWrite(this.hl, this.d); cycles = 8; break;
      case 0x73: this.bus.memWrite(this.hl, this.e); cycles = 8; break;
      case 0x74: this.bus.memWrite(this.hl, this.h); cycles = 8; break;
      case 0x75: this.bus.memWrite(this.hl, this.l); cycles = 8; break;
      // HALT
      case 0x76: this.halted = true; break;
      case 0x77: this.bus.memWrite(this.hl, this.a); cycles = 8; break;

      // LD A,r
      case 0x78: this.a = this.b; break;
      case 0x79: this.a = this.c; break;
      case 0x7A: this.a = this.d; break;
      case 0x7B: this.a = this.e; break;
      case 0x7C: this.a = this.h; break;
      case 0x7D: this.a = this.l; break;
      case 0x7E: this.a = this.bus.memRead(this.hl); cycles = 8; break;
      case 0x7F: break;

      // ADD A,r
      case 0x80: this.addA(this.b); break;
      case 0x81: this.addA(this.c); break;
      case 0x82: this.addA(this.d); break;
      case 0x83: this.addA(this.e); break;
      case 0x84: this.addA(this.h); break;
      case 0x85: this.addA(this.l); break;
      case 0x86: this.addA(this.bus.memRead(this.hl)); cycles = 8; break;
      case 0x87: this.addA(this.a); break;
      // ADC A,r
      case 0x88: this.adcA(this.b); break;
      case 0x89: this.adcA(this.c); break;
      case 0x8A: this.adcA(this.d); break;
      case 0x8B: this.adcA(this.e); break;
      case 0x8C: this.adcA(this.h); break;
      case 0x8D: this.adcA(this.l); break;
      case 0x8E: this.adcA(this.bus.memRead(this.hl)); cycles = 8; break;
      case 0x8F: this.adcA(this.a); break;
      // SUB r
      case 0x90: this.subA(this.b); break;
      case 0x91: this.subA(this.c); break;
      case 0x92: this.subA(this.d); break;
      case 0x93: this.subA(this.e); break;
      case 0x94: this.subA(this.h); break;
      case 0x95: this.subA(this.l); break;
      case 0x96: this.subA(this.bus.memRead(this.hl)); cycles = 8; break;
      case 0x97: this.subA(this.a); break;
      // SBC A,r
      case 0x98: this.sbcA(this.b); break;
      case 0x99: this.sbcA(this.c); break;
      case 0x9A: this.sbcA(this.d); break;
      case 0x9B: this.sbcA(this.e); break;
      case 0x9C: this.sbcA(this.h); break;
      case 0x9D: this.sbcA(this.l); break;
      case 0x9E: this.sbcA(this.bus.memRead(this.hl)); cycles = 8; break;
      case 0x9F: this.sbcA(this.a); break;
      // AND r
      case 0xA0: this.andA(this.b); break;
      case 0xA1: this.andA(this.c); break;
      case 0xA2: this.andA(this.d); break;
      case 0xA3: this.andA(this.e); break;
      case 0xA4: this.andA(this.h); break;
      case 0xA5: this.andA(this.l); break;
      case 0xA6: this.andA(this.bus.memRead(this.hl)); cycles = 8; break;
      case 0xA7: this.andA(this.a); break;
      // XOR r
      case 0xA8: this.xorA(this.b); break;
      case 0xA9: this.xorA(this.c); break;
      case 0xAA: this.xorA(this.d); break;
      case 0xAB: this.xorA(this.e); break;
      case 0xAC: this.xorA(this.h); break;
      case 0xAD: this.xorA(this.l); break;
      case 0xAE: this.xorA(this.bus.memRead(this.hl)); cycles = 8; break;
      case 0xAF: this.xorA(this.a); break;
      // OR r
      case 0xB0: this.orA(this.b); break;
      case 0xB1: this.orA(this.c); break;
      case 0xB2: this.orA(this.d); break;
      case 0xB3: this.orA(this.e); break;
      case 0xB4: this.orA(this.h); break;
      case 0xB5: this.orA(this.l); break;
      case 0xB6: this.orA(this.bus.memRead(this.hl)); cycles = 8; break;
      case 0xB7: this.orA(this.a); break;
      // CP r
      case 0xB8: this.cpA(this.b); break;
      case 0xB9: this.cpA(this.c); break;
      case 0xBA: this.cpA(this.d); break;
      case 0xBB: this.cpA(this.e); break;
      case 0xBC: this.cpA(this.h); break;
      case 0xBD: this.cpA(this.l); break;
      case 0xBE: this.cpA(this.bus.memRead(this.hl)); cycles = 8; break;
      case 0xBF: this.cpA(this.a); break;

      // RET NZ
      case 0xC0: {
        if (!this.flagZ) { this.pc = this.popWord(); cycles = 20; }
        break;
      }
      // POP BC
      case 0xC1: this.bc = this.popWord(); cycles = 12; break;
      // JP NZ,a16
      case 0xC2: {
        const addr = this.readWord();
        if (!this.flagZ) { this.pc = addr; cycles = 16; }
        break;
      }
      // JP a16
      case 0xC3: this.pc = this.readWord(); cycles = 16; break;
      // CALL NZ,a16
      case 0xC4: {
        const addr = this.readWord();
        if (!this.flagZ) { this.pushWord(this.pc); this.pc = addr; cycles = 24; }
        break;
      }
      // PUSH BC
      case 0xC5: this.pushWord(this.bc); cycles = 16; break;
      // ADD A,d8
      case 0xC6: this.addA(this.readByte()); cycles = 8; break;
      // RST 00H
      case 0xC7: this.pushWord(this.pc); this.pc = 0x00; cycles = 16; break;
      // RET Z
      case 0xC8: { if (this.flagZ) { this.pc = this.popWord(); cycles = 20; } break; }
      // RET
      case 0xC9: this.pc = this.popWord(); cycles = 16; break;
      // JP Z,a16
      case 0xCA: {
        const addr = this.readWord();
        if (this.flagZ) { this.pc = addr; cycles = 16; }
        break;
      }
      // CB PREFIX
      case 0xCB: return this.executeCB();
      // CALL Z,a16
      case 0xCC: {
        const addr = this.readWord();
        if (this.flagZ) { this.pushWord(this.pc); this.pc = addr; cycles = 24; }
        break;
      }
      // CALL a16
      case 0xCD: {
        const addr = this.readWord();
        this.pushWord(this.pc);
        this.pc = addr;
        cycles = 24;
        break;
      }
      // ADC A,d8
      case 0xCE: this.adcA(this.readByte()); cycles = 8; break;
      // RST 08H
      case 0xCF: this.pushWord(this.pc); this.pc = 0x08; cycles = 16; break;

      // RET NC
      case 0xD0: { if (!this.flagC) { this.pc = this.popWord(); cycles = 20; } break; }
      // POP DE
      case 0xD1: this.de = this.popWord(); cycles = 12; break;
      // JP NC,a16
      case 0xD2: {
        const addr = this.readWord();
        if (!this.flagC) { this.pc = addr; cycles = 16; }
        break;
      }
      // CALL NC,a16
      case 0xD4: {
        const addr = this.readWord();
        if (!this.flagC) { this.pushWord(this.pc); this.pc = addr; cycles = 24; }
        break;
      }
      // PUSH DE
      case 0xD5: this.pushWord(this.de); cycles = 16; break;
      // SUB d8
      case 0xD6: this.subA(this.readByte()); cycles = 8; break;
      // RST 10H
      case 0xD7: this.pushWord(this.pc); this.pc = 0x10; cycles = 16; break;
      // RET C
      case 0xD8: { if (this.flagC) { this.pc = this.popWord(); cycles = 20; } break; }
      // RETI
      case 0xD9: this.pc = this.popWord(); this.ime = true; cycles = 16; break;
      // JP C,a16
      case 0xDA: {
        const addr = this.readWord();
        if (this.flagC) { this.pc = addr; cycles = 16; }
        break;
      }
      // CALL C,a16
      case 0xDC: {
        const addr = this.readWord();
        if (this.flagC) { this.pushWord(this.pc); this.pc = addr; cycles = 24; }
        break;
      }
      // SBC A,d8
      case 0xDE: this.sbcA(this.readByte()); cycles = 8; break;
      // RST 18H
      case 0xDF: this.pushWord(this.pc); this.pc = 0x18; cycles = 16; break;

      // LDH (a8),A
      case 0xE0: this.bus.memWrite(0xFF00 + this.readByte(), this.a); cycles = 12; break;
      // POP HL
      case 0xE1: this.hl = this.popWord(); cycles = 12; break;
      // LD (C),A
      case 0xE2: this.bus.memWrite(0xFF00 + this.c, this.a); break;
      // PUSH HL
      case 0xE5: this.pushWord(this.hl); cycles = 16; break;
      // AND d8
      case 0xE6: this.andA(this.readByte()); cycles = 8; break;
      // RST 20H
      case 0xE7: this.pushWord(this.pc); this.pc = 0x20; cycles = 16; break;
      // ADD SP,r8
      case 0xE8: {
        const r8 = this.readByte();
        const offset = (r8 ^ 0x80) - 0x80;
        const result = (this.sp + offset) & 0xFFFF;
        this.setFlags(false, false,
          ((this.sp & 0xF) + (offset & 0xF)) & 0x10 ? 1 : 0,
          ((this.sp & 0xFF) + (offset & 0xFF)) & 0x100 ? 1 : 0);
        this.sp = result;
        cycles = 16;
        break;
      }
      // JP (HL)
      case 0xE9: this.pc = this.hl; break;
      // LD (a16),A
      case 0xEA: this.bus.memWrite(this.readWord(), this.a); cycles = 16; break;
      // XOR d8
      case 0xEE: this.xorA(this.readByte()); cycles = 8; break;
      // RST 28H
      case 0xEF: this.pushWord(this.pc); this.pc = 0x28; cycles = 16; break;

      // LDH A,(a8)
      case 0xF0: this.a = this.bus.memRead(0xFF00 + this.readByte()); cycles = 12; break;
      // POP AF
      case 0xF1: this.af = this.popWord(); cycles = 12; break;
      // LD A,(C)
      case 0xF2: this.a = this.bus.memRead(0xFF00 + this.c); break;
      // DI
      case 0xF3: this.ime = false; break;
      // PUSH AF
      case 0xF5: this.pushWord(this.af); cycles = 16; break;
      // OR d8
      case 0xF6: this.orA(this.readByte()); cycles = 8; break;
      // RST 30H
      case 0xF7: this.pushWord(this.pc); this.pc = 0x30; cycles = 16; break;
      // LD HL,SP+r8
      case 0xF8: {
        const r8 = this.readByte();
        const offset = (r8 ^ 0x80) - 0x80;
        this.hl = (this.sp + offset) & 0xFFFF;
        this.setFlags(false, false,
          ((this.sp & 0xF) + (offset & 0xF)) & 0x10 ? 1 : 0,
          ((this.sp & 0xFF) + (offset & 0xFF)) & 0x100 ? 1 : 0);
        cycles = 12;
        break;
      }
      // LD SP,HL
      case 0xF9: this.sp = this.hl; cycles = 8; break;
      // LD A,(a16)
      case 0xFA: this.a = this.bus.memRead(this.readWord()); cycles = 16; break;
      // EI
      case 0xFB: this.imeScheduled = true; break;
      // CP d8
      case 0xFE: this.cpA(this.readByte()); cycles = 8; break;
      // RST 38H
      case 0xFF: this.pushWord(this.pc); this.pc = 0x38; cycles = 16; break;

      default:
        break;
    }
    return cycles;
  }

  // Helper ALU operations
  inc8(val) {
    const result = (val + 1) & 0xFF;
    this.setFlag(7, result === 0);
    this.setFlag(6, false);
    this.setFlag(5, (val & 0xF) === 0xF);
    return result;
  }

  dec8(val) {
    const result = (val - 1) & 0xFF;
    this.setFlag(7, result === 0);
    this.setFlag(6, true);
    this.setFlag(5, (val & 0xF) === 0);
    return result;
  }

  addHL(val) {
    const hl = this.hl;
    const result = hl + val;
    this.setFlag(6, false);
    this.setFlag(5, ((hl & 0xFFF) + (val & 0xFFF)) > 0xFFF);
    this.setFlag(4, result > 0xFFFF);
    this.hl = result & 0xFFFF;
  }

  addA(val) {
    const result = this.a + val;
    this.setFlag(7, (result & 0xFF) === 0);
    this.setFlag(6, false);
    this.setFlag(5, ((this.a & 0xF) + (val & 0xF)) > 0xF);
    this.setFlag(4, result > 0xFF);
    this.a = result & 0xFF;
  }

  adcA(val) {
    const c = this.flagC;
    const result = this.a + val + c;
    this.setFlag(7, (result & 0xFF) === 0);
    this.setFlag(6, false);
    this.setFlag(5, ((this.a & 0xF) + (val & 0xF) + c) > 0xF);
    this.setFlag(4, result > 0xFF);
    this.a = result & 0xFF;
  }

  subA(val) {
    const result = this.a - val;
    this.setFlag(7, (result & 0xFF) === 0);
    this.setFlag(6, true);
    this.setFlag(5, (this.a & 0xF) < (val & 0xF));
    this.setFlag(4, this.a < val);
    this.a = result & 0xFF;
  }

  sbcA(val) {
    const c = this.flagC;
    const result = this.a - val - c;
    this.setFlag(7, (result & 0xFF) === 0);
    this.setFlag(6, true);
    this.setFlag(5, (this.a & 0xF) < (val & 0xF) + c);
    this.setFlag(4, this.a < val + c);
    this.a = result & 0xFF;
  }

  andA(val) {
    this.a &= val;
    this.setFlag(7, this.a === 0);
    this.setFlag(6, false);
    this.setFlag(5, true);
    this.setFlag(4, false);
  }

  xorA(val) {
    this.a ^= val;
    this.setFlag(7, this.a === 0);
    this.setFlags(this.a === 0, false, false, false);
  }

  orA(val) {
    this.a |= val;
    this.setFlags(this.a === 0, false, false, false);
  }

  cpA(val) {
    const result = this.a - val;
    this.setFlag(7, (result & 0xFF) === 0);
    this.setFlag(6, true);
    this.setFlag(5, (this.a & 0xF) < (val & 0xF));
    this.setFlag(4, this.a < val);
  }

  // CB-prefixed opcodes
  executeCB() {
    const op = this.readByte();
    let cycles = 8;
    const reg = op & 0x07;
    const isHL = reg === 6;
    let val = isHL ? this.bus.memRead(this.hl) : this.getReg(reg);

    switch (op & 0xF8) {
      // RLC
      case 0x00: {
        const c = (val >> 7) & 1;
        val = ((val << 1) | c) & 0xFF;
        this.setFlags(val === 0, false, false, !!c);
        break;
      }
      // RRC
      case 0x08: {
        const c = val & 1;
        val = ((val >> 1) | (c << 7)) & 0xFF;
        this.setFlags(val === 0, false, false, !!c);
        break;
      }
      // RL
      case 0x10: {
        const oldC = this.flagC;
        const c = (val >> 7) & 1;
        val = ((val << 1) | oldC) & 0xFF;
        this.setFlags(val === 0, false, false, !!c);
        break;
      }
      // RR
      case 0x18: {
        const oldC = this.flagC;
        const c = val & 1;
        val = ((val >> 1) | (oldC << 7)) & 0xFF;
        this.setFlags(val === 0, false, false, !!c);
        break;
      }
      // SLA
      case 0x20: {
        const c = (val >> 7) & 1;
        val = (val << 1) & 0xFF;
        this.setFlags(val === 0, false, false, !!c);
        break;
      }
      // SRA
      case 0x28: {
        const c = val & 1;
        val = (val >> 1) | (val & 0x80);
        this.setFlags(val === 0, false, false, !!c);
        break;
      }
      // SWAP
      case 0x30: {
        val = ((val & 0xF) << 4) | ((val >> 4) & 0xF);
        this.setFlags(val === 0, false, false, false);
        break;
      }
      // SRL
      case 0x38: {
        const c = val & 1;
        val = val >> 1;
        this.setFlags(val === 0, false, false, !!c);
        break;
      }
      // BIT b,r
      default: {
        if ((op & 0xC0) === 0x40) {
          const bit = (op >> 3) & 7;
          this.setFlag(7, !(val & (1 << bit)));
          this.setFlag(6, false);
          this.setFlag(5, true);
          if (isHL) cycles = 12;
          if (isHL) { this.setReg(reg, val); return cycles; }
          return cycles;
        }
        // RES b,r
        if ((op & 0xC0) === 0x80) {
          const bit = (op >> 3) & 7;
          val &= ~(1 << bit);
          if (isHL) cycles = 16;
        }
        // SET b,r
        if ((op & 0xC0) === 0xC0) {
          const bit = (op >> 3) & 7;
          val |= (1 << bit);
          if (isHL) cycles = 16;
        }
      }
    }

    if (isHL) {
      this.bus.memWrite(this.hl, val);
    } else {
      this.setReg(reg, val);
    }
    return cycles;
  }

  getReg(idx) {
    switch (idx) {
      case 0: return this.b;
      case 1: return this.c;
      case 2: return this.d;
      case 3: return this.e;
      case 4: return this.h;
      case 5: return this.l;
      case 7: return this.a;
      default: return 0;
    }
  }

  setReg(idx, val) {
    switch (idx) {
      case 0: this.b = val; break;
      case 1: this.c = val; break;
      case 2: this.d = val; break;
      case 3: this.e = val; break;
      case 4: this.h = val; break;
      case 5: this.l = val; break;
      case 7: this.a = val; break;
    }
  }
}

class GBPPU {
  constructor(bus) {
    this.bus = bus;
    this.reset();
  }

  reset() {
    this.mode = 2;
    this.line = 0;
    this.modeClock = 0;
    this.windowLineCounter = 0;
    this.frameReady = false;
    this.scanlineRow = new Uint8Array(160);
    this.internalY = 0;
  }

  step(cycles) {
    const io = this.bus.io;
    const lcdc = io[0x40];
    const lcdEnabled = (lcdc >> 7) & 1;

    if (!lcdEnabled) {
      this.mode = 0;
      this.line = 0;
      this.modeClock = 0;
      return;
    }

    this.modeClock += cycles;

    switch (this.mode) {
      // OAM scan
      case 2:
        if (this.modeClock >= 80) {
          this.modeClock -= 80;
          this.mode = 3;
        }
        break;

      // Drawing pixels
      case 3:
        if (this.modeClock >= 172) {
          this.modeClock -= 172;
          this.mode = 0;
          this.renderScanline();
        }
        break;

      // HBlank
      case 0:
        if (this.modeClock >= 204) {
          this.modeClock -= 204;
          this.line++;
          io[0x44] = this.line;

          if (this.line === 144) {
            this.mode = 1;
            this.frameReady = true;
            io[0x0F] |= 0x01; // VBlank IF
            if (io[0x41] & 0x10) io[0x0F] |= 0x02; // STAT interrupt
          } else {
            this.mode = 2;
            if (io[0x41] & 0x20) io[0x0F] |= 0x02; // STAT interrupt
          }
        }
        break;

      // VBlank
      case 1:
        if (this.modeClock >= 456) {
          this.modeClock -= 456;
          this.line++;
          io[0x44] = this.line;

          if (this.line > 153) {
            this.line = 0;
            io[0x44] = 0;
            this.windowLineCounter = 0;
            this.mode = 2;
            if (io[0x41] & 0x20) io[0x0F] |= 0x02;
          }
        }
        break;
    }

    // STAT interrupt for coincidence
    const lyc = io[0x45];
    if (this.line === lyc && (io[0x41] & 0x40)) {
      io[0x0F] |= 0x02;
    }
    io[0x41] = (io[0x41] & 0xFC) | this.mode;
    if (this.line === lyc) io[0x41] |= 0x04;
    else io[0x41] &= ~0x04;
  }

  renderScanline() {
    const io = this.bus.io;
    const lcdc = io[0x40];
    const ly = this.line;
    const pixels = this.bus.pixels;

    if (ly >= 144) return;

    this.scanlineRow.fill(0);

    // Background priority row for sprite behind BG
    const bgPriorityRow = new Uint8Array(160);

    if (lcdc & 0x01) this.renderBG(ly, lcdc, io, bgPriorityRow);
    if (lcdc & 0x20) this.renderWindow(ly, lcdc, io, bgPriorityRow);
    if (lcdc & 0x02) this.renderSprites(ly, lcdc, io);

    const palette = [0x9BBC0F, 0x8BAC0F, 0x306230, 0x0F380F];
    const bgp = io[0x47];

    for (let x = 0; x < 160; x++) {
      const colorIdx = (bgp >> (this.scanlineRow[x] * 2)) & 3;
      pixels[ly * 160 + x] = 0xFF000000 | palette[colorIdx];
    }
  }

  renderBG(ly, lcdc, io, bgPriorityRow) {
    const scrollX = io[0x43];
    const scrollY = io[0x42];
    const tileDataArea = (lcdc & 0x10) ? 0x8000 : 0x8800;
    const tileMapArea = (lcdc & 0x08) ? 0x9C00 : 0x9800;
    const signed = !(lcdc & 0x10);

    const y = (ly + scrollY) & 0xFF;
    const tileRow = (y >> 3) & 31;

    for (let pixel = 0; pixel < 160; pixel++) {
      const x = (pixel + scrollX) & 0xFF;
      const tileCol = (x >> 3) & 31;

      const mapAddr = tileMapArea + tileRow * 32 + tileCol;
      let tileNum = this.bus.vram[mapAddr - 0x8000];

      let tileDataAddr;
      if (signed) {
        tileDataAddr = 0x9000 + ((tileNum ^ 0x80) - 0x80) * 16;
      } else {
        tileDataAddr = 0x8000 + tileNum * 16;
      }

      const lineOffset = (y & 7) * 2;
      const byte1 = this.bus.vram[tileDataAddr + lineOffset - 0x8000];
      const byte2 = this.bus.vram[tileDataAddr + lineOffset + 1 - 0x8000];

      const bit = 7 - (x & 7);
      const color = ((byte2 >> bit) & 1) << 1 | ((byte1 >> bit) & 1);

      this.scanlineRow[pixel] = color;
      bgPriorityRow[pixel] = (lcdc & 0x20) ? ((byte2 >> bit) & 1) || ((byte1 >> bit) & 1) : 0;
    }
  }

  renderWindow(ly, lcdc, io, bgPriorityRow) {
    const winX = io[0x4A];
    const winY = io[0x4B];
    const tileDataArea = (lcdc & 0x10) ? 0x8000 : 0x8800;
    const tileMapArea = (lcdc & 0x40) ? 0x9C00 : 0x9800;
    const signed = !(lcdc & 0x10);

    if (ly < winY) return;
    if (winX > 159) return;

    const windowY = this.windowLineCounter;
    const tileRow = (windowY >> 3) & 31;

    let rendered = false;

    for (let pixel = 0; pixel < 160; pixel++) {
      const screenX = pixel - winX + 7;
      if (screenX < 0) continue;
      if (pixel < winX - 7) continue;

      rendered = true;
      const tileCol = (screenX >> 3) & 31;

      const mapAddr = tileMapArea + tileRow * 32 + tileCol;
      let tileNum = this.bus.vram[mapAddr - 0x8000];

      let tileDataAddr;
      if (signed) {
        tileDataAddr = 0x9000 + ((tileNum ^ 0x80) - 0x80) * 16;
      } else {
        tileDataAddr = 0x8000 + tileNum * 16;
      }

      const lineOffset = (windowY & 7) * 2;
      const byte1 = this.bus.vram[tileDataAddr + lineOffset - 0x8000];
      const byte2 = this.bus.vram[tileDataAddr + lineOffset + 1 - 0x8000];

      const bit = 7 - (screenX & 7);
      const color = ((byte2 >> bit) & 1) << 1 | ((byte1 >> bit) & 1);

      this.scanlineRow[pixel] = color;
    }

    if (rendered) this.windowLineCounter++;
  }

  renderSprites(ly, lcdc, io) {
    const spriteHeight = (lcdc & 0x04) ? 16 : 8;
    const sprites = [];

    for (let i = 0; i < 40; i++) {
      const y = this.bus.oam[i * 4] - 16;
      const x = this.bus.oam[i * 4 + 1] - 8;
      const tile = this.bus.oam[i * 4 + 2];
      const flags = this.bus.oam[i * 4 + 3];

      if (ly >= y && ly < y + spriteHeight) {
        sprites.push({ y, x, tile, flags, index: i });
        if (sprites.length >= 10) break;
      }
    }

    sprites.sort((a, b) => a.x === b.x ? a.index - b.index : a.x - b.x);

    const palette = [0x9BBC0F, 0x8BAC0F, 0x306230, 0x0F380F];
    const obp0 = io[0x48];
    const obp1 = io[0x49];

    for (let i = sprites.length - 1; i >= 0; i--) {
      const s = sprites[i];
      const paletteNum = (s.flags >> 4) & 1;
      const xFlip = (s.flags >> 5) & 1;
      const yFlip = (s.flags >> 6) & 1;
      const bgOver = (s.flags >> 7) & 1;
      const pal = paletteNum ? obp1 : obp0;

      let tileY = ly - s.y;
      let tileNum = s.tile;

      if (yFlip) tileY = spriteHeight - 1 - tileY;

      if (spriteHeight === 16) {
        tileNum &= 0xFE;
        if (tileY >= 8) {
          tileNum += 1;
          tileY -= 8;
        }
      }

      const tileAddr = 0x8000 + tileNum * 16 + tileY * 2;
      const byte1 = this.bus.vram[tileAddr - 0x8000];
      const byte2 = this.bus.vram[tileAddr + 1 - 0x8000];

      for (let px = 0; px < 8; px++) {
        const screenX = s.x + px;
        if (screenX < 0 || screenX >= 160) continue;

        const bit = xFlip ? px : (7 - px);
        const color = ((byte2 >> bit) & 1) << 1 | ((byte1 >> bit) & 1);

        if (color === 0) continue;
        if (bgOver && this.scanlineRow[screenX] !== 0) continue;

        const colorIdx = (pal >> (color * 2)) & 3;
        const paletteArr = [0x9BBC0F, 0x8BAC0F, 0x306230, 0x0F380F];
        this.bus.pixels[ly * 160 + screenX] = 0xFF000000 | paletteArr[colorIdx];
      }
    }
  }
}

class GBAPU {
  constructor() {
    this.reset();
  }

  reset() {
    this.enabled = false;
    this.sampleBuffer = new Float32Array(0);
  }

  step(cycles) {
    // Stub: no audio output
  }

  readRegister(addr) {
    // Return default values for sound registers
    return 0;
  }

  writeRegister(addr, val) {
    // Stub: ignore writes
  }
}

class GameBoy {
  constructor() {
    this.reset();
  }

  reset() {
    this.vram = new Uint8Array(0x2000);
    this.eram = new Uint8Array(0x8000);
    this.wram = new Uint8Array(0x2000);
    this.oam = new Uint8Array(0xA0);
    this.io = new Uint8Array(0x100);
    this.hram = new Uint8Array(0x7F);
    this.pixels = new Uint32Array(160 * 144);

    this.cpu = new GBCPU(this);
    this.ppu = new GBPPU(this);
    this.apu = new GBAPU();

    this.rom = null;
    this.romBankNumber = 1;
    this.ramBankNumber = 0;
    this.mbcType = 0;
    this.ramEnabled = false;
    this.mbcMode = 0;
    this.romBanks = 0;
    this.ramBanks = 0;

    this.frameCycleCount = 0;

    this.pixels.fill(0xFF9BBC0F);

    this.initIO();
  }

  initIO() {
    // Initial IO register values (DMG boot state)
    this.io[0x05] = 0x00;
    this.io[0x06] = 0x00;
    this.io[0x07] = 0x00;
    this.io[0x0F] = 0xE1;
    this.io[0x10] = 0x80;
    this.io[0x11] = 0xBF;
    this.io[0x12] = 0xF3;
    this.io[0x14] = 0xBF;
    this.io[0x16] = 0x3F;
    this.io[0x17] = 0x00;
    this.io[0x19] = 0xBF;
    this.io[0x1A] = 0x7F;
    this.io[0x1B] = 0xFF;
    this.io[0x1C] = 0x9F;
    this.io[0x1E] = 0xBF;
    this.io[0x20] = 0xFF;
    this.io[0x21] = 0x00;
    this.io[0x22] = 0x00;
    this.io[0x23] = 0xBF;
    this.io[0x24] = 0x77;
    this.io[0x25] = 0xF3;
    this.io[0x26] = 0xF1;
    this.io[0x40] = 0x91;
    this.io[0x42] = 0x00;
    this.io[0x43] = 0x00;
    this.io[0x45] = 0x00;
    this.io[0x47] = 0xFC;
    this.io[0x48] = 0xFF;
    this.io[0x49] = 0xFF;
    this.io[0x4A] = 0x00;
    this.io[0x4B] = 0x00;
    this.io[0xFF] = 0x00;
  }

  loadROM(data) {
    if (typeof data === 'string') {
      const bytes = new Uint8Array(data.length);
      for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i) & 0xFF;
      data = bytes;
    }

    this.rom = new Uint8Array(data);

    // Parse header
    const title = [];
    for (let i = 0x134; i < 0x144; i++) {
      if (this.rom[i] === 0) break;
      title.push(String.fromCharCode(this.rom[i]));
    }
    this.headerTitle = title.join('');
    this.headerCartType = this.rom[0x147];
    this.headerROMSize = this.rom[0x148];
    this.headerRAMSize = this.rom[0x149];

    // Determine MBC type
    switch (this.headerCartType) {
      case 0x00: this.mbcType = 0; break; // ROM only
      case 0x01: case 0x02: case 0x03: this.mbcType = 1; break; // MBC1
      case 0x05: case 0x06: this.mbcType = 2; break; // MBC2
      case 0x0F: case 0x10: case 0x11: case 0x12: case 0x13: this.mbcType = 3; break; // MBC3
      case 0x19: case 0x1A: case 0x1B: case 0x1C: case 0x1D: case 0x1E: this.mbcType = 5; break; // MBC5
      default: this.mbcType = 0; break;
    }

    // ROM banks
    this.romBanks = 2 << this.headerROMSize;
    // RAM banks
    switch (this.headerRAMSize) {
      case 0x00: this.ramBanks = 0; break;
      case 0x01: this.ramBanks = 1; break;
      case 0x02: this.ramBanks = 1; break;
      case 0x03: this.ramBanks = 4; break;
      case 0x04: this.ramBanks = 16; break;
      case 0x05: this.ramBanks = 8; break;
      default: this.ramBanks = 0; break;
    }

    const savedMbc = this.mbcType;
    const savedRomBanks = this.romBanks;
    const savedRamBanks = this.ramBanks;
    const savedHeaderTitle = this.headerTitle;
    const savedHeaderCartType = this.headerCartType;
    const savedHeaderROMSize = this.headerROMSize;
    const savedHeaderRAMSize = this.headerRAMSize;

    this.reset();
    this.rom = new Uint8Array(data);
    this.mbcType = savedMbc;
    this.romBanks = savedRomBanks;
    this.ramBanks = savedRamBanks;
    this.headerTitle = savedHeaderTitle;
    this.headerCartType = savedHeaderCartType;
    this.headerROMSize = savedHeaderROMSize;
    this.headerRAMSize = savedHeaderRAMSize;

    // Set initial CPU state (post-boot ROM)
    this.cpu.a = 0x01; this.cpu.f = 0xB0;
    this.cpu.b = 0x00; this.cpu.c = 0x13;
    this.cpu.d = 0x00; this.cpu.e = 0xD8;
    this.cpu.h = 0x01; this.cpu.l = 0x4D;
    this.cpu.sp = 0xFFFE;
    this.cpu.pc = 0x0100;

    this.initIO();
  }

  memRead(addr) {
    addr &= 0xFFFF;

    // ROM Bank 0
    if (addr < 0x4000) {
      if (this.rom) return this.rom[addr] || 0;
      return 0xFF;
    }

    // ROM Bank 1-N
    if (addr < 0x8000) {
      if (this.rom && this.mbcType >= 1) {
        const bankAddr = (this.romBankNumber * 0x4000) + (addr - 0x4000);
        if (bankAddr < this.rom.length) return this.rom[bankAddr];
        return 0xFF;
      }
      if (this.rom) return this.rom[addr] || 0;
      return 0xFF;
    }

    // VRAM
    if (addr < 0xA000) {
      if (this.ppu.mode === 3) return 0xFF;
      return this.vram[addr - 0x8000];
    }

    // External RAM
    if (addr < 0xC000) {
      if (!this.ramEnabled || this.ramBanks === 0) return 0xFF;
      if (this.mbcType >= 1) {
        const ramAddr = (this.ramBankNumber * 0x2000) + (addr - 0xA000);
        return this.eram[ramAddr] || 0;
      }
      return this.eram[addr - 0xA000] || 0;
    }

    // WRAM Bank 0
    if (addr < 0xD000) {
      return this.wram[addr - 0xC000];
    }

    // WRAM Bank 1-N (GBC: switchable, DMG: always bank 1)
    if (addr < 0xE000) {
      return this.wram[0x1000 + (addr - 0xD000)];
    }

    // Echo RAM
    if (addr < 0xFE00) {
      return this.memRead(addr - 0x2000);
    }

    // OAM
    if (addr < 0xFEA0) {
      if (this.ppu.mode === 2 || this.ppu.mode === 3) return 0xFF;
      return this.oam[addr - 0xFE00];
    }

    // Unusable
    if (addr < 0xFF00) return 0xFF;

    // I/O Registers
    if (addr < 0xFF80) {
      // Joypad register - return button state
      if (addr === 0xFF00) {
        const input = this.io[0xFF00];
        const select = (input >> 4) & 3;
        // Return no buttons pressed (all bits set = nothing pressed)
        return input | 0x0F;
      }
      // LCDC register
      if (addr === 0xFF40) return this.io[0x40];
      // STAT register
      if (addr === 0xFF41) return this.io[0x41] | 0x80;
      // LY register
      if (addr === 0xFF44) return this.ppu.line;
      // DMA transfer
      return this.io[addr - 0xFF00];
    }

    // HRAM
    if (addr < 0xFFFF) {
      return this.hram[addr - 0xFF80];
    }

    // IE register
    return this.io[0xFF];
  }

  memWrite(addr, val) {
    addr &= 0xFFFF;
    val &= 0xFF;

    // ROM Bank 0 - MBC control
    if (addr < 0x2000) {
      if (this.mbcType >= 1) {
        this.ramEnabled = (val & 0x0F) === 0x0A;
      }
      return;
    }

    if (addr < 0x4000) {
      if (this.mbcType === 1) {
        this.romBankNumber = (this.romBankNumber & 0x60) | ((val || 1) & 0x1F);
        if (this.romBankNumber === 0) this.romBankNumber = 1;
        this.romBankNumber %= Math.max(this.romBanks, 1);
      } else if (this.mbcType >= 3) {
        this.romBankNumber = (val || 1) & 0x7F;
        if (this.romBankNumber === 0) this.romBankNumber = 1;
      }
      return;
    }

    // RAM Bank number / Upper ROM Bank bits
    if (addr < 0x6000) {
      if (this.mbcType === 1) {
        if (this.mbcMode === 0) {
          this.romBankNumber = (this.romBankNumber & 0x1F) | ((val & 3) << 5);
          this.romBankNumber %= Math.max(this.romBanks, 1);
        } else {
          this.ramBankNumber = val & 3;
          this.ramBankNumber %= Math.max(this.ramBanks, 1);
        }
      } else if (this.mbcType >= 3) {
        this.ramBankNumber = val & 0x03;
      }
      return;
    }

    // Banking mode select (MBC1)
    if (addr < 0x8000) {
      if (this.mbcType === 1) {
        this.mbcMode = val & 1;
      }
      return;
    }

    // VRAM
    if (addr < 0xA000) {
      if (this.ppu.mode !== 3) {
        this.vram[addr - 0x8000] = val;
      }
      return;
    }

    // External RAM
    if (addr < 0xC000) {
      if (this.ramEnabled && this.ramBanks > 0) {
        if (this.mbcType >= 1) {
          const ramAddr = (this.ramBankNumber * 0x2000) + (addr - 0xA000);
          this.eram[ramAddr] = val;
        } else {
          this.eram[addr - 0xA000] = val;
        }
      }
      return;
    }

    // WRAM Bank 0
    if (addr < 0xD000) {
      this.wram[addr - 0xC000] = val;
      return;
    }

    // WRAM Bank 1
    if (addr < 0xE000) {
      this.wram[0x1000 + (addr - 0xD000)] = val;
      return;
    }

    // Echo RAM
    if (addr < 0xFE00) {
      this.memWrite(addr - 0x2000, val);
      return;
    }

    // OAM
    if (addr < 0xFEA0) {
      if (this.ppu.mode !== 2 && this.ppu.mode !== 3) {
        this.oam[addr - 0xFE00] = val;
      }
      return;
    }

    // Unusable
    if (addr < 0xFF00) return;

    // I/O Registers
    if (addr < 0xFF80) {
      switch (addr) {
        // Joypad
        case 0xFF00:
          this.io[0x00] = (this.io[0x00] & 0x0F) | (val & 0x30);
          break;

        // Timer
        case 0xFF04: this.io[0x04] = 0; break;
        case 0xFF05: this.io[0x05] = val; break;
        case 0xFF06: this.io[0x06] = val; break;
        case 0xFF07: this.io[0x07] = val; break;

        // Interrupt Flag
        case 0xFF0F: this.io[0x0F] = val; break;

        // Sound registers - accept writes silently
        case 0xFF10: case 0xFF11: case 0xFF12: case 0xFF13: case 0xFF14:
        case 0xFF16: case 0xFF17: case 0xFF18: case 0xFF19:
        case 0xFF1A: case 0xFF1B: case 0xFF1C: case 0xFF1D: case 0xFF1E:
        case 0xFF20: case 0xFF21: case 0xFF22: case 0xFF23:
        case 0xFF24: case 0xFF25: case 0xFF26:
          this.io[addr - 0xFF00] = val;
          break;

        // Wave RAM
        case 0xFF30: case 0xFF31: case 0xFF32: case 0xFF33:
        case 0xFF34: case 0xFF35: case 0xFF36: case 0xFF37:
        case 0xFF38: case 0xFF39: case 0xFF3A: case 0xFF3B:
        case 0xFF3C: case 0xFF3D: case 0xFF3E: case 0xFF3F:
          this.io[addr - 0xFF00] = val;
          break;

        // LCDC
        case 0xFF40:
          this.io[0x40] = val;
          if (!(val & 0x80)) {
            this.ppu.line = 0;
            this.ppu.modeClock = 0;
            this.ppu.mode = 0;
          }
          break;

        // STAT
        case 0xFF41:
          this.io[0x41] = (this.io[0x41] & 0x07) | (val & 0x78);
          break;

        // SCY, SCX
        case 0xFF42: case 0xFF43:
          this.io[addr - 0xFF00] = val;
          break;

        // LY (read only)
        case 0xFF44: break;

        // LYC
        case 0xFF45:
          this.io[0x45] = val;
          break;

        // DMA
        case 0xFF46: {
          const src = val << 8;
          for (let i = 0; i < 0xA0; i++) {
            this.oam[i] = this.memRead(src + i);
          }
          break;
        }

        // BGP, OBP0, OBP1
        case 0xFF47: case 0xFF48: case 0xFF49:
          this.io[addr - 0xFF00] = val;
          break;

        // WY, WX
        case 0xFF4A: case 0xFF4B:
          this.io[addr - 0xFF00] = val;
          break;

        // VRAM Bank (GBC)
        case 0xFF4F: break;

        // Boot ROM disable (GBC)
        case 0xFF50: break;

        // Speed switch (GBC)
        case 0xFF4D: break;

        // Undocumented registers
        case 0xFF68: case 0xFF69: case 0xFF6A: case 0xFF6B:
          this.io[addr - 0xFF00] = val;
          break;

        default:
          if (addr >= 0xFF10 && addr <= 0xFF3F) {
            this.io[addr - 0xFF00] = val;
          }
          break;
      }
      return;
    }

    // HRAM
    if (addr < 0xFFFF) {
      this.hram[addr - 0xFF80] = val;
      return;
    }

    // IE register
    this.io[0xFF] = val;
  }

  frame() {
    this.frameCycleCount = 0;

    while (this.frameCycleCount < 70224) {
      const cycles = this.cpu.step();
      this.frameCycleCount += cycles;
      this.ppu.step(cycles);
    }
  }
}

// Export for module use or browser global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GBCPU, GBPPU, GBAPU, GameBoy };
} else if (typeof window !== 'undefined') {
  window.GameBoy = GameBoy;
}
