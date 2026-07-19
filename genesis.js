/**
 * Sega Genesis / Mega Drive Emulator Core
 * Complete 68000 CPU, VDP, and system emulation
 */

class Genesis68K {
    constructor(genesis) {
        this.genesis = genesis;
        this.d = new Int32Array(8);
        this.a = new Int32Array(8);
        this.pc = 0;
        this.sr = 0x2700;
        this.stopped = false;
        this.interruptLevel = 0;
        this.cycleCount = 0;
    }

    reset() {
        this.d.fill(0);
        this.a.fill(0);
        this.sr = 0x2700;
        this.pc = this.readLong(0);
        this.stopped = false;
        this.cycleCount = 0;
    }

    get flagX() { return (this.sr >> 4) & 1; }
    get flagN() { return (this.sr >> 3) & 1; }
    get flagZ() { return (this.sr >> 2) & 1; }
    get flagV() { return (this.sr >> 1) & 1; }
    get flagC() { return this.sr & 1; }

    set flagX(v) { this.sr = (this.sr & ~(1 << 4)) | ((v & 1) << 4); }
    set flagN(v) { this.sr = (this.sr & ~(1 << 3)) | ((v & 1) << 3); }
    set flagZ(v) { this.sr = (this.sr & ~(1 << 2)) | ((v & 1) << 2); }
    set flagV(v) { this.sr = (this.sr & ~(1 << 1)) | ((v & 1) << 1); }
    set flagC(v) { this.sr = (this.sr & ~1) | (v & 1); }

    getFlag(f) {
        switch (f) {
            case 0: return this.flagC;
            case 1: return this.flagV;
            case 2: return this.flagZ;
            case 3: return this.flagN;
            case 4: return this.flagX;
        }
        return 0;
    }

    setFlag(f, v) {
        switch (f) {
            case 0: this.flagC = v; break;
            case 1: this.flagV = v; break;
            case 2: this.flagZ = v; break;
            case 3: this.flagN = v; break;
            case 4: this.flagX = v; break;
        }
    }

    maskOut(x, bits) {
        switch (bits) {
            case 1: return x & 0xFF;
            case 2: return x & 0xFFFF;
            case 4: return x | 0;
        }
        return x;
    }

    signExtend(v, bits) {
        if (bits === 1) {
            if (v & 0x80) return v | 0xFFFFFF00;
            return v & 0xFF;
        }
        if (bits === 2) {
            if (v & 0x8000) return v | 0xFFFF0000;
            return v & 0xFFFF;
        }
        return v | 0;
    }

    readByte(addr) {
        return this.genesis.memReadByte(addr & 0xFFFFFF);
    }

    readWord(addr) {
        return this.genesis.memReadWord(addr & 0xFFFFFF);
    }

    readLong(addr) {
        return this.genesis.memReadLong(addr & 0xFFFFFF);
    }

    writeByte(addr, v) {
        this.genesis.memWriteByte(addr & 0xFFFFFF, v & 0xFF);
    }

    writeWord(addr, v) {
        this.genesis.memWriteWord(addr & 0xFFFFFF, v & 0xFFFF);
    }

    writeLong(addr, v) {
        this.genesis.memWriteLong(addr & 0xFFFFFF, v | 0);
    }

    fetchWord() {
        const v = this.readWord(this.pc);
        this.pc = (this.pc + 2) | 0;
        return v;
    }

    fetchLong() {
        const v = this.readLong(this.pc);
        this.pc = (this.pc + 4) | 0;
        return v;
    }

    pushLong(v) {
        this.a[7] = (this.a[7] - 4) | 0;
        this.writeLong(this.a[7], v);
    }

    popLong() {
        const v = this.readLong(this.a[7]);
        this.a[7] = (this.a[7] + 4) | 0;
        return v;
    }

    getEA(mode, reg, size) {
        switch (mode) {
            case 0: return { addr: -1, reg: reg, isReg: true };
            case 1: return { addr: -1, reg: reg, isReg: true, isAddr: true };
            case 2: return { addr: this.a[reg], isMem: true };
            case 3: {
                const addr = this.a[reg];
                this.a[reg] = (this.a[reg] + (size === 4 ? 4 : 2)) | 0;
                if (reg === 7 && size === 1) this.a[7] = (this.a[7] + 1) & ~1;
                return { addr, isMem: true };
            }
            case 4: {
                const s = size === 4 ? 4 : 2;
                this.a[reg] = (this.a[reg] - s) | 0;
                if (reg === 7 && size === 1) this.a[7] = (this.a[7] - 1) & ~1;
                return { addr: this.a[reg], isMem: true };
            }
            case 5: {
                const d = this.fetchWord();
                return { addr: (this.a[reg] + this.signExtend(d, 2)) | 0, isMem: true };
            }
            case 6: {
                const ext = this.fetchWord();
                const xn = (ext >> 12) & 7;
                const isA = (ext >> 15) & 1;
                const isLong = (ext >> 11) & 1;
                const idx = isLong ? (isA ? this.a[xn] : this.d[xn]) : this.signExtend(isA ? this.a[xn] : this.d[xn], 2);
                const disp = this.signExtend(ext, 1);
                return { addr: (this.a[reg] + idx + disp) | 0, isMem: true };
            }
            case 7:
                switch (reg) {
                    case 0: {
                        const a = this.fetchWord();
                        return { addr: this.signExtend(a, 2), isMem: true };
                    }
                    case 1: {
                        const a = this.fetchLong();
                        return { addr: a, isMem: true };
                    }
                    case 2: {
                        const d = this.fetchWord();
                        const addr = (this.pc + this.signExtend(d, 2)) | 0;
                        return { addr, isMem: true };
                    }
                    case 3: {
                        const ext = this.fetchWord();
                        const xn = (ext >> 12) & 7;
                        const isA = (ext >> 15) & 1;
                        const isLong = (ext >> 11) & 1;
                        const idx = isLong ? (isA ? this.a[xn] : this.d[xn]) : this.signExtend(isA ? this.a[xn] : this.d[xn], 2);
                        const disp = this.signExtend(ext, 1);
                        return { addr: (this.pc + idx + disp) | 0, isMem: true };
                    }
                    case 4: {
                        const a = this.fetchLong();
                        return { addr: a, isMem: true };
                    }
                }
                break;
        }
        return { addr: 0, isMem: false };
    }

    readEA(ea, size) {
        if (ea.isReg) {
            if (ea.isAddr) return this.maskOut(this.a[ea.reg], size);
            return this.maskOut(this.d[ea.reg], size);
        }
        if (size === 4) return this.readLong(ea.addr);
        if (size === 2) return this.readWord(ea.addr);
        return this.readByte(ea.addr);
    }

    writeEA(ea, size, val) {
        val = this.maskOut(val, size);
        if (ea.isReg) {
            if (ea.isAddr) { this.a[ea.reg] = this.signExtend(val, size); return; }
            if (size === 4) this.d[ea.reg] = val | 0;
            else if (size === 2) this.d[ea.reg] = (this.d[ea.reg] & 0xFFFF0000) | (val & 0xFFFF);
            else this.d[ea.reg] = (this.d[ea.reg] & 0xFFFFFF00) | (val & 0xFF);
            return;
        }
        if (size === 4) this.writeLong(ea.addr, val);
        else if (size === 2) this.writeWord(ea.addr, val);
        else this.writeByte(ea.addr, val);
    }

    decodeSize(bits) {
        switch (bits) {
            case 1: return 1;
            case 3: return 2;
            case 2: return 4;
        }
        return 2;
    }

    readCCR() {
        return this.sr & 0xFF;
    }

    writeCCR(v) {
        this.sr = (this.sr & 0xFF00) | (v & 0xFF);
    }

    readSR() {
        return this.sr & 0xFFFF;
    }

    writeSR(v) {
        this.sr = v & 0xFFFF;
    }

    execute() {
        if (this.stopped) return 4;

        const opcode = this.fetchWord();
        const cycles = this.decodeAndExecute(opcode);
        this.cycleCount += cycles;
        return cycles;
    }

