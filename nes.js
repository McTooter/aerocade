// NES Emulator Core - CPU (6502), PPU, APU, Memory, Mappers

// ==================== NES CONSTANTS ====================
const NES_WIDTH = 256;
const NES_HEIGHT = 240;
const CPU_FREQ = 1789773;
const CYCLES_PER_FRAME = 29781;
const NTSC_PALETTE = [
    0x666666,0x002288,0x1E0A98,0x3B0094,0x56007A,0x6A004E,0x6E0719,0x5A1A00,
    0x432E00,0x2B3F00,0x154C00,0x065500,0x005409,0x004832,0x003E66,0x00318E,
    0x002BAA,0x0029D0,0x0055D4,0x0080C0,0x00A3A8,0x00A37A,0x0D9048,0x2A7D1F,
    0x446A07,0x5A5A00,0x5F4C00,0x563D00,0x462E00,0x2D232E,0x000000,0x000000,
    0x9A9A9A,0x1E5AB8,0x3C30D8,0x6218DC,0x840CC2,0x9A108A,0x9C2448,0x843A0C,
    0x665200,0x4A6A00,0x2E7C00,0x168800,0x00880A,0x007E3A,0x007270,0x0068A6,
    0x0062CC,0x0068F4,0x1490F4,0x40B8E0,0x4ED4C8,0x4CD098,0x56BC60,0x6CA838,
    0x829418,0x928400,0x907400,0x846200,0x6C5214,0x4E4446,0x000000,0x000000,
    0xFFFFFFFF,0x64AEFF,0x8498FF,0xAA88FF,0xCC7EFF,0xE280CC,0xE29488,0xD0AA4C,
    0xB4BC24,0x96CE08,0x7ADA18,0x60E444,0x4CE480,0x4CDAAC,0x4CC8E4,0x4CBEFF,
    0x4CB8FC,0x60D0FC,0x80E0FC,0xA8ECFC,0xC0F0F0,0xB8F0D4,0xB4ECA8,0xC2E484,
    0xD6DC68,0xE4D654,0xE8CA44,0xE4BC3C,0xD8A838,0xC89850,0x000000,0x000000,
    0xFFFFFFFF,0xC0DEFF,0xC8D0FF,0xD8C8FF,0xECC4FF,0xF8C8E8,0xF8D4CC,0xF0E0A8,
    0xE0ECA0,0xD0F498,0xC0F8A4,0xB4F8C0,0xB0F8DC,0xB0F4F0,0xB0E8FF,0xB4E0FC,
    0xB4DEFC,0xBCE8FC,0xCCF0FC,0xDCFCFC,0xE8FCF8,0xE4FCDC,0xE8F8C4,0xECF4B0,
    0xF4F0A0,0xF8ECA0,0xF8E4A0,0xF4DC9C,0xF0D09C,0xECCCAC,0x000000,0x000000
];

// ==================== CPU (6502) ====================
class CPU {
    constructor(nes) {
        this.nes = nes;
        this.reset();
    }

    reset() {
        this.a = 0; this.x = 0; this.y = 0;
        this.sp = 0xFD; this.pc = 0;
        this.carry = false; this.zero = false;
        this.interrupt = false; this.decimal = false;
        this.overflow = false; this.negative = false;
        this.cycles = 0; this.stall = 0;
    }

    getFlag(f) {
        switch(f) {
            case 'C': return this.carry ? 1 : 0;
            case 'Z': return this.zero ? 1 : 0;
            case 'I': return this.interrupt ? 1 : 0;
            case 'D': return this.decimal ? 1 : 0;
            case 'V': return this.overflow ? 1 : 0;
            case 'N': return this.negative ? 1 : 0;
        }
    }

    setFlag(f, v) {
        switch(f) {
            case 'C': this.carry = !!v; break;
            case 'Z': this.zero = !!v; break;
            case 'I': this.interrupt = !!v; break;
            case 'D': this.decimal = !!v; break;
            case 'V': this.overflow = !!v; break;
            case 'N': this.negative = !!v; break;
        }
    }

    setNZ(v) {
        v = v & 0xFF;
        this.zero = v === 0;
        this.negative = !!(v & 0x80);
        return v;
    }

    read(addr) { return this.nes.cpuRead(addr & 0xFFFF); }
    write(addr, val) { this.nes.cpuWrite(addr & 0xFFFF, val); }

    push(val) { this.write(0x100 + this.sp, val); this.sp = (this.sp - 1) & 0xFF; }
    pull() { this.sp = (this.sp + 1) & 0xFF; return this.read(0x100 + this.sp); }

    pushWord(val) { this.push((val >> 8) & 0xFF); this.push(val & 0xFF); }
    pullWord() { let lo = this.pull(); return lo | (this.pull() << 8); }

    nmi() {
        this.pushWord(this.pc);
        this.push((this.negative?0x80:0)|(this.overflow?0x40:0)|(this.decimal?0x08:0)|(this.interrupt?0x04:0)|(this.zero?0x02:0)|(this.carry?0x01:0));
        this.interrupt = true;
        this.pc = this.read(0xFFFA) | (this.read(0xFFFB) << 8);
        this.cycles += 7;
    }

    irq() {
        if (this.interrupt) return;
        this.pushWord(this.pc);
        this.push((this.negative?0x80:0)|(this.overflow?0x40:0)|(this.decimal?0x08:0)|(this.interrupt?0x04:0)|(this.zero?0x02:0)|(this.carry?0x01:0));
        this.interrupt = true;
        this.pc = this.read(0xFFFE) | (this.read(0xFFFF) << 8);
        this.cycles += 7;
    }

