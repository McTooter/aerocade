// SNES Emulator Core - 65C816 CPU + PPU + DSP

const SNES_WIDTH = 256;
const SNES_HEIGHT = 224;

const SNES_PALETTE = [
    0x7FFF,0x56B5,0x639F,0x7B7F,0x7F5E,0x7F3A,0x7D14,0x60C0,
    0x40C0,0x2120,0x2164,0x21AA,0x19D0,0x04D6,0x0376,0x0236,
    0x41E8,0x4268,0x4AEB,0x536D,0x5BCD,0x5BC8,0x5B60,0x4320,
    0x2AE0,0x1340,0x138A,0x1BF0,0x13F8,0x0BFA,0x0A9A,0x095B,
    0x634F,0x6BEF,0x746F,0x7CEF,0x7CEF,0x7C89,0x7422,0x5C00,
    0x44A0,0x2D60,0x2DE8,0x2E72,0x271A,0x1799,0x1659,0x1539,
    0x7CFF,0x7EFF,0x7E79,0x7E39,0x7DDB,0x7539,0x5D18,0x4510,
    0x2DD0,0x15D0,0x1618,0x2E98,0x3F3A,0x379A,0x371A,0x2E9A,
    0x0000,0x0000,0x0000,0x0000,0x0000,0x0000,0x0000,0x0000,
];

class SNESCPU {
    constructor(snes) {
        this.snes = snes;
        this.a = 0; this.x = 0; this.y = 0;
        this.s = 0x01FF; this.d = 0; this.db = 0; this.pb = 0;
        this.pc = 0; this.emulationMode = true;
        this.mFlag = true; this.xFlag = true;
        this.c = false; this.z = false; this.n = false; this.v = false;
        this.dFlag = false; this.iFlag = true; this.e = true;
        this.cycles = 0;
    }

    reset() {
        this.a = 0; this.x = 0; this.y = 0;
        this.s = 0x01FF; this.d = 0; this.db = 0; this.pb = 0;
        this.emulationMode = true; this.mFlag = true; this.xFlag = true;
        this.c = false; this.z = false; this.n = false; this.v = false;
        this.dFlag = false; this.iFlag = true; this.e = true;
        this.cycles = 0;
    }

    setNZ8(v) { v &= 0xFF; this.z = v === 0; this.n = !!(v & 0x80); }
    setNZ16(v) { v &= 0xFFFF; this.z = v === 0; this.n = !!(v & 0x8000); }
    setNZ(v) { if (this.mFlag) this.setNZ8(v); else this.setNZ16(v); }

    readByte(a) { return this.snes.snesCpuRead(a & 0xFFFFFF); }
    readWord(a) { return this.readByte(a) | (this.readByte(a + 1) << 8); }
    readLong(a) { return this.readByte(a) | (this.readByte(a + 1) << 8) | (this.readByte(a + 2) << 16); }

    writeByte(a, v) { this.snes.snesCpuWrite(a & 0xFFFFFF, v & 0xFF); }

    pushByte(v) { this.writeByte(this.s, v); this.s = (this.s & 0xFF00) | ((this.s - 1) & 0xFF); }
    pushWord(v) { this.pushByte((v >> 8) & 0xFF); this.pushByte(v & 0xFF); }
    pushLong(v) { this.pushByte((v >> 16) & 0xFF); this.pushByte((v >> 8) & 0xFF); this.pushByte(v & 0xFF); }
    pullByte() { this.s = (this.s & 0xFF00) | ((this.s + 1) & 0xFF); return this.readByte(this.s); }
    pullWord() { let lo = this.pullByte(); return lo | (this.pullByte() << 8); }

    getFlagWidth() { return this.mFlag ? 1 : 2; }
    getRegWidth() { return this.xFlag ? 1 : 2; }
    getA() { return this.mFlag ? (this.a & 0xFF) : this.a; }
    setA(v) { if (this.mFlag) { this.a = (this.a & 0xFF00) | (v & 0xFF); } else { this.a = v & 0xFFFF; } }
    getXY() { return this.xFlag ? (this.x & 0xFF) : ((this.x & 0xFF) | (this.y & 0xFF00)); }

    readAddr(mode) {
        switch(mode) {
            case 'imm': { let a = (this.pb << 16) | this.pc; this.pc = (this.pc + (this.mFlag ? 1 : 2)) & 0xFFFF; return a; }
            case 'imm16': { let a = (this.pb << 16) | this.pc; this.pc = (this.pc + 2) & 0xFFFF; return a; }
            case 'dp': { let zp = this.readByte((this.pb << 16) | this.pc); this.pc = (this.pc + 1) & 0xFFFF; return (this.d + zp) & 0xFFFF; }
            case 'dpX': { let zp = this.readByte((this.pb << 16) | this.pc); this.pc = (this.pc + 1) & 0xFFFF; return (this.d + zp + this.x) & 0xFFFF; }
            case 'dpY': { let zp = this.readByte((this.pb << 16) | this.pc); this.pc = (this.pc + 1) & 0xFFFF; return (this.d + zp + this.y) & 0xFFFF; }
            case 'abs': { let a = this.readWord((this.pb << 16) | this.pc); this.pc = (this.pc + 2) & 0xFFFF; return (this.pb << 16) | a; }
            case 'absX': { let a = this.readWord((this.pb << 16) | this.pc); this.pc = (this.pc + 2) & 0xFFFF; return (this.pb << 16) | ((a + this.x) & 0xFFFF); }
            case 'absY': { let a = this.readWord((this.pb << 16) | this.pc); this.pc = (this.pc + 2) & 0xFFFF; return (this.pb << 16) | ((a + this.y) & 0xFFFF); }
            case 'long': { let a = this.readLong((this.pb << 16) | this.pc); this.pc = (this.pc + 3) & 0xFFFF; return a; }
            case 'longX': { let a = this.readLong((this.pb << 16) | this.pc); this.pc = (this.pc + 3) & 0xFFFF; return (a + this.x) & 0xFFFFFF; }
            case 'ind': { let zp = this.readWord((this.pb << 16) | this.pc); this.pc = (this.pc + 2) & 0xFFFF; return this.readWord((this.pb << 16) | zp); }
            case 'indX': { let zp = this.readByte((this.pb << 16) | this.pc); this.pc = (this.pc + 1) & 0xFFFF; let addr = (this.d + zp + this.x) & 0xFFFF; return this.readWord((this.db << 16) | addr); }
            case 'indY': { let zp = this.readByte((this.pb << 16) | this.pc); this.pc = (this.pc + 1) & 0xFFFF; let addr = this.readWord((this.db << 16) | ((this.d + zp) & 0xFFFF)); return ((this.db << 16) | ((addr + this.y) & 0xFFFF)) & 0xFFFFFF; }
            case 'sr': { let off = this.readByte((this.pb << 16) | this.pc); this.pc = (this.pc + 1) & 0xFFFF; if (off & 0x80) off -= 0x100; return ((this.s & 0xFF) + off) & 0xFFFF; }
            case 'srY': { let off = this.readByte((this.pb << 16) | this.pc); this.pc = (this.pc + 1) & 0xFFFF; if (off & 0x80) off -= 0x100; return ((this.s & 0xFF) + off + this.y) & 0xFFFF; }
            default: return 0;
        }
    }