    decodeAndExecute(op) {
        const group = (op >> 12) & 0xF;
        const eaMode = (op >> 3) & 7;
        const eaReg = op & 7;

        if (op === 0x4E71) return 4;
        if (op === 0x4E73) { this.sr = this.readWord(this.a[7]); this.a[7] = (this.a[7] + 2) | 0; this.pc = this.popLong(); return 20; }
        if (op === 0x4E75) { this.pc = this.popLong(); return 16; }
        if (op === 0x4E76) return 4;
        if (op === 0x4E77) return 4;
        if (op === 0x4E70) return 4;
        if (op === 0x4E72) { const v = this.fetchWord(); this.stopped = true; return 4; }
        if (op === 0x4E74) return 4;
        if (op === 0x4E78) return 4;
        if (op === 0x4E7A) return 4;
        if (op === 0x4E7B) return 4;
        if (op === 0x4E7C) return 4;
        if (op === 0x4E7D) return 4;
        if (op === 0x4E7E) return 4;
        if (op === 0x4E7F) return 4;

        if ((op & 0xFFF0) === 0x4E40) {
            const vector = op & 0xF;
            this.pushLong(this.pc);
            this.pushWord(this.sr);
            this.pc = this.readLong(vector * 4);
            this.sr = (this.sr & 0xF8FF) | 0x2000;
            return 40;
        }

        if ((op & 0xFFC0) === 0x42C0) {
            const reg = op & 7;
            this.sr = (this.sr & 0xFF00) | (this.a[reg] & 0xFF);
            return 12;
        }
        if ((op & 0xFFC0) === 0x40C0) {
            const reg = op & 7;
            this.a[reg] = this.sr | 0;
            return 12;
        }
        if ((op & 0xFFF8) === 0x4880) {
            this.d[op & 7] = this.sr | 0;
            return 12;
        }
        if ((op & 0xFFC0) === 0x44C0) {
            const reg = op & 7;
            this.a[reg] = this.signExtend(this.sr, 2);
            return 12;
        }
        if (op === 0x40C0) { this.sr = this.sr | 0; return 12; }
        if (op === 0x42C0) { this.writeCCR(0); return 12; }
        if (op === 0x46C0) { this.writeCCR(~this.sr & 0xFF); return 12; }
        if (op === 0x44C0) { this.a[0] = this.signExtend(this.sr, 2); return 12; }

        if ((op & 0xFFF8) === 0x4E80) {
            const target = this.a[op & 7];
            this.pushLong(this.pc);
            this.pc = target;
            return 16;
        }
        if ((op & 0xFFF8) === 0x4EC0) {
            this.pc = this.a[op & 7];
            return 8;
        }

        if ((op & 0xFF00) === 0x6000) {
            const cond = (op >> 8) & 0xF;
            const offset = this.signExtend(op, 1);
            if (offset === 0) { const o2 = this.fetchWord(); return 10; }
            if (this.testCondition(cond)) {
                this.pc = (this.pc + (op === 0x6000 ? this.fetchWord() : offset) * 2 - 2) | 0;
                return 10;
            }
            return 8;
        }

        if ((op & 0xFF00) === 0x6100) {
            const offset = this.signExtend(op, 1);
            const target = offset === 0 ? (this.pc + this.signExtend(this.fetchWord(), 2)) : (this.pc + offset * 2 - 2);
            this.pushLong(this.pc);
            this.pc = target;
            return 18;
        }

        if ((op & 0xF000) === 0x0000) {
            const size = this.decodeSize((op >> 6) & 3);
            if (size === 1 && eaMode === 1) {
                return this.opMOVEA(op, 2);
            }
            if (size === 2 && eaMode === 1) {
                return this.opMOVEA(op, 4);
            }
            if (eaMode === 0 && ((op >> 6) & 7) === 7) {
                return this.opMOVEM(op);
            }
            return this.opORI(op);
        }
        if ((op & 0xF000) === 0x1000) { return this.opMOVE(op, 1); }
        if ((op & 0xF000) === 0x2000) { return this.opMOVE(op, 4); }
        if ((op & 0xF000) === 0x3000) { return this.opMOVE(op, 2); }

        if ((op & 0xF1C0) === 0x0100) { return this.opBTST_Dn(op); }
        if ((op & 0xFFC0) === 0x0800) { return this.opBTST_IMM(op); }
        if ((op & 0xF1C0) === 0x0140) { return this.opBCHG_Dn(op); }
        if ((op & 0xFFC0) === 0x0840) { return this.opBCHG_IMM(op); }
        if ((op & 0xF1C0) === 0x0180) { return this.opBCLR_Dn(op); }
        if ((op & 0xFFC0) === 0x0880) { return this.opBCLR_IMM(op); }
        if ((op & 0xF1C0) === 0x01C0) { return this.opBSET_Dn(op); }
        if ((op & 0xFFC0) === 0x08C0) { return this.opBSET_IMM(op); }

        if ((op & 0xF0F8) === 0x50C8) { return this.opDBcc(op); }

        if ((op & 0xF100) === 0x5000) { return this.opScc(op); }

        if ((op & 0xFF00) === 0x7000) {
            const data = op & 0xFF;
            const reg = (op >> 9) & 7;
            this.d[reg] = this.signExtend(data, 1);
            this.flagN = 0;
            this.flagZ = (data === 0) ? 1 : 0;
            this.flagV = 0;
            this.flagC = 0;
            return 4;
        }

        if ((op & 0xF1B8) === 0xD100) { return this.opADDX(op); }
        if ((op & 0xF1B8) === 0x9100) { return this.opSUBX(op); }

        if ((op & 0xD0C0) === 0xD000) { return this.opADD(op); }
        if ((op & 0xD0C0) === 0x9000) { return this.opSUB(op); }
        if ((op & 0xD0C0) === 0xB000) { return this.opCMP(op); }
        if ((op & 0xF000) === 0xC000) { return this.opAND(op); }
        if ((op & 0xF000) === 0x8000) { return this.opOR(op); }
        if ((op & 0xF000) === 0xE000) { return this.opEOR(op); }

        if ((op & 0xF100) === 0xC100) { return this.opEXG(op); }

        if ((op & 0xFFC0) === 0x4840) {
            const reg = op & 7;
            this.d[reg] = this.signExtend(this.d[reg] & 0xFFFF, 2);
            this.flagN = (this.d[reg] < 0) ? 1 : 0;
            this.flagZ = (this.d[reg] === 0) ? 1 : 0;
            this.flagV = 0;
            this.flagC = 0;
            return 4;
        }
        if ((op & 0xFFC0) === 0x4880) {
            const reg = op & 7;
            this.d[reg] = this.signExtend(this.d[reg] & 0xFF, 1);
            this.flagN = (this.d[reg] < 0) ? 1 : 0;
            this.flagZ = (this.d[reg] === 0) ? 1 : 0;
            this.flagV = 0;
            this.flagC = 0;
            return 4;
        }

        if ((op & 0xF0C0) === 0xE0C0) { return this.opASL(op); }
        if ((op & 0xF0C0) === 0xE080) { return this.opASR(op); }
        if ((op & 0xF0C0) === 0xE040) { return this.opLSL(op); }
        if ((op & 0xF0C0) === 0xE000) { return this.opLSR(op); }
        if ((op & 0xF0C0) === 0xE2C0) { return this.opROXL(op); }
        if ((op & 0xF0C0) === 0xE280) { return this.opROXR(op); }
        if ((op & 0xF0C0) === 0xE380) { return this.opROXL(op); }
        if ((op & 0xF0C0) === 0xE240) { return this.opROR(op); }
        if ((op & 0xF0C0) === 0xE040) { return this.opROL(op); }

        if ((op & 0xF0C0) === 0xE100) { return this.opLSL_EA(op); }
        if ((op & 0xF0C0) === 0xE000) { return this.opLSR_EA(op); }
        if ((op & 0xF0C0) === 0xE1C0) { return this.opASL_EA(op); }
        if ((op & 0xF0C0) === 0xE0C0) { return this.opASR_EA(op); }
        if ((op & 0xF0C0) === 0xE300) { return this.opROXL_EA(op); }
        if ((op & 0xF0C0) === 0xE200) { return this.opROXR_EA(op); }

        if ((op & 0xFF00) === 0x4A00) { return this.opTST(op); }

        if ((op & 0xF000) === 0xA000) { return this.opLineA(op); }
        if ((op & 0xF000) === 0xF000) { return this.opLineF(op); }

        return this.opILLEGAL(op);
    }

    testCondition(cond) {
        switch (cond) {
            case 0x0: return true;
            case 0x1: return false;
            case 0x2: return this.flagC === 0;
            case 0x3: return this.flagC === 1;
            case 0x4: return this.flagZ === 0;
            case 0x5: return this.flagZ === 1;
            case 0x6: return this.flagC === 0 && this.flagZ === 0;
            case 0x7: return this.flagC === 1 || this.flagZ === 1;
            case 0x8: return this.flagV === 0;
            case 0x9: return this.flagV === 1;
            case 0xA: return this.flagN === 0;
            case 0xB: return this.flagN === 1;
            case 0xC: return this.flagN === this.flagV;
            case 0xD: return this.flagN !== this.flagV;
            case 0xE: return (this.flagN !== this.flagV) && this.flagZ === 0;
            case 0xF: return (this.flagN === this.flagV) || this.flagZ === 1;
        }
        return false;
    }