    step() {
        if (this.stall > 0) { this.stall--; this.cycles++; return; }

        let prevCycles = this.cycles;
        let opcode = this.read(this.pc);
        this.pc = (this.pc + 1) & 0xFFFF;

        let addr, addrMode, val, pageCrossed = false;

        // addressing modes
        const imm = () => { let a = this.pc; this.pc = (this.pc + 1) & 0xFFFF; return a; };
        const zp = () => { let a = this.read(this.pc); this.pc = (this.pc + 1) & 0xFFFF; return a & 0xFF; };
        const zpx = () => { let a = (this.read(this.pc) + this.x) & 0xFF; this.pc = (this.pc + 1) & 0xFFFF; return a; };
        const zpy = () => { let a = (this.read(this.pc) + this.y) & 0xFF; this.pc = (this.pc + 1) & 0xFFFF; return a; };
        const abs = () => { let lo = this.read(this.pc); this.pc = (this.pc + 1) & 0xFFFF; let hi = this.read(this.pc); this.pc = (this.pc + 1) & 0xFFFF; return (hi << 8) | lo; };
        const abx = () => { let a = abs(); if ((a & 0xFF00) !== ((a + this.x) & 0xFF00)) pageCrossed = true; return (a + this.x) & 0xFFFF; };
        const aby = () => { let a = abs(); if ((a & 0xFF00) !== ((a + this.y) & 0xFF00)) pageCrossed = true; return (a + this.y) & 0xFFFF; };
        const indx = () => { let z = (this.read(this.pc) + this.x) & 0xFF; this.pc = (this.pc + 1) & 0xFFFF; return this.read(z & 0xFF) | (this.read((z + 1) & 0xFF) << 8); };
        const indy = () => { let z = this.read(this.pc); this.pc = (this.pc + 1) & 0xFFFF; let a = this.read(z & 0xFF) | (this.read((z + 1) & 0xFF) << 8); if ((a & 0xFF00) !== ((a + this.y) & 0xFF00)) pageCrossed = true; return (a + this.y) & 0xFFFF; };
        const ind = () => { let a = abs(); let lo = this.read(a); let hi = this.read((a & 0xFF00) | ((a + 1) & 0x00FF)); return (hi << 8) | lo; };
        const rel = () => { let offset = this.read(this.pc); this.pc = (this.pc + 1) & 0xFFFF; if (offset & 0x80) offset -= 0x100; return (this.pc + offset) & 0xFFFF; };

        // helpers
        const readMem = (a) => this.read(a);
        const writeMem = (a, v) => this.write(a, v);

        const branch = (cond) => {
            let target = rel();
            if (cond) {
                if ((this.pc & 0xFF00) !== (target & 0xFF00)) this.cycles += 2;
                else this.cycles += 1;
                this.pc = target;
            }
        };

        const cmp = (reg, m) => { let r = reg - m; this.carry = reg >= m; this.setNZ(r & 0xFF); };

        const opcodes = {
            // ADC
            0x69: () => { val = readMem(imm()); let r = this.a + val + (this.carry?1:0); this.carry = r > 0xFF; this.overflow = !((this.a ^ val) & 0x80) && ((this.a ^ r) & 0x80); this.a = this.setNZ(r & 0xFF); },
            0x65: () => { val = readMem(zp()); let r = this.a + val + (this.carry?1:0); this.carry = r > 0xFF; this.overflow = !((this.a ^ val) & 0x80) && ((this.a ^ r) & 0x80); this.a = this.setNZ(r & 0xFF); },
            0x75: () => { val = readMem(zpx()); let r = this.a + val + (this.carry?1:0); this.carry = r > 0xFF; this.overflow = !((this.a ^ val) & 0x80) && ((this.a ^ r) & 0x80); this.a = this.setNZ(r & 0xFF); },
            0x6D: () => { val = readMem(abs()); let r = this.a + val + (this.carry?1:0); this.carry = r > 0xFF; this.overflow = !((this.a ^ val) & 0x80) && ((this.a ^ r) & 0x80); this.a = this.setNZ(r & 0xFF); },
            0x7D: () => { addr = abx(); val = readMem(addr); let r = this.a + val + (this.carry?1:0); this.carry = r > 0xFF; this.overflow = !((this.a ^ val) & 0x80) && ((this.a ^ r) & 0x80); this.a = this.setNZ(r & 0xFF); if(pageCrossed) this.cycles++; },
            0x79: () => { addr = aby(); val = readMem(addr); let r = this.a + val + (this.carry?1:0); this.carry = r > 0xFF; this.overflow = !((this.a ^ val) & 0x80) && ((this.a ^ r) & 0x80); this.a = this.setNZ(r & 0xFF); if(pageCrossed) this.cycles++; },
            0x61: () => { val = readMem(indx()); let r = this.a + val + (this.carry?1:0); this.carry = r > 0xFF; this.overflow = !((this.a ^ val) & 0x80) && ((this.a ^ r) & 0x80); this.a = this.setNZ(r & 0xFF); },
            0x71: () => { addr = indy(); val = readMem(addr); let r = this.a + val + (this.carry?1:0); this.carry = r > 0xFF; this.overflow = !((this.a ^ val) & 0x80) && ((this.a ^ r) & 0x80); this.a = this.setNZ(r & 0xFF); if(pageCrossed) this.cycles++; },

            // AND
            0x29: () => { this.a = this.setNZ(this.a & readMem(imm())); },
            0x25: () => { this.a = this.setNZ(this.a & readMem(zp())); },
            0x35: () => { this.a = this.setNZ(this.a & readMem(zpx())); },
            0x2D: () => { this.a = this.setNZ(this.a & readMem(abs())); },
            0x3D: () => { addr = abx(); this.a = this.setNZ(this.a & readMem(addr)); if(pageCrossed) this.cycles++; },
            0x39: () => { addr = aby(); this.a = this.setNZ(this.a & readMem(addr)); if(pageCrossed) this.cycles++; },
            0x21: () => { this.a = this.setNZ(this.a & readMem(indx())); },
            0x31: () => { addr = indy(); this.a = this.setNZ(this.a & readMem(addr)); if(pageCrossed) this.cycles++; },

            // ASL
            0x0A: () => { this.carry = !!(this.a & 0x80); this.a = this.setNZ((this.a << 1) & 0xFF); },
            0x06: () => { addr = zp(); val = readMem(addr); this.carry = !!(val & 0x80); writeMem(addr, this.setNZ((val << 1) & 0xFF)); },
            0x16: () => { addr = zpx(); val = readMem(addr); this.carry = !!(val & 0x80); writeMem(addr, this.setNZ((val << 1) & 0xFF)); },
            0x0E: () => { addr = abs(); val = readMem(addr); this.carry = !!(val & 0x80); writeMem(addr, this.setNZ((val << 1) & 0xFF)); },
            0x1E: () => { addr = abx(); val = readMem(addr); this.carry = !!(val & 0x80); writeMem(addr, this.setNZ((val << 1) & 0xFF)); },

            // BCC/BCS/BEQ/BMI/BNE/BPL/BVC/BVS
            0x90: () => branch(!this.carry),
            0xB0: () => branch(!!this.carry),
            0xF0: () => branch(!!this.zero),
            0x30: () => branch(!!this.negative),
            0xD0: () => branch(!this.zero),
            0x10: () => branch(!this.negative),
            0x50: () => branch(!this.overflow),
            0x70: () => branch(!!this.overflow),

            // BIT
            0x24: () => { val = readMem(zp()); this.zero = !(this.a & val); this.overflow = !!(val & 0x40); this.negative = !!(val & 0x80); },
            0x2C: () => { val = readMem(abs()); this.zero = !(this.a & val); this.overflow = !!(val & 0x40); this.negative = !!(val & 0x80); },

            // BRK
            0x00: () => { this.pc = (this.pc + 1) & 0xFFFF; this.pushWord(this.pc); this.push(0x34); this.interrupt = true; this.pc = this.read(0xFFFE) | (this.read(0xFFFF) << 8); },

            // CLC/CLD/CLI/CLV
            0x18: () => this.carry = false,
            0xD8: () => this.decimal = false,
            0x58: () => this.interrupt = false,
            0xB8: () => this.overflow = false,

            // CMP
            0xC9: () => cmp(this.a, readMem(imm())),
            0xC5: () => cmp(this.a, readMem(zp())),
            0xD5: () => cmp(this.a, readMem(zpx())),
            0xCD: () => cmp(this.a, readMem(abs())),
            0xDD: () => { addr = abx(); cmp(this.a, readMem(addr)); if(pageCrossed) this.cycles++; },
            0xD9: () => { addr = aby(); cmp(this.a, readMem(addr)); if(pageCrossed) this.cycles++; },
            0xC1: () => cmp(this.a, readMem(indx())),
            0xD1: () => { addr = indy(); cmp(this.a, readMem(addr)); if(pageCrossed) this.cycles++; },

            // CPX
            0xE0: () => cmp(this.x, readMem(imm())),
            0xE4: () => cmp(this.x, readMem(zp())),
            0xEC: () => cmp(this.x, readMem(abs())),

            // CPY
            0xC0: () => cmp(this.y, readMem(imm())),
            0xC4: () => cmp(this.y, readMem(zp())),
            0xCC: () => cmp(this.y, readMem(abs())),

            // DEC
            0xC6: () => { addr = zp(); writeMem(addr, this.setNZ((readMem(addr) - 1) & 0xFF)); },
            0xD6: () => { addr = zpx(); writeMem(addr, this.setNZ((readMem(addr) - 1) & 0xFF)); },
            0xCE: () => { addr = abs(); writeMem(addr, this.setNZ((readMem(addr) - 1) & 0xFF)); },
            0xDE: () => { addr = abx(); writeMem(addr, this.setNZ((readMem(addr) - 1) & 0xFF)); },

            // DEX/DEY
            0xCA: () => this.x = this.setNZ((this.x - 1) & 0xFF),
            0x88: () => this.y = this.setNZ((this.y - 1) & 0xFF),

            // EOR
            0x49: () => { this.a = this.setNZ(this.a ^ readMem(imm())); },
            0x45: () => { this.a = this.setNZ(this.a ^ readMem(zp())); },
            0x55: () => { this.a = this.setNZ(this.a ^ readMem(zpx())); },
            0x4D: () => { this.a = this.setNZ(this.a ^ readMem(abs())); },
            0x5D: () => { addr = abx(); this.a = this.setNZ(this.a ^ readMem(addr)); if(pageCrossed) this.cycles++; },
            0x59: () => { addr = aby(); this.a = this.setNZ(this.a ^ readMem(addr)); if(pageCrossed) this.cycles++; },
            0x41: () => { this.a = this.setNZ(this.a ^ readMem(indx())); },
            0x51: () => { addr = indy(); this.a = this.setNZ(this.a ^ readMem(addr)); if(pageCrossed) this.cycles++; },

            // INC
            0xE6: () => { addr = zp(); writeMem(addr, this.setNZ((readMem(addr) + 1) & 0xFF)); },
            0xF6: () => { addr = zpx(); writeMem(addr, this.setNZ((readMem(addr) + 1) & 0xFF)); },
            0xEE: () => { addr = abs(); writeMem(addr, this.setNZ((readMem(addr) + 1) & 0xFF)); },
            0xFE: () => { addr = abx(); writeMem(addr, this.setNZ((readMem(addr) + 1) & 0xFF)); },

            // INX/INY
            0xE8: () => this.x = this.setNZ((this.x + 1) & 0xFF),
            0xC8: () => this.y = this.setNZ((this.y + 1) & 0xFF),

            // JMP
            0x4C: () => { this.pc = abs(); },
            0x6C: () => { this.pc = ind(); },

            // JSR
            0x20: () => { let a = abs(); this.pushWord((this.pc - 1) & 0xFFFF); this.pc = a; },

            // LDA
            0xA9: () => { this.a = this.setNZ(readMem(imm())); },
            0xA5: () => { this.a = this.setNZ(readMem(zp())); },
            0xB5: () => { this.a = this.setNZ(readMem(zpx())); },
            0xAD: () => { this.a = this.setNZ(readMem(abs())); },
            0xBD: () => { addr = abx(); this.a = this.setNZ(readMem(addr)); if(pageCrossed) this.cycles++; },
            0xB9: () => { addr = aby(); this.a = this.setNZ(readMem(addr)); if(pageCrossed) this.cycles++; },
            0xA1: () => { this.a = this.setNZ(readMem(indx())); },
            0xB1: () => { addr = indy(); this.a = this.setNZ(readMem(addr)); if(pageCrossed) this.cycles++; },

            // LDX
            0xA2: () => { this.x = this.setNZ(readMem(imm())); },
            0xA6: () => { this.x = this.setNZ(readMem(zp())); },
            0xB6: () => { this.x = this.setNZ(readMem(zpy())); },
            0xAE: () => { this.x = this.setNZ(readMem(abs())); },
            0xBE: () => { addr = aby(); this.x = this.setNZ(readMem(addr)); if(pageCrossed) this.cycles++; },

            // LDY
            0xA0: () => { this.y = this.setNZ(readMem(imm())); },
            0xA4: () => { this.y = this.setNZ(readMem(zp())); },
            0xB4: () => { this.y = this.setNZ(readMem(zpx())); },
            0xAC: () => { this.y = this.setNZ(readMem(abs())); },
            0xBC: () => { addr = abx(); this.y = this.setNZ(readMem(addr)); if(pageCrossed) this.cycles++; },

            // LSR
            0x4A: () => { this.carry = this.a & 0x01; this.a = this.setNZ(this.a >> 1); },
            0x46: () => { addr = zp(); val = readMem(addr); this.carry = val & 0x01; writeMem(addr, this.setNZ(val >> 1)); },
            0x56: () => { addr = zpx(); val = readMem(addr); this.carry = val & 0x01; writeMem(addr, this.setNZ(val >> 1)); },
            0x4E: () => { addr = abs(); val = readMem(addr); this.carry = val & 0x01; writeMem(addr, this.setNZ(val >> 1)); },
            0x5E: () => { addr = abx(); val = readMem(addr); this.carry = val & 0x01; writeMem(addr, this.setNZ(val >> 1)); },

            // NOP
            0xEA: () => {},

            // ORA
            0x09: () => { this.a = this.setNZ(this.a | readMem(imm())); },
            0x05: () => { this.a = this.setNZ(this.a | readMem(zp())); },
            0x15: () => { this.a = this.setNZ(this.a | readMem(zpx())); },
            0x0D: () => { this.a = this.setNZ(this.a | readMem(abs())); },
            0x1D: () => { addr = abx(); this.a = this.setNZ(this.a | readMem(addr)); if(pageCrossed) this.cycles++; },
            0x19: () => { addr = aby(); this.a = this.setNZ(this.a | readMem(addr)); if(pageCrossed) this.cycles++; },
            0x01: () => { this.a = this.setNZ(this.a | readMem(indx())); },
            0x11: () => { addr = indy(); this.a = this.setNZ(this.a | readMem(addr)); if(pageCrossed) this.cycles++; },

            // PHA/PHP
            0x48: () => this.push(this.a),
            0x08: () => this.push(0x34),

            // PLA/PLP
            0x68: () => { this.a = this.setNZ(this.pull()); },
            0x28: () => { let p = this.pull(); this.carry = !!(p & 0x01); this.zero = !!(p & 0x02); this.interrupt = !!(p & 0x04); this.decimal = !!(p & 0x08); this.overflow = !!(p & 0x40); this.negative = !!(p & 0x80); },

            // ROL
            0x2A: () => { let c = this.carry ? 1 : 0; this.carry = !!(this.a & 0x80); this.a = this.setNZ(((this.a << 1) | c) & 0xFF); },
            0x26: () => { addr = zp(); val = readMem(addr); let c = this.carry ? 1 : 0; this.carry = !!(val & 0x80); writeMem(addr, this.setNZ(((val << 1) | c) & 0xFF)); },
            0x36: () => { addr = zpx(); val = readMem(addr); let c = this.carry ? 1 : 0; this.carry = !!(val & 0x80); writeMem(addr, this.setNZ(((val << 1) | c) & 0xFF)); },
            0x2E: () => { addr = abs(); val = readMem(addr); let c = this.carry ? 1 : 0; this.carry = !!(val & 0x80); writeMem(addr, this.setNZ(((val << 1) | c) & 0xFF)); },
            0x3E: () => { addr = abx(); val = readMem(addr); let c = this.carry ? 1 : 0; this.carry = !!(val & 0x80); writeMem(addr, this.setNZ(((val << 1) | c) & 0xFF)); },

            // ROR
            0x6A: () => { let c = this.carry ? 0x80 : 0; this.carry = !!(this.a & 0x01); this.a = this.setNZ((this.a >> 1) | c); },
            0x66: () => { addr = zp(); val = readMem(addr); let c = this.carry ? 0x80 : 0; this.carry = !!(val & 0x01); writeMem(addr, this.setNZ((val >> 1) | c)); },
            0x76: () => { addr = zpx(); val = readMem(addr); let c = this.carry ? 0x80 : 0; this.carry = !!(val & 0x01); writeMem(addr, this.setNZ((val >> 1) | c)); },
            0x6E: () => { addr = abs(); val = readMem(addr); let c = this.carry ? 0x80 : 0; this.carry = !!(val & 0x01); writeMem(addr, this.setNZ((val >> 1) | c)); },
            0x7E: () => { addr = abx(); val = readMem(addr); let c = this.carry ? 0x80 : 0; this.carry = !!(val & 0x01); writeMem(addr, this.setNZ((val >> 1) | c)); },

            // RTI/RTS
            0x40: () => { let p = this.pull(); this.carry = !!(p & 0x01); this.zero = !!(p & 0x02); this.interrupt = !!(p & 0x04); this.decimal = !!(p & 0x08); this.overflow = !!(p & 0x40); this.negative = !!(p & 0x80); this.pc = this.pullWord(); },
            0x60: () => { this.pc = (this.pullWord() + 1) & 0xFFFF; },

            // SBC
            0xE9: () => { val = readMem(imm()); let r = this.a - val - (this.carry?0:1); this.carry = r >= 0; this.overflow = ((this.a ^ val) & 0x80) && ((this.a ^ r) & 0x80); this.a = this.setNZ(r & 0xFF); },
            0xE5: () => { val = readMem(zp()); let r = this.a - val - (this.carry?0:1); this.carry = r >= 0; this.overflow = ((this.a ^ val) & 0x80) && ((this.a ^ r) & 0x80); this.a = this.setNZ(r & 0xFF); },
            0xF5: () => { val = readMem(zpx()); let r = this.a - val - (this.carry?0:1); this.carry = r >= 0; this.overflow = ((this.a ^ val) & 0x80) && ((this.a ^ r) & 0x80); this.a = this.setNZ(r & 0xFF); },
            0xED: () => { val = readMem(abs()); let r = this.a - val - (this.carry?0:1); this.carry = r >= 0; this.overflow = ((this.a ^ val) & 0x80) && ((this.a ^ r) & 0x80); this.a = this.setNZ(r & 0xFF); },
            0xFD: () => { addr = abx(); val = readMem(addr); let r = this.a - val - (this.carry?0:1); this.carry = r >= 0; this.overflow = ((this.a ^ val) & 0x80) && ((this.a ^ r) & 0x80); this.a = this.setNZ(r & 0xFF); if(pageCrossed) this.cycles++; },
            0xF9: () => { addr = aby(); val = readMem(addr); let r = this.a - val - (this.carry?0:1); this.carry = r >= 0; this.overflow = ((this.a ^ val) & 0x80) && ((this.a ^ r) & 0x80); this.a = this.setNZ(r & 0xFF); if(pageCrossed) this.cycles++; },
            0xE1: () => { val = readMem(indx()); let r = this.a - val - (this.carry?0:1); this.carry = r >= 0; this.overflow = ((this.a ^ val) & 0x80) && ((this.a ^ r) & 0x80); this.a = this.setNZ(r & 0xFF); },
            0xF1: () => { addr = indy(); val = readMem(addr); let r = this.a - val - (this.carry?0:1); this.carry = r >= 0; this.overflow = ((this.a ^ val) & 0x80) && ((this.a ^ r) & 0x80); this.a = this.setNZ(r & 0xFF); if(pageCrossed) this.cycles++; },

            // SEC/SED/SEI
            0x38: () => this.carry = true,
            0xF8: () => this.decimal = true,
            0x78: () => this.interrupt = true,

            // STA
            0x85: () => writeMem(zp(), this.a),
            0x95: () => writeMem(zpx(), this.a),
            0x8D: () => writeMem(abs(), this.a),
            0x9D: () => writeMem(abx(), this.a),
            0x99: () => writeMem(aby(), this.a),
            0x81: () => writeMem(indx(), this.a),
            0x91: () => writeMem(indy(), this.a),

            // STX
            0x86: () => writeMem(zp(), this.x),
            0x96: () => writeMem(zpy(), this.x),
            0x8E: () => writeMem(abs(), this.x),

            // STY
            0x84: () => writeMem(zp(), this.y),
            0x94: () => writeMem(zpx(), this.y),
            0x8C: () => writeMem(abs(), this.y),

            // TAX/TAY/TSX/TXA/TXS/TYA
            0xAA: () => this.x = this.setNZ(this.a),
            0xA8: () => this.y = this.setNZ(this.a),
            0xBA: () => this.x = this.setNZ(this.sp),
            0x8A: () => this.a = this.setNZ(this.x),
            0x9A: () => this.sp = this.x,
            0x98: () => this.a = this.setNZ(this.y),
        };

        let handler = opcodes[opcode];
        if (handler) {
            handler();
            // Add cycle penalty for page cross on read ops
        } else {
            // Unknown opcode - treat as NOP
            this.cycles++;
        }
    }
}

