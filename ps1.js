"use strict";

class PS1R3000A {
  constructor(ps1) {
    this.ps1 = ps1;
    this.regs = new Int32Array(32);
    this.pc = 0;
    this.nextPC = 0;
    this.hi = 0;
    this.lo = 0;
    this.cop0 = new Int32Array(32);
    this.cop2Data = new Int32Array(32);
    this.cop2Ctrl = new Int32Array(32);
    this.delaySlot = false;
    this.pendingLoad = { reg: 0, val: 0 };
    this.branchQue = [];
    this.stopped = false;
    this.cycles = 0;
    this.gteInstruction = 0;
  }

  reset() {
    this.regs.fill(0);
    this.pc = 0xBFC00000;
    this.nextPC = this.pc + 4;
    this.hi = 0;
    this.lo = 0;
    this.cop0.fill(0);
    this.cop2Data.fill(0);
    this.cop2Ctrl.fill(0);
    this.delaySlot = false;
    this.stopped = false;
    this.cycles = 0;
    this.branchQue = [];
  }

  triggerException(cause, excode) {
    const status = this.cop0[12];
    const mode = status & 0x3F;
    const handler = (status & (1 << 22)) ? 0x80000180 : 0x80000080;
    this.cop0[13] = (this.cop0[13] & ~0x7C) | (excode << 2);
    this.cop0[14] = this.pc;
    this.cop0[12] = (status & ~0x3F) | ((mode << 2) & 0x3F);
    this.pc = handler;
    this.nextPC = handler + 4;
    this.delaySlot = false;
  }

  step() {
    if (this.stopped) {
      this.cycles++;
      return 1;
    }

    const instruction = this.ps1.memRead32(this.pc & 0x1FFFFFFF);

    if (this.delaySlot) {
      this.delaySlot = false;
      for (const b of this.branchQue) {
        b();
      }
      this.branchQue = [];
    }

    this.pc = this.nextPC;
    this.nextPC = this.pc + 4;

    const opcode = (instruction >>> 26) & 0x3F;
    const rs = (instruction >>> 21) & 0x1F;
    const rt = (instruction >>> 16) & 0x1F;
    const rd = (instruction >>> 11) & 0x1F;
    const shamt = (instruction >>> 6) & 0x1F;
    const funct = instruction & 0x3F;
    const imm = instruction & 0xFFFF;
    const simm = (imm << 16) >> 16;
    const uimm = imm >>> 0;
    const target = instruction & 0x3FFFFFF;

    this.regs[0] = 0;

    switch (opcode) {
      case 0x00: // SPECIAL
        this.executeSpecial(funct, rs, rt, rd, shamt, instruction);
        break;
      case 0x01: // BLTZ/BGEZ
        this.executeRegimm(rt, rs, simm);
        break;
      case 0x02: // J
        this.branchQue.push(() => {
          this.nextPC = ((this.pc + 4) & 0xF0000000) | (target << 2);
        });
        this.delaySlot = true;
        break;
      case 0x03: // JAL
        this.regs[31] = this.nextPC;
        this.branchQue.push(() => {
          this.nextPC = ((this.pc + 4) & 0xF0000000) | (target << 2);
        });
        this.delaySlot = true;
        break;
      case 0x04: // BEQ
        if (this.regs[rs] === this.regs[rt]) {
          this.branchQue.push(() => {
            this.nextPC = this.pc + (simm << 2);
          });
          this.delaySlot = true;
        }
        break;
      case 0x05: // BNE
        if (this.regs[rs] !== this.regs[rt]) {
          this.branchQue.push(() => {
            this.nextPC = this.pc + (simm << 2);
          });
          this.delaySlot = true;
        }
        break;
      case 0x06: // BLEZ
        if (this.regs[rs] <= 0) {
          this.branchQue.push(() => {
            this.nextPC = this.pc + (simm << 2);
          });
          this.delaySlot = true;
        }
        break;
      case 0x07: // BGTZ
        if (this.regs[rs] > 0) {
          this.branchQue.push(() => {
            this.nextPC = this.pc + (simm << 2);
          });
          this.delaySlot = true;
        }
        break;
      case 0x08: // ADDI
        {
          const a = this.regs[rs];
          const b = simm;
          const r = (a + b) | 0;
          if (((a ^ b) >= 0) && ((a ^ r) < 0)) {
            this.triggerException(0, 0xC);
          } else {
            this.regs[rt] = r;
          }
        }
        break;
      case 0x09: // ADDIU
        this.regs[rt] = (this.regs[rs] + simm) | 0;
        break;
      case 0x0A: // SLTI
        this.regs[rt] = (this.regs[rs] < simm) ? 1 : 0;
        break;
      case 0x0B: // SLTIU
        this.regs[rt] = ((this.regs[rs] >>> 0) < (simm >>> 0)) ? 1 : 0;
        break;
      case 0x0C: // ANDI
        this.regs[rt] = this.regs[rs] & uimm;
        break;
      case 0x0D: // ORI
        this.regs[rt] = this.regs[rs] | uimm;
        break;
      case 0x0E: // XORI
        this.regs[rt] = this.regs[rs] ^ uimm;
        break;
      case 0x0F: // LUI
        this.regs[rt] = (imm << 16) | 0;
        break;
      case 0x10: // COP0
        this.executeCOP0(rs, rt, rd, funct);
        break;
      case 0x12: // COP2 (GTE)
        this.executeCOP2(instruction);
        break;
      case 0x20: // LB
        this.regs[rt] = (this.ps1.memRead8(this.regs[rs] + simm) << 24) >> 24;
        break;
      case 0x21: // LH
        this.regs[rt] = (this.ps1.memRead16(this.regs[rs] + simm) << 16) >> 16;
        break;
      case 0x22: // LWL
        {
          const addr = (this.regs[rs] + simm) & 0xFFFFFFFF;
          const aligned = addr & ~3;
          const shift = (addr & 3) * 8;
          const memVal = this.ps1.memRead32(aligned) >>> 0;
          const regVal = this.regs[rt] >>> 0;
          if (shift === 0) {
            this.regs[rt] = (memVal << 24) >> 24;
          } else {
            const mask = 0xFFFFFF00 >>> shift;
            this.regs[rt] = ((regVal & mask) | (memVal << (24 - shift))) | 0;
          }
        }
        break;
      case 0x23: // LW
        this.regs[rt] = this.ps1.memRead32(this.regs[rs] + simm);
        break;
      case 0x24: // LBU
        this.regs[rt] = this.ps1.memRead8(this.regs[rs] + simm) & 0xFF;
        break;
      case 0x25: // LHU
        this.regs[rt] = this.ps1.memRead16(this.regs[rs] + simm) & 0xFFFF;
        break;
      case 0x26: // LWR
        {
          const addr = (this.regs[rs] + simm) & 0xFFFFFFFF;
          const aligned = addr & ~3;
          const shift = (addr & 3) * 8;
          const memVal = this.ps1.memRead32(aligned) >>> 0;
          const regVal = this.regs[rt] >>> 0;
          if (shift === 24) {
            this.regs[rt] = (memVal << 24) >> 24;
          } else {
            const mask = 0x00FFFFFF << (24 - shift);
            this.regs[rt] = ((regVal & mask) | (memVal >>> shift)) | 0;
          }
        }
        break;
      case 0x28: // SB
        this.ps1.memWrite8(this.regs[rs] + simm, this.regs[rt] & 0xFF);
        break;
      case 0x29: // SH
        this.ps1.memWrite16(this.regs[rs] + simm, this.regs[rt] & 0xFFFF);
        break;
      case 0x2A: // SWL
        {
          const addr = (this.regs[rs] + simm) & 0xFFFFFFFF;
          const aligned = addr & ~3;
          const shift = (addr & 3) * 8;
          const memVal = this.ps1.memRead32(aligned) >>> 0;
          const regVal = this.regs[rt] >>> 0;
          if (shift === 0) {
            this.ps1.memWrite32(aligned, (regVal & 0xFF) | (memVal & 0xFFFFFF00));
          } else {
            const mask = 0x00FFFFFF << (24 - shift);
            this.ps1.memWrite32(aligned, ((regVal << shift) | (memVal & mask)) | 0);
          }
        }
        break;
      case 0x2B: // SW
        this.ps1.memWrite32(this.regs[rs] + simm, this.regs[rt]);
        break;
      case 0x2E: // SWR
        {
          const addr = (this.regs[rs] + simm) & 0xFFFFFFFF;
          const aligned = addr & ~3;
          const shift = (addr & 3) * 8;
          const memVal = this.ps1.memRead32(aligned) >>> 0;
          const regVal = this.regs[rt] >>> 0;
          if (shift === 24) {
            this.ps1.memWrite32(aligned, (regVal & 0xFF) | (memVal & 0xFFFFFF00));
          } else {
            const mask = 0xFFFFFF00 >>> shift;
            this.ps1.memWrite32(aligned, ((regVal >>> shift) | (memVal & mask)) | 0);
          }
        }
        break;
      case 0x30: // LWC0
        break;
      case 0x32: // LWC2
        {
          const addr = (this.regs[rs] + simm) & 0xFFFFFFFF;
          const aligned = addr & ~3;
          const val = this.ps1.memRead32(aligned);
          const idx = rt;
          if (idx < 32) {
            this.cop2Data[idx] = val;
          }
        }
        break;
      case 0x38: // SWC0
        break;
      case 0x3A: // SWC2
        {
          const addr = (this.regs[rs] + simm) & 0xFFFFFFFF;
          const aligned = addr & ~3;
          const val = this.cop2Data[rt] || 0;
          this.ps1.memWrite32(aligned, val);
        }
        break;
      default:
        this.triggerException(0, 0x0A);
        break;
    }

    this.regs[0] = 0;
    this.cycles++;
    return 1;
  }

