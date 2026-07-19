class PSPAllegrex {
  constructor(memRead8, memRead16, memRead32, memWrite8, memWrite16, memWrite32) {
    this.r = new Int32Array(32);
    this.hi = 0;
    this.lo = 0;
    this.pc = 0;
    this.nextPc = 0;
    this.branchDelay = false;
    this.branchTarget = 0;
    this.inDelaySlot = false;
    this.memRead8 = memRead8;
    this.memRead16 = memRead16;
    this.memRead32 = memRead32;
    this.memWrite8 = memWrite8;
    this.memWrite16 = memWrite16;
    this.memWrite32 = memWrite32;
    this.cop0 = new Int32Array(32);
    this.vfpu = new Float32Array(128 * 4);
    this.cp1fpu = new Float32Array(32);
    this.fcr31 = 0;
    this.cycles = 0;
    this.running = true;
    this.intercept = null;
    this.exceptions = [];
  }

  reset() {
    this.r.fill(0);
    this.hi = 0;
    this.lo = 0;
    this.pc = 0;
    this.nextPc = 0;
    this.branchDelay = false;
    this.branchTarget = 0;
    this.inDelaySlot = false;
    this.cop0.fill(0);
    this.vfpu.fill(0);
    this.cp1fpu.fill(0);
    this.fcr31 = 0;
    this.cycles = 0;
    this.running = true;
    this.exceptions = [];
  }

  raiseException(code, cop0ExcCode = 0) {
    const status = this.cop0[12];
    const mode = status & 0x3F;
    const exlBit = (status >> 1) & 1;
    const bevBit = (status >> 22) & 1;
    this.cop0[13] = (this.cop0[13] & 0xFFFFFF00) | (code << 2) | cop0ExcCode;
    this.cop0[14] = this.pc;
    let newMode = mode & 0x3C;
    if (!exlBit) {
      newMode |= 0x02;
    }
    this.cop0[12] = (status & ~0x3F) | newMode;
    this.pc = bevBit ? 0xBFC00380 : 0x80000080;
    this.nextPc = this.pc + 4;
    this.branchDelay = false;
    this.inDelaySlot = false;
  }

  triggerException(code, badAddr, cop0ExcCode) {
    this.cop0[8] = badAddr;
    this.raiseException(code, cop0ExcCode);
  }

  addSigned(a, b) {
    const r = (a + b) | 0;
    if (((a ^ r) & (b ^ r)) < 0) {
      this.triggerException(0xC, this.pc, 0x30);
      return 0;
    }
    return r;
  }

  subSigned(a, b) {
    const r = (a - b) | 0;
    if (((a ^ b) & (a ^ r)) < 0) {
      this.triggerException(0xC, this.pc, 0x30);
      return 0;
    }
    return r;
  }

  signExtend(val) {
    return (val << 16) >> 16;
  }

  signExtendByte(val) {
    return (val << 24) >> 24;
  }

  readReg(rt) {
    return this.r[rt];
  }

  writeReg(rt, val) {
    if (rt === 0) return;
    this.r[rt] = val;
  }

  checkAddressError(addr, store) {
    if (addr & 3) {
      this.triggerException(0x4, addr, 0x04);
      return true;
    }
    return false;
  }

  executeInstruction(instr) {
    if (instr === 0) return;

    const opcode = (instr >>> 26) & 0x3F;
    const rs = (instr >>> 21) & 0x1F;
    const rt = (instr >>> 16) & 0x1F;
    const rd = (instr >>> 11) & 0x1F;
    const shamt = (instr >>> 6) & 0x1F;
    const funct = instr & 0x3F;
    const imm16 = instr & 0xFFFF;
    const imm16s = (imm16 << 16) >> 16;
    const imm26 = instr & 0x3FFFFFF;
    const uimm16 = imm16 >>> 0;
    const r16 = instr & 0x7FF;
    const rsval = this.r[rs];
    const rtval = this.r[rt];

    if (this.intercept) {
      const handled = this.intercept(this.pc, instr, opcode, rs, rt, rd, funct);
      if (handled !== undefined) return handled;
    }

    switch (opcode) {
      case 0x00: {
        switch (funct) {
          case 0x00: this.writeReg(rd, rtval << shamt); break;
          case 0x02: this.writeReg(rd, (rtval >>> shamt) | 0); break;
          case 0x03: this.writeReg(rd, rtval >> shamt); break;
          case 0x04: this.writeReg(rd, (rtval << (rsval & 0x1F)) | 0); break;
          case 0x06: this.writeReg(rd, (rtval >>> (rsval & 0x1F)) | 0); break;
          case 0x07: this.writeReg(rd, rtval >> (rsval & 0x1F)); break;
          case 0x08: {
            this.branchTarget = rsval;
            this.branchDelay = true;
            break;
          }
          case 0x09: {
            this.writeReg(rd, this.nextPc);
            this.branchTarget = rsval;
            this.branchDelay = true;
            break;
          }
          case 0x0C:
            this.triggerException(0x8, this.pc, 0x08);
            break;
          case 0x0D:
            this.running = false;
            return -1;
          case 0x10: this.writeReg(rd, this.hi); break;
          case 0x11: this.hi = rsval; break;
          case 0x12: this.writeReg(rd, this.lo); break;
          case 0x13: this.lo = rsval; break;
          case 0x18: {
            const a = rsval;
            const b = rtval;
            const prod = BigInt(a) * BigInt(b);
            this.lo = Number(prod & 0xFFFFFFFFn) | 0;
            this.hi = Number((prod >> 32n) & 0xFFFFFFFFn) | 0;
            break;
          }
          case 0x19: {
            const a = rsval >>> 0;
            const b = rtval >>> 0;
            const prod = BigInt(a) * BigInt(b);
            this.lo = Number(prod & 0xFFFFFFFFn) | 0;
            this.hi = Number((prod >> 32n) & 0xFFFFFFFFn) | 0;
            break;
          }
          case 0x1A: {
            if (rtval === 0) {
              this.triggerException(0xC, this.pc, 0x30);
              break;
            }
            const a = rsval;
            const b = rtval;
            this.lo = (a / b) | 0;
            this.hi = (a % b) | 0;
            break;
          }
          case 0x1B: {
            if (rtval === 0) {
              this.triggerException(0xC, this.pc, 0x30);
              break;
            }
            const a = rsval >>> 0;
            const b = rtval >>> 0;
            this.lo = (a / b) | 0;
            this.hi = (a % b) | 0;
            break;
          }
          case 0x20: this.writeReg(rd, this.addSigned(rsval, rtval)); break;
          case 0x21: this.writeReg(rd, (rsval + rtval) | 0); break;
          case 0x22: this.writeReg(rd, this.subSigned(rsval, rtval)); break;
          case 0x23: this.writeReg(rd, (rsval - rtval) | 0); break;
          case 0x24: this.writeReg(rd, rsval & rtval); break;
          case 0x25: this.writeReg(rd, rsval | rtval); break;
          case 0x26: this.writeReg(rd, rsval ^ rtval); break;
          case 0x27: this.writeReg(rd, ~(rsval | rtval)); break;
          case 0x2A: this.writeReg(rd, (rsval < rtval) ? 1 : 0); break;
          case 0x2B: this.writeReg(rd, ((rsval >>> 0) < (rtval >>> 0)) ? 1 : 0); break;
          case 0x30: case 0x31: {
            const result = this.addSigned(rsval, rtval);
            this.lo = result;
            this.hi = (result >> 31) & 1 ? 0xFFFFFFFF : 0;
            break;
          }
          case 0x34: {
            if (rtval === 0) {
              this.triggerException(0xC, this.pc, 0x30);
              break;
            }
            const a = BigInt.asIntN(64, BigInt(rsval)) * BigInt.asIntN(64, BigInt(rtval));
            this.lo = Number(a & 0xFFFFFFFFn) | 0;
            this.hi = Number((a >> 32n) & 0xFFFFFFFFn) | 0;
            break;
          }
          case 0x36: {
            if (rtval === 0) {
              this.triggerException(0xC, this.pc, 0x30);
              break;
            }
            const a = BigInt.asUintN(64, BigInt(rsval)) * BigInt.asUintN(64, BigInt(rtval));
            this.lo = Number(a & 0xFFFFFFFFn) | 0;
            this.hi = Number((a >> 32n) & 0xFFFFFFFFn) | 0;
            break;
          }
          case 0x38: {
            const prod = BigInt.asIntN(64, BigInt(rsval)) * BigInt.asIntN(64, BigInt(rtval));
            let lo = BigInt.asIntN(64, BigInt(this.lo));
            let hi = BigInt.asIntN(64, BigInt(this.hi));
            let sum = (hi << 32n) | (lo & 0xFFFFFFFFn);
            sum += prod;
            this.lo = Number(sum & 0xFFFFFFFFn) | 0;
            this.hi = Number((sum >> 32n) & 0xFFFFFFFFn) | 0;
            break;
          }
          case 0x39: {
            let prod = BigInt(rsval >>> 0) * BigInt(rtval >>> 0);
            let sum = (BigInt(this.hi) << 32n) | BigInt(this.lo >>> 0);
            sum += prod;
            this.lo = Number(sum & 0xFFFFFFFFn) | 0;
            this.hi = Number((sum >> 32n) & 0xFFFFFFFFn) | 0;
            break;
          }
          case 0x3C: {
            const prod = BigInt.asIntN(64, BigInt(rsval)) * BigInt.asIntN(64, BigInt(rtval));
            let sum = (BigInt.asIntN(64, BigInt(this.hi)) << 32n) | BigInt.asIntN(64, BigInt(this.lo));
            sum -= prod;
            this.lo = Number(sum & 0xFFFFFFFFn) | 0;
            this.hi = Number((sum >> 32n) & 0xFFFFFFFFn) | 0;
            break;
          }
          case 0x3D: {
            let prod = BigInt(rsval >>> 0) * BigInt(rtval >>> 0);
            let sum = (BigInt(this.hi) << 32n) | BigInt(this.lo >>> 0);
            sum -= prod;
            this.lo = Number(sum & 0xFFFFFFFFn) | 0;
            this.hi = Number((sum >> 32n) & 0xFFFFFFFFn) | 0;
            break;
          }
          case 0x0F: {
            this.nextPc = (this.pc + 4) | 0;
            this.pc = (this.pc & 0xF0000000) | (imm26 << 2);
            break;
          }
          default:
            break;
        }
        break;
      }
      case 0x01: {
        const bcond = (rs & 0x1E);
        const isLink = (rs & 0x01) !== 0;
        const offset = imm16s << 2;
        let test = false;
        switch (bcond) {
          case 0x00: test = rsval < 0; break;
          case 0x02: test = rsval >= 0; break;
          case 0x10: test = rsval < 0; break;
          case 0x12: test = rsval >= 0; break;
        }
        if (isLink) {
          this.writeReg(31, this.nextPc);
        }
        if (test) {
          this.branchTarget = this.nextPc + offset;
          this.branchDelay = true;
        }
        break;
      }
      case 0x02: {
        const target = (this.nextPc & 0xF0000000) | (imm26 << 2);
        this.branchTarget = target;
        this.branchDelay = true;
        break;
      }
      case 0x03: {
        this.writeReg(31, this.nextPc);
        const target = (this.nextPc & 0xF0000000) | (imm26 << 2);
        this.branchTarget = target;
        this.branchDelay = true;
        break;
      }
      case 0x04: {
        const offset = imm16s << 2;
        if (rsval === rtval) {
          this.branchTarget = this.nextPc + offset;
          this.branchDelay = true;
        }
        break;
      }
      case 0x05: {
        const offset = imm16s << 2;
        if (rsval !== rtval) {
          this.branchTarget = this.nextPc + offset;
          this.branchDelay = true;
        }
        break;
      }
      case 0x06: {
        const offset = imm16s << 2;
        if (rsval <= 0) {
          this.branchTarget = this.nextPc + offset;
          this.branchDelay = true;
        }
        break;
      }
      case 0x07: {
        const offset = imm16s << 2;
        if (rsval > 0) {
          this.branchTarget = this.nextPc + offset;
          this.branchDelay = true;
        }
        break;
      }
      case 0x08: this.writeReg(rt, this.addSigned(rsval, imm16s)); break;
      case 0x09: this.writeReg(rt, (rsval + imm16s) | 0); break;
      case 0x0A: this.writeReg(rt, (rsval < imm16s) ? 1 : 0); break;
      case 0x0B: this.writeReg(rt, ((rsval >>> 0) < uimm16) ? 1 : 0); break;
      case 0x0C: this.writeReg(rt, rsval & uimm16); break;
      case 0x0D: this.writeReg(rt, rsval | uimm16); break;
      case 0x0E: this.writeReg(rt, rsval ^ uimm16); break;
      case 0x0F: this.writeReg(rt, imm16 << 16); break;
      case 0x10: {
        const sub = (rs >>> 0);
        const subFunct = r16 & 0x1F;
        if (sub === 0x00) {
          this.writeReg(rt, this.cop0[rd]);
        } else if (sub === 0x04) {
          this.cop0[rd] = rsval;
        } else if (sub === 0x10) {
          if ((instr & 0x3F) === 0x10) {
            const status = this.cop0[12];
            const mode = status & 0x3F;
            const newMode = (mode & 0x3C) | ((mode & 0x03) << 2);
            this.cop0[12] = (status & ~0x3F) | (newMode & 0x3F);
          }
        } else if (sub === 0x18) {
          const status = this.cop0[12];
          this.cop0[12] = status & ~(1 << 1);
          this.pc = this.cop0[14];
          this.nextPc = this.pc + 4;
        }
        break;
      }
      case 0x12: {
        const sub = (rs >>> 0);
        if (sub === 0x00) {
          this.writeReg(rt, this.cp1fpu[rd] | 0);
        } else if (sub === 0x04) {
          this.cp1fpu[rd] = this.r[rt] | 0;
        }
        break;
      }
      case 0x13: {
        const fmt = (rs >>> 0);
        const ft = rt;
        const fs = rd;
        const fd = shamt;
        const funct7 = funct;
        if (fmt === 0x00) {
          this.cp1fpu[fd] = this.r[ft] | 0;
        } else if (fmt === 0x04) {
          if (funct7 === 0x00) {
            this.writeReg(ft, this.cp1fpu[fs] | 0);
          } else if (funct7 === 0x01) {
            this.cp1fpu[fs] = this.cp1fpu[ft];
          } else if (funct7 === 0x02) {
            this.cp1fpu[fd] = this.cp1fpu[fs] + this.cp1fpu[ft];
          } else if (funct7 === 0x03) {
            this.cp1fpu[fd] = this.cp1fpu[fs] - this.cp1fpu[ft];
          } else if (funct7 === 0x06) {
            this.cp1fpu[fd] = this.cp1fpu[fs] - this.cp1fpu[ft];
          } else if (funct7 === 0x07) {
            this.cp1fpu[fd] = Math.abs(this.cp1fpu[fs] - this.cp1fpu[ft]);
          } else if (funct7 === 0x18) {
            this.cp1fpu[fd] = this.cp1fpu[fs] * this.cp1fpu[ft];
          } else if (funct7 === 0x19) {
            this.cp1fpu[fd] = this.cp1fpu[fs] * this.cp1fpu[ft];
          } else if (funct7 === 0x20) {
            this.cp1fpu[fd] = this.cp1fpu[fs] / this.cp1fpu[ft];
          } else if (funct7 === 0x21) {
            this.cp1fpu[fd] = Math.sqrt(this.cp1fpu[fs]);
          } else if (funct7 === 0x2D) {
            this.cp1fpu[fd] = Math.round(this.cp1fpu[fs]);
          } else if (funct7 === 0x30) {
            this.cp1fpu[fd] = Math.floor(this.cp1fpu[fs] + 0.5);
          } else if (funct7 === 0x32) {
            const b = this.cp1fpu[fs];
            const a = this.cp1fpu[ft];
            this.cp1fpu[fd] = a + b * 2;
          } else if (funct7 === 0x33) {
            const a = this.cp1fpu[fs];
            const b = this.cp1fpu[ft];
            this.cp1fpu[fd] = a + b * 2;
          } else if (funct7 === 0x36) {
            const a = this.cp1fpu[fs];
            const b = this.cp1fpu[ft];
            this.cp1fpu[fd] = a - b * 2;
          } else if (funct7 === 0x37) {
            const a = this.cp1fpu[fs];
            const b = this.cp1fpu[ft];
            this.cp1fpu[fd] = a - b * 2;
          }
        } else if (fmt === 0x01) {
          if (funct7 === 0x00) {
            this.cp1fpu[fd] = Math.round(this.cp1fpu[fs]);
          } else if (funct7 === 0x01) {
            this.cp1fpu[fd] = Math.floor(this.cp1fpu[fs]);
          } else if (funct7 === 0x03) {
            this.cp1fpu[fd] = Math.ceil(this.cp1fpu[fs]);
          }
        } else if (fmt === 0x07) {
          if (funct7 === 0x00) {
            this.cp1fpu[fd] = this.r[ft] | 0;
          } else if (funct7 === 0x02) {
            const v = this.cp1fpu[fs];
            this.writeReg(ft, (v < 0) ? 0xFFFFFFFF : (v > 0 ? 1 : 0));
          } else if (funct7 === 0x24) {
            this.cp1fpu[fd] = Math.floor(this.cp1fpu[fs]);
          }
        } else if (fmt === 0x10) {
          if (funct7 === 0x00) {
            this.writeReg(fd, this.cp1fpu[fs] | 0);
          } else if (funct7 === 0x01) {
            const v = this.r[fs];
            const view = new Float32Array([v]);
            this.writeReg(fd, view[0] | 0);
          }
        } else if (fmt === 0x11) {
          if (funct7 === 0x00) {
            this.writeReg(fd, this.cp1fpu[fs] | 0);
          } else if (funct7 === 0x01) {
            const v = this.r[fs];
            const buf = new ArrayBuffer(4);
            new Int32Array(buf)[0] = v;
            this.cp1fpu[fd] = new Float32Array(buf)[0];
          }
        } else if (fmt === 0x20 || fmt === 0x21) {
          const cond = (this.fcr31 >> 8) & 0x1;
          if (funct7 === 0x32) {
            const a = this.cp1fpu[fs];
            const b = this.cp1fpu[ft];
            if (a === b) this.writeReg(fd, 1);
            else if (a < b) this.writeReg(fd, 0x80000000);
            else this.writeReg(fd, (cond) ? 1 : 0x20000000);
          } else if (funct7 === 0x3C) {
            const a = this.cp1fpu[fs];
            const b = this.cp1fpu[ft];
            if (a === b) this.writeReg(fd, 0x20000000);
            else if (a < b) this.writeReg(fd, 0x80000000);
            else this.writeReg(fd, 1);
          } else if (funct7 === 0x3E) {
            const a = this.cp1fpu[fs];
            const b = this.cp1fpu[ft];
            if (a <= b) this.writeReg(fd, 0x20000000);
            else this.writeReg(fd, 1);
          } else if (funct7 === 0x30) {
            const a = this.cp1fpu[fs];
            if (a === 0) this.writeReg(fd, 0x20000000);
            else if (a < 0) this.writeReg(fd, 0x80000000);
            else this.writeReg(fd, 1);
          } else if (funct7 === 0x3A) {
            const a = this.cp1fpu[fs];
            if (a <= 0) this.writeReg(fd, 0x20000000);
            else this.writeReg(fd, 1);
          }
        } else if (fmt === 0x14) {
          const imm14 = (instr >>> 6) & 0x3FFF;
          const sign = (imm14 >> 13) & 1;
          const exp10 = (imm14 >> 3) & 0x3FF;
          const frac10 = imm14 & 0x7;
          let f = frac10 / 8.0;
          if (exp10 === 0) {
            f = f * Math.pow(2, -24);
          } else {
            f = (1 + f) * Math.pow(2, exp10 - 25);
          }
          if (sign) f = -f;
          this.cp1fpu[fd] = f;
        }
        break;
      }
      case 0x20: {
        const addr = (rsval + imm16s) | 0;
        if (this.checkAddressError(addr, false)) break;
        const val = this.memRead8(addr);
        this.writeReg(rt, this.signExtendByte(val));
        break;
      }
      case 0x21: {
        const addr = (rsval + imm16s) | 0;
        if (this.checkAddressError(addr, false)) break;
        const val = this.memRead16(addr);
        this.writeReg(rt, this.signExtend(val));
        break;
      }
      case 0x22: {
        const addr = (rsval + imm16s) | 0;
        const byte = addr & 3;
        const aligned = addr & ~3;
        const word = this.memRead32(aligned);
        let val;
        switch (byte) {
          case 0: val = (word >> 24); break;
          case 1: val = (word >> 16); break;
          case 2: val = (word >> 8); break;
          case 3: val = word; break;
        }
        this.writeReg(rt, this.signExtendByte(val & 0xFF));
        break;
      }
      case 0x23: {
        const addr = (rsval + imm16s) | 0;
        if (this.checkAddressError(addr, false)) break;
        const val = this.memRead32(addr);
        this.writeReg(rt, val);
        break;
      }
      case 0x24: {
        const addr = (rsval + imm16s) | 0;
        if (this.checkAddressError(addr, false)) break;
        const val = this.memRead8(addr);
        this.writeReg(rt, val & 0xFF);
        break;
      }
      case 0x25: {
        const addr = (rsval + imm16s) | 0;
        if (this.checkAddressError(addr, false)) break;
        const val = this.memRead16(addr);
        this.writeReg(rt, val & 0xFFFF);
        break;
      }
      case 0x26: {
        const addr = (rsval + imm16s) | 0;
        const byte = addr & 3;
        const aligned = addr & ~3;
        const word = this.memRead32(aligned);
        let val;
        switch (byte) {
          case 0: val = (word >> 24); break;
          case 1: val = (word >> 16); break;
          case 2: val = (word >> 8); break;
          case 3: val = word; break;
        }
        this.writeReg(rt, val & 0xFF);
        break;
      }
      case 0x27: {
        const addr = (rsval + imm16s) | 0;
        if (this.checkAddressError(addr, false)) break;
        const val = this.memRead32(addr);
        this.writeReg(rt, val & 0xFFFFFFFF);
        break;
      }
      case 0x28: {
        const addr = (rsval + imm16s) | 0;
        if (this.checkAddressError(addr, true)) break;
        const byte = addr & 3;
        const aligned = addr & ~3;
        let word = this.memRead32(aligned);
        word = (word & ~(0xFF << (byte * 8))) | ((rtval & 0xFF) << (byte * 8));
        this.memWrite32(aligned, word);
        break;
      }
      case 0x29: {
        const addr = (rsval + imm16s) | 0;
        if (this.checkAddressError(addr, true)) break;
        const byte = addr & 2;
        const aligned = addr & ~3;
        let word = this.memRead32(aligned);
        word = (word & ~(0xFFFF << (byte * 8))) | ((rtval & 0xFFFF) << (byte * 8));
        this.memWrite32(aligned, word);
        break;
      }
      case 0x2B: {
        const addr = (rsval + imm16s) | 0;
        if (this.checkAddressError(addr, true)) break;
        this.memWrite32(addr, rtval);
        break;
      }
      case 0x30: {
        const addr = (rsval + imm16s) | 0;
        if (this.checkAddressError(addr, false)) break;
        const val = this.memRead32(addr);
        this.cop0[28] = val;
        break;
      }
      case 0x38: {
        const addr = (rsval + imm16s) | 0;
        if (this.checkAddressError(addr, true)) break;
        this.memWrite32(addr, rtval);
        break;
      }
      case 0x3C: {
        if (imm16 === 0x43E0) {
          this.cp1fpu[31] = rtval;
          this.fcr31 = rtval;
        }
        break;
      }
      case 0x2F: {
        const addr = (rsval + imm16s) | 0;
        if (this.checkAddressError(addr, false)) break;
        const val = this.memRead32(addr);
        this.cp1fpu[rt] = val;
        break;
      }
      case 0x39: {
        const addr = (rsval + imm16s) | 0;
        if (this.checkAddressError(addr, true)) break;
        this.memWrite32(addr, this.cp1fpu[rt] | 0);
        break;
      }
      case 0x18: {
        const addr = (rsval + imm16s) | 0;
        if (this.checkAddressError(addr, false)) break;
        break;
      }
      case 0x30: {
        const addr = (rsval + imm16s) | 0;
        break;
      }
      case 0x1B: {
        const addr = (rsval + imm16s) | 0;
        break;
      }
      case 0x1C: {
        const addr = (rsval + imm16s) | 0;
        break;
      }
      case 0x2C: {
        const addr = (rsval + imm16s) | 0;
        break;
      }
      default:
        break;
    }
  }

  step() {
    if (!this.running) return false;
    if (this.pc === 0) {
      this.running = false;
      return false;
    }
    this.inDelaySlot = this.branchDelay;
    this.nextPc = (this.pc + 4) | 0;
    const instr = this.memRead32(this.pc);
    if (this.checkAddressError(this.pc, false)) return true;
    this.executeInstruction(instr);
    this.pc = this.nextPc;
    if (this.branchDelay) {
      this.pc = this.branchTarget;
      this.branchDelay = false;
    }
    this.r[0] = 0;
    this.cop0[0] = 0;
    this.cop0[13] = this.cop0[13] & ~1;
    this.cycles++;
    return true;
  }

  runCycles(count) {
    let ran = 0;
    while (ran < count && this.running) {
      if (!this.step()) break;
      ran++;
    }
    return ran;
  }
}