// ==================== PPU ====================
class PPU {
    constructor(nes) {
        this.nes = nes;
        this.reset();
    }

    reset() {
        this.ctrl = 0; this.mask = 0; this.status = 0;
        this.oamAddr = 0; this.ppuAddr = 0; this.ppuDataBuf = 0;
        this.fineX = 0; this.firstWrite = true;
        this.vramAddr = 0; this.tempAddr = 0;
        this.scanline = 0; this.cycle = 0; this.frame = 0;
        this.nmi = false; this.nmiOccured = false;
        this.vramBuffer = new Uint8Array(0x2000);
        this.oam = new Uint8Array(0x100);
        this.palette = new Uint8Array(32);
        this.pixels = new Uint32Array(NES_WIDTH * NES_HEIGHT);
        this.spriteZeroOnLine = false;
        this.spriteZeroRendering = false;
    }

    readRegister(addr) {
        switch (addr & 0x7) {
            case 2: // PPUSTATUS
                let result = (this.status & 0xE0) | (this.ppuDataBuf & 0x1F);
                this.status &= ~0x80;
                this.nmiOccured = false;
                this.firstWrite = true;
                return result;
            case 4: // OAMDATA
                return this.oam[this.oamAddr];
            case 7: // PPUDATA
                let r = this.ppuDataBuf;
                this.ppuDataBuf = this.vramRead(this.vramAddr);
                this.vramAddr = (this.vramAddr + ((this.ctrl & 0x04) ? 32 : 1)) & 0xFFFF;
                return r;
        }
        return 0;
    }