  executeSpecial(funct, rs, rt, rd, shamt, instruction) {
    switch (funct) {
      case 0x00: // SLL
        this.regs[rd] = this.regs[rt] << shamt;
        break;
      case 0x02: // SRL
        this.regs[rd] = this.regs[rt] >>> shamt;
        break;
      case 0x03: // SRA
        this.regs[rd] = this.regs[rt] >> shamt;
        break;
      case 0x04: // SLLV
        this.regs[rd] = this.regs[rt] << (this.regs[rs] & 0x1F);
        break;
      case 0x06: // SRLV
        this.regs[rd] = this.regs[rt] >>> (this.regs[rs] & 0x1F);
        break;
      case 0x07: // SRAV
        this.regs[rd] = this.regs[rt] >> (this.regs[rs] & 0x1F);
        break;
      case 0x08: // JR
        this.branchQue.push(() => {
          this.nextPC = this.regs[rs];
        });
        this.delaySlot = true;
        break;
      case 0x09: // JALR
        {
          const target = this.regs[rs];
          this.regs[rd || 31] = this.nextPC;
          this.branchQue.push(() => {
            this.nextPC = target;
          });
          this.delaySlot = true;
        }
        break;
      case 0x0C: // SYSCALL
        this.triggerException(0, 0x08);
        break;
      case 0x0D: // BREAK
        this.stopped = true;
        break;
      case 0x10: // MFHI
        this.regs[rd] = this.hi;
        break;
      case 0x11: // MTHI
        this.hi = this.regs[rs];
        break;
      case 0x12: // MFLO
        this.regs[rd] = this.lo;
        break;
      case 0x13: // MTLO
        this.lo = this.regs[rs];
        break;
      case 0x18: // MULT
        {
          const a = BigInt(this.regs[rs]);
          const b = BigInt(this.regs[rt]);
          const result = a * b;
          this.lo = Number(result & 0xFFFFFFFFn) | 0;
          this.hi = Number((result >> 32n) & 0xFFFFFFFFn) | 0;
        }
        break;
      case 0x19: // MULTU
        {
          const a = BigInt(this.regs[rs] >>> 0);
          const b = BigInt(this.regs[rt] >>> 0);
          const result = a * b;
          this.lo = Number(result & 0xFFFFFFFFn) | 0;
          this.hi = Number((result >> 32n) & 0xFFFFFFFFn) | 0;
        }
        break;
      case 0x1A: // DIV
        {
          const n = this.regs[rs];
          const d = this.regs[rt];
          if (d === 0) {
            this.hi = n;
            this.lo = (n >= 0) ? -1 : 1;
          } else if (n === -2147483648 && d === -1) {
            this.hi = 0;
            this.lo = -2147483648;
          } else {
            this.hi = n % d;
            this.lo = (n / d) | 0;
          }
        }
        break;
      case 0x1B: // DIVU
        {
          const n = this.regs[rs] >>> 0;
          const d = this.regs[rt] >>> 0;
          if (d === 0) {
            this.hi = this.regs[rs];
            this.lo = 0xFFFFFFFF;
          } else {
            this.hi = (n % d) | 0;
            this.lo = (n / d) | 0;
          }
        }
        break;
      case 0x20: // ADD
        {
          const a = this.regs[rs];
          const b = this.regs[rt];
          const r = (a + b) | 0;
          if (((a ^ b) >= 0) && ((a ^ r) < 0)) {
            this.triggerException(0, 0xC);
          } else {
            this.regs[rd] = r;
          }
        }
        break;
      case 0x21: // ADDU
        this.regs[rd] = (this.regs[rs] + this.regs[rt]) | 0;
        break;
      case 0x22: // SUB
        {
          const a = this.regs[rs];
          const b = this.regs[rt];
          const r = (a - b) | 0;
          if (((a ^ b) < 0) && ((a ^ r) < 0)) {
            this.triggerException(0, 0xC);
          } else {
            this.regs[rd] = r;
          }
        }
        break;
      case 0x23: // SUBU
        this.regs[rd] = (this.regs[rs] - this.regs[rt]) | 0;
        break;
      case 0x24: // AND
        this.regs[rd] = this.regs[rs] & this.regs[rt];
        break;
      case 0x25: // OR
        this.regs[rd] = this.regs[rs] | this.regs[rt];
        break;
      case 0x26: // XOR
        this.regs[rd] = this.regs[rs] ^ this.regs[rt];
        break;
      case 0x27: // NOR
        this.regs[rd] = ~(this.regs[rs] | this.regs[rt]);
        break;
      case 0x2A: // SLT
        this.regs[rd] = (this.regs[rs] < this.regs[rt]) ? 1 : 0;
        break;
      case 0x2B: // SLTU
        this.regs[rd] = ((this.regs[rs] >>> 0) < (this.regs[rt] >>> 0)) ? 1 : 0;
        break;
      default:
        this.triggerException(0, 0x0A);
        break;
    }
  }

  executeRegimm(rt, rs, simm) {
    switch (rt) {
      case 0x00: // BLTZ
        if (this.regs[rs] < 0) {
          this.branchQue.push(() => {
            this.nextPC = this.pc + (simm << 2);
          });
          this.delaySlot = true;
        }
        break;
      case 0x01: // BGEZ
        if (this.regs[rs] >= 0) {
          this.branchQue.push(() => {
            this.nextPC = this.pc + (simm << 2);
          });
          this.delaySlot = true;
        }
        break;
      case 0x10: // BLTZAL
        this.regs[31] = this.nextPC;
        if (this.regs[rs] < 0) {
          this.branchQue.push(() => {
            this.nextPC = this.pc + (simm << 2);
          });
          this.delaySlot = true;
        }
        break;
      case 0x11: // BGEZAL
        this.regs[31] = this.nextPC;
        if (this.regs[rs] >= 0) {
          this.branchQue.push(() => {
            this.nextPC = this.pc + (simm << 2);
          });
          this.delaySlot = true;
        }
        break;
      default:
        this.triggerException(0, 0x0A);
        break;
    }
  }

  executeCOP0(rs, rt, rd, funct) {
    switch (rs) {
      case 0x00: // MFC0
        this.regs[rt] = this.cop0[rd];
        break;
      case 0x04: // MTC0
        this.cop0[rd] = this.regs[rt];
        if (rd === 12) {
          this.ps1.interruptUpdate();
        }
        break;
      case 0x10: // RFE
        {
          const mode = this.cop0[12] & 0x3F;
          this.cop0[12] = (this.cop0[12] & ~0x0F) | (mode >>> 2);
        }
        break;
      default:
        break;
    }
  }

  executeCOP2(instruction) {
    const sub = (instruction >>> 25) & 0x7F;
    const cmd = instruction & 0x3F;

    if ((sub & 0x01) === 0) {
      switch (cmd) {
        case 0x00: this.cmd.RTPS(); break;
        case 0x06: this.cmd.NCLIP(); break;
        case 0x0C: this.cmd.AVSZ3(); break;
        case 0x0D: this.cmd.AVSZ4(); break;
        case 0x12: this.cmd.MVMVA(); break;
        case 0x13: this.cmd.NCDS(); break;
        case 0x14: this.cmd.NCS(); break;
        case 0x1B: this.cmd.GPF(0); break;
        case 0x1C: this.cmd.GPL(0); break;
        case 0x10: this.cmd.OP(); break;
        case 0x01: this.cmd.RTPS(); break;
        case 0x02: this.cmd.NCLIP(); break;
        case 0x03: this.cmd.OP(); break;
        case 0x04: {
          const d = (instruction >> 11) & 0x1F;
          const s = (instruction >> 15) & 0x1F;
          const t = (instruction >> 16) & 0x1F;
          this.cop2Data[d] = this.cop2Data[s] + this.cop2Data[t];
          break;
        }
        case 0x06: this.cmd.NCCT(); break;
        case 0x08: {
          const d = (instruction >> 11) & 0x1F;
          this.cop2Data[d] = this.cop2Data[d] + this.cop2Data[0];
          break;
        }
        case 0x0A: {
          const d = (instruction >> 11) & 0x1F;
          const s = (instruction >> 15) & 0x1F;
          this.cop2Data[d] = this.cop2Data[s] + this.cop2Data[0];
          break;
        }
        case 0x0E: this.cmd.NCCS(); break;
        case 0x1D: this.cmd.NCCT(); break;
        case 0x1E: this.cmd.NCS(); break;
        case 0x1F: this.cmd.NCCS(); break;
        default:
          break;
      }
    } else {
      switch (cmd) {
        case 0x30: this.cmd.RTPS(); break;
        case 0x36: this.cmd.NCLIP(); break;
        case 0x3C: this.cmd.AVSZ3(); break;
        case 0x3D: this.cmd.AVSZ4(); break;
        case 0x42: this.cmd.MVMVA(); break;
        case 0x43: this.cmd.NCDS(); break;
        case 0x44: this.cmd.NCS(); break;
        case 0x5B: this.cmd.GPF(0); break;
        case 0x5C: this.cmd.GPL(0); break;
        case 0x50: this.cmd.OP(); break;
        case 0x40: {
          const s = (instruction >> 15) & 0x1F;
          const t = (instruction >> 16) & 0x1F;
          const d = (instruction >> 11) & 0x1F;
          this.cop2Data[d] = this.cop2Data[s] + this.cop2Data[t];
          break;
        }
        case 0x46: this.cmd.NCCT(); break;
        case 0x48: {
          const d = (instruction >> 11) & 0x1F;
          this.cop2Data[d] = this.cop2Data[d] + this.cop2Data[0];
          break;
        }
        case 0x4A: {
          const d = (instruction >> 11) & 0x1F;
          const s = (instruction >> 15) & 0x1F;
          this.cop2Data[d] = this.cop2Data[s] + this.cop2Data[0];
          break;
        }
        case 0x4E: this.cmd.NCCS(); break;
        case 0x5D: this.cmd.NCCT(); break;
        case 0x5E: this.cmd.NCS(); break;
        case 0x5F: this.cmd.NCCS(); break;
        default:
          break;
      }
    }
  }

