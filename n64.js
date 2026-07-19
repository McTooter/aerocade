// N64 Emulator Core - MIPS R4300i + basic RSP/RDP

const N64_WIDTH = 320;
const N64_HEIGHT = 240;

class N64CPU {
    constructor(n64) {
        this.n64 = n64;
        this.regs = new Int32Array(32);
        this.fRegs = new Float64Array(32);
        this.pc = 0; this.nextPC = 0;
        this.hi = 0; this.lo = 0;
        this.cop0 = new Int32Array(32);
        this.cop1 = new Float64Array(32);
        this.cycles = 0;
        this.running = false;
        this.llBit = false;
        this.branchDelay = false;
        this.interlock = false;
    }

    reset() {
        this.regs.fill(0);
        this.fRegs.fill(0);
        this.pc = 0x80000000;
        this.nextPC = 0x80000004;
        this.hi = 0; this.lo = 0;
        this.cop0.fill(0);
        this.cop0[12] = 0x34000000; // Status register
        this.cop0[15] = 0x00000F00; // PRId
        this.cycles = 0;
        this.running = true;
    }

    read32(addr) { return this.n64.memRead32(addr); }
    read16(addr) { return this.n64.memRead16(addr); }
    read8(addr) { return this.n64.memRead8(addr); }
    write32(addr, val) { this.n64.memWrite32(addr, val); }
    write16(addr, val) { this.n64.memWrite16(addr, val); }
    write8(addr, val) { this.n64.memWrite8(addr, val); }

    signExtend(v) { v = v | 0; return (v << 0) >> 0; }
    signExtend16(v) { return ((v << 16) >> 16); }
    signExtend8(v) { return ((v << 24) >> 24); }