    writeRegister(addr, val) {
        switch (addr & 0x7) {
            case 0: // PPUCTRL
                this.ctrl = val;
                this.tempAddr = (this.tempAddr & 0xF3FF) | ((val & 0x03) << 10);
                break;
            case 1: // PPUMASK
                this.mask = val;
                break;
            case 3: // OAMADDR
                this.oamAddr = val;
                break;
            case 4: // OAMDATA
                this.oam[this.oamAddr] = val;
                this.oamAddr = (this.oamAddr + 1) & 0xFF;
                break;
            case 5: // PPUSCROLL
                if (this.firstWrite) {
                    this.fineX = val & 0x07;
                    this.tempAddr = (this.tempAddr & 0xFFE0) | (val >> 3);
                } else {
                    this.tempAddr = (this.tempAddr & 0x0C1F) | ((val & 0x07) << 12) | ((val & 0xF8) << 2);
                }
                this.firstWrite = !this.firstWrite;
                break;
            case 6: // PPUADDR
                if (this.firstWrite) {
                    this.tempAddr = (this.tempAddr & 0x80FF) | ((val & 0x3F) << 8);
                } else {
                    this.tempAddr = (this.tempAddr & 0xFF00) | val;
                    this.vramAddr = this.tempAddr;
                }
                this.firstWrite = !this.firstWrite;
                break;
            case 7: // PPUDATA
                this.vramWrite(this.vramAddr, val);
                this.vramAddr = (this.vramAddr + ((this.ctrl & 0x04) ? 32 : 1)) & 0xFFFF;
                break;
        }
    }