  readCOP2Data(idx) {
    return this.cop2Data[idx] || 0;
  }

  writeCOP2Data(idx, val) {
    this.cop2Data[idx] = val;
  }

  readCOP2Ctrl(idx) {
    return this.cop2Ctrl[idx] || 0;
  }

  writeCOP2Ctrl(idx, val) {
    this.cop2Ctrl[idx] = val;
  }

  cmd = {
    RTPS: () => {
      const v = [this.cop2Data[0], this.cop2Data[1], this.cop2Data[2]];
      const mx = this.cop2Ctrl[5];
      const my = this.cop2Ctrl[6];
      const mz = this.cop2Ctrl[7];
      const tx = this.cop2Ctrl[9];
      const ty = this.cop2Ctrl[10];
      const tz = this.cop2Ctrl[11];
      const fov = this.cop2Ctrl[13];
      const h = this.cop2Ctrl[14];

      const x = (v[0] * mx + v[1] * my + v[2] * mz + tx * 4096) | 0;
      const y = (v[0] * mx + v[1] * my + v[2] * mz + ty * 4096) | 0;
      const z = (v[0] * mx + v[1] * my + v[2] * mz + tz * 4096) | 0;

      const sz = Math.max(1, Math.min(0xFFFF, Math.floor((h * 2048) / Math.max(z, 1))));
      const sx = Math.max(-0x400, Math.min(0x3FF, Math.floor(x * sz / 4096 + 160)));
      const sy = Math.max(-0x400, Math.min(0x3FF, Math.floor(y * sz / 4096 + 120)));

      this.cop2Data[12] = sx;
      this.cop2Data[13] = sy;
      this.cop2Data[14] = sz;
      this.cop2Data[15] = (x * sz) >> 12;
      this.cop2Data[16] = (y * sz) >> 12;

      this.cop2Data[7] = Math.min(0x1FFFF, Math.max(-0x1FFFF, z));
      this.cop2Data[8] = Math.min(0x1FFFF, Math.max(-0x1FFFF, z));
      this.cop2Data[9] = Math.min(0x1FFFF, Math.max(-0x1FFFF, z));

      this.cop2Data[11] = sz;
    },
    NCLIP: () => {
      const x0 = this.cop2Data[0] & 0xFFFF;
      const y0 = this.cop2Data[0] >> 16;
      const x1 = this.cop2Data[2] & 0xFFFF;
      const y1 = this.cop2Data[2] >> 16;
      const x2 = this.cop2Data[4] & 0xFFFF;
      const y2 = this.cop2Data[4] >> 16;
      const result = ((x0 * y1) + (x1 * y2) + (x2 * y0) - (x0 * y2) - (x1 * y0) - (x2 * y1)) / 2;
      this.cop2Data[24] = result | 0;
    },
    AVSZ3: () => {
      const z0 = this.cop2Data[11];
      const z1 = this.cop2Data[12];
      const z2 = this.cop2Data[13];
      this.cop2Data[7] = (z0 + z1 + z2 + 2) / 3;
    },
    AVSZ4: () => {
      const z0 = this.cop2Data[11];
      const z1 = this.cop2Data[12];
      const z2 = this.cop2Data[13];
      const z3 = this.cop2Data[14];
      this.cop2Data[7] = (z0 + z1 + z2 + z3 + 2) / 4;
    },
    MVMVA: () => {
      const sf = (this.cop2Data[27] >> 19) & 1;
      const mx = (this.cop2Data[27] >> 17) & 3;
      const cv = (this.cop2Data[27] >> 13) & 3;
      const mm = (this.cop2Data[27] >> 16) & 1;
      const mmx = (this.cop2Data[27] >> 14) & 1;

      const matrix = [
        [this.cop2Ctrl[0], this.cop2Ctrl[1], this.cop2Ctrl[2]],
        [this.cop2Ctrl[4], this.cop2Ctrl[5], this.cop2Ctrl[6]],
        [this.cop2Ctrl[8], this.cop2Ctrl[9], this.cop2Ctrl[10]]
      ];

      const vector = [
        (this.cop2Data[0] << 16) >> 16,
        (this.cop2Data[1] << 16) >> 16,
        (this.cop2Data[2] << 16) >> 16
      ];

      const translation = [
        this.cop2Ctrl[9 + cv * 3] || 0,
        this.cop2Ctrl[10 + cv * 3] || 0,
        this.cop2Ctrl[11 + cv * 3] || 0
      ];

      const result = [0, 0, 0];
      for (let i = 0; i < 3; i++) {
        let sum = 0;
        for (let j = 0; j < 3; j++) {
          sum += matrix[mx][j] * vector[j];
        }
        result[i] = ((sum >> (sf ? 12 : 0)) + translation[i]) | 0;
      }

      this.cop2Data[25] = result[0];
      this.cop2Data[26] = result[1];
      this.cop2Data[27] = result[2];
    },
    NCDS: () => {
      this.calculateLight();
    },
    NCS: () => {
      this.calculateSingleLight();
    },
    NCCT: () => {
      this.calculateLight();
    },
    NCCS: () => {
      this.calculateSingleLight();
    },
    GPF: () => {
      const sf = 12;
      const ir0 = (this.cop2Data[9] << 16) >> 16;
      const s0 = (this.cop2Data[0] << 16) >> 16;
      const s1 = (this.cop2Data[1] << 16) >> 16;
      const s2 = (this.cop2Data[2] << 16) >> 16;
      const s3 = (this.cop2Data[3] << 16) >> 16;
      this.cop2Data[25] = Math.min(0x7FFF, Math.max(-0x8000, ((s0 * s3) >> sf) | 0));
      this.cop2Data[26] = Math.min(0x7FFF, Math.max(-0x8000, ((s1 * s3) >> sf) | 0));
      this.cop2Data[27] = Math.min(0x7FFF, Math.max(-0x8000, ((s2 * s3) >> sf) | 0));
    },
    GPL: () => {
      const sf = 12;
      const ir0 = (this.cop2Data[9] << 16) >> 16;
      const s0 = (this.cop2Data[0] << 16) >> 16;
      const s1 = (this.cop2Data[1] << 16) >> 16;
      const s2 = (this.cop2Data[2] << 16) >> 16;
      const s3 = (this.cop2Data[3] << 16) >> 16;
      const d0 = this.cop2Data[25];
      const d1 = this.cop2Data[26];
      const d2 = this.cop2Data[27];
      this.cop2Data[25] = Math.min(0x7FFF, Math.max(-0x8000, d0 + ((s0 * s3) >> sf) | 0));
      this.cop2Data[26] = Math.min(0x7FFF, Math.max(-0x8000, d1 + ((s1 * s3) >> sf) | 0));
      this.cop2Data[27] = Math.min(0x7FFF, Math.max(-0x8000, d2 + ((s2 * s3) >> sf) | 0));
    },
    OP: () => {
      const v0x = this.cop2Data[0];
      const v0y = this.cop2Data[1];
      const v0z = this.cop2Data[2];
      const v1x = this.cop2Data[4];
      const v1y = this.cop2Data[5];
      const v1z = this.cop2Data[6];
      this.cop2Data[9] = ((v0y * v1z - v0z * v1y) >> 12) | 0;
      this.cop2Data[10] = ((v0z * v1x - v0x * v1z) >> 12) | 0;
      this.cop2Data[11] = ((v0x * v1y - v0y * v1x) >> 12) | 0;
    }
  };

  calculateLight() {
    const sf = 12;
    const s0 = (this.cop2Data[0] << 16) >> 16;
    const s1 = (this.cop2Data[1] << 16) >> 16;
    const s2 = (this.cop2Data[2] << 16) >> 16;
    const s3 = (this.cop2Data[3] << 16) >> 16;
    const s4 = (this.cop2Data[4] << 16) >> 16;
    const s5 = (this.cop2Data[5] << 16) >> 16;
    const s6 = (this.cop2Data[6] << 16) >> 16;
    const s7 = (this.cop2Data[7] << 16) >> 16;
    const s8 = (this.cop2Data[8] << 16) >> 16;
    const ir0 = (this.cop2Data[9] << 16) >> 16;

    const r = Math.min(0xFF, Math.max(0, ((s0 * s6 + s1 * s7 + s2 * s8) >> sf) + ir0));
    const g = Math.min(0xFF, Math.max(0, ((s3 * s6 + s4 * s7 + s5 * s8) >> sf) + ir0));
    const b = Math.min(0xFF, Math.max(0, ((s3 * s6 + s4 * s7 + s5 * s8) >> sf) + ir0));

    this.cop2Data[28] = (b << 16) | (g << 8) | r;
    this.cop2Data[29] = (b << 16) | (g << 8) | r;
    this.cop2Data[30] = (b << 16) | (g << 8) | r;
  }