    step() {
        if (!this.running) return;

        let instr = this.read32(this.pc);
        this.pc = this.nextPC;
        this.nextPC = (this.nextPC + 4) | 0;

        let op = (instr >>> 26) & 0x3F;
        let rs = (instr >>> 21) & 0x1F;
        let rt = (instr >>> 16) & 0x1F;
        let rd = (instr >>> 11) & 0x1F;
        let shamt = (instr >>> 6) & 0x1F;
        let funct = instr & 0x3F;
        let imm = instr & 0xFFFF;
        let simm = this.signExtend16(imm);
        let target = ((this.pc & 0xF0000000) | ((instr & 0x03FFFFFF) << 2)) >>> 0;

        // Clear R0
        const clearR0 = () => { this.regs[0] = 0; };

        switch (op) {
            case 0x00: // SPECIAL
                switch (funct) {
                    case 0x00: this.regs[rd] = this.regs[rs] << shamt; clearR0(); break; // SLL
                    case 0x02: this.regs[rd] = this.regs[rs] >>> shamt; clearR0(); break; // SRL
                    case 0x03: this.regs[rd] = (this.regs[rs] >> shamt) | 0; clearR0(); break; // SRA
                    case 0x04: this.regs[rd] = (this.regs[rs] << (this.regs[rt] & 0x1F)) | 0; clearR0(); break; // SLLV
                    case 0x06: this.regs[rd] = (this.regs[rs] >>> (this.regs[rt] & 0x1F)) | 0; clearR0(); break; // SRLV
                    case 0x07: this.regs[rd] = (this.regs[rs] >> (this.regs[rt] & 0x1F)) | 0; clearR0(); break; // SRAV
                    case 0x08: this.nextPC = this.regs[rs] | 0; break; // JR
                    case 0x09: { let addr = this.regs[rs] | 0; this.regs[31] = this.nextPC; this.nextPC = addr; break; } // JALR
                    case 0x0C: { // SYSCALL
                        let excCode = (instr >>> 6) & 0x3;
                        this.cop0[13] = (this.cop0[13] & 0x7FFFFFFF) | (0x08 << 2); // ExcCode = Syscall
                        this.cop0[14] = this.pc;
                        this.pc = 0x80000180;
                        this.nextPC = (this.pc + 4) | 0;
                        break;
                    }
                    case 0x0D: break; // BREAK
                    case 0x0F: break; // SYNC
                    case 0x10: this.regs[rd] = this.hi; clearR0(); break; // MFHI
                    case 0x11: this.hi = this.regs[rs]; break; // MTHI
                    case 0x12: this.regs[rd] = this.lo; clearR0(); break; // MFLO
                    case 0x13: this.lo = this.regs[rs]; break; // MTLO
                    case 0x18: { let s = this.regs[rs] | 0; let t = this.regs[rt] | 0; let p = Math.imul(s, t); this.hi = (p / 0x100000000) | 0; this.lo = p | 0; break; } // MULT
                    case 0x19: { let s = (this.regs[rs] >>> 0); let t = (this.regs[rt] >>> 0); let p = s * t; this.hi = (p / 0x100000000) | 0; this.lo = p | 0; break; } // MULTU
                    case 0x1A: { let s = this.regs[rs] | 0; let t = this.regs[rt] | 0; if (t !== 0) { this.lo = (s / t) | 0; this.hi = s % t; } break; } // DIV
                    case 0x1B: { let s = (this.regs[rs] >>> 0); let t = (this.regs[rt] >>> 0); if (t !== 0) { this.lo = (s / t) | 0; this.hi = s % t; } break; } // DIVU
                    case 0x20: this.regs[rd] = this.signExtend(this.read8(this.regs[rs] + this.regs[rt])); clearR0(); break; // ADD (overflow)
                    case 0x21: this.regs[rd] = (this.regs[rs] + this.regs[rt]) | 0; clearR0(); break; // ADDU
                    case 0x22: this.regs[rd] = (this.regs[rs] - this.regs[rt]) | 0; clearR0(); break; // SUB
                    case 0x23: this.regs[rd] = (this.regs[rs] - this.regs[rt]) | 0; clearR0(); break; // SUBU
                    case 0x24: this.regs[rd] = this.regs[rs] & this.regs[rt]; clearR0(); break; // AND
                    case 0x25: this.regs[rd] = this.regs[rs] | this.regs[rt]; clearR0(); break; // OR
                    case 0x26: this.regs[rd] = this.regs[rs] ^ this.regs[rt]; clearR0(); break; // XOR
                    case 0x27: this.regs[rd] = ~(this.regs[rs] | this.regs[rt]); clearR0(); break; // NOR
                    case 0x2A: this.regs[rd] = (this.regs[rs] < this.regs[rt]) ? 1 : 0; clearR0(); break; // SLT
                    case 0x2B: this.regs[rd] = ((this.regs[rs] >>> 0) < (this.regs[rt] >>> 0)) ? 1 : 0; clearR0(); break; // SLTU
                    case 0x30: this.regs[rd] = this.signExtend(this.read16(this.regs[rs] + this.regs[rt])); clearR0(); break; // TEQ (treated as ADD for simplicity)
                    default: break;
                }
                break;

            case 0x01: // REGIMM
                switch (rt) {
                    case 0x00: if (this.regs[rs] < 0) this.nextPC = target; break; // BLTZ
                    case 0x01: if (this.regs[rs] >= 0) this.nextPC = target; break; // BGEZ
                    case 0x10: if (this.regs[rs] < 0) { this.regs[31] = this.nextPC; this.nextPC = target; } break; // BLTZAL
                    case 0x11: if (this.regs[rs] >= 0) { this.regs[31] = this.nextPC; this.nextPC = target; } break; // BGEZAL
                    default: break;
                }
                break;

            case 0x02: this.nextPC = target; break; // J
            case 0x03: this.regs[31] = this.nextPC; this.nextPC = target; break; // JAL

            case 0x04: if (this.regs[rs] === this.regs[rt]) this.nextPC = target; break; // BEQ
            case 0x05: if (this.regs[rs] !== this.regs[rt]) this.nextPC = target; break; // BNE
            case 0x06: if (this.regs[rs] <= 0) this.nextPC = target; break; // BLEZ
            case 0x07: if (this.regs[rs] > 0) this.nextPC = target; break; // BGTZ

            case 0x08: this.regs[rd] = (this.regs[rs] + simm) | 0; clearR0(); break; // ADDI
            case 0x09: this.regs[rt] = (this.regs[rs] + simm) | 0; clearR0(); break; // ADDIU
            case 0x0A: this.regs[rt] = (this.regs[rs] < simm) ? 1 : 0; break; // SLTI
            case 0x0B: this.regs[rt] = ((this.regs[rs] >>> 0) < (imm >>> 0)) ? 1 : 0; break; // SLTIU
            case 0x0C: this.regs[rt] = this.regs[rs] & imm; break; // ANDI
            case 0x0D: this.regs[rt] = this.regs[rs] | imm; break; // ORI
            case 0x0E: this.regs[rt] = this.regs[rs] ^ imm; break; // XORI
            case 0x0F: this.regs[rt] = imm << 16; break; // LUI

            case 0x20: this.regs[rt] = this.signExtend(this.read8(this.regs[rs] + simm)); break; // LB
            case 0x21: this.regs[rt] = this.signExtend(this.read16(this.regs[rs] + simm)); break; // LH
            case 0x22: { // LWL
                let addr = (this.regs[rs] + simm) | 0;
                let aligned = this.read32(addr & ~3);
                let shift = (addr & 3) * 8;
                this.regs[rt] = (this.regs[rt] & ((1 << shift) - 1)) | (aligned << (32 - shift));
                break;
            }
            case 0x23: this.regs[rt] = this.read32((this.regs[rs] + simm) | 0); break; // LW
            case 0x24: this.regs[rt] = this.read8((this.regs[rs] + simm) | 0) & 0xFF; break; // LBU
            case 0x25: this.regs[rt] = this.read16((this.regs[rs] + simm) | 0) & 0xFFFF; break; // LHU
            case 0x26: { // LWR
                let addr = (this.regs[rs] + simm) | 0;
                let aligned = this.read32(addr & ~3);
                let shift = (addr & 3) * 8;
                this.regs[rt] = (this.regs[rt] & ~((1 << (32 - shift)) - 1)) | (aligned >>> shift);
                break;
            }

            case 0x28: this.write8(this.regs[rs] + simm, this.regs[rt] & 0xFF); break; // SB
            case 0x29: this.write16(this.regs[rs] + simm, this.regs[rt] & 0xFFFF); break; // SH
            case 0x2A: { // SWL
                let addr = (this.regs[rs] + simm) | 0;
                let aligned = this.read32(addr & ~3);
                let shift = (addr & 3) * 8;
                let val = (aligned >>> shift) | (this.regs[rt] << (32 - shift));
                this.write32(addr & ~3, val);
                break;
            }
            case 0x2B: this.write32((this.regs[rs] + simm) | 0, this.regs[rt]); break; // SW
            case 0x2E: { // SWR
                let addr = (this.regs[rs] + simm) | 0;
                let aligned = this.read32(addr & ~3);
                let shift = (addr & 3) * 8;
                let val = (this.regs[rt] >>> shift) | (aligned << (32 - shift));
                this.write32(addr & ~3, val);
                break;
            }

            // COP0
            case 0x10:
                switch (rs) {
                    case 0x00: this.regs[rt] = this.cop0[rd]; break; // MFC0
                    case 0x04: this.cop0[rd] = this.regs[rt]; break; // MTC0
                    case 0x01: // TLB
                        switch (funct) {
                            case 0x02: break; // TLBWI
                            case 0x06: break; // TLBWR
                            case 0x08: break; // TLBR
                            case 0x10: break; // TLBP
                        }
                        break;
                }
                break;

            // COP1 (FPU) - stub
            case 0x11: break;

            // LWC1
            case 0x31: break;
            // SWC1
            case 0x39: break;

            // LLD
            case 0x1C: break;
            // SCD
            case 0x3C: break;
            // LD
            case 0x37: {
                let addr = (this.regs[rs] + simm) | 0;
                let lo = this.read32(addr);
                let hi = this.read32(addr + 4);
                // For simplicity, store in two 32-bit regs (low in rt, high in rt+1)
                this.regs[rt] = lo;
                if (rt < 31) this.regs[rt + 1] = hi;
                break;
            }
            // SD
            case 0x3F: {
                let addr = (this.regs[rs] + simm) | 0;
                this.write32(addr, this.regs[rt]);
                if (rt < 31) this.write32(addr + 4, this.regs[rt + 1]);
                break;
            }

            // CACHE (stub)
            case 0x2F: break;

            default:
                break;
        }

        this.regs[0] = 0;
        this.cycles++;
    }
}