    vramRead(addr) {
        addr &= 0xFFFF;
        if (addr < 0x2000) return this.nes.mapper.ppuRead(addr);
        if (addr < 0x3F00) {
            let mirroring = this.nes.mapper.mirror;
            let a = (addr - 0x2000) % 0x1000;
            let table = Math.floor(a / 0x0400);
            let offset = a % 0x0400;
            let realAddr;
            if (mirroring === 0) { // horizontal
                realAddr = [0, 0, 1, 1][table] * 0x0400 + offset;
            } else if (mirroring === 1) { // vertical
                realAddr = [0, 1, 0, 1][table] * 0x0400 + offset;
            } else {
                realAddr = a;
            }
            return this.vramBuffer[realAddr];
        }
        let a = addr & 0x1F;
        if (a === 0x10 || a === 0x14 || a === 0x18 || a === 0x1C) a -= 0x10;
        return this.palette[a];
    }

    vramWrite(addr, val) {
        addr &= 0xFFFF;
        if (addr < 0x2000) {
            this.nes.mapper.ppuWrite(addr, val);
        } else if (addr < 0x3F00) {
            let mirroring = this.nes.mapper.mirror;
            let a = (addr - 0x2000) % 0x1000;
            let table = Math.floor(a / 0x0400);
            let offset = a % 0x0400;
            let realAddr;
            if (mirroring === 0) {
                realAddr = [0, 0, 1, 1][table] * 0x0400 + offset;
            } else if (mirroring === 1) {
                realAddr = [0, 1, 0, 1][table] * 0x0400 + offset;
            } else {
                realAddr = a;
            }
            this.vramBuffer[realAddr] = val;
        } else {
            let a = addr & 0x1F;
            if (a === 0x10 || a === 0x14 || a === 0x18 || a === 0x1C) a -= 0x10;
            this.palette[a] = val;
        }
    }

    pixelColor(index) {
        return NTSC_PALETTE[index & 0x3F] | 0xFF000000;
    }

    renderScanline() {
        if (this.scanline < 0 || this.scanline >= NES_HEIGHT) return;

        let bgEnabled = !!(this.mask & 0x08);
        let sprEnabled = !!(this.mask & 0x10);

        let baseNametable = 0x2000 | (this.vramAddr & 0x0C00);
        let nametableAddr = baseNametable + (this.scanline >> 3) * 32;
        let tileRow = this.scanline & 7;
        let yTile = Math.floor(this.scanline / 8);
        let fineY = (this.vramAddr >> 12) & 7;

        let bgPixels = [];
        for (let px = 0; px < NES_WIDTH; px++) {
            bgPixels[px] = 0;
        }

        if (bgEnabled) {
            let scrollX = ((this.vramAddr & 0x0400) ? 256 : 0) + ((this.vramAddr & 0x1F) << 3) + this.fineX;

            for (let px = 0; px < NES_WIDTH + 8; px++) {
                let screenX = (px + this.fineX) & 0x1FF;
                let tileX = screenX >> 3;
                let fineX = screenX & 7;

                let ntAddr = baseNametable;
                if (tileX >= 32) {
                    ntAddr ^= 0x0400;
                    tileX -= 32;
                }

                let ntByte = this.vramRead(ntAddr + Math.floor(this.scanline / 8) * 32 + tileX);
                let attrAddr = ntAddr + 0x03C0 + Math.floor(this.scanline / 8 / 4) * 8 + Math.floor(tileX / 4);
                let attrByte = this.vramRead(attrAddr);
                let attrShift = ((this.scanline / 4 | 0) & 1) * 4 + ((tileX / 4 | 0) & 1) * 2;
                let paletteNum = (attrByte >> attrShift) & 3;

                let chrAddr = ((this.ctrl & 0x10) ? 0x1000 : 0) + ntByte * 16 + fineY;
                let lo = this.vramRead(chrAddr);
                let hi = this.vramRead(chrAddr + 8);
                let bit = 7 - fineX;
                let colorIdx = ((lo >> bit) & 1) | (((hi >> bit) & 1) << 1);

                if (colorIdx === 0) bgPixels[px] = 0;
                else bgPixels[px] = this.pixelColor(this.palette[paletteNum * 4 + colorIdx]);
            }
        }

        // Sprites
        let sprCount = 0;
        let sprPixels = new Array(NES_WIDTH).fill(0);
        let sprPriority = new Array(NES_WIDTH).fill(false);
        let sprZeroPixels = new Array(NES_WIDTH).fill(false);

        if (sprEnabled) {
            let sprHeight = (this.ctrl & 0x20) ? 16 : 8;
            let spriteZeroInLine = false;

            for (let i = 0; i < 64; i++) {
                let y = this.oam[i * 4] + 1;
                if (y > this.scanline || y + sprHeight <= this.scanline) continue;
                if (sprCount >= 8) continue;

                sprCount++;
                let tile = this.oam[i * 4 + 1];
                let attr = this.oam[i * 4 + 2];
                let x = this.oam[i * 4 + 3];

                let flipV = !!(attr & 0x80);
                let flipH = !!(attr & 0x40);
                let palNum = attr & 0x03;
                let sprBehind = !!(attr & 0x20);

                let line = this.scanline - y;
                if (flipV) line = sprHeight - 1 - line;

                let chrAddr;
                if (sprHeight === 16) {
                    let bank = (tile & 1) * 0x1000;
                    let t = tile & 0xFE;
                    if (line < 8) chrAddr = bank + t * 16 + line;
                    else chrAddr = bank + (t + 1) * 16 + (line - 8);
                } else {
                    chrAddr = ((this.ctrl & 0x08) ? 0x1000 : 0) + tile * 16 + line;
                }

                let lo = this.vramRead(chrAddr);
                let hi = this.vramRead(chrAddr + 8);

                for (let bit = 0; bit < 8; bit++) {
                    let sx = x + bit;
                    if (sx >= NES_WIDTH) continue;

                    let pBit = flipH ? bit : (7 - bit);
                    let colorIdx = ((lo >> pBit) & 1) | (((hi >> pBit) & 1) << 1);
                    if (colorIdx === 0) continue;

                    if (i === 0) {
                        spriteZeroInLine = true;
                        if (sprPixels[sx] === 0) sprZeroPixels[sx] = true;
                    }

                    if (sprPixels[sx] === 0) {
                        sprPixels[sx] = this.pixelColor(this.palette[0x10 + palNum * 4 + colorIdx]);
                        sprPriority[sx] = sprBehind;
                    }
                }
            }
            this.spriteZeroRendering = spriteZeroInLine;
        }

        for (let px = 0; px < NES_WIDTH; px++) {
            let bg = bgPixels[px];
            let sp = sprPixels[px];
            let idx = this.scanline * NES_WIDTH + px;

            if (!bgEnabled && !sprEnabled) {
                this.pixels[idx] = this.pixelColor(this.palette[0]);
            } else if (!bgEnabled) {
                this.pixels[idx] = sp || this.pixelColor(this.palette[0]);
            } else if (!sprEnabled) {
                this.pixels[idx] = bg;
            } else {
                if (bg === 0 && sp === 0) {
                    this.pixels[idx] = this.pixelColor(this.palette[0]);
                } else if (bg === 0) {
                    this.pixels[idx] = sp;
                } else if (sp === 0) {
                    this.pixels[idx] = bg;
                } else {
                    if (this.spriteZeroRendering && sprZeroPixels[px] && px < 255) {
                        this.pixels[idx] = this.pixelColor(this.palette[0]);
                    } else if (sprPriority[px]) {
                        this.pixels[idx] = bg;
                    } else {
                        this.pixels[idx] = sp;
                    }
                }
            }
        }
    }