class PSPGE {
  constructor(emulator) {
    this.emu = emulator;
    this.width = 480;
    this.height = 272;
    this.vramWidth = 512;
    this.framebuffer = new Uint32Array(this.width * this.height);
    this.depthBuffer = new Uint32Array(this.width * this.height);
    this.state = {
      projectionMatrix: new Float32Array(16),
      viewMatrix: new Float32Array(16),
      worldMatrix: new Float32Array(16),
      viewPosMatrix: new Float32Array(16),
      viewDirMatrix: new Float32Array(16),
      textureMatrix: new Float32Array(16),
      colorR: 1.0,
      colorG: 1.0,
      colorB: 1.0,
      colorA: 1.0,
      fogColor: 0,
      ambientColor: [1, 1, 1, 1],
      materialColor: [1, 1, 1, 1],
      diffuseColor: [0, 0, 0, 0],
      specularColor: [0, 0, 0, 0],
      ambientMatColor: [0, 0, 0, 0],
      diffuseMatColor: [0, 0, 0, 0],
      specularMatColor: [0, 0, 0, 0],
      viewportX: 0,
      viewportY: 0,
      viewportWidth: 480,
      viewportHeight: 272,
      offsetX: 0,
      offsetY: 0,
      offsetScale: 0,
      depthRangeNear: 0,
      depthRangeFar: 1,
      frameBufferAddr: 0,
      frameBufferStride: 512,
      frameBufferFormat: 3,
      depthBufferAddr: 0,
      depthBufferStride: 512,
      texturePageBaseX: 0,
      texturePageBaseY: 0,
      texturePageOffsetX: 0,
      texturePageOffsetY: 0,
      textureWindowMaskX: 0,
      textureWindowMaskY: 0,
      textureWindowOffsetX: 0,
      textureWindowOffsetY: 0,
      textureWidth: 256,
      textureHeight: 256,
      blendEnabled: false,
      blendOp: 0,
      blendSrc: 0,
      blendDst: 0,
      logicOp: 0,
      depthTestEnabled: false,
      depthTestFunc: 0,
      scissorTestEnabled: false,
      scissorX1: 0,
      scissorY1: 0,
      scissorX2: 480,
      scissorY2: 272,
      cullFaceEnabled: false,
      cullFaceDir: 0,
      frontFaceCCW: true,
      textureEnabled: false,
      vertexFormat: 0,
      primitiveType: 0,
      morphWeight: new Float32Array(8),
      numLights: 0,
      lightPos: [],
      lightDir: [],
      lightColor: [],
      lightAmbient: [],
      lightSpecular: [],
      clearFlags: 0,
      clearColorR: 0,
      clearColorG: 0,
      clearColorB: 0,
      clearColorA: 0,
      clearDepth: 1,
      texFunc: 0,
      texMapMode: 0,
      texShadeColor: 0,
      alphaTestEnabled: false,
      alphaTestFunc: 0,
      alphaTestRef: 0,
      stencilTestEnabled: false,
      maskBitEnabled: false,
      patchPrim: 0,
      patchDivS: 1,
      patchDivT: 1,
      patchFacing: 0,
      pointSize: 1,
      lineSize: 1,
      colorTestEnabled: false,
      patchCull: 0,
      fogEnabled: false,
      ditherEnabled: false,
      minz: 0,
      maxz: 1,
    };
    this.identityMatrix(this.state.projectionMatrix);
    this.identityMatrix(this.state.viewMatrix);
    this.identityMatrix(this.state.worldMatrix);
    this.identityMatrix(this.state.viewPosMatrix);
    this.identityMatrix(this.state.viewDirMatrix);
    this.identityMatrix(this.state.textureMatrix);
    for (let i = 0; i < 8; i++) {
      this.state.lightPos.push([0, 0, 0]);
      this.state.lightDir.push([0, 0, -1]);
      this.state.lightColor.push([1, 1, 1]);
      this.state.lightAmbient.push([0, 0, 0]);
      this.state.lightSpecular.push([0, 0, 0]);
    }
    this.vertices = [];
    this.currentVertex = {};
    this.displayLists = [];
    this.dlProcessing = false;
  }