class N64RSP {
    constructor(n64) { this.n64 = n64; this.regs = new Uint8Array(0x2000); this.pc = 0; this.halt = true; }
    reset() { this.regs.fill(0); this.pc = 0; this.halt = true; }
    readReg(addr) { return this.regs[addr & 0xFFF]; }
    writeReg(addr, val) { this.regs[addr & 0xFFF] = val; }
    step() { if (this.halt) return; /* minimal RSP execution */ }
}

class N64RDP {
    constructor(n64) {
        this.n64 = n64;
        this.pixels = new Uint32Array(N64_WIDTH * N64_HEIGHT);
        this.cmdBuffer = [];
        this.colorImage = null;
    }

    reset() { this.pixels.fill(0xFF000000); this.cmdBuffer = []; }

    processCommand(cmd) {
        let cmdType = (cmd >>> 24) & 0xFF;
        switch (cmdType) {
            case 0xFF: // Full sync - render
                break;
            case 0x3F: // Set Scissor
                break;
            case 0x3D: // Set Fill Color
                let color = cmd & 0xFFFFFF;
                break;
            case 0x24: // Texture Rectangle
                break;
            case 0xE4: // Set Texture Image
                break;
        }
    }

    render() {
        // Clear screen with default color
        this.pixels.fill(0xFF202020);
    }
}