    opMOVE(op, size) {
        const dstMode = (op >> 9) & 7;
        const dstReg = (op >> 9) & 7;
        const srcMode = (op >> 3) & 7;
        const srcReg = op & 7;

        const src = this.getEA(srcMode, srcReg, size);
        const val = this.readEA(src, size);

        if (dstMode === 1 && srcMode === 1) {
            if (size === 4) {
                this.a[dstReg] = val | 0;
            } else {
                this.a[dstReg] = this.signExtend(val, size);
            }
            this.flagN = (val < 0) ? 1 : 0;
            this.flagZ = (val === 0) ? 1 : 0;
            this.flagV = 0;
            this.flagC = 0;
            return 4 + (srcMode === 0 ? 0 : 4) + 4;
        }

        const dst = this.getEA(dstMode, dstReg, size);
        this.writeEA(dst, size, val);
        this.flagN = (this.signExtend(val, size) < 0) ? 1 : 0;
        this.flagZ = (val === 0) ? 1 : 0;
        this.flagV = 0;
        this.flagC = 0;

        let cycles = 4;
        if (src.isMem) cycles += 4;
        if (dst.isMem) cycles += 4;
        if (size === 4 && (src.isMem || dst.isMem)) cycles += 2;
        return cycles;
    }

    opMOVEA(op, size) {
        const dstReg = (op >> 9) & 7;
        const srcMode = (op >> 3) & 7;
        const srcReg = op & 7;
        const src = this.getEA(srcMode, srcReg, size);
        const val = this.readEA(src, size);
        this.a[dstReg] = this.signExtend(val, size);
        return 4 + (src.isMem ? 4 : 0);
    }

    opMOVEM(op) {
        const isStore = (op >> 10) & 1;
        const size = (op >> 6) & 1 ? 4 : 2;
        const eaMode = (op >> 3) & 7;
        const eaReg = op & 7;
        const mask = this.fetchWord();
        const ea = this.getEA(eaMode, eaReg, size);

        if (isStore) {
            let addr = ea.addr;
            for (let i = 0; i < 16; i++) {
                if (mask & (1 << i)) {
                    if (size === 4) {
                        this.writeLong(addr, i < 8 ? this.d[i] : this.a[i - 8]);
                    } else {
                        this.writeWord(addr, i < 8 ? (this.d[i] & 0xFFFF) : (this.a[i - 8] & 0xFFFF));
                    }
                    addr = (addr + size) | 0;
                }
            }
        } else {
            let addr = ea.addr;
            for (let i = 0; i < 16; i++) {
                if (mask & (1 << i)) {
                    if (size === 4) {
                        if (i < 8) this.d[i] = this.readLong(addr) | 0;
                        else this.a[i - 8] = this.readLong(addr) | 0;
                    } else {
                        const v = this.readWord(addr);
                        if (i < 8) this.d[i] = this.signExtend(v, 2);
                        else this.a[i - 8] = this.signExtend(v, 2);
                    }
                    addr = (addr + size) | 0;
                }
            }
        }
        return 16 + 8 * (this.popCount(mask));
    }

    popCount(x) {
        x = x - ((x >> 1) & 0x5555);
        x = (x & 0x3333) + ((x >> 2) & 0x3333);
        return (((x + (x >> 4)) & 0x0F0F) * 0x0101) >> 8;
    }

    opORI(op) {
        const size = this.decodeSize((op >> 6) & 3);
        const dstReg = op & 7;
        let data;
        if (size === 4) data = this.fetchLong();
        else if (size === 2) data = this.fetchWord();
        else data = this.fetchByte();

        const ea = this.getEA((op >> 3) & 7, dstReg, size);
        const dst = this.readEA(ea, size);
        const result = (dst | data) & this.maskOut(-1, size);
        this.writeEA(ea, size, result);
        this.flagN = (this.signExtend(result, size) < 0) ? 1 : 0;
        this.flagZ = (result === 0) ? 1 : 0;
        this.flagV = 0;
        this.flagC = 0;
        return size === 4 ? 16 : 12;
    }

    opANDI(op) {
        const size = this.decodeSize((op >> 6) & 3);
        const dstReg = op & 7;
        let data;
        if (size === 4) data = this.fetchLong();
        else if (size === 2) data = this.fetchWord();
        else data = this.fetchByte();

        const ea = this.getEA((op >> 3) & 7, dstReg, size);
        const dst = this.readEA(ea, size);
        const result = (dst & data) & this.maskOut(-1, size);
        this.writeEA(ea, size, result);
        this.flagN = (this.signExtend(result, size) < 0) ? 1 : 0;
        this.flagZ = (result === 0) ? 1 : 0;
        this.flagV = 0;
        this.flagC = 0;
        return size === 4 ? 16 : 12;
    }

    opEORI(op) {
        const size = this.decodeSize((op >> 6) & 3);
        const dstReg = op & 7;
        let data;
        if (size === 4) data = this.fetchLong();
        else if (size === 2) data = this.fetchWord();
        else data = this.fetchByte();

        const ea = this.getEA((op >> 3) & 7, dstReg, size);
        const dst = this.readEA(ea, size);
        const result = (dst ^ data) & this.maskOut(-1, size);
        this.writeEA(ea, size, result);
        this.flagN = (this.signExtend(result, size) < 0) ? 1 : 0;
        this.flagZ = (result === 0) ? 1 : 0;
        this.flagV = 0;
        this.flagC = 0;
        return size === 4 ? 16 : 12;
    }

    opSUBI(op) {
        const size = this.decodeSize((op >> 6) & 3);
        const dstReg = op & 7;
        let data;
        if (size === 4) data = this.fetchLong();
        else if (size === 2) data = this.fetchWord();
        else data = this.fetchByte();

        const ea = this.getEA((op >> 3) & 7, dstReg, size);
        const dst = this.readEA(ea, size);
        const result = this.aluSub(dst, data, size, true);
        this.writeEA(ea, size, result);
        return size === 4 ? 16 : 12;
    }

    opADDI(op) {
        const size = this.decodeSize((op >> 6) & 3);
        const dstReg = op & 7;
        let data;
        if (size === 4) data = this.fetchLong();
        else if (size === 2) data = this.fetchWord();
        else data = this.fetchByte();

        const ea = this.getEA((op >> 3) & 7, dstReg, size);
        const dst = this.readEA(ea, size);
        const result = this.aluAdd(dst, data, size, true);
        this.writeEA(ea, size, result);
        return size === 4 ? 16 : 12;
    }

    opCMPI(op) {
        const size = this.decodeSize((op >> 6) & 3);
        const dstReg = op & 7;
        let data;
        if (size === 4) data = this.fetchLong();
        else if (size === 2) data = this.fetchWord();
        else data = this.fetchByte();

        const ea = this.getEA((op >> 3) & 7, dstReg, size);
        const dst = this.readEA(ea, size);
        this.aluSub(dst, data, size, false);
        return size === 4 ? 14 : 8;
    }

    opADD(op) {
        const size = this.decodeSize((op >> 6) & 3);
        const isDn = ((op >> 8) & 1) === 0;
        const dir = (op >> 8) & 1;
        const reg = (op >> 9) & 7;
        const eaMode = (op >> 3) & 7;
        const eaReg = op & 7;

        if (dir === 0) {
            const ea = this.getEA(eaMode, eaReg, size);
            const src = this.readEA(ea, size);
            const dst = this.maskOut(this.d[reg], size);
            const result = this.aluAdd(dst, src, size, true);
            this.writeEA({ isReg: true, reg, isAddr: false }, size, result);
            return ea.isMem ? 8 : 4;
        } else {
            const ea = this.getEA(eaMode, eaReg, size);
            const src = this.maskOut(this.d[reg], size);
            const dst = this.readEA(ea, size);
            const result = this.aluAdd(dst, src, size, true);
            this.writeEA(ea, size, result);
            return ea.isMem ? 8 : 4;
        }
    }

    opSUB(op) {
        const size = this.decodeSize((op >> 6) & 3);
        const dir = (op >> 8) & 1;
        const reg = (op >> 9) & 7;
        const eaMode = (op >> 3) & 7;
        const eaReg = op & 7;

        if (dir === 0) {
            const ea = this.getEA(eaMode, eaReg, size);
            const src = this.readEA(ea, size);
            const dst = this.maskOut(this.d[reg], size);
            const result = this.aluSub(dst, src, size, true);
            this.writeEA({ isReg: true, reg, isAddr: false }, size, result);
            return ea.isMem ? 8 : 4;
        } else {
            const ea = this.getEA(eaMode, eaReg, size);
            const src = this.maskOut(this.d[reg], size);
            const dst = this.readEA(ea, size);
            const result = this.aluSub(dst, src, size, true);
            this.writeEA(ea, size, result);
            return ea.isMem ? 8 : 4;
        }
    }

    opCMP(op) {
        const size = this.decodeSize((op >> 6) & 3);
        const dir = (op >> 8) & 1;
        const reg = (op >> 9) & 7;
        const eaMode = (op >> 3) & 7;
        const eaReg = op & 7;

        const ea = this.getEA(eaMode, eaReg, size);
        const src = this.readEA(ea, size);

        if (dir === 0) {
            const dst = this.maskOut(this.d[reg], size);
            this.aluSub(dst, src, size, false);
        } else {
            const dst = this.readEA(ea, size);
            const srcVal = this.maskOut(this.d[reg], size);
            this.aluSub(dst, srcVal, size, false);
        }
        return ea.isMem ? 8 : 4;
    }