  reset() {
    this.framebuffer.fill(0xFF000000);
    this.depthBuffer.fill(0xFFFFFFFF);
    this.identityMatrix(this.state.projectionMatrix);
    this.identityMatrix(this.state.viewMatrix);
    this.identityMatrix(this.state.worldMatrix);
    this.identityMatrix(this.state.viewPosMatrix);
    this.identityMatrix(this.state.viewDirMatrix);
    this.identityMatrix(this.state.textureMatrix);
    this.vertices = [];
    this.currentVertex = {};
    this.displayLists = [];
    this.dlProcessing = false;
    this.state.clearColorR = 0;
    this.state.clearColorG = 0;
    this.state.clearColorB = 0;
    this.state.clearColorA = 0;
    this.state.clearDepth = 1;
  }

  identityMatrix(out) {
    out.fill(0);
    out[0] = out[5] = out[10] = out[15] = 1.0;
  }

  multiplyMatrix(out, a, b) {
    const result = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        result[i * 4 + j] = 0;
        for (let k = 0; k < 4; k++) {
          result[i * 4 + j] += a[k * 4 + j] * b[i * 4 + k];
        }
      }
    }
    for (let i = 0; i < 16; i++) out[i] = result[i];
  }

  transformVertex(x, y, z, w) {
    const mvp = new Float32Array(16);
    const temp = new Float32Array(16);
    this.multiplyMatrix(temp, this.state.viewMatrix, this.state.worldMatrix);
    this.multiplyMatrix(mvp, this.state.projectionMatrix, temp);
    const rx = mvp[0] * x + mvp[4] * y + mvp[8] * z + mvp[12] * w;
    const ry = mvp[1] * x + mvp[5] * y + mvp[9] * z + mvp[13] * w;
    const rz = mvp[2] * x + mvp[6] * y + mvp[10] * z + mvp[14] * w;
    const rw = mvp[3] * x + mvp[7] * y + mvp[11] * z + mvp[15] * w;
    return [rx, ry, rz, rw];
  }

  screenTransform(rx, ry, rz, rw) {
    if (rw === 0) rw = 0.001;
    const ndcx = rx / rw;
    const ndcy = ry / rw;
    const ndcz = rz / rw;
    const sx = this.state.viewportX + this.state.viewportWidth * (ndcx * 0.5 + 0.5);
    const sy = this.state.viewportY + this.state.viewportHeight * (ndcy * 0.5 + 0.5);
    const sz = (ndcz + 1) * 0.5;
    const fw = this.state.viewportWidth;
    const fh = this.state.viewportHeight;
    const ox = this.state.offsetX;
    const oy = this.state.offsetY;
    const os = Math.pow(2, this.state.offsetScale);
    const fx = sx * os + ox;
    const fy = sy * os + oy;
    const fz = sz;
    return [fx, fy, fz];
  }

  rasterizeTriangle(v0, v1, v2) {
    let [x0, y0, z0] = v0.screen;
    let [x1, y1, z1] = v1.screen;
    let [x2, y2, z2] = v2.screen;
    if (x0 === x1 && y0 === y1 && x1 === x2 && y1 === y2) return;
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
    const maxX = Math.min(this.width - 1, Math.ceil(Math.max(x0, x1, x2)));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
    const maxY = Math.min(this.height - 1, Math.ceil(Math.max(y0, y1, y2)));
    if (minX > maxX || minY > maxY) return;
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (Math.abs(area) < 0.001) return;
    const invArea = 1.0 / area;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const w0 = ((x1 - x0) * (y - y0) - (y1 - y0) * (x - x0)) * invArea;
        const w1 = ((x2 - x1) * (y - y1) - (y2 - y1) * (x - x1)) * invArea;
        const w2 = 1 - w0 - w1;
        if (w0 >= 0 && w1 >= 0 && w2 >= 0) {
          const z = w0 * z0 + w1 * z1 + w2 * z2;
          if (this.state.depthTestEnabled) {
            const depthIdx = y * this.width + x;
            const depthVal = this.depthBuffer[depthIdx];
            const testZ = Math.floor(z * 0x7FFFFFFF);
            let pass = false;
            switch (this.state.depthTestFunc) {
              case 0: pass = false; break;
              case 1: pass = testZ < depthVal; break;
              case 2: pass = testZ <= depthVal; break;
              case 3: pass = testZ === depthVal; break;
              case 4: pass = testZ >= depthVal; break;
              case 5: pass = testZ > depthVal; break;
              case 6: pass = testZ !== depthVal; break;
              case 7: pass = true; break;
              default: pass = testZ <= depthVal; break;
            }
            if (!pass) continue;
            this.depthBuffer[depthIdx] = testZ;
          }
          let r = Math.floor((w0 * v0.color[0] + w1 * v1.color[0] + w2 * v2.color[0]) * 255);
          let g = Math.floor((w0 * v0.color[1] + w1 * v1.color[1] + w2 * v2.color[1]) * 255);
          let b = Math.floor((w0 * v0.color[2] + w1 * v1.color[2] + w2 * v2.color[2]) * 255);
          let a = Math.floor((w0 * v0.color[3] + w1 * v1.color[3] + w2 * v2.color[3]) * 255);
          r = Math.max(0, Math.min(255, r));
          g = Math.max(0, Math.min(255, g));
          b = Math.max(0, Math.min(255, b));
          a = Math.max(0, Math.min(255, a));
          const color = 0xFF000000 | (r << 16) | (g << 8) | b;
          if (this.state.blendEnabled) {
            const idx = y * this.width + x;
            const dst = this.framebuffer[idx];
            const dr = (dst >> 16) & 0xFF;
            const dg = (dst >> 8) & 0xFF;
            const db = dst & 0xFF;
            const da = (dst >> 24) & 0xFF;
            let fr = r, fg = g, fb = b, fa = a;
            const srcFactor = this.state.blendSrc;
            const dstFactor = this.state.blendDst;
            switch (srcFactor) {
              case 0: fr = r; fg = g; fb = b; fa = a; break;
              case 1: fr = 0; fg = 0; fb = 0; fa = 0; break;
              case 2: fr = dr; fg = dg; fb = db; fa = da; break;
              case 3: fr = 255 - dr; fg = 255 - dg; fb = 255 - db; fa = 255 - da; break;
              case 4: fr = Math.floor(r * da / 255); break;
              default: fr = r; fg = g; fb = b; fa = a; break;
            }
            let sr2 = fr, sg2 = fg, sb2 = fb, sa2 = fa;
            switch (dstFactor) {
              case 0: break;
              case 1: sr2 = 0; sg2 = 0; sb2 = 0; sa2 = 0; break;
              case 2: sr2 += Math.floor(dr * a / 255); sg2 += Math.floor(dg * a / 255); sb2 += Math.floor(db * a / 255); sa2 += Math.floor(da * a / 255); break;
              case 3: sr2 += Math.floor(dr * (255 - a) / 255); sg2 += Math.floor(dg * (255 - a) / 255); sb2 += Math.floor(db * (255 - a) / 255); sa2 += Math.floor(da * (255 - a) / 255); break;
              default: sr2 += dr; sg2 += dg; sb2 += db; sa2 += da; break;
            }
            this.framebuffer[idx] = 0xFF000000 | (Math.min(255, sr2) << 16) | (Math.min(255, sg2) << 8) | Math.min(255, sb2);
          } else {
            this.framebuffer[y * this.width + x] = color;
          }
        }
      }
    }
  }

  drawPrimitive(type, vertices) {
    if (vertices.length < 3) return;
    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i];
      const worldPos = this.transformVertex(v.x, v.y, v.z, 1.0);
      v.screen = this.screenTransform(worldPos[0], worldPos[1], worldPos[2], worldPos[3]);
    }
    switch (type) {
      case 1:
        for (let i = 0; i + 2 < vertices.length; i += 3) {
          this.rasterizeTriangle(vertices[i], vertices[i + 1], vertices[i + 2]);
        }
        break;
      case 2:
        for (let i = 1; i + 1 < vertices.length; i++) {
          this.rasterizeTriangle(vertices[0], vertices[i], vertices[i + 1]);
        }
        break;
      case 3:
        for (let i = 0; i + 2 < vertices.length; i += 2) {
          if (i + 2 < vertices.length) {
            this.rasterizeTriangle(vertices[i], vertices[i + 1], vertices[i + 2]);
          }
        }
        break;
      case 4:
        for (let i = 2; i < vertices.length; i++) {
          this.rasterizeTriangle(vertices[i - 2], vertices[i - 1], vertices[i]);
        }
        break;
      default:
        for (let i = 0; i + 2 < vertices.length; i += 3) {
          this.rasterizeTriangle(vertices[i], vertices[i + 1], vertices[i + 2]);
        }
        break;
    }
  }

  processCommand(cmd) {
    const opcode = (cmd >>> 26) & 0x3F;
    const param = cmd & 0x00FFFFFF;
    const top2 = (cmd >>> 24) & 0xFF;

    switch (top2) {
      case 0x00:
      case 0x10:
      case 0x11:
        break;
      case 0x12: {
        const sub = opcode & 0x0F;
        switch (sub) {
          case 0x00:
            this.state.projectionMatrix.fill(0);
            this.state.projectionMatrix[0] = this.state.projectionMatrix[5] = this.state.projectionMatrix[10] = this.state.projectionMatrix[15] = 1.0;
            break;
          case 0x01:
            this.state.viewMatrix.fill(0);
            this.state.viewMatrix[0] = this.state.viewMatrix[5] = this.state.viewMatrix[10] = this.state.viewMatrix[15] = 1.0;
            break;
          case 0x02:
            this.state.worldMatrix.fill(0);
            this.state.worldMatrix[0] = this.state.worldMatrix[5] = this.state.worldMatrix[10] = this.state.worldMatrix[15] = 1.0;
            break;
          case 0x03:
            this.state.textureMatrix.fill(0);
            this.state.textureMatrix[0] = this.state.textureMatrix[5] = this.state.textureMatrix[10] = this.state.textureMatrix[15] = 1.0;
            break;
        }
        break;
      }
      case 0x13:
        break;
      case 0x14:
        break;
      case 0x15:
        break;
      case 0x16:
        break;
      case 0x1A:
        break;
      case 0x1B:
        break;
      case 0x1C:
        break;
      case 0x20:
        break;
      case 0x21:
        break;
      case 0x22:
        break;
      case 0x23:
        break;
      case 0x24:
        break;
      case 0x25:
        break;
      case 0x26:
        break;
      case 0x27:
        break;
      case 0x28:
        break;
      case 0x29:
        break;
      case 0x2A:
        break;
      case 0x2B:
        break;
      case 0x2C:
        break;
      case 0x30:
        break;
      case 0x31:
        break;
      case 0x32:
        break;
      case 0x33:
        break;
      case 0x34:
        break;
      case 0x35:
        break;
      case 0x36:
        break;
      case 0x37:
        break;
      case 0x38:
        break;
      case 0x39:
        break;
      case 0x3A:
        break;
      case 0x3B:
        break;
      case 0x3C:
        break;
      case 0x3D:
        break;
      case 0x3E:
        break;
      case 0x3F:
        break;
      case 0x40:
        break;
      case 0x41:
        break;
      case 0x42:
        break;
      case 0x43:
        break;
      case 0x44:
        break;
      case 0x45:
        break;
      case 0x46:
        break;
      case 0x47:
        break;
      case 0x48:
        break;
      case 0x49:
        break;
      case 0x4A:
        break;
      case 0x4B:
        break;
      case 0x4C:
        break;
      case 0x4D:
        break;
      case 0x4E:
        break;
      case 0x4F:
        break;
      case 0x50:
        break;
      case 0x51:
        break;
      case 0x52:
        break;
      case 0x53:
        break;
      case 0x54:
        break;
      case 0x55:
        break;
      case 0x56:
        break;
      case 0x57:
        break;
      case 0x58:
        break;
      case 0x59:
        break;
      case 0x5A:
        break;
      case 0x5B:
        break;
      case 0x5C:
        break;
      case 0x5D:
        break;
      case 0x5E:
        break;
      case 0x5F:
        break;
      case 0x60:
        break;
      case 0x61:
        break;
      case 0x62:
        break;
      case 0x63:
        break;
      case 0x64:
        break;
      case 0x65:
        break;
      case 0x66:
        break;
      case 0x67:
        break;
      case 0x68:
        break;
      case 0x69:
        break;
      case 0x6A:
        break;
      case 0x6B:
        break;
      case 0x6C:
        break;
      case 0x6D:
        break;
      case 0x6E:
        break;
      case 0x6F:
        break;
      case 0x70:
        break;
      case 0x71:
        break;
      case 0x72:
        break;
      case 0x73:
        break;
      case 0x74:
        break;
      case 0x75:
        break;
      case 0x76:
        break;
      case 0x77:
        break;
      case 0x78:
        break;
      case 0x79:
        break;
      case 0x7A:
        break;
      case 0x7B:
        break;
      case 0x7C:
        break;
      case 0x7D:
        break;
      case 0x7E:
        break;
      case 0x7F:
        break;
      case 0x80:
        break;
      case 0x81:
        break;
      case 0x82:
        break;
      case 0x83:
        break;
      case 0x84:
        break;
      case 0x85:
        break;
      case 0x86:
        break;
      case 0x87:
        break;
      case 0x88:
        break;
      case 0x89:
        break;
      case 0x8A:
        break;
      case 0x8B:
        break;
      case 0x8C:
        break;
      case 0x8D:
        break;
      case 0x8E:
        break;
      case 0x8F:
        break;
      case 0x90:
        break;
      case 0x91:
        break;
      case 0x92:
        break;
      case 0x93:
        break;
      case 0x94:
        break;
      case 0x95:
        break;
      case 0x96:
        break;
      case 0x97:
        break;
      case 0x98:
        break;
      case 0x99:
        break;
      case 0x9A:
        break;
      case 0x9B:
        break;
      case 0x9C:
        break;
      case 0x9D:
        break;
      case 0x9E:
        break;
      case 0x9F:
        break;
      case 0xA0:
        break;
      case 0xA1:
        break;
      case 0xA2:
        break;
      case 0xA3:
        break;
      case 0xA4:
        break;
      case 0xA5:
        break;
      case 0xA6:
        break;
      case 0xA7:
        break;
      case 0xA8:
        break;
      case 0xA9:
        break;
      case 0xAA:
        break;
      case 0xAB:
        break;
      case 0xAC:
        break;
      case 0xAD:
        break;
      case 0xAE:
        break;
      case 0xAF:
        break;
      case 0xB0:
        break;
      case 0xB1:
        break;
      case 0xB2:
        break;
      case 0xB3:
        break;
      case 0xB4:
        break;
      case 0xB5:
        break;
      case 0xB6:
        break;
      case 0xB7:
        break;
      case 0xB8:
        break;
      case 0xB9:
        break;
      case 0xBA:
        break;
      case 0xBB:
        break;
      case 0xBC:
        break;
      case 0xBD:
        break;
      case 0xBE:
        break;
      case 0xBF:
        break;
      case 0xC0:
        this.state.frameBufferAddr = param & 0xFFFFFC;
        break;
      case 0xC1:
        this.state.frameBufferStride = (param + 1) & 0xFFFF;
        break;
      case 0xC2:
        this.state.frameBufferFormat = param & 0xF;
        break;
      case 0xC3:
        this.state.frameBufferWidth = (param & 0xFFFF) + 1;
        this.state.frameBufferHeight = ((param >> 16) & 0xFFFF) + 1;
        break;
      case 0xC4:
        break;
      case 0xC5:
        break;
      case 0xC6:
        break;
      case 0xC7:
        break;
      case 0xD0:
        this.state.depthBufferAddr = param & 0xFFFFFC;
        break;
      case 0xD1:
        this.state.depthBufferStride = (param + 1) & 0xFFFF;
        break;
      case 0xD2:
        this.state.depthBufferFormat = param & 0xF;
        break;
      case 0xD3:
        break;
      case 0xD4:
        break;
      case 0xD5:
        break;
      case 0xD6:
        break;
      case 0xD7:
        break;
      case 0xE0:
        break;
      case 0xE1:
        this.state.texturePageBaseX = param & 0xF;
        this.state.texturePageBaseY = (param >> 4) & 0x1;
        this.state.texturePageOffsetX = (param >> 10) & 0xF;
        this.state.texturePageOffsetY = (param >> 14) & 0xF;
        break;
      case 0xE2:
        this.state.textureWindowMaskX = param & 0x1F;
        this.state.textureWindowMaskY = (param >> 5) & 0x1F;
        this.state.textureWindowOffsetX = (param >> 10) & 0x1F;
        this.state.textureWindowOffsetY = (param >> 15) & 0x1F;
        break;
      case 0xE3:
        this.state.scissorX1 = param & 0x3FF;
        this.state.scissorY1 = (param >> 10) & 0x1FF;
        break;
      case 0xE4:
        this.state.scissorX2 = param & 0x3FF;
        this.state.scissorY2 = (param >> 10) & 0x1FF;
        break;
      case 0xE5:
        this.state.offsetX = ((param & 0xFFFF) << 8) >> 8;
        this.state.offsetY = ((param >> 16) << 8) >> 8;
        break;
      case 0xE6:
        this.state.offsetScale = param & 0x1F;
        break;
      case 0xE7:
        this.state.clutX = param & 0x3F;
        this.state.clutY = (param >> 6) & 0x1FF;
        break;
      case 0xE8:
        break;
      case 0xE9:
        break;
      case 0xEA:
        break;
      case 0xEB:
        this.state.clearColorR = (param & 0xFF) / 255.0;
        this.state.clearColorG = ((param >> 8) & 0xFF) / 255.0;
        this.state.clearColorB = ((param >> 16) & 0xFF) / 255.0;
        break;
      case 0xEC:
        this.state.clearColorA = (param & 0xFF) / 255.0;
        break;
      case 0xED:
        this.state.clearDepth = param & 0xFFFF;
        break;
      case 0xEE:
        this.state.clearFlags = param;
        break;
      case 0xEF:
        break;
      case 0xF0:
        break;
      case 0xF1:
        break;
      case 0xF2:
        break;
      case 0xF3:
        break;
      case 0xF4:
        break;
      case 0xF5:
        break;
      case 0xF6:
        break;
      case 0xF7:
        break;
      case 0xF8:
        break;
      case 0xF9:
        break;
      case 0xFA:
        break;
      case 0xFB:
        break;
      case 0xFC:
        break;
      case 0xFD:
        break;
      case 0xFE:
        break;
      case 0xFF:
        break;
    }

    switch (opcode) {
      case 0x00: break;
      case 0x01:
        this.state.vertexFormat = param & 0xFF;
        this.vertices = [];
        this.currentVertex = { x: 0, y: 0, z: 0, w: 1, color: [1, 1, 1, 1], u: 0, v: 0, nx: 0, ny: 0, nz: 1 };
        break;
      case 0x02:
        this.state.primitiveType = param & 0x7;
        break;
      case 0x03:
        this.state.textureEnabled = (param & 1) === 1;
        break;
      case 0x04:
        this.state.blendEnabled = (param & 1) === 1;
        break;
      case 0x05:
        this.state.blendOp = param & 0xF;
        break;
      case 0x06:
        this.state.blendSrc = param & 0xF;
        this.state.blendDst = (param >> 4) & 0xF;
        break;
      case 0x07:
        this.state.depthTestEnabled = (param & 1) === 1;
        break;
      case 0x08:
        this.state.depthTestFunc = param & 0x7;
        break;
      case 0x09:
        this.state.fogEnabled = (param & 1) === 1;
        break;
      case 0x0A:
        this.state.cullFaceEnabled = (param & 1) === 1;
        break;
      case 0x0B:
        this.state.frontFaceCCW = ((param >> 1) & 1) === 0;
        break;
      case 0x0C:
        this.state.scissorTestEnabled = (param & 1) === 1;
        break;
      case 0x0D:
        this.state.ditherEnabled = (param & 1) === 1;
        break;
      case 0x0E:
        this.state.maskBitEnabled = (param & 1) === 1;
        break;
      case 0x10:
        this.state.alphaTestEnabled = (param & 1) === 1;
        break;
      case 0x11:
        this.state.alphaTestFunc = param & 0x7;
        this.state.alphaTestRef = (param >> 8) & 0xFF;
        break;
      case 0x12:
        this.state.colorTestEnabled = (param & 1) === 1;
        break;
      case 0x13:
        this.state.stencilTestEnabled = (param & 1) === 1;
        break;
      case 0x14:
        break;
      case 0x15:
        break;
      case 0x16:
        break;
      case 0x17:
        break;
      case 0x18:
        this.state.pointSize = (param & 0xFFFF) / 16.0;
        break;
      case 0x19:
        break;
      case 0x1A:
        break;
      case 0x1B:
        this.state.lineSize = (param & 0xFFFF) / 16.0;
        break;
      case 0x20:
        this.state.numLights = param;
        break;
      case 0x21:
      case 0x22:
      case 0x23:
      case 0x24:
      case 0x25:
      case 0x26:
      case 0x27:
      case 0x28: {
        const lightIdx = opcode - 0x21;
        if (lightIdx < 8) {
          this.state.lightAmbient[lightIdx] = [
            ((param) & 0xFF) / 255,
            ((param >> 8) & 0xFF) / 255,
            ((param >> 16) & 0xFF) / 255
          ];
        }
        break;
      }
      case 0x30:
      case 0x31:
      case 0x32:
      case 0x33:
      case 0x34:
      case 0x35:
      case 0x36:
      case 0x37:
      case 0x38: {
        const lightIdx2 = opcode - 0x30;
        if (lightIdx2 < 8) {
          this.state.lightDir[lightIdx2] = [
            (((param) & 0xFF) / 127.5) - 1,
            (((param >> 8) & 0xFF) / 127.5) - 1,
            (((param >> 16) & 0xFF) / 127.5) - 1
          ];
        }
        break;
      }
      case 0x40:
      case 0x41:
      case 0x42:
      case 0x43:
      case 0x44:
      case 0x45:
      case 0x46:
      case 0x47:
      case 0x48: {
        const lightIdx3 = opcode - 0x40;
        if (lightIdx3 < 8) {
          const spec = ((param >> 0) & 0xFF) / 255;
          const diff = ((param >> 8) & 0xFF) / 255;
          const amb = ((param >> 16) & 0xFF) / 255;
          this.state.lightSpecular[lightIdx3] = [spec, diff, amb];
        }
        break;
      }
      case 0x50:
      case 0x51:
      case 0x52:
      case 0x53:
      case 0x54:
      case 0x55:
      case 0x56:
      case 0x57:
      case 0x58: {
        const lightIdx4 = opcode - 0x50;
        if (lightIdx4 < 8) {
          this.state.lightColor[lightIdx4] = [
            ((param) & 0xFF) / 255,
            ((param >> 8) & 0xFF) / 255,
            ((param >> 16) & 0xFF) / 255
          ];
        }
        break;
      }
      case 0x60:
      case 0x61:
      case 0x62:
      case 0x63:
      case 0x64:
      case 0x65:
      case 0x66:
      case 0x67:
      case 0x68: {
        const lightIdx5 = opcode - 0x60;
        if (lightIdx5 < 8) {
          this.state.lightPos[lightIdx5] = [
            (((param) & 0xFF) / 127.5) - 1,
            (((param >> 8) & 0xFF) / 127.5) - 1,
            (((param >> 16) & 0xFF) / 127.5) - 1
          ];
        }
        break;
      }
      case 0x70: {
        this.state.materialColor[0] = ((param) & 0xFF) / 255;
        this.state.materialColor[1] = ((param >> 8) & 0xFF) / 255;
        this.state.materialColor[2] = ((param >> 16) & 0xFF) / 255;
        this.state.materialColor[3] = ((param >> 24) & 0xFF) / 255;
        break;
      }
      case 0x71: {
        this.state.diffuseColor[0] = ((param) & 0xFF) / 255;
        this.state.diffuseColor[1] = ((param >> 8) & 0xFF) / 255;
        this.state.diffuseColor[2] = ((param >> 16) & 0xFF) / 255;
        break;
      }
      case 0x72: {
        this.state.ambientColor[0] = ((param) & 0xFF) / 255;
        this.state.ambientColor[1] = ((param >> 8) & 0xFF) / 255;
        this.state.ambientColor[2] = ((param >> 16) & 0xFF) / 255;
        break;
      }
      case 0x73: {
        this.state.specularColor[0] = ((param) & 0xFF) / 255;
        this.state.specularColor[1] = ((param >> 8) & 0xFF) / 255;
        this.state.specularColor[2] = ((param >> 16) & 0xFF) / 255;
        break;
      }
      case 0x74: {
        const matIdx = (opcode - 0x74);
        this.state.ambientMatColor[0] = ((param) & 0xFF) / 255;
        this.state.ambientMatColor[1] = ((param >> 8) & 0xFF) / 255;
        this.state.ambientMatColor[2] = ((param >> 16) & 0xFF) / 255;
        break;
      }
      case 0x75:
        this.state.diffuseMatColor[0] = ((param) & 0xFF) / 255;
        this.state.diffuseMatColor[1] = ((param >> 8) & 0xFF) / 255;
        this.state.diffuseMatColor[2] = ((param >> 16) & 0xFF) / 255;
        break;
      case 0x76:
        this.state.specularMatColor[0] = ((param) & 0xFF) / 255;
        this.state.specularMatColor[1] = ((param >> 8) & 0xFF) / 255;
        this.state.specularMatColor[2] = ((param >> 16) & 0xFF) / 255;
        break;
      case 0x80:
      case 0x81:
      case 0x82:
      case 0x83:
      case 0x84:
      case 0x85:
      case 0x86:
      case 0x87:
        this.state.morphWeight[opcode - 0x80] = (param & 0xFFFF) / 65536.0;
        break;
      case 0xA0:
        break;
      case 0xA1:
        break;
      case 0xA2:
        break;
      case 0xA3:
        break;
      case 0xA4:
        break;
      case 0xA5:
        break;
      case 0xA6:
        break;
      case 0xA7:
        break;
      case 0xB0: {
        if (this.vertices.length > 0) {
          this.drawPrimitive(this.state.primitiveType, this.vertices);
          this.vertices = [];
        }
        break;
      }
      case 0xB1:
        break;
      case 0xB2:
        break;
      case 0xC8:
        break;
      case 0xC9:
        break;
      case 0xCA:
        break;
      case 0xCB:
        break;
      case 0xCC:
        break;
      case 0xCD:
        break;
      case 0xCE:
        break;
      case 0xCF:
        break;
      case 0xD8:
        break;
      case 0xD9:
        break;
      case 0xDA:
        break;
      case 0xDB:
        break;
      case 0xDC:
        break;
      case 0xDD:
        break;
      case 0xDE:
        break;
      case 0xDF:
        break;
      case 0xE8: {
        const count = (param & 0xFF) + 1;
        break;
      }
      case 0xE9:
        break;
      case 0xEA:
        break;
      default:
        break;
    }
  }

  addVertexCommand(param) {
    const fmt = this.state.vertexFormat;
    const v = {
      x: 0, y: 0, z: 0, w: 1,
      color: [this.state.colorR, this.state.colorG, this.state.colorB, this.state.colorA],
      u: 0, v: 0,
      nx: 0, ny: 0, nz: 1,
      weights: [0, 0, 0, 0, 0, 0, 0, 0]
    };

    if (fmt & 0x01) {
      v.x = (((param) & 0xFFFF) << 16) >> 16;
      v.y = (((param >> 16) & 0xFFFF) << 16) >> 16;
    }
    if (fmt & 0x02) {
      v.z = (((param) & 0xFFFF) << 16) >> 16;
      if (fmt & 0x01) {
        v.w = 1.0;
      }
    }
    if (fmt & 0x04) {
      v.u = (param & 0xFFFF) / 32768.0;
      v.v = ((param >> 16) & 0xFFFF) / 32768.0;
    }
    if (fmt & 0x08) {
      const r = (param) & 0xFF;
      const g = (param >> 8) & 0xFF;
      const b = (param >> 16) & 0xFF;
      const a = (param >> 24) & 0xFF;
      v.color = [r / 255, g / 255, b / 255, a / 255];
    }
    if (fmt & 0x10) {
      v.nx = (((param) & 0xFF) / 127.5) - 1;
      v.ny = (((param >> 8) & 0xFF) / 127.5) - 1;
      v.nz = (((param >> 16) & 0xFF) / 127.5) - 1;
    }

    this.vertices.push(v);
  }

  processDisplayList(addr, size) {
    this.dlProcessing = true;
    let idx = 0;
    let vertCount = 0;
    const maxVerts = 256;
    while (idx < size && this.dlProcessing) {
      const cmd = this.emu.memRead32(addr + idx * 4);
      idx++;
      const opcode = (cmd >>> 24) & 0xFF;
      if (opcode >= 0x10 && opcode <= 0x1F) {
        this.processCommand(cmd);
      } else if (opcode >= 0x60 && opcode <= 0x7F) {
        this.addVertexCommand(cmd & 0x00FFFFFF);
        vertCount++;
        if (vertCount >= maxVerts) {
          if (this.vertices.length >= 3) {
            this.drawPrimitive(this.state.primitiveType, this.vertices);
          }
          this.vertices = [];
          vertCount = 0;
        }
      } else if (opcode >= 0x20 && opcode <= 0x3F) {
        this.processCommand(cmd);
      } else if (opcode >= 0xC0 && opcode <= 0xFF) {
        this.processCommand(cmd);
      } else if (opcode >= 0xE0 && opcode <= 0xEF) {
        this.processCommand(cmd);
      } else if (opcode >= 0x80 && opcode <= 0x9F) {
        this.processCommand(cmd);
      } else if (opcode === 0x00) {
        if (cmd === 0) break;
      }
    }
    if (this.vertices.length >= 3) {
      this.drawPrimitive(this.state.primitiveType, this.vertices);
    }
    this.vertices = [];
    this.dlProcessing = false;
  }

  clear(flags, color, depth) {
    const cr = ((color >> 16) & 0xFF);
    const cg = ((color >> 8) & 0xFF);
    const cb = (color & 0xFF);
    const ca = ((color >> 24) & 0xFF);
    const packedColor = 0xFF000000 | (cr << 16) | (cg << 8) | cb;
    if (flags & 1) {
      this.framebuffer.fill(packedColor);
    }
    if (flags & 2) {
      this.depthBuffer.fill(depth);
    }
  }

  present(pixels) {
    pixels.set(this.framebuffer);
  }
}