class N64 {
    constructor() {
        this.cpu = new N64CPU(this);
        this.rsp = new N64RSP(this);
        this.rdp = new N64RDP(this);
        this.running = false;
        this.rom = null;
        this.ram = new Uint8Array(0x800000); // 8MB RDRAM
        this.romData = null;
        this.spRegs = new Uint8Array(0x20);
        this.aiRegs = new Uint8Array(0x18);
        this.viRegs = new Uint8Array(0x38);
        this.piRegs = new Uint8Array(0x34);
        this.siRegs = new Uint8Array(0x1C);
        this.dpRegs = new Uint8Array(0x20);
    }

    memRead32(addr) {
        addr = addr >>> 0;
        // RDRAM
        if (addr < 0x800000) return (this.ram[addr] << 24) | (this.ram[addr+1] << 16) | (this.ram[addr+2] << 8) | this.ram[addr+3];
        // ROM (mapped to 0x10000000)
        if (addr >= 0x10000000 && addr < 0x14000000 && this.romData) {
            let off = (addr - 0x10000000) % this.romData.length;
            return (this.romData[off] << 24) | (this.romData[off+1] << 16) | (this.romData[off+2] << 8) | this.romData[off+3];
        }
        // SP registers
        if (addr >= 0x04040000 && addr < 0x04040020) return (this.spRegs[addr - 0x04040000] << 24) | (this.spRegs[addr-0x04040001] << 16) | (this.spRegs[addr-0x04040002] << 8) | this.spRegs[addr-0x04040003];
        // VI registers
        if (addr >= 0x04400000 && addr < 0x04400038) { let off = addr - 0x04400000; return (this.viRegs[off] << 24) | (this.viRegs[off+1] << 16) | (this.viRegs[off+2] << 8) | this.viRegs[off+3]; }
        // AI registers
        if (addr >= 0x04500000 && addr < 0x04500018) { let off = addr - 0x04500000; return (this.aiRegs[off] << 24) | (this.aiRegs[off+1] << 16) | (this.aiRegs[off+2] << 8) | this.aiRegs[off+3]; }
        // PI registers
        if (addr >= 0x04600000 && addr < 0x04600034) { let off = addr - 0x04600000; return (this.piRegs[off] << 24) | (this.piRegs[off+1] << 16) | (this.piRegs[off+2] << 8) | this.piRegs[off+3]; }
        // SI registers
        if (addr >= 0x04800000 && addr < 0x0480001C) { let off = addr - 0x04800000; return (this.siRegs[off] << 24) | (this.siRegs[off+1] << 16) | (this.siRegs[off+2] << 8) | this.siRegs[off+3]; }
        // DP registers
        if (addr >= 0x04300000 && addr < 0x04300020) { let off = addr - 0x04300000; return (this.dpRegs[off] << 24) | (this.dpRegs[off+1] << 16) | (this.dpRegs[off+2] << 8) | this.dpRegs[off+3]; }
        // KSEG1 unmapped
        return 0;
    }