    opAND(op) {
        const size = this.decodeSize((op >> 6) & 3);
        const dir = (op >> 8) & 1;
        const reg = (op >> 9) & 7;
        const eaMode = (op >> 3) & 7;
        const eaReg = op & 7;

        if (dir === 0) {
            const ea = this.getEA(eaMode, eaReg, size);
            const src = this.readEA(ea, size);
            const result = (this.d[reg] & src) & this.maskOut(-1, size);
            this.writeEA({ isReg: true, reg, isAddr: false }, size, result);
            this.flagN = (this.signExtend(result, size) < 0) ? 1 : 0;
            this.flagZ = (result === 0) ? 1 : 0;
            this.flagV = 0;
            this.flagC = 0;
            return ea.isMem ? 8 : 4;
        } else {
            const ea = this.getEA(eaMode, eaReg, size);
            const src = this.maskOut(this.d[reg], size);
            const dst = this.readEA(ea, size);
            const result = (dst & src) & this.maskOut(-1, size);
            this.writeEA(ea, size, result);
            this.flagN = (this.signExtend(result, size) < 0) ? 1 : 0;
            this.flagZ = (result === 0) ? 1 : 0;
            this.flagV = 0;
            this.flagC = 0;
            return ea.isMem ? 8 : 4;
        }
    }

    opOR(op) {
        const size = this.decodeSize((op >> 6) & 3);
        const dir = (op >> 8) & 1;
        const reg = (op >> 9) & 7;
        const eaMode = (op >> 3) & 7;
        const eaReg = op & 7;

        if (dir === 0) {
            const ea = this.getEA(eaMode, eaReg, size);
            const src = this.readEA(ea, size);
            const result = (this.d[reg] | src) & this.maskOut(-1, size);
            this.writeEA({ isReg: true, reg, isAddr: false }, size, result);
            this.flagN = (this.signExtend(result, size) < 0) ? 1 : 0;
            this.flagZ = (result === 0) ? 1 : 0;
            this.flagV = 0;
            this.flagC = 0;
            return ea.isMem ? 8 : 4;
        } else {
            const ea = this.getEA(eaMode, eaReg, size);
            const src = this.maskOut(this.d[reg], size);
            const dst = this.readEA(ea, size);
            const result = (dst | src) & this.maskOut(-1, size);
            this.writeEA(ea, size, result);
            this.flagN = (this.signExtend(result, size) < 0) ? 1 : 0;
            this.flagZ = (result === 0) ? 1 : 0;
            this.flagV = 0;
            this.flagC = 0;
            return ea.isMem ? 8 : 4;
        }
    }

    opEOR(op) {
        const size = this.decodeSize((op >> 6) & 3);
        const reg = (op >> 9) & 7;
        const eaMode = (op >> 3) & 7;
        const eaReg = op & 7;

        const ea = this.getEA(eaMode, eaReg, size);
        const src = this.readEA(ea, size);
        const result = (this.d[reg] ^ src) & this.maskOut(-1, size);
        this.writeEA(ea, size, result);
        this.flagN = (this.signExtend(result, size) < 0) ? 1 : 0;
        this.flagZ = (result === 0) ? 1 : 0;
        this.flagV = 0;
        this.flagC = 0;
        return ea.isMem ? 8 : 4;
    }

    opEXG(op) {
        const regX = (op >> 9) & 7;
        const regY = op & 7;
        const mode = (op >> 3) & 0x1F;

        if (mode === 8) {
            const tmp = this.d[regX];
            this.d[regX] = this.d[regY];
            this.d[regY] = tmp;
        } else if (mode === 9) {
            const tmp = this.a[regX];
            this.a[regX] = this.a[regY];
            this.a[regY] = tmp;
        } else if (mode === 17) {
            const tmp = this.d[regX];
            this.d[regX] = this.a[regY];
            this.a[regY] = tmp;
        }
        return 6;
    }

    opBTST_Dn(op) {
        const reg = (op >> 9) & 7;
        const bit = this.d[reg] & 31;
        const eaMode = (op >> 3) & 7;
        const eaReg = op & 7;

        if (eaMode === 0) {
            this.flagZ = (this.d[eaReg] & (1 << bit)) ? 0 : 1;
            return 6;
        } else {
            const ea = this.getEA(eaMode, eaReg, 1);
            const val = this.readByte(ea.addr);
            this.flagZ = (val & (1 << (bit & 7))) ? 0 : 1;
            return 4;
        }
    }

    opBTST_IMM(op) {
        const bit = this.fetchWord() & 31;
        const eaMode = (op >> 3) & 7;
        const eaReg = op & 7;

        if (eaMode === 0) {
            this.flagZ = (this.d[eaReg] & (1 << bit)) ? 0 : 1;
            return 8;
        } else {
            const ea = this.getEA(eaMode, eaReg, 1);
            const val = this.readByte(ea.addr);
            this.flagZ = (val & (1 << (bit & 7))) ? 0 : 1;
            return 8;
        }
    }

    opBCHG_Dn(op) {
        const reg = (op >> 9) & 7;
        const bit = this.d[reg] & 31;
        const eaMode = (op >> 3) & 7;
        const eaReg = op & 7;

        if (eaMode === 0) {
            this.flagZ = (this.d[eaReg] & (1 << bit)) ? 0 : 1;
            this.d[eaReg] ^= (1 << bit);
            return 8;
        } else {
            const ea = this.getEA(eaMode, eaReg, 1);
            const val = this.readByte(ea.addr);
            this.flagZ = (val & (1 << (bit & 7))) ? 0 : 1;
            this.writeByte(ea.addr, val ^ (1 << (bit & 7)));
            return 8;
        }
    }

    opBCHG_IMM(op) {
        const bit = this.fetchWord() & 31;
        const eaMode = (op >> 3) & 7;
        const eaReg = op & 7;

        if (eaMode === 0) {
            this.flagZ = (this.d[eaReg] & (1 << bit)) ? 0 : 1;
            this.d[eaReg] ^= (1 << bit);
            return 10;
        } else {
            const ea = this.getEA(eaMode, eaReg, 1);
            const val = this.readByte(ea.addr);
            this.flagZ = (val & (1 << (bit & 7))) ? 0 : 1;
            this.writeByte(ea.addr, val ^ (1 << (bit & 7)));
            return 10;
        }
    }

    opBCLR_Dn(op) {
        const reg = (op >> 9) & 7;
        const bit = this.d[reg] & 31;
        const eaMode = (op >> 3) & 7;
        const eaReg = op & 7;

        if (eaMode === 0) {
            this.flagZ = (this.d[eaReg] & (1 << bit)) ? 0 : 1;
            this.d[eaReg] &= ~(1 << bit);
            return 8;
        } else {
            const ea = this.getEA(eaMode, eaReg, 1);
            const val = this.readByte(ea.addr);
            this.flagZ = (val & (1 << (bit & 7))) ? 0 : 1;
            this.writeByte(ea.addr, val & ~(1 << (bit & 7)));
            return 8;
        }
    }

    opBCLR_IMM(op) {
        const bit = this.fetchWord() & 31;
        const eaMode = (op >> 3) & 7;
        const eaReg = op & 7;

        if (eaMode === 0) {
            this.flagZ = (this.d[eaReg] & (1 << bit)) ? 0 : 1;
            this.d[eaReg] &= ~(1 << bit);
            return 10;
        } else {
            const ea = this.getEA(eaMode, eaReg, 1);
            const val = this.readByte(ea.addr);
            this.flagZ = (val & (1 << (bit & 7))) ? 0 : 1;
            this.writeByte(ea.addr, val & ~(1 << (bit & 7)));
            return 10;
        }
    }

    opBSET_Dn(op) {
        const reg = (op >> 9) & 7;
        const bit = this.d[reg] & 31;
        const eaMode = (op >> 3) & 7;
        const eaReg = op & 7;

        if (eaMode === 0) {
            this.flagZ = (this.d[eaReg] & (1 << bit)) ? 0 : 1;
            this.d[eaReg] |= (1 << bit);
            return 8;
        } else {
            const ea = this.getEA(eaMode, eaReg, 1);
            const val = this.readByte(ea.addr);
            this.flagZ = (val & (1 << (bit & 7))) ? 0 : 1;
            this.writeByte(ea.addr, val | (1 << (bit & 7)));
            return 8;
        }
    }