    fetch() { let v = this.readByte((this.pb << 16) | this.pc); this.pc = (this.pc + 1) & 0xFFFF; return v; }
    fetchWord() { let v = this.readWord((this.pb << 16) | this.pc); this.pc = (this.pc + 2) & 0xFFFF; return v; }

    step() {
        let opcode = this.fetch();
        let w = this.mFlag ? 1 : 2;
        let rw = this.getRegWidth();

        const RMW = (fn) => {
            if (this.mFlag) {
                let addr = this.readAddr('abs');
                let val = this.readByte(addr);
                fn(val, (v) => { this.writeByte(addr, v); });
            } else {
                let addr = this.readAddr('abs');
                let val = this.readWord(addr);
                fn(val, (v) => { this.writeWord(addr, v); });
            }
        };

        const ADC = (val) => {
            let result;
            if (this.mFlag) {
                let a = this.a & 0xFF;
                if (this.dFlag) { let al = (a & 0x0F) + (val & 0x0F) + (this.c ? 1 : 0); if (al >= 10) { al -= 10; result = (a & 0xF0) + 0x10 + al; } else { result = a + val + (this.c ? 1 : 0); } }
                else { result = a + (val & 0xFF) + (this.c ? 1 : 0); }
                this.v = !((a ^ val) & 0x80) && ((a ^ result) & 0x80);
                this.c = result > 0xFF;
                this.a = (this.a & 0xFF00) | (result & 0xFF);
                this.setNZ8(result & 0xFF);
            } else {
                let a = this.a;
                if (this.dFlag) { let al = (a & 0x000F) + (val & 0x000F) + (this.c ? 1 : 0); if (al >= 10) { al -= 10; result = (a & 0xFFF0) + 0x10 + al; } else { result = a + val + (this.c ? 1 : 0); } }
                else { result = a + val + (this.c ? 1 : 0); }
                this.v = !((a ^ val) & 0x8000) && ((a ^ result) & 0x8000);
                this.c = result > 0xFFFF;
                this.a = result & 0xFFFF;
                this.setNZ16(result);
            }
        };

        const SBC = (val) => {
            if (this.mFlag) {
                let a = this.a & 0xFF; val = val & 0xFF;
                let result = a - val - (this.c ? 0 : 1);
                this.v = ((a ^ val) & 0x80) && ((a ^ result) & 0x80);
                this.c = result >= 0;
                result &= 0xFF;
                this.a = (this.a & 0xFF00) | result;
                this.setNZ8(result);
            } else {
                let a = this.a; val = val & 0xFFFF;
                let result = a - val - (this.c ? 0 : 1);
                this.v = ((a ^ val) & 0x8000) && ((a ^ result) & 0x8000);
                this.c = result >= 0;
                result &= 0xFFFF;
                this.a = result;
                this.setNZ16(result);
            }
        };

        const CMP = (reg, val) => {
            let r = reg - val;
            this.c = reg >= val;
            if (rw === 1) this.setNZ8(r & 0xFF); else this.setNZ16(r & 0xFFFF);
        };

        const BRA = (cond) => {
            let off = this.fetch();
            if (off & 0x80) off -= 0x100;
            if (cond) { this.pc = (this.pc + off) & 0xFFFF; this.cycles += 2; }
        };

        const BIT = (val) => {
            if (this.mFlag) {
                this.z = !(this.a & 0xFF & val);
                this.n = !!(val & 0x80);
                this.v = !!(val & 0x40);
            } else {
                this.z = !(this.a & val);
                this.n = !!(val & 0x8000);
                this.v = !!(val & 0x4000);
            }
        };

        // Block transfers
        const MVN = () => { let dst = this.fetch(); let src = this.fetch(); this.db = dst; let cnt = this.xFlag ? 1 : this.a + 1; for (let i = 0; i < cnt; i++) { this.writeByte((dst << 16) | this.y, this.readByte((src << 16) | this.x)); this.x++; this.y++; } this.a = 0xFFFF; this.xFlag || (this.a -= 1); };
        const MVP = () => { let dst = this.fetch(); let src = this.fetch(); this.db = dst; let cnt = this.xFlag ? 1 : this.a + 1; for (let i = 0; i < cnt; i++) { this.writeByte((dst << 16) | this.y, this.readByte((src << 16) | this.x)); this.x--; this.y--; } this.a = 0xFFFF; this.xFlag || (this.a -= 1); };

        switch (opcode) {
            // NOP
            case 0xEA: break;

            // LDA
            case 0xA9: { let addr = this.readAddr('imm'); if (this.mFlag) { this.a = (this.a & 0xFF00) | this.readByte(addr); this.setNZ8(this.a & 0xFF); } else { this.a = this.readWord(addr); this.setNZ16(this.a); } break; }
            case 0xA5: case 0xB5: case 0xAD: case 0xBD: case 0xB9: case 0xAF: case 0xBF: {
                let modes = [,'dp','dpX','abs','absX','absY','long','longX'];
                let addr = this.readAddr(modes[opcode] || 'abs');
                if (this.mFlag) { this.a = (this.a & 0xFF00) | this.readByte(addr); this.setNZ8(this.a & 0xFF); }
                else { this.a = this.readWord(addr); this.setNZ16(this.a); }
                break;
            }
            case 0xA1: case 0xB1: case 0xA3: case 0xB3: {
                let modes = ['indX','indY','sr','srY'];
                let addr = this.readAddr(modes[opcode - 0xA1] || 'indX');
                if (this.mFlag) { this.a = (this.a & 0xFF00) | this.readByte(addr); this.setNZ8(this.a & 0xFF); }
                else { this.a = this.readWord(addr); this.setNZ16(this.a); }
                break;
            }

            // STA
            case 0x85: case 0x95: case 0x8D: case 0x9D: case 0x99: case 0x8F: case 0x9F: {
                let modes = [,'dp','dpX','abs','absX','absY','long','longX'];
                let addr = this.readAddr(modes[opcode] || 'abs');
                if (this.mFlag) this.writeByte(addr, this.a & 0xFF);
                else { this.writeByte(addr, this.a & 0xFF); this.writeByte(addr + 1, (this.a >> 8) & 0xFF); }
                break;
            }
            case 0x81: case 0x91: case 0x83: case 0x93: {
                let modes = ['indX','indY','sr','srY'];
                let addr = this.readAddr(modes[opcode - 0x81] || 'indX');
                if (this.mFlag) this.writeByte(addr, this.a & 0xFF);
                else { this.writeByte(addr, this.a & 0xFF); this.writeByte(addr + 1, (this.a >> 8) & 0xFF); }
                break;
            }

            // LDX
            case 0xA2: { let addr = this.readAddr(this.xFlag ? 'imm' : 'imm16'); if (this.xFlag) { this.x = this.readByte(addr); this.setNZ8(this.x); } else { this.x = this.readWord(addr); this.setNZ16(this.x); } break; }
            case 0xA6: case 0xB6: case 0xAE: case 0xBE: {
                let modes = [,'dp','dpY','abs','absY'];
                let addr = this.readAddr(modes[opcode] || 'abs');
                if (this.xFlag) { this.x = this.readByte(addr); this.setNZ8(this.x); } else { this.x = this.readWord(addr); this.setNZ16(this.x); }
                break;
            }

            // STX
            case 0x86: case 0x96: case 0x8E: {
                let modes = [,'dp','dpY','abs'];
                let addr = this.readAddr(modes[opcode] || 'abs');
                if (this.xFlag) this.writeByte(addr, this.x & 0xFF);
                else { this.writeByte(addr, this.x & 0xFF); this.writeByte(addr + 1, (this.x >> 8) & 0xFF); }
                break;
            }

            // LDY
            case 0xA0: case 0xB0: case 0xAC: case 0xBC: {
                let modes = ['imm','dp','abs','absX'];
                let addr = this.readAddr(modes[opcode - 0xA0] || 'imm');
                if (this.xFlag) { this.y = this.readByte(addr); this.setNZ8(this.y); } else { this.y = this.readWord(addr); this.setNZ16(this.y); }
                break;
            }

            // STY
            case 0x84: case 0x94: case 0x8C: {
                let modes = ['imm','dp','abs'];
                let addr = this.readAddr(modes[opcode - 0x84] || 'imm');
                if (this.xFlag) this.writeByte(addr, this.y & 0xFF);
                else { this.writeByte(addr, this.y & 0xFF); this.writeByte(addr + 1, (this.y >> 8) & 0xFF); }
                break;
            }

            // STZ
            case 0x64: case 0x74: case 0x9C: case 0x9E: {
                let modes = ['imm','dp','dpX','abs','absX'];
                let addr = this.readAddr(modes[opcode - 0x64] || 'abs');
                if (this.mFlag) this.writeByte(addr, 0);
                else { this.writeByte(addr, 0); this.writeByte(addr + 1, 0); }
                break;
            }

            // ADC
            case 0x69: { let addr = this.readAddr('imm'); ADC(this.mFlag ? this.readByte(addr) : this.readWord(addr)); break; }
            case 0x65: case 0x75: case 0x6D: case 0x7D: case 0x79: case 0x6F: case 0x7F: {
                let modes = [,'dp','dpX','abs','absX','absY','long','longX'];
                let addr = this.readAddr(modes[opcode] || 'abs');
                ADC(this.mFlag ? this.readByte(addr) : this.readWord(addr));
                break;
            }

            // SBC
            case 0xE9: { let addr = this.readAddr('imm'); SBC(this.mFlag ? this.readByte(addr) : this.readWord(addr)); break; }
            case 0xE5: case 0xF5: case 0xED: case 0xFD: case 0xF9: case 0xEF: case 0xFF: {
                let modes = [,'dp','dpX','abs','absX','absY','long','longX'];
                let addr = this.readAddr(modes[opcode] || 'abs');
                SBC(this.mFlag ? this.readByte(addr) : this.readWord(addr));
                break;
            }

            // CMP
            case 0xC9: { let addr = this.readAddr('imm'); CMP(this.getA(), this.mFlag ? this.readByte(addr) : this.readWord(addr)); break; }
            case 0xC5: case 0xD5: case 0xCD: case 0xDD: case 0xD9: case 0xCF: case 0xDF: {
                let modes = [,'dp','dpX','abs','absX','absY','long','longX'];
                let addr = this.readAddr(modes[opcode] || 'abs');
                CMP(this.getA(), this.mFlag ? this.readByte(addr) : this.readWord(addr));
                break;
            }

            // CPX
            case 0xE0: case 0xE4: case 0xEC: {
                let modes = ['imm','dp','abs'];
                let addr = this.readAddr(modes[opcode - 0xE0] || 'imm');
                CMP(this.xFlag ? (this.x & 0xFF) : this.x, this.xFlag ? this.readByte(addr) : this.readWord(addr));
                break;
            }

            // CPY
            case 0xC0: case 0xC4: case 0xCC: {
                let modes = ['imm','dp','abs'];
                let addr = this.readAddr(modes[opcode - 0xC0] || 'imm');
                CMP(this.xFlag ? (this.y & 0xFF) : this.y, this.xFlag ? this.readByte(addr) : this.readWord(addr));
                break;
            }

            // INC
            case 0x1A: case 0x3A: { if (this.mFlag) { this.a = (this.a & 0xFF00) | ((this.a + 1) & 0xFF); this.setNZ8(this.a & 0xFF); } else { this.a = (this.a + 1) & 0xFFFF; this.setNZ16(this.a); } break; }
            case 0xE6: case 0xF6: case 0xEE: case 0xFE: {
                let modes = [,'dp','dpX','abs','absX'];
                let addr = this.readAddr(modes[opcode] || 'abs');
                if (this.mFlag) { let v = (this.readByte(addr) + 1) & 0xFF; this.writeByte(addr, v); this.setNZ8(v); }
                else { let v = (this.readWord(addr) + 1) & 0xFFFF; this.writeByte(addr, v & 0xFF); this.writeByte(addr + 1, (v >> 8) & 0xFF); this.setNZ16(v); }
                break;
            }

            // DEC
            case 0x8A: { this.a = this.x; if (this.mFlag) this.setNZ8(this.a & 0xFF); else this.setNZ16(this.a); break; }
            case 0x98: { this.a = this.y; if (this.mFlag) this.setNZ8(this.a & 0xFF); else this.setNZ16(this.a); break; }
            case 0xC6: case 0xD6: case 0xCE: case 0xDE: {
                let modes = [,'dp','dpX','abs','absX'];
                let addr = this.readAddr(modes[opcode] || 'abs');
                if (this.mFlag) { let v = (this.readByte(addr) - 1) & 0xFF; this.writeByte(addr, v); this.setNZ8(v); }
                else { let v = (this.readWord(addr) - 1) & 0xFFFF; this.writeByte(addr, v & 0xFF); this.writeByte(addr + 1, (v >> 8) & 0xFF); this.setNZ16(v); }
                break;
            }

            // DEX/DEY
            case 0xCA: { if (this.xFlag) { this.x = (this.x - 1) & 0xFF; this.setNZ8(this.x); } else { this.x = (this.x - 1) & 0xFFFF; this.setNZ16(this.x); } break; }
            case 0x88: { if (this.xFlag) { this.y = (this.y - 1) & 0xFF; this.setNZ8(this.y); } else { this.y = (this.y - 1) & 0xFFFF; this.setNZ16(this.y); } break; }

            // INX/INY
            case 0xE8: { if (this.xFlag) { this.x = (this.x + 1) & 0xFF; this.setNZ8(this.x); } else { this.x = (this.x + 1) & 0xFFFF; this.setNZ16(this.x); } break; }
            case 0xC8: { if (this.xFlag) { this.y = (this.y + 1) & 0xFF; this.setNZ8(this.y); } else { this.y = (this.y + 1) & 0xFFFF; this.setNZ16(this.y); } break; }

            // TAX/TAY/TXA/TYA/TXS/TXSA/TCD/TDC/TCX/TSC
            case 0xAA: { this.x = this.xFlag ? (this.a & 0xFF) : this.a; this.setNZ(this.x); break; }
            case 0xA8: { this.y = this.xFlag ? (this.a & 0xFF) : this.a; this.setNZ(this.y); break; }
            case 0x8A: { this.a = this.xFlag ? (this.a & 0xFF00) | (this.x & 0xFF) : this.x; break; }
            case 0x98: { this.a = this.xFlag ? (this.a & 0xFF00) | (this.y & 0xFF) : this.y; break; }
            case 0xBA: { this.x = this.s; this.setNZ(this.x); break; }
            case 0x9A: { this.s = (this.s & 0xFF00) | (this.x & 0xFF); break; }

            // AND
            case 0x29: { let addr = this.readAddr('imm'); if (this.mFlag) { this.a = (this.a & 0xFF00) | ((this.a & 0xFF) & this.readByte(addr)); this.setNZ8(this.a & 0xFF); } else { this.a &= this.readWord(addr); this.setNZ16(this.a); } break; }
            case 0x25: case 0x35: case 0x2D: case 0x3D: case 0x39: case 0x2F: case 0x3F: {
                let modes = [,'dp','dpX','abs','absX','absY','long','longX'];
                let addr = this.readAddr(modes[opcode] || 'abs');
                if (this.mFlag) { this.a = (this.a & 0xFF00) | ((this.a & 0xFF) & this.readByte(addr)); this.setNZ8(this.a & 0xFF); }
                else { this.a &= this.readWord(addr); this.setNZ16(this.a); }
                break;
            }

            // ORA
            case 0x09: { let addr = this.readAddr('imm'); if (this.mFlag) { this.a = (this.a & 0xFF00) | ((this.a | this.readByte(addr)) & 0xFF); this.setNZ8(this.a & 0xFF); } else { this.a |= this.readWord(addr); this.setNZ16(this.a); } break; }
            case 0x05: case 0x15: case 0x0D: case 0x1D: case 0x19: case 0x0F: case 0x1F: {
                let modes = [,'dp','dpX','abs','absX','absY','long','longX'];
                let addr = this.readAddr(modes[opcode] || 'abs');
                if (this.mFlag) { this.a = (this.a & 0xFF00) | ((this.a | this.readByte(addr)) & 0xFF); this.setNZ8(this.a & 0xFF); }
                else { this.a |= this.readWord(addr); this.setNZ16(this.a); }
                break;
            }

            // EOR
            case 0x49: { let addr = this.readAddr('imm'); if (this.mFlag) { this.a = (this.a & 0xFF00) | (((this.a & 0xFF) ^ this.readByte(addr)) & 0xFF); this.setNZ8(this.a & 0xFF); } else { this.a ^= this.readWord(addr); this.setNZ16(this.a); } break; }
            case 0x45: case 0x55: case 0x4D: case 0x5D: case 0x59: case 0x4F: case 0x5F: {
                let modes = [,'dp','dpX','abs','absX','absY','long','longX'];
                let addr = this.readAddr(modes[opcode] || 'abs');
                if (this.mFlag) { this.a = (this.a & 0xFF00) | (((this.a & 0xFF) ^ this.readByte(addr)) & 0xFF); this.setNZ8(this.a & 0xFF); }
                else { this.a ^= this.readWord(addr); this.setNZ16(this.a); }
                break;
            }

            // ASL
            case 0x0A: { if (this.mFlag) { this.c = !!(this.a & 0x80); this.a = (this.a & 0xFF00) | ((this.a << 1) & 0xFF); this.setNZ8(this.a & 0xFF); } else { this.c = !!(this.a & 0x8000); this.a = (this.a << 1) & 0xFFFF; this.setNZ16(this.a); } break; }

            // LSR
            case 0x4A: { if (this.mFlag) { this.c = !!(this.a & 0x01); this.a = (this.a & 0xFF00) | ((this.a >> 1) & 0xFF); this.setNZ8(this.a & 0xFF); } else { this.c = !!(this.a & 0x0001); this.a >>= 1; this.setNZ16(this.a); } break; }

            // ROL
            case 0x2A: { if (this.mFlag) { let c = this.c ? 1 : 0; this.c = !!(this.a & 0x80); this.a = (this.a & 0xFF00) | (((this.a << 1) | c) & 0xFF); this.setNZ8(this.a & 0xFF); } else { let c = this.c ? 1 : 0; this.c = !!(this.a & 0x8000); this.a = ((this.a << 1) | c) & 0xFFFF; this.setNZ16(this.a); } break; }

            // ROR
            case 0x6A: { if (this.mFlag) { let c = this.c ? 0x80 : 0; this.c = !!(this.a & 0x01); this.a = (this.a & 0xFF00) | ((this.a >> 1) | c); this.setNZ8(this.a & 0xFF); } else { let c = this.c ? 0x8000 : 0; this.c = !!(this.a & 0x0001); this.a = (this.a >> 1) | c; this.setNZ16(this.a); } break; }

            // BIT
            case 0x89: { let addr = this.readAddr('imm'); BIT(this.mFlag ? this.readByte(addr) : this.readWord(addr)); break; }
            case 0x24: case 0x34: case 0x2C: case 0x3C: {
                let modes = [,'dp','dpX','abs','absX'];
                let addr = this.readAddr(modes[opcode] || 'abs');
                BIT(this.mFlag ? this.readByte(addr) : this.readWord(addr));
                break;
            }

            // Branches
            case 0x80: { let off = this.fetch(); if (off & 0x80) off -= 0x100; this.pc = (this.pc + off) & 0xFFFF; this.cycles += 2; break; } // BRA
            case 0x82: { let off = this.fetchWord(); if (off & 0x8000) off -= 0x10000; this.pc = (this.pc + off) & 0xFFFF; this.cycles += 2; break; } // BRL
            case 0xF0: BRA(this.z); break; // BEQ
            case 0xD0: BRA(!this.z); break; // BNE
            case 0x10: BRA(!this.n); break; // BPL
            case 0x30: BRA(!!this.n); break; // BMI
            case 0xB0: BRA(!!this.c); break; // BCS
            case 0x90: BRA(!this.c); break; // BCC
            case 0x50: BRA(!this.v); break; // BVC
            case 0x70: BRA(!!this.v); break; // BVS

            // JMP
            case 0x4C: { let addr = this.readWord((this.pb << 16) | this.pc); this.pc = (this.pc + 2) & 0xFFFF; this.pc = addr; break; }
            case 0x5C: { let addr = this.readLong((this.pb << 16) | this.pc); this.pc = (this.pc + 3) & 0xFFFF; this.pb = (addr >> 16) & 0xFF; this.pc = addr & 0xFFFF; break; }
            case 0x6C: { let zp = this.readWord((this.pb << 16) | this.pc); this.pc = (this.pc + 2) & 0xFFFF; this.pc = this.readWord((this.pb << 16) | zp); break; }
            case 0x7C: { let zp = this.readWord((this.pb << 16) | this.pc); this.pc = (this.pc + 2) & 0xFFFF; this.pc = (this.readWord((this.pb << 16) | zp) + this.x) & 0xFFFF; break; }

            // JSR/JSRL/JSL
            case 0x20: { let addr = this.readWord((this.pb << 16) | this.pc); this.pc = (this.pc + 2) & 0xFFFF; this.pushWord((this.pc - 1) & 0xFFFF); this.pc = addr; break; }
            case 0xFC: { let addr = this.readWord((this.pb << 16) | this.pc); this.pc = (this.pc + 2) & 0xFFFF; this.pushWord((this.pc - 1) & 0xFFFF); this.pc = (addr + this.x) & 0xFFFF; break; }
            case 0x22: { let addr = this.readLong((this.pb << 16) | this.pc); this.pc = (this.pc + 3) & 0xFFFF; this.pushByte(this.pb); this.pushWord((this.pc - 1) & 0xFFFF); this.pb = (addr >> 16) & 0xFF; this.pc = addr & 0xFFFF; break; }

            // RTS/RTL
            case 0x60: { this.pc = (this.pullWord() + 1) & 0xFFFF; break; }
            case 0x6B: { this.pc = (this.pullWord() + 1) & 0xFFFF; this.pb = this.pullByte(); break; }

            // RTI
            case 0x40: {
                let p = this.pullByte();
                this.c = !!(p & 0x01); this.z = !!(p & 0x02); this.iFlag = !!(p & 0x04);
                this.dFlag = !!(p & 0x08); this.xFlag = !!(p & 0x10); this.mFlag = !!(p & 0x20);
                this.v = !!(p & 0x40); this.n = !!(p & 0x80);
                this.pc = this.pullWord();
                if (!this.emulationMode) this.pb = this.pullByte();
                break;
            }

            // PHA/PHX/PHY/PHB/PHD/PHK
            case 0x48: { if (this.mFlag) this.pushByte(this.a & 0xFF); else this.pushWord(this.a); break; }
            case 0xDA: { if (this.xFlag) this.pushByte(this.x & 0xFF); else this.pushWord(this.x); break; }
            case 0x5A: { if (this.xFlag) this.pushByte(this.y & 0xFF); else this.pushWord(this.y); break; }
            case 0x8B: this.pushByte(this.db); break;
            case 0x0B: this.pushWord(this.d); break;
            case 0x08: this.pushByte(this.pb); break;

            // PLA/PLX/PLY/PLB/PLD
            case 0x68: { if (this.mFlag) { this.a = (this.a & 0xFF00) | this.pullByte(); this.setNZ8(this.a & 0xFF); } else { this.a = this.pullWord(); this.setNZ16(this.a); } break; }
            case 0xFA: { if (this.xFlag) { this.x = this.pullByte(); this.setNZ8(this.x); } else { this.x = this.pullWord(); this.setNZ16(this.x); } break; }
            case 0x7A: { if (this.xFlag) { this.y = this.pullByte(); this.setNZ8(this.y); } else { this.y = this.pullWord(); this.setNZ16(this.y); } break; }
            case 0xAB: this.db = this.pullByte(); break;
            case 0x2B: this.d = this.pullWord(); break;

            // SEI/CLI/SEC/CLC/SED/CLD/CLV
            case 0x78: this.iFlag = true; break;
            case 0x58: this.iFlag = false; break;
            case 0x38: this.c = true; break;
            case 0x18: this.c = false; break;
            case 0xF8: this.dFlag = true; break;
            case 0xD8: this.dFlag = false; break;
            case 0xB8: this.v = false; break;

            // REP/SEP
            case 0xC2: { let val = this.fetch(); if (val & 0x01) this.c = false; if (val & 0x02) this.z = false; if (val & 0x04) this.iFlag = false; if (val & 0x08) this.dFlag = false; if (val & 0x10) this.xFlag = false; if (val & 0x20) this.mFlag = false; if (val & 0x40) this.v = false; if (val & 0x80) this.n = false; break; }
            case 0xE2: { let val = this.fetch(); if (val & 0x01) this.c = true; if (val & 0x02) this.z = true; if (val & 0x04) this.iFlag = true; if (val & 0x08) this.dFlag = true; if (val & 0x10) this.xFlag = true; if (val & 0x20) this.mFlag = true; if (val & 0x40) this.v = true; if (val & 0x80) this.n = true; break; }

            // XBA
            case 0xEB: { let lo = this.a & 0xFF; let hi = (this.a >> 8) & 0xFF; this.a = (lo << 8) | hi; this.setNZ8(this.a & 0xFF); break; }

            // MVN/MVP
            case 0x54: MVN(); break;
            case 0x44: MVP(); break;

            // TRB/TSB
            case 0x14: case 0x1C: {
                let addr = this.readAddr(opcode === 0x14 ? 'dp' : 'abs');
                if (this.mFlag) { let m = this.readByte(addr); this.z = !(this.a & 0xFF & m); this.writeByte(addr, m & ~(this.a & 0xFF)); }
                else { let m = this.readWord(addr); this.z = !(this.a & m); this.writeByte(addr, (m & ~this.a) & 0xFF); this.writeByte(addr + 1, ((m & ~this.a) >> 8) & 0xFF); }
                break;
            }
            case 0x04: case 0x0C: {
                let addr = this.readAddr(opcode === 0x04 ? 'dp' : 'abs');
                if (this.mFlag) { let m = this.readByte(addr); this.z = !(this.a & 0xFF & m); this.writeByte(addr, m | (this.a & 0xFF)); }
                else { let m = this.readWord(addr); this.z = !(this.a & m); this.writeByte(addr, (m | this.a) & 0xFF); this.writeByte(addr + 1, ((m | this.a) >> 8) & 0xFF); }
                break;
            }

            // WAI
            case 0xCB: break;

            // BRK
            case 0x00: {
                this.fetch();
                if (this.emulationMode) { this.pushByte(this.pc >> 8); this.pushByte(this.pc & 0xFF); this.pushByte(0x34); }
                else { this.pushByte(this.pb); this.pushWord(this.pc); let p = (this.n?0x80:0)|(this.v?0x40:0)|(this.mFlag?0x20:0)|(this.xFlag?0x10:0)|(this.dFlag?0x08:0)|(this.iFlag?0x04:0)|(this.z?0x02:0)|(this.c?0x01:0); this.pushByte(p); }
                this.pc = this.readWord(0xFFE6); this.pb = 0; this.iFlag = true; this.dFlag = false;
                break;
            }

            // COP
            case 0x02: {
                this.fetch();
                if (this.emulationMode) { this.pushByte(this.pc >> 8); this.pushByte(this.pc & 0xFF); this.pushByte(0x34); }
                else { this.pushByte(this.pb); this.pushWord(this.pc); let p = (this.n?0x80:0)|(this.v?0x40:0)|(this.mFlag?0x20:0)|(this.xFlag?0x10:0)|(this.dFlag?0x08:0)|(this.iFlag?0x04:0)|(this.z?0x02:0)|(this.c?0x01:0); this.pushByte(p); }
                this.pc = this.readWord(0xFFF4); this.pb = 0; this.iFlag = true; this.dFlag = false;
                break;
            }

            // STP / WDM / MVP / MVN handled above
            case 0xDB: case 0x42: break;

            default:
                // Unimplemented - treat as NOP
                break;
        }

        this.cycles += 6; // approximate
    }
}