  calculateSingleLight() {
    const sf = 12;
    const s0 = (this.cop2Data[0] << 16) >> 16;
    const s1 = (this.cop2Data[1] << 16) >> 16;
    const s2 = (this.cop2Data[2] << 16) >> 16;
    const s6 = (this.cop2Data[6] << 16) >> 16;
    const s7 = (this.cop2Data[7] << 16) >> 16;
    const s8 = (this.cop2Data[8] << 16) >> 16;

    const r = Math.min(0xFF, Math.max(0, (s0 * s6 + s1 * s7 + s2 * s8) >> sf));
    const g = Math.min(0xFF, Math.max(0, (s0 * s6 + s1 * s7 + s2 * s8) >> sf));
    const b = Math.min(0xFF, Math.max(0, (s0 * s6 + s1 * s7 + s2 * s8) >> sf));

    this.cop2Data[28] = (b << 16) | (g << 8) | r;
    this.cop2Data[29] = (b << 16) | (g << 8) | r;
    this.cop2Data[30] = (b << 16) | (g << 8) | r;
  }

  getICache() { return 0; }
  setICache(v) { }
  getDCache() { return 0; }
  setDCache(v) { }
}

exports.PS1R3000A = PS1R3000A;

class PS1GPU {
  constructor(ps1) {
    this.ps1 = ps1;
    this.pixels = new Uint32Array(320 * 240);
    this.vram = new Uint8Array(1024 * 512 * 2);

    this.gp0CommandBuffer = [];
    this.gp0WordsRemaining = 0;
    this.gp0CommandFunction = null;

    this.status = 0x14802000;
    this.displayMode = 0;
    this.displayAreaStartX = 0;
    this.displayAreaStartY = 0;
    this.displayAreaEndX = 320;
    this.displayAreaEndY = 240;

    this.drawAreaLeft = 0;
    this.drawAreaTop = 0;
    this.drawAreaRight = 319;
    this.drawAreaBottom = 239;
    this.drawOffsetX = 0;
    this.drawOffsetY = 0;

    this.textureWindowX = 0;
    this.textureWindowY = 0;
    this.textureWindowW = 0;
    this.textureWindowH = 0;

    this.maskBit = 0;

    this.drawEnvX = 0;
    this.drawEnvY = 0;

    this.horizontalRes = 320;
    this.verticalRes = 240;

    this.interlace = false;
    this.displayDisabled = true;
    this.forceDisplayBuffer = false;
    this.colorDepth = 0;
    this.videoMode = 0;

    this.dmaDirection = 0;
    this.dmaRequest = false;
    this.evenOddStatus = false;

    this.revision = 2;
    this.gpuBusy = false;
    this.cmdFifoReady = true;
  }

  reset() {
    this.pixels.fill(0xFF000000);
    this.status = 0x14802000;
    this.gp0CommandBuffer = [];
    this.gp0WordsRemaining = 0;
    this.gp0CommandFunction = null;
    this.drawAreaLeft = 0;
    this.drawAreaTop = 0;
    this.drawAreaRight = 319;
    this.drawAreaBottom = 239;
    this.drawOffsetX = 0;
    this.drawOffsetY = 0;
    this.textureWindowX = 0;
    this.textureWindowY = 0;
    this.textureWindowW = 0;
    this.textureWindowH = 0;
    this.maskBit = 0;
    this.gpuBusy = false;
  }

  gp0(command) {
    const cmd = (command >>> 24) & 0xFF;

    if (this.gp0WordsRemaining > 0) {
      this.gp0CommandBuffer.push(command);
      this.gp0WordsRemaining--;
      if (this.gp0WordsRemaining === 0 && this.gp0CommandFunction) {
        this.gp0CommandFunction();
      }
      return;
    }

    switch (cmd) {
      case 0x00: // NOP
        break;
      case 0x01: // Clear cache
        break;
      case 0x02: // Fill rect
        this.gp0WordsRemaining = 2;
        this.gp0CommandFunction = () => this.cmdFillRect();
        this.gp0CommandBuffer = [command];
        break;
      case 0x20: case 0x21: case 0x22: case 0x23: // Triangle
      case 0x24: case 0x25: case 0x26: case 0x27:
        this.gp0WordsRemaining = 3;
        this.gp0CommandFunction = () => this.cmdDrawTriangle(command);
        this.gp0CommandBuffer = [command];
        break;
      case 0x28: case 0x29: case 0x2A: case 0x2B: // Quad
      case 0x2C: case 0x2D: case 0x2E: case 0x2F:
        this.gp0WordsRemaining = 4;
        this.gp0CommandFunction = () => this.cmdDrawQuad(command);
        this.gp0CommandBuffer = [command];
        break;
      case 0x30: case 0x31: case 0x32: case 0x33: // Line
      case 0x34: case 0x35: case 0x36: case 0x37:
        this.gp0WordsRemaining = 1;
        this.gp0CommandFunction = () => this.cmdDrawLine(command);
        this.gp0CommandBuffer = [command];
        break;
      case 0x40: case 0x41: case 0x42: case 0x43:
      case 0x44: case 0x45: case 0x46: case 0x47: // Mono rect
        this.gp0WordsRemaining = 1;
        this.gp0CommandFunction = () => this.cmdDrawRect(command);
        this.gp0CommandBuffer = [command];
        break;
      case 0x60: case 0x61: case 0x62: case 0x63: // Var rect
      case 0x64: case 0x65: case 0x66: case 0x67:
        this.gp0WordsRemaining = 2;
        this.gp0CommandFunction = () => this.cmdDrawRect(command);
        this.gp0CommandBuffer = [command];
        break;
      case 0x80: case 0x81: case 0x82: case 0x83:
        this.gp0WordsRemaining = 1;
        this.gp0CommandFunction = () => this.cmdVRAMtoCPU();
        this.gp0CommandBuffer = [command];
        break;
      case 0xA0: case 0xA1: case 0xA2: case 0xA3:
        this.gp0WordsRemaining = 2;
        this.gp0CommandFunction = () => this.cmdCPUtoVRAM();
        this.gp0CommandBuffer = [command];
        break;
      case 0xE0: this.setTexturePage(command); break;
      case 0xE1: this.setTextureWindow(command); break;
      case 0xE2: this.setDrawAreaTL(command); break;
      case 0xE3: this.setDrawAreaBR(command); break;
      case 0xE4: this.setDrawOffset(command); break;
      case 0xE5: this.setMaskBit(command); break;
      default:
        break;
    }
  }

  gp1(command) {
    const cmd = (command >>> 24) & 0xFF;

    switch (cmd) {
      case 0x00: this.reset(); break;
      case 0x01: this.gp0CommandBuffer = []; this.gp0WordsRemaining = 0; this.gp0CommandFunction = null; break;
      case 0x02: this.gpuAckIRQ(); break;
      case 0x03: this.displayDisabled = (command & 1) === 1; break;
      case 0x04: this.dmaDirection = (command >> 1) & 3; break;
      case 0x05: this.startDisplayArea(command); break;
      case 0x06: this.setHorizontalRange(command); break;
      case 0x07: this.setVerticalRange(command); break;
      case 0x08: this.setDisplayMode(command); break;
      case 0x09: break;
      case 0x10: this.gpuAckIRQ(); break;
      case 0x11: break;
      case 0x20: this.status = this.status ^ 0x00000800; break;
      case 0x30: this.status = (this.status & ~0x00000800) | ((command & 1) << 11); break;
      default: break;
    }
  }

  gpuAckIRQ() {
    this.status &= ~0x08000000;
  }

  startDisplayArea(command) {
    this.displayAreaStartX = command & 0x3FE;
    this.displayAreaStartY = (command >>> 10) & 0x1FF;
  }

  setHorizontalRange(command) {
    this.displayAreaStartX = command & 0x3FE;
    this.displayAreaEndX = ((command >>> 12) & 0x3FE) + this.displayAreaStartX;
  }

  setVerticalRange(command) {
    this.displayAreaStartY = command & 0x1FF;
    this.displayAreaEndY = (command >>> 10) & 0x1FF;
  }

  setDisplayMode(command) {
    this.displayMode = command;
    this.horizontalRes = ((command & 3) === 3) ? 368 : (320 << ((command >> 6) & 1));
    this.verticalRes = (command & 4) ? 480 : 240;
    this.interlace = (command & 8) !== 0;
    this.colorDepth = (command & 16) !== 0;
    this.videoMode = (command & 32) !== 0;

    this.status = (this.status & ~0x0000003F) | (command & 0x3F);
    this.status = (this.status & ~(1 << 19)) | (this.videoMode ? (1 << 19) : 0);
    this.status = (this.status & ~(1 << 23)) | (this.interlace ? (1 << 23) : 0);
  }

  setTexturePage(command) {
    this.textureWindowX = command & 0xF;
    this.textureWindowY = (command >> 4) & 0xF;
    this.textureWindowW = (command >> 8) & 0xF;
    this.textureWindowH = (command >> 12) & 0xF;
  }