    opBSET_IMM(op) {
        const bit = this.fetchWord() & 31;
        const eaMode = (op >> 3) & 7;
        const eaReg = op & 7;

        if (eaMode === 0) {
            this.flagZ = (this.d[eaReg] & (1 << bit)) ? 0 : 1;
            this.d[eaReg] |= (1 << bit);
            return 12;
        } else {
            const ea = this.getEA(eaMode, eaReg, 1);
            const val = this.readByte(ea.addr);
            this.flagZ = (val & (1 << (bit & 7))) ? 0 : 1;
            this.writeByte(ea.addr, val | (1 << (bit & 7)));
            return 12;
        }
    }

    opDBcc(op) {
        const cond = (op >> 8) & 0xF;
        const reg = op & 7;
        const offset = this.fetchWord();

        if (!this.testCondition(cond)) {
            const counter = (this.d[reg] - 1) & 0xFFFF;
            this.d[reg] = (this.d[reg] & 0xFFFF0000) | counter;
            if (counter !== 0xFFFF) {
                this.pc = (this.pc + this.signExtend(offset, 2)) | 0;
                return 10;
            }
        }
        return 12;
    }

    opScc(op) {
        const cond = (op >> 8) & 0xF;
        const eaMode = (op >> 3) & 7;
        const eaReg = op & 7;

        const val = this.testCondition(cond) ? 0xFF : 0x00;

        if (eaMode === 0) {
            this.d[eaReg] = (this.d[eaReg] & 0xFFFFFF00) | val;
            return 6;
        } else {
            const ea = this.getEA(eaMode, eaReg, 1);
            this.writeByte(ea.addr, val);
            return 8;
        }
    }

    opADDX(op) {
        const size = this.decodeSize((op >> 6) & 3);
        const isDn = (op >> 3) & 1;
        const regX = (op >> 9) & 7;
        const regY = op & 7;

        const src = isDn ? this.maskOut(this.d[regX], size) : this.readByte(this.a[regY]);
        const dst = isDn ? this.maskOut(this.d[regY], size) : this.readByte(this.a[regY]);

        const result = this.aluAdd(dst, src, size, true);
        if (isDn) {
            this.writeEA({ isReg: true, reg: regY, isAddr: false }, size, result);
        } else {
            this.writeByte(this.a[regY], result & 0xFF);
        }
        return isDn ? 4 : 8;
    }

    opSUBX(op) {
        const size = this.decodeSize((op >> 6) & 3);
        const isDn = (op >> 3) & 1;
        const regX = (op >> 9) & 7;
        const regY = op & 7;

        const src = isDn ? this.maskOut(this.d[regX], size) : this.readByte(this.a[regY]);
        const dst = isDn ? this.maskOut(this.d[regY], size) : this.readByte(this.a[regY]);

        const result = this.aluSub(dst, src, size, true);
        if (isDn) {
            this.writeEA({ isReg: true, reg: regY, isAddr: false }, size, result);
        } else {
            this.writeByte(this.a[regY], result & 0xFF);
        }
        return isDn ? 4 : 8;
    }

    opTST(op) {
        const size = this.decodeSize((op >> 6) & 3);
        const eaMode = (op >> 3) & 7;
        const eaReg = op & 7;
        const ea = this.getEA(eaMode, eaReg, size);
        const val = this.readEA(ea, size);

        this.flagN = (this.signExtend(val, size) < 0) ? 1 : 0;
        this.flagZ = (val === 0) ? 1 : 0;
        this.flagV = 0;
        this.flagC = 0;
        return ea.isMem ? 8 : 4;
    }

    opASL(op) {
        const size = this.decodeSize((op >> 6) & 3);
        const shiftReg = (op >> 9) & 7;
        const reg = op & 7;
        const shift = this.d[shiftReg] & 63;
        if (shift === 0) { this.flagC = 0; return 6; }

        const val = this.maskOut(this.d[reg], size);
        let result = val << (shift - 1);
        this.flagC = (result < 0) ? 1 : 0;
        this.flagX = this.flagC;
        result = result << 1;
        result = this.maskOut(result, size);
        this.d[reg] = this.signExtend(result, size);
        this.flagN = (this.signExtend(result, size) < 0) ? 1 : 0;
        this.flagZ = (result === 0) ? 1 : 0;
        this.flagV = 0;
        return 6 + 2 * shift;
    }

    opASR(op) {
        const size = this.decodeSize((op >> 6) & 3);
        const shiftReg = (op >> 9) & 7;
        const reg = op & 7;
        const shift = this.d[shiftReg] & 63;
        if (shift === 0) { this.flagC = 0; return 6; }

        let val = this.signExtend(this.d[reg], size);
        let carry = 0;
        for (let i = 0; i < shift; i++) {
            carry = val & 1;
            val = val >> 1;
        }
        this.flagC = carry;
        this.flagX = carry;
        val = this.maskOut(val, size);
        this.d[reg] = this.signExtend(val, size);
        this.flagN = (this.signExtend(val, size) < 0) ? 1 : 0;
        this.flagZ = (val === 0) ? 1 : 0;
        this.flagV = 0;
        return 6 + 2 * shift;
    }

    opLSL(op) {
        const size = this.decodeSize((op >> 6) & 3);
        const shiftReg = (op >> 9) & 7;
        const reg = op & 7;
        const shift = this.d[shiftReg] & 63;
        if (shift === 0) { this.flagC = 0; return 6; }

        const val = this.maskOut(this.d[reg], size);
        let result = val << (shift - 1);
        this.flagC = (result < 0) ? 1 : 0;
        this.flagX = this.flagC;
        result = result << 1;
        result = this.maskOut(result, size);
        this.d[reg] = this.signExtend(result, size);
        this.flagN = (this.signExtend(result, size) < 0) ? 1 : 0;
        this.flagZ = (result === 0) ? 1 : 0;
        this.flagV = 0;
        return 6 + 2 * shift;
    }

    opLSR(op) {
        const size = this.decodeSize((op >> 6) & 3);
        const shiftReg = (op >> 9) & 7;
        const reg = op & 7;
        const shift = this.d[shiftReg] & 63;
        if (shift === 0) { this.flagC = 0; return 6; }

        let val = this.maskOut(this.d[reg], size);
        let carry = 0;
        for (let i = 0; i < shift; i++) {
            carry = val & 1;
            val = val >>> 1;
        }
        this.flagC = carry;
        this.flagX = carry;
        this.d[reg] = this.signExtend(val, size);
        this.flagN = 0;
        this.flagZ = (val === 0) ? 1 : 0;
        this.flagV = 0;
        return 6 + 2 * shift;
    }

    opROXL(op) {
        const size = this.decodeSize((op >> 6) & 3);
        const shiftReg = (op >> 9) & 7;
        const reg = op & 7;
        const shift = this.d[shiftReg] & 63;
        if (shift === 0) { this.flagC = 0; return 6; }

        let val = this.maskOut(this.d[reg], size);
        const bits = size === 4 ? 32 : size === 2 ? 16 : 8;
        let carry = this.flagX;
        for (let i = 0; i < shift; i++) {
            const highBit = (val >>> (bits - 1)) & 1;
            carry = highBit;
            val = ((val << 1) | this.flagX) & this.maskOut(-1, size);
            this.flagX = carry;
        }
        this.flagC = carry;
        this.d[reg] = this.signExtend(val, size);
        this.flagN = (this.signExtend(val, size) < 0) ? 1 : 0;
        this.flagZ = (val === 0) ? 1 : 0;
        this.flagV = 0;
        return 6 + 2 * shift;
    }

    opROXR(op) {
        const size = this.decodeSize((op >> 6) & 3);
        const shiftReg = (op >> 9) & 7;
        const reg = op & 7;
        const shift = this.d[shiftReg] & 63;
        if (shift === 0) { this.flagC = 0; return 6; }

        let val = this.maskOut(this.d[reg], size);
        const bits = size === 4 ? 32 : size === 2 ? 16 : 8;
        let carry = this.flagX;
        for (let i = 0; i < shift; i++) {
            const lowBit = val & 1;
            val = (val >>> 1) | (carry << (bits - 1));
            carry = lowBit;
        }
        this.flagC = carry;
        this.flagX = carry;
        this.d[reg] = this.signExtend(val, size);
        this.flagN = (this.signExtend(val, size) < 0) ? 1 : 0;
        this.flagZ = (val === 0) ? 1 : 0;
        this.flagV = 0;
        return 6 + 2 * shift;
    }

    opROR(op) {
        const size = this.decodeSize((op >> 6) & 3);
        const shiftReg = (op >> 9) & 7;
        const reg = op & 7;
        const shift = this.d[shiftReg] & 63;
        if (shift === 0) { this.flagC = 0; return 6; }

        let val = this.maskOut(this.d[reg], size);
        const bits = size === 4 ? 32 : size === 2 ? 16 : 8;
        let carry = 0;
        for (let i = 0; i < shift; i++) {
            carry = val & 1;
            val = (val >>> 1) | (carry << (bits - 1));
        }
        this.flagC = carry;
        this.d[reg] = this.signExtend(val, size);
        this.flagN = (this.signExtend(val, size) < 0) ? 1 : 0;
        this.flagZ = (val === 0) ? 1 : 0;
        this.flagV = 0;
        return 6 + 2 * shift;
    }