class PSPAudio {
  constructor() {
    this.registers = new Uint32Array(256);
  }

  reset() {
    this.registers.fill(0);
  }

  read(addr) {
    return 0;
  }

  write(addr, val) {
    const reg = (addr >> 2) & 0xFF;
    this.registers[reg] = val;
  }
}

class PSP {
  constructor() {
    this.width = 480;
    this.height = 272;
    this.pixels = new Uint32Array(this.width * this.height);
    this.ram = new Uint8Array(32 * 1024 * 1024);
    this.vram = new Uint8Array(2 * 1024 * 1024);
    this.cpu = new PSPAllegrex(
      (a) => this.memRead8(a),
      (a) => this.memRead16(a),
      (a) => this.memRead32(a),
      (a, v) => this.memWrite8(a, v),
      (a, v) => this.memWrite16(a, v),
      (a, v) => this.memWrite32(a, v)
    );
    this.ge = new PSPGE(this);
    this.audio = new PSPAudio();
    this.dma = new Array(16);
    for (let i = 0; i < 16; i++) {
      this.dma[i] = { src: 0, dst: 0, size: 0, control: 0, started: false };
    }
    this.sif = { iuStat: 0, mStat: 0 };
    this.interrupts = { stat: 0, enable: 0, pending: 0 };
    this.timers = [];
    for (let i = 0; i < 4; i++) {
      this.timers.push({ counter: 0, target: 0, mode: 0, count: 0, started: false });
    }
    this.gpTimer = { count: 0, target: 0, mode: 0, started: false };
    this.cpu.intercept = (pc, instr, opcode, rs, rt, rd, funct) => this.cpuIntercept(pc, instr, opcode, rs, rt, rd, funct);
  }