  setTextureWindow(command) {
    this.textureWindowX = command & 0xF;
    this.textureWindowY = (command >> 4) & 0xF;
    this.textureWindowW = (command >> 8) & 0xF;
    this.textureWindowH = (command >> 12) & 0xF;
  }

  setDrawAreaTL(command) {
    this.drawAreaLeft = command & 0x3FF;
    this.drawAreaTop = (command >> 10) & 0x1FF;
    this.updateDrawAreaStatus();
  }

  setDrawAreaBR(command) {
    this.drawAreaRight = command & 0x3FF;
    this.drawAreaBottom = (command >> 10) & 0x1FF;
    this.updateDrawAreaStatus();
  }

  updateDrawAreaStatus() {
    this.status = (this.status & ~(0x7FF << 10)) |
      ((this.drawAreaLeft & 0x7FF) << 10);
    this.status = (this.status & ~(0x7FF << 21)) |
      ((this.drawAreaTop & 0x7FF) << 21);
  }

  setDrawOffset(command) {
    const x = (command << 16) >> 16;
    const y = (command >> 11);
    this.drawOffsetX = x;
    this.drawOffsetY = y;
    this.status = (this.status & ~0x7FF) | (x & 0x7FF);
    this.status = (this.status & ~(0x7FF << 11)) | ((y & 0x7FF) << 11);
  }

  setMaskBit(command) {
    this.maskBit = command & 1;
  }

  cmdFillRect() {
    const c = this.gp0CommandBuffer[0];
    const x = this.gp0CommandBuffer[1] & 0x3F0;
    const y = (this.gp0CommandBuffer[1] >>> 16) & 0x1FF;
    const w = (this.gp0CommandBuffer[2] & 0x3FF);
    const h = (this.gp0CommandBuffer[2] >>> 16) & 0x1FF;
    if (w === 0) return;
    if (h === 0) return;

    const r = c & 0xFF;
    const g = (c >>> 8) & 0xFF;
    const b = (c >>> 16) & 0xFF;
    const color = 0xFF000000 | (r) | (g << 8) | (b << 16);

    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (px >= 0 && px < 320 && py >= 0 && py < 240) {
          this.pixels[py * 320 + px] = color;
        }
      }
    }
  }

  cmdDrawTriangle(command) {
    const c = this.gp0CommandBuffer[0];
    const isShaded = (command & 0x10) !== 0;
    const isTextured = (command & 0x04) !== 0;
    const isSemiTrans = (command & 0x02) !== 0;

    let x0, y0, x1, y1, x2, y2;
    let c0, c1, c2;

    if (isShaded) {
      c0 = c;
      c1 = this.gp0CommandBuffer[1];
      c2 = this.gp0CommandBuffer[2];
      x0 = (this.gp0CommandBuffer[3] & 0xFFFF) | 0;
      y0 = (this.gp0CommandBuffer[3] >>> 16) | 0;
      x1 = (this.gp0CommandBuffer[4] & 0xFFFF) | 0;
      y1 = (this.gp0CommandBuffer[4] >>> 16) | 0;
      x2 = (this.gp0CommandBuffer[5] & 0xFFFF) | 0;
      y2 = (this.gp0CommandBuffer[5] >>> 16) | 0;
    } else {
      c0 = c1 = c2 = c;
      x0 = (this.gp0CommandBuffer[1] & 0xFFFF) | 0;
      y0 = (this.gp0CommandBuffer[1] >>> 16) | 0;
      x1 = (this.gp0CommandBuffer[2] & 0xFFFF) | 0;
      y1 = (this.gp0CommandBuffer[2] >>> 16) | 0;
      x2 = (this.gp0CommandBuffer[3] & 0xFFFF) | 0;
      y2 = (this.gp0CommandBuffer[3] >>> 16) | 0;
    }

    x0 = (x0 << 16) >> 16;
    y0 = (y0 << 16) >> 16;
    x1 = (x1 << 16) >> 16;
    y1 = (y1 << 16) >> 16;
    x2 = (x2 << 16) >> 16;
    y2 = (y2 << 16) >> 16;

    x0 += this.drawOffsetX;
    y0 += this.drawOffsetY;
    x1 += this.drawOffsetX;
    y1 += this.drawOffsetY;
    x2 += this.drawOffsetX;
    y2 += this.drawOffsetY;

    this.drawTriangle(x0, y0, x1, y1, x2, y2, c0, c1, c2, isShaded, isSemiTrans);
  }

  cmdDrawQuad(command) {
    const c = this.gp0CommandBuffer[0];
    const isShaded = (command & 0x10) !== 0;
    const isTextured = (command & 0x04) !== 0;
    const isSemiTrans = (command & 0x02) !== 0;

    let x0, y0, x1, y1, x2, y2, x3, y3;
    let c0, c1, c2, c3;

    if (isShaded) {
      c0 = c;
      c1 = this.gp0CommandBuffer[1];
      c2 = this.gp0CommandBuffer[2];
      c3 = this.gp0CommandBuffer[3];
      x0 = (this.gp0CommandBuffer[4] & 0xFFFF) | 0;
      y0 = (this.gp0CommandBuffer[4] >>> 16) | 0;
      x1 = (this.gp0CommandBuffer[5] & 0xFFFF) | 0;
      y1 = (this.gp0CommandBuffer[5] >>> 16) | 0;
      x2 = (this.gp0CommandBuffer[6] & 0xFFFF) | 0;
      y2 = (this.gp0CommandBuffer[6] >>> 16) | 0;
      x3 = (this.gp0CommandBuffer[7] & 0xFFFF) | 0;
      y3 = (this.gp0CommandBuffer[7] >>> 16) | 0;
    } else {
      c0 = c1 = c2 = c3 = c;
      x0 = (this.gp0CommandBuffer[1] & 0xFFFF) | 0;
      y0 = (this.gp0CommandBuffer[1] >>> 16) | 0;
      x1 = (this.gp0CommandBuffer[2] & 0xFFFF) | 0;
      y1 = (this.gp0CommandBuffer[2] >>> 16) | 0;
      x2 = (this.gp0CommandBuffer[3] & 0xFFFF) | 0;
      y2 = (this.gp0CommandBuffer[3] >>> 16) | 0;
      x3 = (this.gp0CommandBuffer[4] & 0xFFFF) | 0;
      y3 = (this.gp0CommandBuffer[4] >>> 16) | 0;
    }

    x0 = (x0 << 16) >> 16;
    y0 = (y0 << 16) >> 16;
    x1 = (x1 << 16) >> 16;
    y1 = (y1 << 16) >> 16;
    x2 = (x2 << 16) >> 16;
    y2 = (y2 << 16) >> 16;
    x3 = (x3 << 16) >> 16;
    y3 = (y3 << 16) >> 16;

    x0 += this.drawOffsetX;
    y0 += this.drawOffsetY;
    x1 += this.drawOffsetX;
    y1 += this.drawOffsetY;
    x2 += this.drawOffsetX;
    y2 += this.drawOffsetY;
    x3 += this.drawOffsetX;
    y3 += this.drawOffsetY;

    this.drawTriangle(x0, y0, x1, y1, x2, y2, c0, c1, c2, isShaded, isSemiTrans);
    this.drawTriangle(x1, y1, x2, y2, x3, y3, c1, c2, c3, isShaded, isSemiTrans);
  }

  cmdDrawLine(command) {
    const c = this.gp0CommandBuffer[0];
    const isShaded = (command & 0x10) !== 0;
    let x0, y0, x1, y1;

    if (isShaded) {
      x0 = (this.gp0CommandBuffer[1] & 0xFFFF) | 0;
      y0 = (this.gp0CommandBuffer[1] >>> 16) | 0;
      x1 = (this.gp0CommandBuffer[2] & 0xFFFF) | 0;
      y1 = (this.gp0CommandBuffer[2] >>> 16) | 0;
    } else {
      x0 = (this.gp0CommandBuffer[1] & 0xFFFF) | 0;
      y0 = (this.gp0CommandBuffer[1] >>> 16) | 0;
      x1 = (this.gp0CommandBuffer[2] & 0xFFFF) | 0;
      y1 = (this.gp0CommandBuffer[2] >>> 16) | 0;
    }

    x0 = (x0 << 16) >> 16;
    y0 = (y0 << 16) >> 16;
    x1 = (x1 << 16) >> 16;
    y1 = (y1 << 16) >> 16;

    x0 += this.drawOffsetX;
    y0 += this.drawOffsetY;
    x1 += this.drawOffsetX;
    y1 += this.drawOffsetY;

    const r = c & 0xFF;
    const g = (c >>> 8) & 0xFF;
    const b = (c >>> 16) & 0xFF;
    const color = 0xFF000000 | (r) | (g << 8) | (b << 16);

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      if (x0 >= this.drawAreaLeft && x0 <= this.drawAreaRight &&
        y0 >= this.drawAreaTop && y0 <= this.drawAreaBottom) {
        if (x0 >= 0 && x0 < 320 && y0 >= 0 && y0 < 240) {
          if (!this.maskBit || (this.pixels[y0 * 320 + x0] & 0x80000000) === 0) {
            this.pixels[y0 * 320 + x0] = color;
          }
        }
      }

      if (x0 === x1 && y0 === y1) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  cmdDrawRect(command) {
    const c = this.gp0CommandBuffer[0];
    const isShaded = (command & 0x10) !== 0;
    const isTextured = (command & 0x04) !== 0;
    const isSemiTrans = (command & 0x02) !== 0;

    let x0, y0, w, h;

    if ((command & 0xF0) === 0x60 || (command & 0xF0) === 0x68 ||
      (command & 0xF0) === 0x70 || (command & 0xF0) === 0x78) {
      x0 = (this.gp0CommandBuffer[1] & 0xFFFF) | 0;
      y0 = (this.gp0CommandBuffer[1] >>> 16) | 0;
      w = (this.gp0CommandBuffer[2] & 0xFFFF) | 0;
      h = (this.gp0CommandBuffer[2] >>> 16) | 0;
    } else {
      x0 = (this.gp0CommandBuffer[1] & 0xFFFF) | 0;
      y0 = (this.gp0CommandBuffer[1] >>> 16) | 0;
      w = (this.gp0CommandBuffer[2] & 0xFFFF);
      h = (this.gp0CommandBuffer[2] >>> 16);
    }

    x0 = (x0 << 16) >> 16;
    y0 = (y0 << 16) >> 16;

    x0 += this.drawOffsetX;
    y0 += this.drawOffsetY;

    const r = c & 0xFF;
    const g = (c >>> 8) & 0xFF;
    const b = (c >>> 16) & 0xFF;
    const color = 0xFF000000 | (r) | (g << 8) | (b << 16);

    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const px = x0 + dx;
        const py = y0 + dy;
        if (px >= this.drawAreaLeft && px <= this.drawAreaRight &&
          py >= this.drawAreaTop && py <= this.drawAreaBottom) {
          if (px >= 0 && px < 320 && py >= 0 && py < 240) {
            if (!this.maskBit || (this.pixels[py * 320 + px] & 0x80000000) === 0) {
              this.pixels[py * 320 + px] = color;
            }
          }
        }
      }
    }
  }

  cmdVRAMtoCPU() {
    const x = this.gp0CommandBuffer[1] & 0x3FF;
    const y = (this.gp0CommandBuffer[1] >>> 16) & 0x1FF;
    const w = this.gp0CommandBuffer[2] & 0xFFFF;
    const h = (this.gp0CommandBuffer[2] >>> 16) & 0xFFFF;
    // Stub
  }

  cmdCPUtoVRAM() {
    const x = this.gp0CommandBuffer[1] & 0x3FF;
    const y = (this.gp0CommandBuffer[1] >>> 16) & 0x1FF;
    const w = this.gp0CommandBuffer[2] & 0xFFFF;
    const h = (this.gp0CommandBuffer[2] >>> 16) & 0xFFFF;
    // Stub
  }

  drawTriangle(x0, y0, x1, y1, x2, y2, c0, c1, c2, isShaded, isSemiTrans) {
    if (y0 > y1) { [x0, y0, c0, x1, y1, c1] = [x1, y1, c1, x0, y0, c0]; }
    if (y0 > y2) { [x0, y0, c0, x2, y2, c2] = [x2, y2, c2, x0, y0, c0]; }
    if (y1 > y2) { [x1, y1, c1, x2, y2, c2] = [x2, y2, c2, x1, y1, c1]; }

    if (y0 === y2) return;

    const minX = Math.min(x0, x1, x2);
    const maxX = Math.max(x0, x1, x2);
    const minY = Math.max(y0, this.drawAreaTop);
    const maxY = Math.min(y2, this.drawAreaBottom);

    if (minY >= maxY) return;

    const area = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
    if (area === 0) return;

    const r0 = c0 & 0xFF, g0 = (c0 >> 8) & 0xFF, b0 = (c0 >> 16) & 0xFF;
    const r1 = c1 & 0xFF, g1 = (c1 >> 8) & 0xFF, b1 = (c1 >> 16) & 0xFF;
    const r2 = c2 & 0xFF, g2 = (c2 >> 8) & 0xFF, b2 = (c2 >> 16) & 0xFF;

    for (let y = minY; y <= maxY; y++) {
      let leftX, rightX;
      let lr, lg, lb, rr, rg, rb;

      if (y < y1) {
        if (y0 === y1) continue;
        const t1 = (y - y0) / (y1 - y0);
        const t2 = (y - y0) / (y2 - y0);
        leftX = x0 + t1 * (x1 - x0);
        rightX = x0 + t2 * (x2 - x0);
        if (isShaded) {
          lr = r0 + t1 * (r1 - r0); lg = g0 + t1 * (g1 - g0); lb = b0 + t1 * (b1 - b0);
          rr = r0 + t2 * (r2 - r0); rg = g0 + t2 * (g2 - g0); rb = b0 + t2 * (b2 - b0);
        }
      } else {
        if (y1 === y2) continue;
        const t1 = (y - y1) / (y2 - y1);
        const t2 = (y - y0) / (y2 - y0);
        leftX = x1 + t1 * (x2 - x1);
        rightX = x0 + t2 * (x2 - x0);
        if (isShaded) {
          lr = r1 + t1 * (r2 - r1); lg = g1 + t1 * (g2 - g1); lb = b1 + t1 * (b2 - b1);
          rr = r0 + t2 * (r2 - r0); rg = g0 + t2 * (g2 - g0); rb = b0 + t2 * (b2 - b0);
        }
      }

      let sx = Math.floor(Math.min(leftX, rightX));
      let ex = Math.ceil(Math.max(leftX, rightX));

      sx = Math.max(sx, this.drawAreaLeft);
      ex = Math.min(ex, this.drawAreaRight);

      for (let x = sx; x <= ex; x++) {
        if (x >= 0 && x < 320 && y >= 0 && y < 240) {
          let color;
          if (isShaded) {
            const t = (leftX === rightX) ? 0 : (x - leftX) / (rightX - leftX);
            const r = Math.max(0, Math.min(255, Math.floor(lr + t * (rr - lr))));
            const g = Math.max(0, Math.min(255, Math.floor(lg + t * (rg - lg))));
            const b = Math.max(0, Math.min(255, Math.floor(lb + t * (rb - lb))));
            color = 0xFF000000 | (r) | (g << 8) | (b << 16);
          } else {
            const r = c0 & 0xFF;
            const g = (c0 >> 8) & 0xFF;
            const b = (c0 >> 16) & 0xFF;
            color = 0xFF000000 | (r) | (g << 8) | (b << 16);
          }

          if (!this.maskBit || (this.pixels[y * 320 + x] & 0x80000000) === 0) {
            if (isSemiTrans) {
              const dest = this.pixels[y * 320 + x];
              const dr = dest & 0xFF, dg = (dest >> 8) & 0xFF, db = (dest >> 16) & 0xFF;
              const sr = color & 0xFF, sg = (color >> 8) & 0xFF, sb = (color >> 16) & 0xFF;
              const r = Math.min(255, (sr + dr) >> 1);
              const g = Math.min(255, (sg + dg) >> 1);
              const b = Math.min(255, (sb + db) >> 1);
              color = 0xFF000000 | (r) | (g << 8) | (b << 16);
            }
            this.pixels[y * 320 + x] = color;
          }
        }
      }
    }
  }
}