class SNESPPU {
    constructor(snes) {
        this.snes = snes;
        this.pixels = new Uint32Array(SNES_WIDTH * SNES_HEIGHT);
        this.vram = new Uint8Array(0x10000);
        this.oam = new Uint8Array(0x220);
        this.palette = new Uint16Array(256);
        this.inidisp = 0x80;
        this.bgmode = 0;
        this.tm = 0; this.ts = 0;
        this.nmiEnabled = false;
        this.scanline = 0; this.dot = 0;
        this.vramInc = 1; this.vramAddr = 0;
        this.cgAddr = 0; this.cgFlip = false;
        this.multiplicationResult = 0;
        this.hTimer = 0; this.vTimer = 0;
    }

    reset() {
        this.pixels.fill(0xFF000000);
        this.vram.fill(0);
        this.oam.fill(0);
        this.palette.fill(0);
        this.inidisp = 0x80;
        this.scanline = 0; this.dot = 0;
        this.nmiEnabled = false;
    }

    readRegister(addr) {
        switch (addr) {
            case 0x2134: // MPYL/MPLYH
                return this.multiplicationResult & 0xFF;
            case 0x2135: return (this.multiplicationResult >> 8) & 0xFF;
            case 0x2137: return 0; // SLHV
            case 0x213B: { let r = this.cgFlip ? 0x80 : 0; this.cgFlip = !this.cgFlip; return r; }
            case 0x213C: return this.dot & 0xFF;
            case 0x213D: return this.scanline & 0xFF;
            case 0x4210: { let r = (this.scanline >= 225 ? 0x80 : 0) | (this.nmiEnabled ? 0x00 : 0x00); this.scanline >= 225 && (this.nmiEnabled = false); return r | 0x01; }
            case 0x4211: return 0;
            case 0x4212: { let v = 0; if (this.scanline >= 225) v |= 0x80; if (this.dot >= 6 && this.dot <= 274) v |= 0x40; return v; }
            default: return 0;
        }
    }