  reset() {
    this.ram.fill(0);
    this.vram.fill(0);
    this.cpu.reset();
    this.ge.reset();
    this.audio.reset();
    for (let i = 0; i < 16; i++) {
      this.dma[i] = { src: 0, dst: 0, size: 0, control: 0, started: false };
    }
    this.sif = { iuStat: 0, mStat: 0 };
    this.interrupts = { stat: 0, enable: 0, pending: 0 };
    for (let i = 0; i < 4; i++) {
      this.timers[i] = { counter: 0, target: 0, mode: 0, count: 0, started: false };
    }
    this.gpTimer = { count: 0, target: 0, mode: 0, started: false };
    this.pixels.fill(0xFF000000);
  }

  loadROM(data) {
    this.reset();
    if (data.length < 4) return false;
    if (data[0] === 0x7F && data[1] === 0x45 && data[2] === 0x4C && data[3] === 0x46) {
      return this.loadELF(data);
    }
    if (data[0] === 0x00 && data[1] === 0x50 && data[2] === 0x42 && data[3] === 0x50) {
      return this.loadPBP(data);
    }
    if (data.length >= 0x1000) {
      this.loadBinary(data, 0x08800000);
      this.cpu.pc = 0x08800000;
      this.cpu.nextPc = this.cpu.pc + 4;
      return true;
    }
    return false;
  }