exports.PS1GPU = PS1GPU;

class PS1SPU {
  constructor(ps1) {
    this.ps1 = ps1;
    this.regs = new Uint8Array(0x200);
    this.outputBuffer = new Float32Array(44100);
    this.writeBuffer = new Float32Array(44100);
    this.writePos = 0;
    this.readPos = 0;
    this.volumeLeft = 0x3FFF;
    this.volumeRight = 0x3FFF;
    this.keyOn = 0;
    this.keyOff = 0;
    this.reverb = 0;
    this.status = 0;
    this.dmaControl = 0;
    this.dmaData = 0;
    this.dataFifo = new Uint16Array(512);
    this.dataFifoPos = 0;
    this.reverbDepth = 0;
    this.reverbDelay = 0;
    this.reverbFeedback = 0;
    this.noise = 0;
    this.reverbLeft = 0;
    this.reverbRight = 0;
    this.sustainLevel = 0;
    this.decayLevel = 0;
    this.attackLevel = 0;
    this.releaseLevel = 0;
    this.sustainRate = 0;
    this.decayRate = 0;
    this.attackRate = 0;
    this.releaseRate = 0;
  }

  reset() {
    this.regs.fill(0);
    this.keyOn = 0;
    this.keyOff = 0;
    this.status = 0;
    this.dmaControl = 0;
    this.dmaData = 0;
    this.dataFifoPos = 0;
  }

  read16(addr) {
    const reg = (addr & 0x1FF) >>> 1;
    if (reg < 0x80) {
      return this.regs[reg * 2] | (this.regs[reg * 2 + 1] << 8);
    }
    if (reg === 0x1A0) return this.volumeLeft;
    if (reg === 0x1A2) return this.volumeRight;
    if (reg === 0x1A4) return this.reverbDepth;
    if (reg === 0x1A6) return this.status;
    if (reg === 0x1A8) return this.dmaControl;
    return 0;
  }

  write16(addr, val) {
    const reg = (addr & 0x1FF) >>> 1;
    if (reg < 0x80) {
      this.regs[reg * 2] = val & 0xFF;
      this.regs[reg * 2 + 1] = (val >> 8) & 0xFF;
      return;
    }
    if (reg === 0x1A0) this.volumeLeft = val;
    if (reg === 0x1A2) this.volumeRight = val;
    if (reg === 0x1A4) this.reverbDepth = val;
    if (reg === 0x1A6) this.status = val;
    if (reg === 0x1A8) this.dmaControl = val;
    if (reg === 0x1AA) this.keyOn = val;
    if (reg === 0x1AC) this.keyOff = val;
  }