    writeRegister(addr, val) {
        switch (addr) {
            case 0x2100: this.inidisp = val; break;
            case 0x2105: this.bgmode = val; break;
            case 0x2107: break; // BG1SC
            case 0x2115: this.vramInc = (val & 0x80) ? 32 : 1; break;
            case 0x2116: this.vramAddr = (this.vramAddr & 0xFF00) | val; break;
            case 0x2117: this.vramAddr = (this.vramAddr & 0x00FF) | (val << 8); break;
            case 0x2118: { this.vram[this.vramAddr * 2] = val; this.vramAddr += this.vramInc; break; }
            case 0x2119: { this.vram[this.vramAddr * 2 + 1] = val; this.vramAddr += this.vramInc; break; }
            case 0x212C: this.tm = val; break;
            case 0x212D: this.ts = val; break;
            case 0x4200: this.nmiEnabled = !!(val & 0x80); break;
            case 0x2121: this.cgAddr = val; this.cgFlip = false; break;
            case 0x2122: {
                if (!this.cgFlip) { this.cgLatch = val; this.cgFlip = true; }
                else { this.cgPaletteWrite((this.cgAddr >> 1) & 0xFF, this.cgLatch | (val << 8)); this.cgAddr++; this.cgFlip = false; }
                break;
            }
        }
    }