    step() {
        let renderFrame = false;

        if (this.scanline >= 0 && this.scanline < NES_HEIGHT) {
            if (this.cycle === 0) this.renderScanline();
        }

        this.cycle++;

        if (this.cycle >= 341) {
            this.cycle = 0;
            this.scanline++;

            if (this.scanline === -1) {
                // Pre-render
            } else if (this.scanline === NES_HEIGHT) {
                // VBlank start
                this.status |= 0x80;
                if (this.ctrl & 0x80) {
                    this.nmiOccured = true;
                    this.nes.cpu.nmi();
                }
                renderFrame = true;
            } else if (this.scanline === 261) {
                // Post-render
                this.scanline = -1;
                this.status &= ~(0x80 | 0x40);
                this.nmiOccured = false;
            }
        }

        return renderFrame;
    }
}

// ==================== APU ====================
class APU {
    constructor(nes) {
        this.nes = nes;
        this.reset();
    }

    reset() {
        this.pulse1 = { enabled: false, duty: 0, timerPeriod: 0, timerCounter: 0, envelopeLoop: false, volume: 0, sweepEnabled: false, lengthCounter: 0 };
        this.pulse2 = { enabled: false, duty: 0, timerPeriod: 0, timerCounter: 0, envelopeLoop: false, volume: 0, sweepEnabled: false, lengthCounter: 0 };
        this.triangle = { enabled: false, timerPeriod: 0, timerCounter: 0, lengthCounter: 0, counterReload: false, counter: 0, position: 0 };
        this.noise = { enabled: false, timerPeriod: 0, timerCounter: 0, lengthCounter: 0, shiftRegister: 1, mode: false };
        this.frameCounter = 0; this.framePeriod = 0;
        this.sampleBuffer = []; this.sampleRate = 0;
        this.audioCtx = null; this.scriptNode = null;
    }