  loadPBP(data) {
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const header = dv.getUint32(0, true);
    if (header !== 0x00504250) return false;
    const offsets = [];
    for (let i = 0; i < 8; i++) {
      offsets.push(dv.getUint32(4 + i * 4, true));
    }
    const dataPspStart = offsets[6];
    const dataPspEnd = offsets[7];
    if (dataPspStart >= data.length || dataPspEnd > data.length) return false;
    const pspData = data.slice(dataPspStart, dataPspEnd);
    return this.loadELF(pspData);
  }

  loadELF(data) {
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    if (dv.getUint32(0, false) !== 0x7F454C46) return false;
    const eType = dv.getUint16(16, false);
    const eEntry = dv.getUint32(24, false);
    const ePhoff = dv.getUint32(28, false);
    const eShoff = dv.getUint32(32, false);
    const ePhnum = dv.getUint16(42, false);
    const eShnum = dv.getUint16(48, false);
    const eShstrndx = dv.getUint16(50, false);
    let kernelMode = false;
    if (eShnum > 0 && eShoff > 0 && eShstrndx < eShnum) {
      const shstrOff = eShoff + eShstrndx * 40;
      const shstrOffset = dv.getUint32(shstrOff + 24, false);
      for (let i = 0; i < eShnum; i++) {
        const shOff = eShoff + i * 40;
        const shNameIdx = dv.getUint32(shOff, false);
        const shName = this.readELFString(data, shstrOffset + shNameIdx);
        if (shName === '.module_start' || shName === '.text') {
          const shAddr = dv.getUint32(shOff + 16, false);
          if (shAddr >= 0x88000000) {
            kernelMode = true;
          }
        }
      }
    }
    const baseAddr = kernelMode ? 0x08800000 : 0x08800000;
    for (let i = 0; i < ePhnum; i++) {
      const phOff = ePhoff + i * 32;
      const pType = dv.getUint32(phOff, false);
      const pOffset = dv.getUint32(phOff + 4, false);
      const pVaddr = dv.getUint32(phOff + 8, false);
      const pPaddr = dv.getUint32(phOff + 12, false);
      const pFilesz = dv.getUint32(phOff + 16, false);
      const pMemsz = dv.getUint32(phOff + 20, false);
      if (pType === 1 && pFilesz > 0) {
        const target = pVaddr >= 0x08000000 ? pVaddr : pVaddr + baseAddr;
        this.loadBinary(data.slice(pOffset, pOffset + pFilesz), target);
        if (pMemsz > pFilesz) {
          const zeroSize = pMemsz - pFilesz;
          const zbuf = new Uint8Array(zeroSize);
          this.loadBinary(zbuf, target + pFilesz);
        }
      }
    }
    this.cpu.pc = eEntry;
    this.cpu.nextPc = eEntry + 4;
    return true;
  }