    opROL(op) {
        const size = this.decodeSize((op >> 6) & 3);
        const shiftReg = (op >> 9) & 7;
        const reg = op & 7;
        const shift = this.d[shiftReg] & 63;
        if (shift === 0) { this.flagC = 0; return 6; }

        let val = this.maskOut(this.d[reg], size);
        const bits = size === 4 ? 32 : size === 2 ? 16 : 8;
        let carry = 0;
        for (let i = 0; i < shift; i++) {
            carry = (val >>> (bits - 1)) & 1;
            val = ((val << 1) | carry) & this.maskOut(-1, size);
        }
        this.flagC = carry;
        this.d[reg] = this.signExtend(val, size);
        this.flagN = (this.signExtend(val, size) < 0) ? 1 : 0;
        this.flagZ = (val === 0) ? 1 : 0;
        this.flagV = 0;
        return 6 + 2 * shift;
    }

    opLSL_EA(op) {
        const eaMode = (op >> 3) & 7;
        const eaReg = op & 7;
        const ea = this.getEA(eaMode, eaReg, 2);
        let val = this.readWord(ea.addr);
        this.flagC = (val < 0) ? 1 : 0;
        this.flagX = this.flagC;
        val = (val << 1) & 0xFFFF;
        this.writeWord(ea.addr, val);
        this.flagN = (val < 0) ? 1 : 0;
        this.flagZ = (val === 0) ? 1 : 0;
        this.flagV = 0;
        return 8;
    }

    opLSR_EA(op) {
        const eaMode = (op >> 3) & 7;
        const eaReg = op & 7;
        const ea = this.getEA(eaMode, eaReg, 2);
        let val = this.readWord(ea.addr);
        this.flagC = val & 1;
        this.flagX = this.flagC;
        val = (val >>> 1) & 0x7FFF;
        this.writeWord(ea.addr, val);
        this.flagN = 0;
        this.flagZ = (val === 0) ? 1 : 0;
        this.flagV = 0;
        return 8;
    }

    opASL_EA(op) {
        const eaMode = (op >> 3) & 7;
        const eaReg = op & 7;
        const ea = this.getEA(eaMode, eaReg, 2);
        let val = this.readWord(ea.addr);
        this.flagC = (val < 0) ? 1 : 0;
        this.flagX = this.flagC;
        val = (val << 1) & 0xFFFF;
        this.writeWord(ea.addr, val);
        this.flagN = (val < 0) ? 1 : 0;
        this.flagZ = (val === 0) ? 1 : 0;
        this.flagV = 0;
        return 8;
    }

    opASR_EA(op) {
        const eaMode = (op >> 3) & 7;
        const eaReg = op & 7;
        const ea = this.getEA(eaMode, eaReg, 2);
        let val = this.signExtend(this.readWord(ea.addr), 2);
        this.flagC = val & 1;
        this.flagX = this.flagC;
        val = (val >> 1) & 0xFFFF;
        this.writeWord(ea.addr, val);
        this.flagN = (val < 0) ? 1 : 0;
        this.flagZ = (val === 0) ? 1 : 0;
        this.flagV = 0;
        return 8;
    }

    opROXL_EA(op) {
        const eaMode = (op >> 3) & 7;
        const eaReg = op & 7;
        const ea = this.getEA(eaMode, eaReg, 2);
        let val = this.readWord(ea.addr);
        const oldX = this.flagX;
        this.flagC = (val < 0) ? 1 : 0;
        this.flagX = this.flagC;
        val = ((val << 1) | oldX) & 0xFFFF;
        this.writeWord(ea.addr, val);
        this.flagN = (val < 0) ? 1 : 0;
        this.flagZ = (val === 0) ? 1 : 0;
        this.flagV = 0;
        return 8;
    }

    opROXR_EA(op) {
        const eaMode = (op >> 3) & 7;
        const eaReg = op & 7;
        const ea = this.getEA(eaMode, eaReg, 2);
        let val = this.readWord(ea.addr);
        const oldX = this.flagX;
        this.flagC = val & 1;
        this.flagX = this.flagC;
        val = ((val >>> 1) | (oldX << 15)) & 0xFFFF;
        this.writeWord(ea.addr, val);
        this.flagN = (val < 0) ? 1 : 0;
        this.flagZ = (val === 0) ? 1 : 0;
        this.flagV = 0;
        return 8;
    }

    aluAdd(dst, src, size, setFlags) {
        const mask = this.maskOut(-1, size);
        const result = (dst + src) & mask;
        if (setFlags) {
            this.flagN = (this.signExtend(result, size) < 0) ? 1 : 0;
            this.flagZ = (result === 0) ? 1 : 0;
            this.flagV = (((~dst & ~src & result) | (dst & src & ~result)) >>> (size === 4 ? 31 : size === 2 ? 15 : 7)) & 1;
            this.flagC = ((dst + src) >>> (size === 4 ? 32 : size === 2 ? 16 : 8)) & 1;
            this.flagX = this.flagC;
        }
        return result;
    }

    aluSub(dst, src, size, setFlags) {
        const mask = this.maskOut(-1, size);
        const result = (dst - src) & mask;
        if (setFlags) {
            this.flagN = (this.signExtend(result, size) < 0) ? 1 : 0;
            this.flagZ = (result === 0) ? 1 : 0;
            this.flagV = (((dst & ~src & ~result) | (~dst & src & result)) >>> (size === 4 ? 31 : size === 2 ? 15 : 7)) & 1;
            this.flagC = ((dst - src) < 0) ? 1 : 0;
            this.flagX = this.flagC;
        }
        return result;
    }

    opLineA(op) {
        return 4;
    }

    opLineF(op) {
        return 4;
    }

    opILLEGAL(op) {
        this.pushLong(this.pc);
        this.pushWord(this.sr);
        this.pc = this.readLong(10 << 2);
        this.sr = (this.sr & 0xF8FF) | 0x2000;
        return 40;
    }

    triggerInterrupt(level) {
        if (level > ((this.sr >> 8) & 7)) {
            this.interruptLevel = level;
            this.pushLong(this.pc);
            this.pushWord(this.sr);
            this.sr = (this.sr & 0xF8FF) | (level << 8) | 0x2000;
            this.pc = this.readLong((24 + level) << 2);
            this.cycleCount += 40;
        }
    }

    fetchByte() {
        const v = this.readByte(this.pc);
        this.pc = (this.pc + 2) | 0;
        return v;
    }
}

class GenesisVDP {
    constructor(genesis) {
        this.genesis = genesis;
        this.vram = new Uint8Array(0x10000);
        this.cram = new Uint16Array(64);
        this.vram16 = new Uint16Array(this.vram.buffer);
        this.vram32 = new Int32Array(this.vram.buffer);
        this.vsram = new Uint16Array(64);
        this.pixels = new Uint32Array(320 * 224);
        this.code = 0;
        this.address = 0;
        this.status = 0x3400;
        this.reg = new Uint8Array(24);
        this.hIntCounter = 0;
        this.vIntPending = false;
        this.hIntPending = false;
        this.vCounter = 0;
        this.hCounter = 0;
        this.dmaFill = false;
        this.pendingWrite = false;
        this.lineSize = 320;
    }

    reset() {
        this.vram.fill(0);
        this.cram.fill(0);
        this.vsram.fill(0);
        this.pixels.fill(0xFF000000);
        this.code = 0;
        this.address = 0;
        this.status = 0x3400;
        this.reg.fill(0);
        this.hIntCounter = 0;
        this.vIntPending = false;
        this.hIntPending = false;
        this.vCounter = 0;
        this.hCounter = 0;
        this.pendingWrite = false;
    }

    writeByte(addr, val) {
        addr &= 0x1F;
        switch (addr) {
            case 0x00: this.reg[0x00] = val; break;
            case 0x01: this.reg[0x01] = val; break;
            case 0x02: this.reg[0x02] = val; break;
            case 0x03: this.reg[0x03] = val; break;
            case 0x04: this.reg[0x04] = val; break;
            case 0x05: this.reg[0x05] = val; break;
            case 0x07: this.reg[0x07] = val; break;
            case 0x0A: this.reg[0x0A] = val; break;
            case 0x0B: this.reg[0x0B] = val; break;
            case 0x0C: this.reg[0x0C] = val; break;
            case 0x0D: this.reg[0x0D] = val; break;
            case 0x0E: this.reg[0x0E] = val; break;
            case 0x10: this.reg[0x10] = val; break;
            case 0x11: this.reg[0x11] = val; break;
            case 0x12: this.reg[0x12] = val; break;
            case 0x13: this.reg[0x13] = val; break;
            case 0x16: this.reg[0x16] = val; break;
            case 0x17: this.reg[0x17] = val; break;
        }
    }