    initAudio(sampleRate) {
        if (this.audioCtx) return;
        try {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: sampleRate });
            this.scriptNode = this.audioCtx.createScriptProcessor(1024, 0, 1);
            this.scriptNode.onaudioprocess = (e) => this.audioCallback(e);
            this.scriptNode.connect(this.audioCtx.destination);
            this.sampleRate = sampleRate;
        } catch(e) { console.warn('Audio init failed:', e); }
    }

    audioCallback(e) {
        let output = e.outputBuffer.getChannelData(0);
        let needed = output.length;
        while (this.sampleBuffer.length < needed) this.sampleBuffer.push(0);
        for (let i = 0; i < needed; i++) {
            output[i] = this.sampleBuffer.shift();
        }
    }

    stopAudio() {
        if (this.scriptNode) { this.scriptNode.disconnect(); this.scriptNode = null; }
        if (this.audioCtx) { this.audioCtx.close(); this.audioCtx = null; }
    }

    writeRegister(addr, val) {
        switch (addr) {
            case 0x4000:
                this.pulse1.enabled = !!(val & 0x0F || val & 0x10);
                this.pulse1.duty = (val >> 6) & 3;
                this.pulse1.envelopeLoop = !!(val & 0x20);
                this.pulse1.volume = val & 0x0F;
                break;
            case 0x4001:
                this.pulse1.sweepEnabled = !!(val & 0x80);
                break;
            case 0x4002:
                this.pulse1.timerPeriod = (this.pulse1.timerPeriod & 0x700) | val;
                break;
            case 0x4003:
                this.pulse1.timerPeriod = (this.pulse1.timerPeriod & 0xFF) | ((val & 0x07) << 8);
                this.pulse1.lengthCounter = [13,154,12,6,28,60,24,48,16,32,68,16,56,12,24,32][(val >> 3) & 0x1F];
                break;
            case 0x4004:
                this.pulse2.enabled = !!(val & 0x0F || val & 0x10);
                this.pulse2.duty = (val >> 6) & 3;
                this.pulse2.envelopeLoop = !!(val & 0x20);
                this.pulse2.volume = val & 0x0F;
                break;
            case 0x4005:
                this.pulse2.sweepEnabled = !!(val & 0x80);
                break;
            case 0x4006:
                this.pulse2.timerPeriod = (this.pulse2.timerPeriod & 0x700) | val;
                break;
            case 0x4007:
                this.pulse2.timerPeriod = (this.pulse2.timerPeriod & 0xFF) | ((val & 0x07) << 8);
                this.pulse2.lengthCounter = [13,154,12,6,28,60,24,48,16,32,68,16,56,12,24,32][(val >> 3) & 0x1F];
                break;
            case 0x4008:
                this.triangle.enabled = !!(val & 0x7F);
                this.triangle.counterReload = !!(val & 0x80);
                this.triangle.counter = this.triangle.counterReload ? 0 : this.triangle.counter;
                break;
            case 0x400A:
                this.triangle.timerPeriod = (this.triangle.timerPeriod & 0x700) | val;
                break;
            case 0x400B:
                this.triangle.timerPeriod = (this.triangle.timerPeriod & 0xFF) | ((val & 0x07) << 8);
                this.triangle.lengthCounter = [13,154,12,6,28,60,24,48,16,32,68,16,56,12,24,32][(val >> 3) & 0x1F];
                break;
            case 0x400C:
                this.noise.enabled = !!(val & 0x0F || val & 0x10);
                this.noise.envelopeLoop = !!(val & 0x20);
                this.noise.volume = val & 0x0F;
                break;
            case 0x400E:
                this.noise.mode = !!(val & 0x80);
                this.noise.timerPeriod = [4,8,16,32,64,96,128,160,202,254,380,508,762,1016,2034,4068][val & 0x0F];
                break;
            case 0x400F:
                this.noise.lengthCounter = [13,154,12,6,28,60,24,48,16,32,68,16,56,12,24,32][(val >> 3) & 0x1F];
                break;
            case 0x4015:
                this.pulse1.enabled = !!(val & 0x01);
                this.pulse2.enabled = !!(val & 0x02);
                this.triangle.enabled = !!(val & 0x04);
                this.noise.enabled = !!(val & 0x08);
                break;
            case 0x4017:
                this.frameCounter = val;
                break;
        }
    }

    readRegister(addr) {
        if (addr === 0x4015) {
            let result = 0;
            if (this.pulse1.lengthCounter > 0) result |= 0x01;
            if (this.pulse2.lengthCounter > 0) result |= 0x02;
            if (this.triangle.lengthCounter > 0) result |= 0x04;
            if (this.noise.lengthCounter > 0) result |= 0x08;
            return result;
        }
        return 0;
    }

    static DUTY_TABLE = [
        [0,1,0,0,0,0,0,0],
        [0,1,1,0,0,0,0,0],
        [0,1,1,1,1,0,0,0],
        [1,0,0,1,1,1,1,1]
    ];

    static TRIANGLE_TABLE = [
        15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,0,
        0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15
    ];

    step() {
        // Step all timers
        if (this.pulse1.timerCounter <= 0) {
            this.pulse1.timerCounter = this.pulse1.timerPeriod;
            this.pulse1.timerCycle = ((this.pulse1.timerCycle || 0) + 1) & 7;
        } else {
            this.pulse1.timerCounter--;
        }

        if (this.pulse2.timerCounter <= 0) {
            this.pulse2.timerCounter = this.pulse2.timerPeriod;
            this.pulse2.timerCycle = ((this.pulse2.timerCycle || 0) + 1) & 7;
        } else {
            this.pulse2.timerCounter--;
        }

        if (this.triangle.timerCounter <= 0) {
            this.triangle.timerCounter = this.triangle.timerPeriod;
            if (this.triangle.lengthCounter > 0 && this.triangle.counter > 0) {
                this.triangle.position = (this.triangle.position + 1) & 31;
            }
        } else {
            this.triangle.timerCounter--;
        }

        if (this.noise.timerCounter <= 0) {
            this.noise.timerCounter = this.noise.timerPeriod;
            let bit = this.noise.mode ? 6 : 1;
            let feedback = (this.noise.shiftRegister ^ (this.noise.shiftRegister >> bit)) & 1;
            this.noise.shiftRegister = (this.noise.shiftRegister >> 1) | (feedback << 14);
        } else {
            this.noise.timerCounter--;
        }
    }

    getSample() {
        let p1 = 0, p2 = 0, tri = 0, noise = 0;

        if (this.pulse1.enabled && this.pulse1.lengthCounter > 0) {
            let duty = APU.DUTY_TABLE[this.pulse1.duty][this.pulse1.timerCycle || 0];
            p1 = duty * this.pulse1.volume / 15;
        }
        if (this.pulse2.enabled && this.pulse2.lengthCounter > 0) {
            let duty = APU.DUTY_TABLE[this.pulse2.duty][this.pulse2.timerCycle || 0];
            p2 = duty * this.pulse2.volume / 15;
        }
        if (this.triangle.enabled && this.triangle.lengthCounter > 0) {
            tri = APU.TRIANGLE_TABLE[this.triangle.position] / 15.0;
        }
        if (this.noise.enabled && this.noise.lengthCounter > 0) {
            noise = (this.noise.shiftRegister & 1) * (this.noise.volume || 0) / 15;
        }

        let sample = (p1 * 0.00752 + p2 * 0.00752 + tri * 0.00851 + noise * 0.00494) * 2;
        return Math.max(-1, Math.min(1, sample));
    }
}

// ==================== MAPPER 0 (NROM) ====================
class Mapper0 {
    constructor(prgROM, chrROM, mirror) {
        this.prgROM = prgROM;
        this.chrROM = chrROM;
        this.chrRAM = new Uint8Array(0x2000);
        this.mirror = mirror;
        this.prgRAM = new Uint8Array(0x2000);
        this.hasChrRAM = chrROM.length === 0;
    }

    cpuRead(addr) {
        if (addr >= 0x6000 && addr < 0x8000) return this.prgRAM[addr - 0x6000];
        if (addr >= 0x8000) {
            if (this.prgROM.length === 0x4000) return this.prgROM[(addr - 0x8000) & 0x3FFF];
            return this.prgROM[addr - 0x8000];
        }
        return 0;
    }

    cpuWrite(addr, val) {
        if (addr >= 0x6000 && addr < 0x8000) this.prgRAM[addr - 0x6000] = val;
    }

    ppuRead(addr) {
        if (this.hasChrRAM) return this.chrRAM[addr];
        if (addr < this.chrROM.length) return this.chrROM[addr];
        return 0;
    }

    ppuWrite(addr, val) {
        if (this.hasChrRAM) this.chrRAM[addr] = val;
    }
}

// ==================== MAPPER 1 (MMC1) ====================
class Mapper1 {
    constructor(prgROM, chrROM, mirror) {
        this.prgROM = prgROM;
        this.chrROM = chrROM;
        this.chrRAM = new Uint8Array(0x2000);
        this.mirror = mirror;
        this.prgRAM = new Uint8Array(0x2000);
        this.hasChrRAM = chrROM.length === 0;
        this.shiftReg = 0x10;
        this.control = 0x0C;
        this.prgBank = 0;
        this.chrBank0 = 0;
        this.chrBank1 = 0;
    }

    cpuRead(addr) {
        if (addr >= 0x6000 && addr < 0x8000) return this.prgRAM[addr - 0x6000];
        if (addr >= 0x8000) {
            let bank = this.prgBank;
            let mode = (this.control >> 2) & 3;
            let offset;
            if (addr < 0xC000) {
                if (mode >= 2) offset = bank * 0x4000;
                else offset = 0;
            } else {
                if (mode === 0 || mode === 1) offset = this.prgROM.length - 0x8000;
                else if (mode === 2) offset = this.prgROM.length - 0x8000;
                else offset = bank * 0x4000;
            }
            return this.prgROM[(offset + (addr - 0x8000)) % this.prgROM.length];
        }
        return 0;
    }

    cpuWrite(addr, val) {
        if (addr >= 0x6000 && addr < 0x8000) { this.prgRAM[addr - 0x6000] = val; return; }
        if (addr < 0x8000) return;
        if (val & 0x80) { this.shiftReg = 0x10; this.control |= 0x0C; return; }
        let complete = this.shiftReg & 1;
        this.shiftReg = (this.shiftReg >> 1) | ((val & 1) << 4);
        if (complete) {
            let reg = (addr >> 13) & 3;
            let value = this.shiftReg & 0x1F;
            this.shiftReg = 0x10;
            switch(reg) {
                case 0:
                    this.control = value;
                    this.mirror = [1, 1, 0, 0][(value >> 2) & 3];
                    break;
                case 1: this.chrBank0 = value; break;
                case 2: this.chrBank1 = value; break;
                case 3: this.prgBank = value & 0x0F; break;
            }
        }
    }