  readDMA() {
    if (this.dataFifoPos < this.dataFifo.length) {
      return this.dataFifo[this.dataFifoPos++];
    }
    return 0;
  }

  writeDMA(val) {
    if (this.dataFifoPos < this.dataFifo.length) {
      this.dataFifo[this.dataFifoPos++] = val;
    }
  }

  generateSamples(count) {
    const samples = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      samples[i] = ((Math.random() * 2 - 1) * 0.01);
    }
    return samples;
  }
}

exports.PS1SPU = PS1SPU;

class PS1 {
  constructor() {
    this.ram = new Uint8Array(2 * 1024 * 1024);
    this.scratchpad = new Uint8Array(1024);
    this.cpu = new PS1R3000A(this);
    this.gpu = new PS1GPU(this);
    this.spu = new PS1SPU(this);

    this.dmaRegisters = new Uint32Array(32);
    this.dmaRegs = {
      0: { base: 0, blockSize: 0, blockCount: 0, control: 0 },
      1: { base: 0, blockSize: 0, blockCount: 0, control: 0 },
      2: { base: 0, blockSize: 0, blockCount: 0, control: 0 },
      3: { base: 0, blockSize: 0, blockCount: 0, control: 0 },
      4: { base: 0, blockSize: 0, blockCount: 0, control: 0 },
      5: { base: 0, blockSize: 0, blockCount: 0, control: 0 },
      6: { base: 0, blockSize: 0, blockCount: 0, control: 0 }
    };

    this.irqControl = {
      stat: 0,
      mask: 0
    };

    this.timers = [
      { value: 0, target: 0, control: 0, mode: 0, irq: false },
      { value: 0, target: 0, control: 0, mode: 0, irq: false },
      { value: 0, target: 0, control: 0, mode: 0, irq: false }
    ];

    this.timerBaseCounter = 0;

    this.expansion1 = new Uint8Array(8 * 1024 * 1024);

    this.bios = new Uint8Array(512 * 1024);
    this.biosLoaded = false;

    this.cycleCount = 0;
    this.frameCount = 0;
  }

  reset() {
    this.ram.fill(0);
    this.scratchpad.fill(0);
    this.cpu.reset();
    this.gpu.reset();
    this.spu.reset();
    this.dmaRegisters.fill(0);
    for (let i = 0; i < 7; i++) {
      this.dmaRegs[i] = { base: 0, blockSize: 0, blockCount: 0, control: 0 };
    }
    this.irqControl.stat = 0;
    this.irqControl.mask = 0;
    this.timers.forEach(t => {
      t.value = 0;
      t.target = 0;
      t.control = 0;
      t.mode = 0;
      t.irq = false;
    });
    this.timerBaseCounter = 0;
    this.expansion1.fill(0xFF);
    this.cycleCount = 0;
    this.frameCount = 0;
  }

  loadROM(data) {
    const rom = new Uint8Array(data);
    const magic = String.fromCharCode(rom[0], rom[1], rom[2], rom[rom[3]], rom[4], rom[5], rom[6], rom[7]);

    if (magic === "PS-X EXE") {
      const textOffset = rom[0x18] | (rom[0x19] << 8) | (rom[0x1A] << 16) | (rom[0x1B] << 24);
      const textSize = rom[0x1C] | (rom[0x1D] << 8) | (rom[0x1E] << 16) | (rom[0x1F] << 24);
      const dataOffset = rom[0x20] | (rom[0x21] << 8) | (rom[0x22] << 16) | (rom[0x23] << 24);
      const dataSize = rom[0x24] | (rom[0x25] << 8) | (rom[0x26] << 16) | (rom[0x27] << 24);
      const entryAddr = rom[0x10] | (rom[0x11] << 8) | (rom[0x12] << 16) | (rom[0x13] << 24);
      const gpValue = rom[0x14] | (rom[0x15] << 8) | (rom[0x16] << 16) | (rom[0x17] << 24);

      if (textOffset === 0x800) {
        const loadAddr = entryAddr & 0x1FFFFFFF;
        for (let i = 0; i < textSize; i++) {
          if (loadAddr + i < 2 * 1024 * 1024) {
            this.ram[loadAddr + i] = rom[0x800 + i];
          }
        }
      }

      if (dataSize > 0 && dataOffset === 0x800 + textSize) {
        const loadAddr = (entryAddr + textSize) & 0x1FFFFFFF;
        for (let i = 0; i < dataSize; i++) {
          if (loadAddr + i < 2 * 1024 * 1024) {
            this.ram[loadAddr + i] = rom[dataOffset + i];
          }
        }
      }

      this.cpu.pc = entryAddr;
      this.cpu.nextPC = entryAddr + 4;
      this.cpu.regs[28] = gpValue;
      this.cpu.regs[29] = entryAddr + 0x7FFFE0;
      this.cpu.regs[30] = entryAddr + 0x7FFFE0;
      this.cpu.regs[31] = entryAddr;

      return true;
    }

    return false;
  }

  loadBIOS(data) {
    if (data.length >= 512 * 1024) {
      this.bios = new Uint8Array(data.slice(0, 512 * 1024));
      this.biosLoaded = true;
      return true;
    }
    return false;
  }

  maskAddr(addr) {
    return addr & 0x1FFFFFFF;
  }

  memRead8(addr) {
    addr = this.maskAddr(addr);

    if (addr < 0x200000) {
      return this.ram[addr] || 0;
    }

    if (addr >= 0x1F000000 && addr < 0x1F080000) {
      return this.expansion1[addr - 0x1F000000] || 0xFF;
    }

    if (addr >= 0x1F802000 && addr < 0x1F802040) {
      return this.gpuRead8(addr);
    }

    if (addr >= 0x1F801C00 && addr < 0x1F801E00) {
      return this.spu.read16(addr) & 0xFF;
    }

    return 0;
  }

  memRead16(addr) {
    addr = this.maskAddr(addr);

    if (addr < 0x200000) {
      const b0 = this.ram[addr] || 0;
      const b1 = this.ram[addr + 1] || 0;
      return b0 | (b1 << 8);
    }

    if (addr >= 0x1F802000 && addr < 0x1F802040) {
      return this.gpuRead16(addr);
    }

    if (addr >= 0x1F801C00 && addr < 0x1F801E00) {
      return this.spu.read16(addr);
    }

    if (addr >= 0x1F801070 && addr < 0x1F801080) {
      return this.irqControlRead(addr);
    }

    if (addr >= 0x1F801100 && addr < 0x1F801130) {
      return this.timerRead(addr);
    }

    return 0;
  }

  memRead32(addr) {
    addr = this.maskAddr(addr);

    if (addr < 0x200000) {
      const b0 = this.ram[addr] || 0;
      const b1 = this.ram[addr + 1] || 0;
      const b2 = this.ram[addr + 2] || 0;
      const b3 = this.ram[addr + 3] || 0;
      return b0 | (b1 << 8) | (b2 << 16) | (b3 << 24);
    }

    if (addr >= 0x1F000000 && addr < 0x1F080000) {
      const offset = addr - 0x1F000000;
      const b0 = this.expansion1[offset] || 0xFF;
      const b1 = this.expansion1[offset + 1] || 0xFF;
      const b2 = this.expansion1[offset + 2] || 0xFF;
      const b3 = this.expansion1[offset + 3] || 0xFF;
      return b0 | (b1 << 8) | (b2 << 16) | (b3 << 24);
    }

    if (addr >= 0x1F800000 && addr < 0x1F800400) {
      const offset = addr - 0x1F800000;
      const b0 = this.scratchpad[offset] || 0;
      const b1 = this.scratchpad[offset + 1] || 0;
      const b2 = this.scratchpad[offset + 2] || 0;
      const b3 = this.scratchpad[offset + 3] || 0;
      return b0 | (b1 << 8) | (b2 << 16) | (b3 << 24);
    }

    if (addr >= 0x1F801000 && addr < 0x1F801020) {
      return this.joypadRead(addr);
    }

    if (addr >= 0x1F801040 && addr < 0x1F801050) {
      return this.sioRead(addr);
    }

    if (addr >= 0x1F801070 && addr < 0x1F801080) {
      return this.irqControlRead(addr);
    }

    if (addr >= 0x1F801080 && addr < 0x1F801100) {
      return this.dmaRead(addr);
    }

    if (addr >= 0x1F801100 && addr < 0x1F801130) {
      return this.timerRead(addr);
    }

    if (addr >= 0x1F801C00 && addr < 0x1F801E00) {
      return this.spuRead(addr);
    }

    if (addr >= 0x1F802000 && addr < 0x1F802040) {
      return this.gpuRead32(addr);
    }

    if (addr === 0x1F802040) return 0;

    if (addr === 0xFFFE0130) {
      return 0x00000002;
    }

    return 0;
  }

  memWrite8(addr, val) {
    addr = this.maskAddr(addr);

    if (addr < 0x200000) {
      this.ram[addr] = val;
      return;
    }

    if (addr >= 0x1F802000 && addr < 0x1F802040) {
      this.gpuWrite8(addr, val);
      return;
    }

    if (addr >= 0x1F801C00 && addr < 0x1F801E00) {
      this.spu.write16(addr, val);
      return;
    }
  }