    cgPaletteWrite(index, val) { this.palette[index] = val; }

    renderScanline() {
        let line = this.scanline;
        if (line >= SNES_HEIGHT) return;

        let bgmode = this.bgmode & 7;
        let forceBlank = !!(this.inidisp & 0x80);
        let brightness = this.inidisp & 0x0F;
        if (forceBlank) {
            for (let x = 0; x < SNES_WIDTH; x++) this.pixels[line * SNES_WIDTH + x] = 0xFF000000;
            return;
        }

        for (let x = 0; x < SNES_WIDTH; x++) {
            let bgColor = 0;
            let bgColorIdx = 0;
            let priority = 0;

            // BG Mode 0: 4 BGs, all 4bpp
            if (bgmode === 0 || bgmode === 1) {
                // Simple BG1 rendering
                if (this.tm & 0x01) {
                    let scrollX = 0, scrollY = 0;
                    let tilemapBase = ((this.bgmode >> 0) & 0) * 0x1000;
                    let chrBase = 0;
                    let tx = ((x + scrollX) >> 3) & 31;
                    let ty = ((line + scrollY) >> 3) & 31;
                    let fineX = (x + scrollX) & 7;
                    let fineY = (line + scrollY) & 7;

                    let tmAddr = tilemapBase + ty * 32 + tx;
                    let tileData = this.vram[tmAddr * 2] | (this.vram[tmAddr * 2 + 1] << 8);
                    let tileNum = tileData & 0x0FF;
                    let tilePal = (tileData >> 10) & 7;
                    let tilePri = (tileData >> 13) & 1;
                    let tileFlipH = !!(tileData & 0x4000);
                    let tileFlipV = !!(tileData & 0x8000);

                    let fx = tileFlipH ? (7 - fineX) : fineX;
                    let fy = tileFlipV ? (7 - fineY) : fineY;

                    let chrAddr = chrBase + tileNum * 16 + fy;
                    let lo = this.vram[chrAddr * 2] | (this.vram[chrAddr * 2 + 1] << 8);
                    let hi = (this.vram[(chrAddr + 8) * 2] | (this.vram[(chrAddr + 8) * 2 + 1] << 8));
                    let bit = 7 - fx;
                    let palIdx = ((lo >> bit) & 1) | (((hi >> bit) & 1) << 1);
                    if (palIdx > 0) {
                        let color = this.palette[tilePal * 4 + palIdx];
                        bgColorIdx = tilePal * 4 + palIdx;
                        bgColor = this.snesColorToRGB(color);
                        priority = tilePri;
                    }
                }

                // BG2
                if (bgmode >= 1 && (this.tm & 0x02)) {
                    // simplified second layer
                }
            }

            // Sprites (simplified)
            if (this.tm & 0x10) {
                // sprite rendering placeholder
            }

            // Apply brightness
            let r = (bgColor >> 16) & 0xFF;
            let g = (bgColor >> 8) & 0xFF;
            let b = bgColor & 0xFF;
            let mul = brightness + 1;
            r = Math.min(255, r * mul >> 4);
            g = Math.min(255, g * mul >> 4);
            b = Math.min(255, b * mul >> 4);

            this.pixels[line * SNES_WIDTH + x] = 0xFF000000 | (r << 16) | (g << 8) | b;
        }
    }