    ppuRead(addr) {
        if (this.hasChrRAM) return this.chrRAM[addr];
        let mode = (this.control >> 4) & 1;
        if (mode === 0) {
            return this.chrROM[(this.chrBank0 * 0x1000 + addr) % this.chrROM.length];
        } else {
            if (addr < 0x1000) return this.chrROM[(this.chrBank0 * 0x1000 + addr) % this.chrROM.length];
            else return this.chrROM[(this.chrBank1 * 0x1000 + (addr - 0x1000)) % this.chrROM.length];
        }
    }

    ppuWrite(addr, val) {
        if (this.hasChrRAM) this.chrRAM[addr] = val;
    }
}

// ==================== MAPPER 2 (UxROM) ====================
class Mapper2 {
    constructor(prgROM, chrROM, mirror) {
        this.prgROM = prgROM;
        this.chrROM = chrROM;
        this.chrRAM = new Uint8Array(0x2000);
        this.mirror = mirror;
        this.prgBank = 0;
        this.hasChrRAM = chrROM.length === 0;
    }

    cpuRead(addr) {
        if (addr >= 0x8000) {
            return this.prgROM[(this.prgBank * 0x4000 + (addr - 0x8000)) % this.prgROM.length];
        }
        return 0;
    }

    cpuWrite(addr, val) {
        if (addr >= 0x8000) this.prgBank = val & 0x0F;
    }

    ppuRead(addr) {
        if (this.hasChrRAM) return this.chrRAM[addr];
        return this.chrROM[addr % this.chrROM.length];
    }

    ppuWrite(addr, val) {
        if (this.hasChrRAM) this.chrRAM[addr] = val;
    }
}

// ==================== MAPPER 3 (CNROM) ====================
class Mapper3 {
    constructor(prgROM, chrROM, mirror) {
        this.prgROM = prgROM;
        this.chrROM = chrROM;
        this.mirror = mirror;
        this.chrBank = 0;
    }

    cpuRead(addr) {
        if (addr >= 0x8000) {
            if (this.prgROM.length === 0x4000) return this.prgROM[(addr - 0x8000) & 0x3FFF];
            return this.prgROM[addr - 0x8000];
        }
        return 0;
    }

    cpuWrite(addr, val) {
        if (addr >= 0x8000) this.chrBank = val & 0x03;
    }

    ppuRead(addr) {
        return this.chrROM[(this.chrBank * 0x2000 + addr) % this.chrROM.length];
    }

    ppuWrite() {}
}

// ==================== NES ====================
class NES {
    constructor() {
        this.cpu = new CPU(this);
        this.ppu = new PPU(this);
        this.apu = new APU(this);
        this.mapper = null;
        this.running = false;
        this.frameCallback = null;

        this.cpuRAM = new Uint8Array(0x0800);
        this.controller1 = 0;
        this.controller2 = 0;
        this.controllerStrobe = 0;
        this.controller1Bits = 0;
        this.controller2Bits = 0;
    }

    cpuRead(addr) {
        if (addr < 0x2000) return this.cpuRAM[addr & 0x7FF];
        if (addr < 0x4000) return this.ppu.readRegister(addr);
        if (addr === 0x4016) {
            let result = (this.controller1Bits >> 7) & 1;
            this.controller1Bits = (this.controller1Bits << 1) & 0xFF;
            return result;
        }
        if (addr === 0x4017) {
            let result = (this.controller2Bits >> 7) & 1;
            this.controller2Bits = (this.controller2Bits << 1) & 0xFF;
            return result;
        }
        if (addr >= 0x4000 && addr < 0x4020) return this.apu.readRegister(addr);
        if (addr >= 0x4020) return this.mapper.cpuRead(addr);
        return 0;
    }

    cpuWrite(addr, val) {
        if (addr < 0x2000) { this.cpuRAM[addr & 0x7FF] = val; return; }
        if (addr < 0x4000) { this.ppu.writeRegister(addr, val); return; }
        if (addr === 0x4014) {
            // OAM DMA
            let base = val << 8;
            for (let i = 0; i < 256; i++) {
                this.ppu.oam[(this.ppu.oamAddr + i) & 0xFF] = this.cpuRead(base + i);
            }
            this.cpu.stall += 513 + (this.cpu.cycles & 1);
            return;
        }
        if (addr === 0x4016) {
            this.controllerStrobe = val & 1;
            if (this.controllerStrobe) {
                this.controller1Bits = this.controller1;
                this.controller2Bits = this.controller2;
            }
            return;
        }
        if (addr >= 0x4000 && addr < 0x4020) { this.apu.writeRegister(addr, val); return; }
        if (addr >= 0x4020) { this.mapper.cpuWrite(addr, val); }
    }

    loadROM(data) {
        if (data[0] !== 0x4E || data[1] !== 0x45 || data[2] !== 0x53 || data[3] !== 0x1A) {
            throw new Error('Not a valid iNES ROM');
        }

        let prgSize = data[4] * 16384;
        let chrSize = data[5] * 8192;
        let flags6 = data[6];
        let flags7 = data[7];

        let mirror = (flags6 & 1) ? 1 : 0;
        let mapperNum = ((flags6 >> 4) & 0x0F) | (flags7 & 0xF0);

        let hasTrainer = !!(flags6 & 0x04);
        let prgStart = 16 + (hasTrainer ? 512 : 0);
        let chrStart = prgStart + prgSize;

        let prgROM = data.slice(prgStart, prgStart + prgSize);
        let chrROM = chrSize > 0 ? data.slice(chrStart, chrStart + chrSize) : new Uint8Array(0);

        switch(mapperNum) {
            case 0: this.mapper = new Mapper0(prgROM, chrROM, mirror); break;
            case 1: this.mapper = new Mapper1(prgROM, chrROM, mirror); break;
            case 2: this.mapper = new Mapper2(prgROM, chrROM, mirror); break;
            case 3: this.mapper = new Mapper3(prgROM, chrROM, mirror); break;
            default: throw new Error('Unsupported mapper: ' + mapperNum);
        }

        this.reset();
    }

    reset() {
        this.cpu.reset();
        this.ppu.reset();
        this.apu.reset();
        this.cpuRAM.fill(0);
        this.cpu.pc = this.cpuRead(0xFFFD) === 0 ? 0x8000 : (this.cpuRead(0xFFFC) | (this.cpuRead(0xFFFD) << 8));
        if (this.cpu.pc === 0) this.cpu.pc = this.cpuRead(0xFFFC) | (this.cpuRead(0xFFFD) << 8);
        if (this.cpu.pc === 0) this.cpu.pc = 0x8000;
        this.running = false;
    }

    setController(controller, keys) {
        let val = 0;
        if (keys.A) val |= 0x80;
        if (keys.B) val |= 0x40;
        if (keys.Select) val |= 0x20;
        if (keys.Start) val |= 0x10;
        if (keys.Up) val |= 0x08;
        if (keys.Down) val |= 0x04;
        if (keys.Left) val |= 0x02;
        if (keys.Right) val |= 0x01;
        if (controller === 1) this.controller1 = val;
        else this.controller2 = val;
    }

    frame() {
        let frameComplete = false;
        while (!frameComplete) {
            this.cpu.step();
            let cpuCycles = this.cpu.cycles;
            this.cpu.cycles = 0;

            for (let i = 0; i < cpuCycles * 3; i++) {
                if (this.ppu.step()) frameComplete = true;
                this.apu.step();
            }
        }
    }
}