  readELFString(data, offset) {
    let str = '';
    while (offset < data.length && data[offset] !== 0) {
      str += String.fromCharCode(data[offset]);
      offset++;
    }
    return str;
  }

  loadBinary(data, addr) {
    for (let i = 0; i < data.length; i++) {
      this.memWrite8(addr + i, data[i]);
    }
  }

  memRead8(addr) {
    addr = addr >>> 0;
    if (addr >= 0x08000000 && addr < 0x0A000000) {
      const offset = addr - 0x08000000;
      if (offset < this.ram.length) return this.ram[offset];
      return 0;
    }
    if (addr >= 0x0A000000 && addr < 0x0C000000) {
      const offset = addr - 0x0A000000;
      if (offset < this.ram.length) return this.ram[offset];
      return 0;
    }
    if (addr >= 0x04100000 && addr < 0x04200000) {
      const offset = addr - 0x04100000;
      if (offset < this.vram.length) return this.vram[offset];
      return 0;
    }
    if (addr >= 0x08800000 && addr < 0x0A000000) {
      const offset = addr - 0x08800000 + 0x00800000;
      if (offset < this.ram.length) return this.ram[offset];
      return 0;
    }
    if (addr >= 0x04000000 && addr < 0x06000000) {
      return 0;
    }
    if (addr >= 0x04400000 && addr < 0x04500000) {
      return 0;
    }
    if (addr >= 0x04600000 && addr < 0x04700000) {
      return this.ioRead8(addr);
    }
    if (addr >= 0x04700000 && addr < 0x04800000) {
      return this.audio.read(addr);
    }
    if (addr >= 0x04800000 && addr < 0x04900000) {
      return 0;
    }
    return 0;
  }