    snesColorToRGB(c) {
        let r = (c & 0x1F) << 3;
        let g = ((c >> 5) & 0x1F) << 3;
        let b = ((c >> 10) & 0x1F) << 3;
        return (r << 16) | (g << 8) | b;
    }

    step() {
        this.dot++;
        let renderFrame = false;
        if (this.dot >= 360) {
            this.dot = 0;
            this.scanline++;
            if (this.scanline < SNES_HEIGHT) {
                this.renderScanline();
            } else if (this.scanline === SNES_HEIGHT) {
                renderFrame = true;
            } else if (this.scanline >= 262) {
                this.scanline = -1;
            }
        }
        return renderFrame;
    }
}

class SNESAPU {
    constructor() { this.registers = new Uint8Array(0x200); }
    reset() { this.registers.fill(0); }
    readRegister(addr) { return this.registers[addr & 0x1FF]; }
    writeRegister(addr, val) { this.registers[addr & 0x1FF] = val; }
    step() {}
    getSample() { return 0; }
}

class SNES {
    constructor() {
        this.cpu = new SNESCPU(this);
        this.ppu = new SNESPPU(this);
        this.apu = new SNESAPU();
        this.mapper = null;
        this.running = false;
    }

    snesCpuRead(addr) {
        addr &= 0xFFFFFF;
        if (addr < 0x2000) return this.wram[addr & 0x1FFF];
        if (addr >= 0x2100 && addr < 0x2200) return this.ppu.readRegister(addr);
        if (addr >= 0x4000 && addr < 0x4200) return this.cpuIO[addr & 0x3FF] || 0;
        if (addr >= 0x4200 && addr < 0x4400) return this.cpuIO[addr & 0x3FF] || 0;
        if (addr >= 0x8000 && this.mapper) return this.mapper.cpuRead(addr);
        return 0;
    }