    readByte(addr) {
        addr &= 0x1F;
        switch (addr) {
            case 0x04: return this.status & 0xFF;
            case 0x05: return (this.status >> 8) & 0xFF;
            case 0x08: return this.hCounter;
            case 0x09: return this.vCounter & 0xFF;
        }
        return 0;
    }

    readWord() {
        const result = this.pendingWrite ? this.vram16[this.address >> 1] : 0;
        this.address = (this.address + (this.reg[0x0E] & 1 ? 4 : 2)) & 0xFFFF;
        return result;
    }

    writeWordData(data) {
        switch (this.code) {
            case 0x01:
                this.vram16[this.address >> 1] = data;
                this.address = (this.address + (this.reg[0x0E] & 1 ? 4 : 2)) & 0xFFFF;
                break;
            case 0x03: {
                const idx = this.address >> 1;
                if (idx < 64) this.cram[idx] = data;
                this.address = (this.address + 2) & 0xFFFF;
                break;
            }
            case 0x05: {
                const idx = this.address >> 1;
                if (idx < 64) this.vsram[idx] = data;
                this.address = (this.address + 2) & 0xFFFF;
                break;
            }
        }
        this.pendingWrite = true;
    }

    writeCommand(data) {
        if (this.pendingWrite) {
            if ((data & 0xC000) === 0x8000) {
                this.code = (data >> 14) & 3;
                this.address = (this.address & 0x3FFF) | ((data & 0x3FFF) << 0);
                if (data & 0x100) this.address |= 0x8000;
            } else if ((data & 0xE000) === 0xC000) {
                this.code = 3;
                this.address = data & 0x7F;
            }
            this.pendingWrite = false;
        } else {
            this.code = (data >> 14) & 3;
            this.address = (this.address & 0xFC00) | (data & 0x3FF);
            if (data & 0x100) this.address |= 0x8000;
            this.pendingWrite = true;
        }
    }

    renderLine(line) {
        const h40 = (this.reg[0x0C] & 0x81) === 0x81;
        const displayWidth = h40 ? 40 : 32;
        const pixelWidth = h40 ? 8 : 6;
        const nameBaseA = ((this.reg[0x02] >> 1) & 7) * 0x1000;
        const nameBaseB = ((this.reg[0x04] >> 3) & 7) * 0x1000;
        const hScrollA = this.reg[0x0D] & 3;
        const hScrollB = this.reg[0x0D] & 3;
        const hScrollBase = (this.reg[0x0B] & 3) * 0x400;

        const windowEnabled = (this.reg[0x11] & 0x80) !== 0;

        for (let px = 0; px < 320; px++) {
            let pixel = 0xFF000000;

            if (windowEnabled) {
                const winX = (this.reg[0x11] & 0x1F) * 8;
                const winY = (this.reg[0x12] & 0x1F) * 8;
                const winRight = (this.reg[0x11] & 0x80) !== 0;
                const winDown = (this.reg[0x11] & 0x40) !== 0;

                if ((winRight ? px >= winX : px < winX) && (winDown ? line >= winY : line < winY)) {
                    pixel = this.renderWindow(px, line);
                } else {
                    pixel = this.renderPlane('A', px, line, nameBaseA, hScrollBase, hScrollA);
                }
            } else {
                pixel = this.renderPlane('A', px, line, nameBaseA, hScrollBase, hScrollA);
            }

            const bPixel = this.renderPlane('B', px, line, nameBaseB, hScrollBase, hScrollB);
            if ((bPixel & 0x00FFFFFF) !== 0) {
                const bPri = (bPixel >> 24) & 1;
                const aPri = (pixel >> 24) & 1;
                if (!aPri || bPri) pixel = bPixel;
            }

            pixel = this.renderSprites(px, line, pixel);

            this.pixels[line * 320 + px] = pixel;
        }
    }

    renderPlane(plane, px, line, nameBase, hScrollBase, hScrollMode) {
        const hScrollAddr = hScrollBase + (line & 0x7FF) * 2;
        let hScroll = this.vram16[hScrollAddr >> 1] || 0;
        if (plane === 'B') hScroll = this.vram16[(hScrollAddr + 0x200) >> 1] || 0;

        const scrollMask = (this.reg[0x0B] & 3) === 3 ? 0x7FF : (this.reg[0x0B] & 3) === 2 ? 0x1FF : (this.reg[0x0B] & 3) === 1 ? 0xFF : 0x7F;
        hScroll = (-hScroll) & scrollMask;

        const planeWidth = (this.reg[0x10] & 3) === 3 ? 128 : (this.reg[0x10] & 3) === 2 ? 64 : (this.reg[0x10] & 3) === 1 ? 32 : 32;
        const planeHeight = ((this.reg[0x10] >> 4) & 3) === 3 ? 128 : ((this.reg[0x10] >> 4) & 3) === 2 ? 64 : ((this.reg[0x10] >> 4) & 3) === 1 ? 32 : 32;

        const scrollX = (px + hScroll) % (planeWidth * 8);
        const tileX = (scrollX >> 3) & (planeWidth - 1);
        const tileY = (line >> 3) & (planeHeight - 1);
        const pixelInTile = scrollX & 7;

        const nameAddr = nameBase + (tileY * planeWidth + tileX) * 2;
        const nameEntry = (this.vram[nameAddr] << 8) | this.vram[nameAddr + 1];

        const tileAddr = (nameEntry & 0x7FF) * 0x20;
        const pal = (nameEntry >> 13) & 3;
        const vFlip = (nameEntry >> 11) & 1;
        const hFlip = (nameEntry >> 10) & 1;

        let ty = vFlip ? (7 - (line & 7)) : (line & 7);
        let tx = hFlip ? (7 - pixelInTile) : pixelInTile;

        const pixelOffset = tileAddr + ty * 4;
        const bitIdx = 7 - tx;

        const b0 = (this.vram[pixelOffset] >> bitIdx) & 1;
        const b1 = (this.vram[pixelOffset + 1] >> bitIdx) & 1;
        const b2 = (this.vram[pixelOffset + 2] >> bitIdx) & 1;
        const b3 = (this.vram[pixelOffset + 3] >> bitIdx) & 1;
        const colorIdx = (b3 << 3) | (b2 << 2) | (b1 << 1) | b0;

        if (colorIdx === 0) return 0xFF000000;

        const cramIdx = pal * 16 + colorIdx;
        const color = this.cram[cramIdx] || 0;

        const r = ((color >> 1) & 7) * 36;
        const g = (((color >> 5) & 7) << 2) | ((color >> 3) & 3);
        g = g * 9;
        const b = ((color >> 9) & 7) * 36;

        return 0xFF000000 | (r << 16) | (g << 8) | b;
    }

    renderWindow(px, line) {
        const nameBase = ((this.reg[0x06] >> 1) & 7) * 0x1000;
        const tileX = (px >> 3) & 0x3F;
        const tileY = (line >> 3) & 0x3F;
        const pixelInTile = px & 7;

        const nameAddr = nameBase + (tileY * 64 + tileX) * 2;
        const nameEntry = (this.vram[nameAddr] << 8) | this.vram[nameAddr + 1];
        const tileAddr = (nameEntry & 0x7FF) * 0x20;
        const pal = (nameEntry >> 13) & 3;
        const vFlip = (nameEntry >> 11) & 1;
        const hFlip = (nameEntry >> 10) & 1;

        let ty = vFlip ? (7 - (line & 7)) : (line & 7);
        let tx = hFlip ? (7 - pixelInTile) : pixelInTile;

        const pixelOffset = tileAddr + ty * 4;
        const bitIdx = 7 - tx;

        const b0 = (this.vram[pixelOffset] >> bitIdx) & 1;
        const b1 = (this.vram[pixelOffset + 1] >> bitIdx) & 1;
        const b2 = (this.vram[pixelOffset + 2] >> bitIdx) & 1;
        const b3 = (this.vram[pixelOffset + 3] >> bitIdx) & 1;
        const colorIdx = (b3 << 3) | (b2 << 2) | (b1 << 1) | b0;

        if (colorIdx === 0) return 0xFF000000;

        const cramIdx = pal * 16 + colorIdx;
        const color = this.cram[cramIdx] || 0;

        const r = ((color >> 1) & 7) * 36;
        const g = (((color >> 5) & 7) << 2) | ((color >> 3) & 3);
        g = g * 9;
        const b = ((color >> 9) & 7) * 36;

        return 0xFF000000 | (r << 16) | (g << 8) | b;
    }