  memRead16(addr) {
    const b0 = this.memRead8(addr);
    const b1 = this.memRead8(addr + 1);
    return (b0 & 0xFF) | ((b1 & 0xFF) << 8);
  }

  memRead32(addr) {
    addr = addr >>> 0;
    if (addr >= 0x04400000 && addr < 0x04600000) {
      return 0;
    }
    if (addr >= 0x04600000 && addr < 0x04700000) {
      return this.ioRead32(addr);
    }
    const b0 = this.memRead8(addr);
    const b1 = this.memRead8(addr + 1);
    const b2 = this.memRead8(addr + 2);
    const b3 = this.memRead8(addr + 3);
    return (b0 & 0xFF) | ((b1 & 0xFF) << 8) | ((b2 & 0xFF) << 16) | ((b3 & 0xFF) << 24);
  }

  memWrite8(addr, val) {
    addr = addr >>> 0;
    val = val & 0xFF;
    if (addr >= 0x08000000 && addr < 0x0A000000) {
      const offset = addr - 0x08000000;
      if (offset < this.ram.length) this.ram[offset] = val;
      return;
    }
    if (addr >= 0x0A000000 && addr < 0x0C000000) {
      const offset = addr - 0x0A000000;
      if (offset < this.ram.length) this.ram[offset] = val;
      return;
    }
    if (addr >= 0x04100000 && addr < 0x04200000) {
      const offset = addr - 0x04100000;
      if (offset < this.vram.length) this.vram[offset] = val;
      return;
    }
    if (addr >= 0x08800000 && addr < 0x0A000000) {
      const offset = addr - 0x08800000 + 0x00800000;
      if (offset < this.ram.length) this.ram[offset] = val;
      return;
    }
    if (addr >= 0x04000000 && addr < 0x06000000) {
      return;
    }
    if (addr >= 0x04400000 && addr < 0x04600000) {
      return;
    }
    if (addr >= 0x04600000 && addr < 0x04700000) {
      this.ioWrite8(addr, val);
      return;
    }
    if (addr >= 0x04700000 && addr < 0x04800000) {
      this.audio.write(addr, val);
      return;
    }
  }

  memWrite16(addr, val) {
    val = val & 0xFFFF;
    this.memWrite8(addr, val & 0xFF);
    this.memWrite8(addr + 1, (val >> 8) & 0xFF);
  }

  memWrite32(addr, val) {
    addr = addr >>> 0;
    val = val | 0;
    if (addr >= 0x04400000 && addr < 0x04600000) {
      return;
    }
    if (addr >= 0x04600000 && addr < 0x04700000) {
      this.ioWrite32(addr, val);
      return;
    }
    if (addr >= 0x04000000 && addr < 0x06000000) {
      return;
    }
    if (addr >= 0x04700000 && addr < 0x04800000) {
      this.audio.write(addr, val);
      return;
    }
    this.memWrite8(addr, val & 0xFF);
    this.memWrite8(addr + 1, (val >> 8) & 0xFF);
    this.memWrite8(addr + 2, (val >> 16) & 0xFF);
    this.memWrite8(addr + 3, (val >> 24) & 0xFF);
  }

  ioRead8(addr) {
    return 0;
  }

  ioRead32(addr) {
    if (addr >= 0x04600000 && addr < 0x04600100) {
      return 0;
    }
    return 0;
  }

  ioWrite8(addr, val) {
  }

  ioWrite32(addr, val) {
    if (addr >= 0x04600000 && addr < 0x04600100) {
      return;
    }
  }

  cpuIntercept(pc, instr, opcode, rs, rt, rd, funct) {
    if (pc === 0x08800000 || pc === 0x08800004) {
      if (instr === 0x0000000C) {
        this.handleSyscall();
        return 0;
      }
    }
    return undefined;
  }

  handleSyscall() {
    const ra = this.cpu.r[31];
    if (ra >= 0x08000000 && ra < 0x0C000000) {
      const callNum = this.cpu.r[1];
      switch (callNum) {
        case 0x1000:
          break;
        default:
          break;
      }
    }
  }

  frame() {
    const cyclesPerFrame = 333000000 / 60;
    const maxCycles = 3700000;
    let cyclesRun = 0;
    while (cyclesRun < maxCycles && this.cpu.running) {
      const before = this.cpu.cycles;
      this.cpu.step();
      const elapsed = this.cpu.cycles - before;
      cyclesRun += Math.max(1, elapsed);
      this.cpu.cycles = cyclesRun;
      if (cyclesRun % 1000 === 0) {
        this.updateTimers(1000);
      }
    }
    this.ge.present(this.pixels);
  }

  updateTimers(count) {
    for (let i = 0; i < 4; i++) {
      const t = this.timers[i];
      if (t.started) {
        t.count += count;
        t.counter = (t.counter + count) & 0xFFFFFFFF;
        if (t.target !== 0 && t.counter >= t.target) {
          if (t.mode & 0x08) {
            t.counter = 0;
          }
        }
      }
    }
    this.gpTimer.count += count;
    if (this.gpTimer.started) {
      this.gpTimer.counter = (this.gpTimer.counter + count) & 0xFFFFFFFF;
    }
  }

  triggerDMA(channel) {
    const dma = this.dma[channel];
    if (!dma || !dma.started) return;
    for (let i = 0; i < dma.size; i++) {
      const byte = this.memRead8(dma.src + i);
      this.memWrite8(dma.dst + i, byte);
    }
    dma.started = false;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PSP, PSPAllegrex, PSPGE, PSPAudio };
}