    snesCpuWrite(addr, val) {
        addr &= 0xFFFFFF;
        if (addr < 0x2000) { this.wram[addr & 0x1FFF] = val; return; }
        if (addr >= 0x2100 && addr < 0x2200) { this.ppu.writeRegister(addr, val); return; }
        if (addr >= 0x4000 && addr < 0x4400) { this.cpuIO[addr & 0x3FF] = val; return; }
        if (addr >= 0x8000 && this.mapper) { this.mapper.cpuWrite(addr, val); return; }
    }

    loadROM(data) {
        // Find SMC header if present
        let offset = (data.length % 1024 === 512) ? 512 : 0;
        let rom = data.slice(offset);

        // Determine LoROM vs HiROM
        let headerAddr = 0x7FC0;
        let checksum = rom[headerAddr + 0x2C] | (rom[headerAddr + 0x2D] << 8);

        // Check for valid header
        let validHi = true, validLo = true;
        for (let i = 0; i < 21; i++) {
            if (rom[0x7FC0 + i] === 0 && rom[0xFFC0 + i] === 0) {}
        }

        let isHiROM = ((rom[0x7FD5] & 0x20) !== 0);
        let romBanks = rom.length;

        this.mapper = {
            rom: rom,
            isHiROM: isHiROM,
            cpuRead(addr) {
                addr &= 0xFFFFFF;
                if (isHiROM) {
                    let bank = (addr >> 16) & 0xFF;
                    let a = addr & 0xFFFF;
                    if (a >= 0x8000) {
                        let offset = (bank & 0x7F) * 0x10000 + (a - 0x8000);
                        return rom[offset % rom.length];
                    }
                } else {
                    let bank = (addr >> 16) & 0xFF;
                    let a = addr & 0xFFFF;
                    if (a >= 0x8000) {
                        let offset = ((bank & 0x7F) * 0x8000) + (a - 0x8000);
                        return rom[offset % rom.length];
                    }
                }
                return 0;
            },
            cpuWrite(addr, val) {}
        };

        this.wram = new Uint8Array(0x20000);
        this.cpuIO = new Uint8Array(0x400);
        this.reset();
    }

    reset() {
        this.cpu.reset();
        this.ppu.reset();
        this.cpu.pc = this.snesCpuRead(0xFFFC) | (this.snesCpuRead(0xFFFD) << 8);
        this.cpu.pb = 0;
    }

    frame() {
        let frameComplete = false;
        let maxCycles = 1000000;
        let totalCycles = 0;
        while (!frameComplete && totalCycles < maxCycles) {
            this.cpu.step();
            totalCycles += 6;
            let cpuCycles = 6;
            for (let i = 0; i < cpuCycles * 4; i++) {
                if (this.ppu.step()) frameComplete = true;
            }
        }
    }
}