    memRead16(addr) { let v = this.memRead32(addr & ~3); return (v >>> ((addr & 2) * 8)) & 0xFFFF; }
    memRead8(addr) { let v = this.memRead32(addr & ~3); return (v >>> ((addr & 3) * 8)) & 0xFF; }

    memWrite32(addr, val) {
        addr = addr >>> 0; val = val >>> 0;
        if (addr < 0x800000) { this.ram[addr] = val >>> 24; this.ram[addr+1] = (val >>> 16) & 0xFF; this.ram[addr+2] = (val >>> 8) & 0xFF; this.ram[addr+3] = val & 0xFF; return; }
        // SP registers
        if (addr >= 0x04040000 && addr < 0x04040020) { let off = addr - 0x04040000; this.spRegs[off] = val >>> 24; this.spRegs[off+1] = (val>>>16)&0xFF; this.spRegs[off+2] = (val>>>8)&0xFF; this.spRegs[off+3]=val&0xFF; return; }
        // VI registers
        if (addr >= 0x04400000 && addr < 0x04400038) { let off = addr - 0x04400000; this.viRegs[off] = val >>> 24; this.viRegs[off+1]=(val>>>16)&0xFF; this.viRegs[off+2]=(val>>>8)&0xFF; this.viRegs[off+3]=val&0xFF; return; }
        // DP registers
        if (addr >= 0x04300000 && addr < 0x04300020) { this.rdp.processCommand(val); return; }
    }

    memWrite16(addr, val) { let cur = this.memRead32(addr & ~3); let s = (addr & 2) * 8; cur = (cur & ~(0xFFFF << s)) | ((val & 0xFFFF) << s); this.memWrite32(addr & ~3, cur); }
    memWrite8(addr, val) { let cur = this.memRead32(addr & ~3); let s = (addr & 3) * 8; cur = (cur & ~(0xFF << s)) | ((val & 0xFF) << s); this.memWrite32(addr & ~3, cur); }

    loadROM(data) {
        // N64 ROMs are typically big-endian
        // Check for byte order and swap if needed
        this.romData = new Uint8Array(data);

        // Check header - N64 ROMs start with magic bytes
        // 0x80371240 = native endian
        let magic = (this.romData[0] << 24) | (this.romData[1] << 16) | (this.romData[2] << 8) | this.romData[3];

        if (magic === 0x80371240) {
            // Native endian - no swap needed
        } else if (magic === 0x37804012) {
            // Byteswapped
            for (let i = 0; i < data.length; i += 4) {
                let b0 = this.romData[i], b1 = this.romData[i+1], b2 = this.romData[i+2], b3 = this.romData[i+3];
                this.romData[i] = b1; this.romData[i+1] = b0; this.romData[i+2] = b3; this.romData[i+3] = b2;
            }
        } else if (magic === 0x40123780) {
            // Wordswapped
            for (let i = 0; i < data.length; i += 4) {
                let b0 = this.romData[i], b1 = this.romData[i+1], b2 = this.romData[i+2], b3 = this.romData[i+3];
                this.romData[i] = b2; this.romData[i+1] = b3; this.romData[i+2] = b0; this.romData[i+3] = b1;
            }
        }

        this.reset();
    }

    reset() {
        this.ram.fill(0);
        this.cpu.reset();
        this.rsp.reset();
        this.rdp.reset();
        this.spRegs.fill(0);
        this.viRegs.fill(0);
        this.aiRegs.fill(0);
        this.piRegs.fill(0);
    }

    frame() {
        let frameComplete = false;
        let maxCycles = 62500000; // ~62.5M cycles per frame at 60fps
        let count = 0;
        while (!frameComplete && count < maxCycles) {
            this.cpu.step();
            count++;
            if (count % 100000 === 0) {
                // VI interrupt
                this.rdp.render();
            }
            if (count >= maxCycles) frameComplete = true;
        }
        // Render a frame
        this.rdp.render();
    }
}