    renderSprites(px, line, bgPixel) {
        const sprBase = (this.reg[0x0B] & 0x78) << 7;

        for (let i = 0; i < 80; i++) {
            const addr = sprBase + i * 8;
            const y = this.vram16[(addr) >> 1] & 0x7FF;
            const size = this.vram16[(addr + 2) >> 1] & 0xF00;
            const link = this.vram16[(addr + 2) >> 1] & 0x7F;
            const hPixels = ((size >> 8) & 0xF) + 1;
            const vPixels = ((size >> 8) & 0xF0) + 1;

            let yLine = line - y;
            if (yLine < 0 || yLine >= vPixels) continue;
            if (link === 0 && i > 0) break;

            const tileRow = yLine >> 3;
            const yInTile = yLine & 7;

            for (let h = 0; h < hPixels; h++) {
                const x = (this.vram16[(addr + 4 + h * 2) >> 1] & 0x1FF) - 128;
                if (px < x || px >= x + 8) continue;

                const tileNum = (this.vram16[(addr + 6) >> 1] & 0x7FF) + tileRow * ((size & 0x3000) === 0x1000 ? 2 : 1);
                const pal = (this.vram16[(addr + 6) >> 1] >> 13) & 3;
                const vFlip = (this.vram16[(addr + 6) >> 1] >> 12) & 1;
                const hFlip = (this.vram16[(addr + 6) >> 1] >> 11) & 1;

                const tileAddr = tileNum * 0x20;
                let ty = vFlip ? (7 - yInTile) : yInTile;
                let tx = hFlip ? (7 - (px - x)) : (px - x);

                const pixelOffset = tileAddr + ty * 4;
                const bitIdx = 7 - tx;

                const b0 = (this.vram[pixelOffset] >> bitIdx) & 1;
                const b1 = (this.vram[pixelOffset + 1] >> bitIdx) & 1;
                const b2 = (this.vram[pixelOffset + 2] >> bitIdx) & 1;
                const b3 = (this.vram[pixelOffset + 3] >> bitIdx) & 1;
                const colorIdx = (b3 << 3) | (b2 << 2) | (b1 << 1) | b0;

                if (colorIdx === 0) continue;

                const cramIdx = pal * 16 + colorIdx;
                const color = this.cram[cramIdx] || 0;

                const r = ((color >> 1) & 7) * 36;
                const g = (((color >> 5) & 7) << 2) | ((color >> 3) & 3);
                g = g * 9;
                const b = ((color >> 9) & 7) * 36;

                return 0xFF000000 | (r << 16) | (g << 8) | b;
            }
        }
        return bgPixel;
    }

    renderFullFrame() {
        const height = (this.reg[0x01] & 0x08) ? 240 : 224;
        for (let line = 0; line < height; line++) {
            this.renderLine(line);
        }
    }
}

class Genesis {
    constructor() {
        this.cpu = new Genesis68K(this);
        this.vdp = new GenesisVDP(this);
        this.rom = null;
        this.ram = new Uint8Array(0x10000);
        this.ram16 = new Uint16Array(this.ram.buffer);
        this.ram32 = new Int32Array(this.ram.buffer);
        this.ioPorts = new Uint8Array(0x20);
        this.z80Ram = new Uint8Array(0x2000);
        this.z80BusReq = 0;
        this.z80Reset = 0;
        this.controllers = [0, 0, 0];
        this.controllerData = [0, 0, 0];
        this.controllerTh = [0, 0, 0];
        this.pixels = this.vdp.pixels;
        this.cyclesPerLine = 3420;
        this.totalLines = 262;
        this.cyclesPerFrame = this.cyclesPerLine * this.totalLines;
        this.currentLine = 0;
        this.frameCycles = 0;
        this.megaCycles = 0;
        this.scanline = 0;
    }

    loadROM(data) {
        if (typeof data === 'string') {
            this.rom = new Uint8Array(data.length);
            for (let i = 0; i < data.length; i++) {
                this.rom[i] = data.charCodeAt(i) & 0xFF;
            }
        } else if (data instanceof ArrayBuffer) {
            this.rom = new Uint8Array(data);
        } else if (data instanceof Uint8Array) {
            this.rom = data;
        } else {
            throw new Error('Invalid ROM data');
        }
        this.reset();
    }

    reset() {
        this.cpu.reset();
        this.vdp.reset();
        this.ram.fill(0);
        this.z80Ram.fill(0);
        this.ioPorts.fill(0);
        this.currentLine = 0;
        this.frameCycles = 0;
    }

    memReadByte(addr) {
        addr = addr | 0;
        if (addr < 0x400000) {
            return this.rom ? this.rom[addr & (this.rom.length - 1)] : 0;
        }
        if (addr >= 0xA00000 && addr < 0xA10000) {
            return this.z80BusReq & 0xFF;
        }
        if (addr >= 0xA10000 && addr < 0xA10020) {
            return this.ioPorts[addr & 0x1F];
        }
        if (addr >= 0xC00000 && addr < 0xC00010) {
            return this.vdp.readByte(addr);
        }
        if (addr >= 0xE00000 || (addr >= 0xFF0000)) {
            return this.ram[addr & 0xFFFF];
        }
        return 0;
    }

    memReadWord(addr) {
        return ((this.memReadByte(addr) << 8) | this.memReadByte((addr + 1) | 0)) & 0xFFFF;
    }

    memReadLong(addr) {
        return ((this.memReadWord(addr) << 16) | this.memReadWord((addr + 2) | 0)) | 0;
    }

    memWriteByte(addr, val) {
        addr = addr | 0;
        val = val & 0xFF;

        if (addr >= 0xA00000 && addr < 0xA10000) {
            this.z80BusReq = val;
            return;
        }
        if (addr >= 0xA10000 && addr < 0xA10020) {
            this.handleIOWrite(addr, val);
            return;
        }
        if (addr >= 0xC00000 && addr < 0xC00008) {
            if (addr & 1) this.vdp.writeWordData(val << 8);
            else this.vdp.writeCommand((val << 8));
            return;
        }
        if (addr >= 0xC00008 && addr < 0xC00010) {
            if (addr & 1) this.vdp.writeWordData(val << 8);
            else this.vdp.writeWordData(val);
            return;
        }
        if (addr >= 0xC00011 && addr < 0xC00018) {
            return;
        }
        if (addr >= 0xE00000 || addr >= 0xFF0000) {
            this.ram[addr & 0xFFFF] = val;
            return;
        }
    }

    memWriteWord(addr, val) {
        this.memWriteByte(addr, (val >> 8) & 0xFF);
        this.memWriteByte((addr + 1) | 0, val & 0xFF);
    }

    memWriteLong(addr, val) {
        this.memWriteWord(addr, (val >> 16) & 0xFFFF);
        this.memWriteWord((addr + 2) | 0, val & 0xFFFF);
    }

    handleIOWrite(addr, val) {
        const port = addr & 0x0E;
        const reg = addr & 0x0F;

        switch (reg) {
            case 0x01:
                this.ioPorts[1] = val;
                if (val & 0x80) {
                    this.z80BusReq = 0;
                }
                break;
            case 0x03:
                this.ioPorts[3] = val;
                break;
            case 0x05:
                this.ioPorts[5] = val;
                break;
            case 0x09:
                this.controllerTh[port >> 1] = val;
                break;
        }
    }

    handleIORead(addr) {
        const port = addr & 0x0E;
        const reg = addr & 0x0F;

        switch (reg) {
            case 0x01: return 0x20;
            case 0x03: return 0xFF;
            case 0x05: return 0xFF;
            case 0x09: return 0xFF;
            case 0x0B: return 0xFF;
            default: return 0xFF;
        }
    }

    setController(port, buttons) {
        if (port < 0 || port > 2) return;
        this.controllers[port] = buttons;
    }

    frame() {
        const height = (this.vdp.reg[0x01] & 0x08) ? 240 : 224;

        for (this.currentLine = 0; this.currentLine < this.totalLines; this.currentLine++) {
            this.vdp.vCounter = this.currentLine;
            this.vdp.hCounter = 0;

            if (this.currentLine < height) {
                this.vdp.renderLine(this.currentLine);
            }

            if (this.currentLine === (this.vdp.reg[0x10] | 0)) {
                this.vdp.hIntPending = true;
                this.cpu.triggerInterrupt(4);
            }

            if (this.currentLine === height) {
                this.vdp.status |= 0x08;
                this.vdp.vIntPending = true;
                this.cpu.triggerInterrupt(6);
            } else if (this.currentLine === height + 1) {
                this.vdp.status &= ~0x08;
            }

            for (let cycle = 0; cycle < this.cyclesPerLine; cycle += 4) {
                this.cpu.execute();
                if (this.cpu.stopped) break;
            }

            if (this.cpu.stopped && this.cpu.interruptLevel > 0) {
                this.cpu.stopped = false;
            }
        }

        this.megaCycles += this.cyclesPerFrame;
    }

    getDisplaySize() {
        const h40 = (this.vdp.reg[0x0C] & 0x81) === 0x81;
        const h240 = (this.vdp.reg[0x01] & 0x08) !== 0;
        return {
            width: h40 ? 320 : 256,
            height: h240 ? 240 : 224
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Genesis68K, GenesisVDP, Genesis };
}