  memWrite16(addr, val) {
    addr = this.maskAddr(addr);

    if (addr < 0x200000) {
      this.ram[addr] = val & 0xFF;
      this.ram[addr + 1] = (val >> 8) & 0xFF;
      return;
    }

    if (addr >= 0x1F802000 && addr < 0x1F802040) {
      this.gpuWrite16(addr, val);
      return;
    }

    if (addr >= 0x1F801C00 && addr < 0x1F801E00) {
      this.spu.write16(addr, val);
      return;
    }

    if (addr >= 0x1F801070 && addr < 0x1F801080) {
      this.irqControlWrite(addr, val);
      return;
    }

    if (addr >= 0x1F801100 && addr < 0x1F801130) {
      this.timerWrite(addr, val);
      return;
    }
  }

  memWrite32(addr, val) {
    addr = this.maskAddr(addr);

    if (addr < 0x200000) {
      this.ram[addr] = val & 0xFF;
      this.ram[addr + 1] = (val >> 8) & 0xFF;
      this.ram[addr + 2] = (val >> 16) & 0xFF;
      this.ram[addr + 3] = (val >> 24) & 0xFF;
      return;
    }

    if (addr >= 0x1F800000 && addr < 0x1F800400) {
      const offset = addr - 0x1F800000;
      this.scratchpad[offset] = val & 0xFF;
      this.scratchpad[offset + 1] = (val >> 8) & 0xFF;
      this.scratchpad[offset + 2] = (val >> 16) & 0xFF;
      this.scratchpad[offset + 3] = (val >> 24) & 0xFF;
      return;
    }

    if (addr >= 0x1F801000 && addr < 0x1F801020) {
      this.joypadWrite(addr, val);
      return;
    }

    if (addr >= 0x1F801040 && addr < 0x1F801050) {
      this.sioWrite(addr, val);
      return;
    }

    if (addr >= 0x1F801070 && addr < 0x1F801080) {
      this.irqControlWrite(addr, val);
      return;
    }

    if (addr >= 0x1F801080 && addr < 0x1F801100) {
      this.dmaWrite(addr, val);
      return;
    }

    if (addr >= 0x1F801100 && addr < 0x1F801130) {
      this.timerWrite(addr, val);
      return;
    }

    if (addr >= 0x1F801C00 && addr < 0x1F801E00) {
      this.spuWrite(addr, val);
      return;
    }

    if (addr >= 0x1F802000 && addr < 0x1F802040) {
      this.gpuWrite32(addr, val);
      return;
    }

    if (addr === 0xFFFE0130) {
      return;
    }
  }

  gpuRead8(addr) {
    return 0;
  }

  gpuRead16(addr) {
    return this.gpu.status & 0xFFFF;
  }

  gpuRead32(addr) {
    return this.gpu.status;
  }

  gpuWrite8(addr, val) {
    this.gpu.gp0(val);
  }

  gpuWrite16(addr, val) {
    this.gpu.gp1(val);
  }

  gpuWrite32(addr, val) {
    this.gpu.gp0(val);
  }

  spuRead(addr) {
    return this.spu.read16(addr);
  }

  spuWrite(addr, val) {
    this.spu.write16(addr, val);
  }

  joypadRead(addr) {
    return 0;
  }

  joypadWrite(addr, val) {
  }

  sioRead(addr) {
    return 0;
  }

  sioWrite(addr, val) {
  }

  irqControlRead(addr) {
    const reg = (addr - 0x1F801070) & 0xF;
    if (reg === 0) return this.irqControl.stat;
    if (reg === 4) return this.irqControl.mask;
    return 0;
  }

  irqControlWrite(addr, val) {
    const reg = (addr - 0x1F801070) & 0xF;
    if (reg === 0) {
      this.irqControl.stat = this.irqControl.stat & val;
    } else if (reg === 4) {
      this.irqControl.mask = val;
    }
    this.interruptUpdate();
  }

  interruptUpdate() {
    const pending = this.irqControl.stat & this.irqControl.mask;
    if (pending !== 0) {
      this.cpu.cop0[13] = (this.cpu.cop0[13] | 0x400);
      if (this.cpu.cop0[12] & (1 << 10)) {
        this.cpu.triggerException(0, 0);
      }
    } else {
      this.cpu.cop0[13] &= ~0x400;
    }
  }

  dmaRead(addr) {
    const channel = (addr - 0x1F801080) >>> 4;
    const reg = ((addr - 0x1F801080) & 0xF) >>> 2;

    const ch = this.dmaRegs[channel];
    if (!ch) return 0;

    switch (reg) {
      case 0: return ch.base;
      case 1: return ch.blockSize | (ch.blockCount << 16);
      case 2: return ch.control;
      default: return 0;
    }
  }

  dmaWrite(addr, val) {
    const channel = (addr - 0x1F801080) >>> 4;
    const reg = ((addr - 0x1F801080) & 0xF) >>> 2;

    const ch = this.dmaRegs[channel];
    if (!ch) return;

    switch (reg) {
      case 0:
        ch.base = val;
        break;
      case 1:
        ch.blockSize = val & 0xFFFF;
        ch.blockCount = (val >>> 16) & 0xFFFF;
        break;
      case 2:
        ch.control = val;
        if ((val & 0x00000800) !== 0) {
          this.startDMA(channel);
        }
        break;
    }
  }

  startDMA(channel) {
    const ch = this.dmaRegs[channel];
    if (!ch) return;

    const direction = (ch.control >> 0) & 3;
    const step = (ch.control >> 10) & 1;
    const sync = (ch.control >> 9) & 3;

    if (channel === 2) {
      this.dmaGPU(ch, direction, step, sync);
    } else if (channel === 6) {
      this.dmaOTC(ch, direction);
    }

    this.irqControl.stat |= (1 << (channel + 24));
    this.interruptUpdate();
  }

  dmaGPU(ch, direction, step, sync) {
    const addr = ch.base & 0x1FFFFC;
    let wordsLeft;
    let addrInc;

    if (sync === 0) {
      wordsLeft = 1;
      addrInc = 4;
    } else if (sync === 1) {
      wordsLeft = ch.blockSize;
      addrInc = 4;
    } else {
      wordsLeft = ch.blockSize * ch.blockCount;
      addrInc = 4;
    }

    if (direction === 0 || direction === 1) {
      for (let i = 0; i < wordsLeft; i++) {
        const word = this.memRead32(addr + i * addrInc);
        this.gpu.gp0(word);
      }
    } else if (direction === 2) {
      for (let i = 0; i < wordsLeft; i++) {
        const word = this.gpuRead32(0x1F802000);
        this.memWrite32(addr + i * addrInc, word);
      }
    }

    ch.base = (addr + wordsLeft * addrInc) & 0xFFFFFF;
    ch.control &= ~0x00000800;
  }

  dmaOTC(ch, direction) {
    const addr = ch.base & 0x1FFFFC;
    let wordsLeft;

    if (ch.blockCount === 0) {
      wordsLeft = 0x200000;
    } else {
      wordsLeft = ch.blockCount;
    }

    const step = (ch.control & (1 << 10)) ? -4 : 4;
    let curAddr = addr;

    for (let i = 0; i < wordsLeft; i++) {
      this.memWrite32(curAddr, curAddr - 4);
      curAddr += step;
    }

    this.memWrite32(curAddr, 0xFFFFFF);
    ch.base = 0xFFFFFF;
    ch.control &= ~0x00000800;
  }

  timerRead(addr) {
    const timer = (addr - 0x1F801100) >>> 4;
    const reg = ((addr - 0x1F801100) & 0xF) >>> 2;
    const t = this.timers[timer];
    if (!t) return 0;

    switch (reg) {
      case 0: return t.value;
      case 1: return t.target;
      case 2: return t.control;
      default: return 0;
    }
  }

  timerWrite(addr, val) {
    const timer = (addr - 0x1F801100) >>> 4;
    const reg = ((addr - 0x1F801100) & 0xF) >>> 2;
    const t = this.timers[timer];
    if (!t) return;

    switch (reg) {
      case 0:
        t.value = val;
        break;
      case 1:
        t.target = val;
        break;
      case 2:
        t.control = val;
        break;
    }
  }

  updateTimers(cycles) {
    for (let i = 0; i < 3; i++) {
      const t = this.timers[i];
      const enabled = (t.control & 1) !== 0;
      if (!enabled) continue;

      const mode = (t.control >> 1) & 3;
      const syncEnable = (t.control >> 2) & 1;
      const irqRepeat = (t.control & 4) !== 0;
      const irqTarget = (t.control & 8) !== 0;

      t.value += cycles;

      if (irqTarget && t.value >= t.target) {
        this.irqControl.stat |= (1 << (3 + i));
        this.interruptUpdate();
      }

      if (mode === 2) {
        t.value = 0;
      } else if (mode === 3) {
        t.value = 0;
      }
    }
  }

  frame() {
    const CYCLES_PER_FRAME = 564480;
    let cyclesRun = 0;

    while (cyclesRun < CYCLES_PER_FRAME) {
      const beforeCycles = this.cpu.cycles;
      this.cpu.step();
      const executed = this.cpu.cycles - beforeCycles;
      cyclesRun += executed;

      if (cyclesRun % 100 === 0) {
        this.updateTimers(100);
      }
    }

    this.frameCount++;
  }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PS1R3000A, PS1GPU, PS1SPU, PS1 };
} else if (typeof window !== 'undefined') {
    window.PS1R3000A = PS1R3000A;
    window.PS1GPU = PS1GPU;
    window.PS1SPU = PS1SPU;
    window.PS1 = PS1;
}
