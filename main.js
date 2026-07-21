(() => {
    const $ = s => document.querySelector(s);
    const $$ = s => document.querySelectorAll(s);

    const canvas = $('#emulatorCanvas');
    const ctx = canvas.getContext('2d');
    const romFileInput = $('#romFileInput');
    const views = { home: $('#viewHome'), library: $('#viewLibrary'), settings: $('#viewSettings'), emulator: $('#viewEmulator'), wiishop: $('#viewWiiShop'), miimaker: $('#viewMiiMaker') };

    let activeConsole = null, activeEmulator = null, running = false, speed = 1;
    let animFrameId = null, lastTime = 0, framesThisSec = 0, fpsTime = 0;
    let currentRomName = '';
    let gameLibrary = [];
    let usingEmulatorJS = false;

    const keys = { A:0, B:0, Select:0, Start:0, Up:0, Down:0, Left:0, Right:0 };

    const CONSOLES = {
        nes:     { name: 'NES',              emoji: '\u{1F3AE}', width: 256, height: 240, exts: ['.nes'],              color: '#fee2e2', textColor: '#991b1b', info: '8-bit \u00B7 Nintendo', tag: 'Mappers 0-3' },
        snes:    { name: 'SNES',             emoji: '\u{1F3AE}', width: 256, height: 224, exts: ['.sfc', '.smc'],      color: '#dbeafe', textColor: '#1e40af', info: '16-bit \u00B7 Nintendo', tag: 'LoROM / HiROM' },
        n64:     { name: 'Nintendo 64',       emoji: '\u{1F3D2}', width: 320, height: 240, exts: ['.n64', '.z64', '.v64'], color: '#f3e8ff', textColor: '#6b21a8', info: '64-bit \u00B7 Nintendo', tag: 'MIPS R4300i' },
        gb:      { name: 'Game Boy',          emoji: '\u{1F4F1}', width: 160, height: 144, exts: ['.gb', '.gbc'],       color: '#d1fae5', textColor: '#166534', info: '8-bit \u00B7 Nintendo', tag: 'DMG / CGB' },
        genesis: { name: 'Sega Genesis',      emoji: '\u{1F3AE}', width: 320, height: 224, exts: ['.gen', '.md', '.bin'], color: '#ffedd5', textColor: '#9a3412', info: '16-bit \u00B7 Sega', tag: 'M68000 + Z80' },
        ps1:     { name: 'PlayStation',       emoji: '\u{1F3AE}', width: 320, height: 240, exts: ['.psx', '.bin', '.cue'], color: '#e0e7ff', textColor: '#3730a3', info: '32-bit \u00B7 Sony', tag: 'R3000A + GTE' },
        psp:     { name: 'PSP',               emoji: '\u{1F4F1}', width: 480, height: 272, exts: ['.pbp', '.elf', '.iso', '.cso'], color: '#fce7f3', textColor: '#9d174d', info: 'Portable \u00B7 Sony', tag: 'Allegrex + GE' },
    };

    // ==================== BUBBLE PARTICLES ====================
    function createBubbles() {
        const container = $('#bubbleContainer');
        if (!container) return;
        const colors = [
            'radial-gradient(circle at 30% 30%, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0.04) 60%, transparent 100%)',
            'radial-gradient(circle at 30% 30%, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.03) 60%, transparent 100%)',
            'radial-gradient(circle at 30% 30%, rgba(139,92,246,0.15) 0%, rgba(139,92,246,0.03) 60%, transparent 100%)',
            'radial-gradient(circle at 30% 30%, rgba(236,72,153,0.12) 0%, rgba(236,72,153,0.02) 60%, transparent 100%)',
            'radial-gradient(circle at 30% 30%, rgba(6,182,212,0.15) 0%, rgba(6,182,212,0.03) 60%, transparent 100%)',
        ];
        for (let i = 0; i < 8; i++) {
            const b = document.createElement('div');
            b.className = 'bubble';
            const size = 18 + Math.random() * 50;
            b.style.width = size + 'px';
            b.style.height = size + 'px';
            b.style.left = Math.random() * 100 + '%';
            b.style.bottom = '-' + size + 'px';
            b.style.background = colors[Math.floor(Math.random() * colors.length)];
            b.style.animation = `floatUp ${10 + Math.random() * 16}s ${Math.random() * 12}s linear infinite`;
            container.appendChild(b);
        }
    }

    // ==================== CLOUDS ====================
    function createClouds() {
        const container = $('#cloudContainer');
        if (!container) return;
        for (let i = 0; i < 3; i++) {
            const cloud = document.createElement('div');
            cloud.className = 'cloud';
            const scale = 0.4 + Math.random() * 0.8;
            const w = 120 + Math.random() * 100;
            const h = 40 + Math.random() * 30;
            cloud.style.top = (5 + Math.random() * 25) + '%';
            cloud.style.transform = `scale(${scale})`;
            cloud.innerHTML = `
                <div class="cloud-body" style="width:${w}px;height:${h}px;">
                    <div style="position:absolute;top:-${h*0.4}px;left:${w*0.15}px;width:${w*0.5}px;height:${h*0.9}px;background:rgba(255,255,255,0.5);border-radius:50%;filter:blur(2px);"></div>
                    <div style="position:absolute;top:-${h*0.2}px;left:${w*0.45}px;width:${w*0.4}px;height:${h*0.7}px;background:rgba(255,255,255,0.45);border-radius:50%;filter:blur(2px);"></div>
                </div>`;
            cloud.style.animation = `cloudDrift ${50 + Math.random() * 60}s ${Math.random() * 40}s linear infinite`;
            container.appendChild(cloud);
        }
    }

    // ==================== BOKEH ====================
    function createBokeh() {
        const container = $('#bokehContainer');
        if (!container) return;
        const colors = [
            'rgba(59,130,246,0.12)',
            'rgba(16,185,129,0.10)',
            'rgba(139,92,246,0.10)',
            'rgba(236,72,153,0.08)',
            'rgba(6,182,212,0.10)',
            'rgba(251,191,36,0.08)',
            'rgba(244,114,182,0.08)',
        ];
        for (let i = 0; i < 5; i++) {
            const b = document.createElement('div');
            b.className = 'bokeh';
            const size = 30 + Math.random() * 80;
            b.style.width = size + 'px';
            b.style.height = size + 'px';
            b.style.left = Math.random() * 100 + '%';
            b.style.bottom = '-' + (size + 20) + 'px';
            b.style.background = `radial-gradient(circle at 35% 35%, ${colors[Math.floor(Math.random() * colors.length)]}, transparent 70%)`;
            b.style.animation = `bokehFloat ${14 + Math.random() * 18}s ${Math.random() * 15}s linear infinite`;
            container.appendChild(b);
        }
    }

    // ==================== FLOATING LEAVES ====================
    function createLeaves() {
        const container = $('#leafContainer');
        if (!container) return;
        for (let i = 0; i < 3; i++) {
            const leaf = document.createElement('div');
            leaf.className = 'leaf';
            const size = 10 + Math.random() * 14;
            leaf.style.width = size + 'px';
            leaf.style.height = size * 1.3 + 'px';
            leaf.style.left = Math.random() * 100 + '%';
            leaf.style.top = '-' + (size * 1.3 + 20) + 'px';
            leaf.innerHTML = '<div class="leaf-shape"></div>';
            leaf.style.animation = `leafFall ${12 + Math.random() * 16}s ${Math.random() * 20}s linear infinite`;
            leaf.style.transformOrigin = '50% 50%';
            container.appendChild(leaf);
        }
    }

    // ==================== LENS FLARES ====================
    function createLensFlares() {
        const container = $('#lensFlareContainer');
        if (!container) return;
        for (let i = 0; i < 2; i++) {
            const flare = document.createElement('div');
            flare.className = 'lens-flare';
            const size = 60 + Math.random() * 100;
            flare.style.width = size + 'px';
            flare.style.height = size + 'px';
            flare.style.left = (10 + Math.random() * 80) + '%';
            flare.style.top = (5 + Math.random() * 30) + '%';
            flare.innerHTML = '<div class="lens-flare-core"></div>';
            flare.style.animation = `flarePulse ${8 + Math.random() * 12}s ${Math.random() * 10}s ease-in-out infinite`;
            container.appendChild(flare);
        }
    }

    // ==================== WATER DROPS ====================
    function createWaterDrops() {
        const container = $('#waterDropContainer');
        if (!container) return;
        for (let i = 0; i < 5; i++) {
            const drop = document.createElement('div');
            drop.className = 'water-drop';
            drop.style.left = Math.random() * 100 + '%';
            drop.style.top = Math.random() * 60 + '%';
            drop.style.animationDuration = (2 + Math.random() * 3) + 's';
            drop.style.animationDelay = (Math.random() * 6) + 's';
            container.appendChild(drop);
        }
    }

    // ==================== LIGHT RAYS ====================
    function createLightRays() {
        const container = $('#lightRayContainer');
        if (!container) return;
        for (let i = 0; i < 4; i++) {
            const ray = document.createElement('div');
            ray.className = 'light-ray';
            ray.style.left = (10 + Math.random() * 80) + '%';
            ray.style.height = (100 + Math.random() * 200) + 'px';
            ray.style.width = (0.5 + Math.random() * 1.5) + 'px';
            ray.style.animationDuration = (5 + Math.random() * 10) + 's';
            ray.style.animationDelay = (Math.random() * 8) + 's';
            container.appendChild(ray);
        }
    }

    // ==================== WATER RIPPLES ====================
    function createRipples() {
        const container = $('#rippleContainer');
        if (!container) return;
        function spawnRipple() {
            const ring = document.createElement('div');
            ring.className = 'ripple-ring';
            ring.style.left = (Math.random() * 100) + '%';
            ring.style.top = (Math.random() * 100) + '%';
            ring.style.transform = 'translate(-50%, -50%)';
            ring.style.animation = 'rippleExpand 3s ease-out forwards';
            container.appendChild(ring);
            setTimeout(() => ring.remove(), 3000);
        }
        setInterval(spawnRipple, 5000);
        setTimeout(spawnRipple, 500);
        setTimeout(spawnRipple, 1200);
    }

    // ==================== MOUSE PARALLAX ====================
    function initParallax() {
        let ticking = false;
        const targets = [
            { el: $('#cloudContainer'), mx: 6.4, my: 4.8 },
            { el: $('#bokehContainer'), mx: 4, my: 3.2 },
            { el: $('#bubbleContainer'), mx: 2.4, my: 2.4 },
            { el: $('#leafContainer'), mx: 4.8, my: 4 },
            { el: $('#lensFlareContainer'), mx: 1.6, my: 1.6 },
        ].filter(t => t.el);
        document.addEventListener('mousemove', e => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                const cx = (e.clientX / window.innerWidth - 0.5) * 2;
                const cy = (e.clientY / window.innerHeight - 0.5) * 2;
                for (const t of targets) {
                    t.el.style.translate = `${cx * t.mx}px ${cy * t.my}px`;
                }
                ticking = false;
            });
        });
    }

    // ==================== WII CURSOR ====================
    function initWiiCursor() {
        const cursor = $('#wiiCursor');
        if (!cursor) return;
        let mx = -100, my = -100;
        let curX = -100, curY = -100;
        let visible = false;
        let idleTimer = null;
        let curRaf = null;

        const style = document.createElement('style');
        style.textContent = `*, *::before, *::after { cursor: none !important; }`;
        document.head.appendChild(style);

        function startLoop() {
            if (curRaf) return;
            function tick() {
                curX += (mx - curX) * 0.25;
                curY += (my - curY) * 0.25;
                cursor.style.left = curX + 'px';
                cursor.style.top = curY + 'px';
                if (Math.abs(mx - curX) > 0.5 || Math.abs(my - curY) > 0.5) {
                    curRaf = requestAnimationFrame(tick);
                } else {
                    curRaf = null;
                }
            }
            curRaf = requestAnimationFrame(tick);
        }

        document.addEventListener('mousemove', e => {
            mx = e.clientX; my = e.clientY;
            if (!visible) {
                visible = true;
                cursor.style.opacity = '1';
                cursor.style.transition = 'opacity 0.3s ease';
            }
            startLoop();
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => { visible = false; cursor.style.opacity = '0'; }, 3000);
        });

        document.addEventListener('mouseleave', () => {
            visible = false;
            cursor.style.opacity = '0';
            clearTimeout(idleTimer);
        });

        document.addEventListener('mousedown', e => {
            cursor.style.transform = 'translate(-6px,-2px) scale(0.85)';
            setTimeout(() => { cursor.style.transform = 'translate(-6px,-2px) scale(1)'; }, 120);
            const burst = document.createElement('div');
            burst.className = 'click-burst';
            burst.style.left = (e.clientX - 60) + 'px';
            burst.style.top = (e.clientY - 60) + 'px';
            document.body.appendChild(burst);
            setTimeout(() => burst.remove(), 600);
        });
    }

    // ==================== 3D FLOATING CARD ====================
    function init3DCard() {
        const scene = $('#scene3d');
        const card = $('#card3d');
        if (!scene || !card) return;
        let isFlipped = false;

        scene.addEventListener('mousemove', e => {
            const rect = scene.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;
            const rotateY = x * 30 + (isFlipped ? 180 : 0);
            const rotateX = -y * 20;
            card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        });

        scene.addEventListener('mouseleave', () => {
            card.style.transform = `rotateX(0deg) rotateY(${isFlipped ? 180 : 0}deg)`;
            card.style.transition = 'transform 0.5s ease-out';
            setTimeout(() => { card.style.transition = 'transform 0.1s ease-out'; }, 500);
        });

        card.addEventListener('click', () => {
            isFlipped = !isFlipped;
            card.style.transform = `rotateX(0deg) rotateY(${isFlipped ? 180 : 0}deg)`;
        });

        card.style.animation = 'card3dFloat 4s ease-in-out infinite';
    }

    // ==================== WII CHANNEL ZOOM ====================
    function wiiZoomToConsole(cardEl, consoleId) {
        const rect = cardEl.getBoundingClientRect();
        const overlay = $('#wiiZoomOverlay');
        const zoomCard = $('#wiiZoomCard');
        if (!overlay || !zoomCard) { activeConsole = consoleId; showView('library'); return; }

        const clone = cardEl.cloneNode(true);
        clone.style.width = rect.width + 'px';
        clone.style.height = rect.height + 'px';
        clone.style.margin = '0';
        clone.style.position = 'static';
        clone.style.transform = 'none';

        zoomCard.innerHTML = '';
        zoomCard.appendChild(clone);
        zoomCard.style.left = rect.left + 'px';
        zoomCard.style.top = rect.top + 'px';
        zoomCard.style.width = rect.width + 'px';
        zoomCard.style.height = rect.height + 'px';
        zoomCard.style.borderRadius = '16px';
        zoomCard.style.background = 'white';
        zoomCard.style.display = 'block';
        zoomCard.classList.remove('wii-zooming');
        overlay.style.display = 'block';
        overlay.classList.remove('wii-active');
        overlay.style.pointerEvents = 'all';

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                overlay.classList.add('wii-active');
                zoomCard.classList.add('wii-zooming');
                zoomCard.style.left = '0';
                zoomCard.style.top = '0';
                zoomCard.style.width = '100vw';
                zoomCard.style.height = '100vh';
                zoomCard.style.borderRadius = '0';
            });
        });

        setTimeout(() => {
            activeConsole = consoleId;
            overlay.style.display = 'none';
            overlay.classList.remove('wii-active');
            overlay.style.pointerEvents = 'none';
            zoomCard.style.display = 'none';
            zoomCard.classList.remove('wii-zooming');
            zoomCard.innerHTML = '';
            showView('library');
        }, 580);
    }

    // ==================== SPARKLES ====================
    function createSparkles() {
        const container = $('#sparkleContainer');
        if (!container) return;
        for (let i = 0; i < 6; i++) {
            const s = document.createElement('div');
            s.className = 'sparkle';
            const size = 6 + Math.random() * 8;
            s.style.width = size + 'px';
            s.style.height = size + 'px';
            s.style.left = Math.random() * 100 + '%';
            s.style.top = Math.random() * 100 + '%';
            s.innerHTML = '<div class="sparkle-core"></div>';
            s.style.animation = `sparkleAnim ${2 + Math.random() * 3}s ${Math.random() * 6}s ease-in-out infinite`;
            container.appendChild(s);
        }
    }

    // ==================== TWINKLING STARS ====================
    function createStars() {
        const container = $('#starContainer');
        if (!container) return;
        for (let i = 0; i < 8; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            const size = 6 + Math.random() * 10;
            star.style.width = size + 'px';
            star.style.height = size + 'px';
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 50 + '%';
            star.style.animation = `twinkle ${2 + Math.random() * 4}s ${Math.random() * 5}s ease-in-out infinite`;
            container.appendChild(star);
        }
    }

    // ==================== PRISMATIC BANDS ====================
    function createPrismaticBands() {
        const body = document.body;
        for (let i = 0; i < 2; i++) {
            const band = document.createElement('div');
            band.className = 'prismatic-band';
            band.style.top = (15 + Math.random() * 60) + '%';
            band.style.left = '0';
            band.style.right = '0';
            band.style.animationDuration = (12 + Math.random() * 15) + 's';
            band.style.animationDelay = (Math.random() * 10) + 's';
            body.appendChild(band);
        }
    }

    // ==================== GLOW ORBS ====================
    function createGlowOrbs() {
        const body = document.body;
        const orbColors = ['rgba(134,239,172,0.3)', 'rgba(59,130,246,0.25)', 'rgba(168,85,247,0.2)', 'rgba(236,72,153,0.2)', 'rgba(6,182,212,0.25)'];
        for (let i = 0; i < 2; i++) {
            const orb = document.createElement('div');
            orb.className = 'glow-orb';
            const size = 100 + Math.random() * 200;
            orb.style.width = size + 'px';
            orb.style.height = size + 'px';
            orb.style.left = Math.random() * 100 + '%';
            orb.style.top = Math.random() * 100 + '%';
            orb.style.background = orbColors[i % orbColors.length];
            orb.style.animation = `orbPulse ${8 + Math.random() * 10}s ${Math.random() * 8}s ease-in-out infinite`;
            body.appendChild(orb);
        }
    }

    // ==================== FLOATING PETALS ====================
    function createPetals() {
        const body = document.body;
        for (let i = 0; i < 3; i++) {
            const petal = document.createElement('div');
            petal.className = 'petal';
            const size = 8 + Math.random() * 10;
            petal.style.width = size + 'px';
            petal.style.height = size * 1.4 + 'px';
            petal.style.left = Math.random() * 100 + '%';
            petal.style.top = '-' + (size * 1.4 + 10) + 'px';
            petal.innerHTML = '<div class="petal-shape"></div>';
            petal.style.animation = `petalFall ${14 + Math.random() * 14}s ${Math.random() * 18}s linear infinite`;
            body.appendChild(petal);
        }
    }

    // ==================== CORNER LIGHT STREAKS ====================
    function createCornerStreaks() {
        const body = document.body;
        ['tl', 'tr', 'bl', 'br'].forEach(pos => {
            const el = document.createElement('div');
            el.className = 'corner-streak corner-streak--' + pos;
            body.appendChild(el);
        });
    }

    // ==================== BUTTERFLIES ====================
    function createButterflies() {
        const container = $('#butterflyContainer');
        if (!container) return;
        const colors = [
            ['rgba(59,130,246,0.5)', 'rgba(96,165,250,0.4)'],
            ['rgba(236,72,153,0.45)', 'rgba(244,114,182,0.35)'],
            ['rgba(139,92,246,0.4)', 'rgba(167,139,250,0.35)'],
            ['rgba(16,185,129,0.45)', 'rgba(52,211,153,0.35)'],
            ['rgba(251,191,36,0.4)', 'rgba(252,211,77,0.3)'],
        ];
        for (let i = 0; i < 3; i++) {
            const b = document.createElement('div');
            b.className = 'butterfly';
            const size = 14 + Math.random() * 10;
            b.style.width = (size * 2) + 'px';
            b.style.height = size + 'px';
            b.style.left = (-50 - Math.random() * 100) + 'px';
            b.style.top = (10 + Math.random() * 50) + '%';
            const c = colors[i % colors.length];
            b.innerHTML = `<div class="butterfly-body">
                <div class="butterfly-wing butterfly-wing--left" style="width:${size}px;height:${size}px;background:radial-gradient(circle at 60% 40%,${c[0]},${c[1]});"></div>
                <div class="butterfly-wing butterfly-wing--right" style="width:${size}px;height:${size}px;background:radial-gradient(circle at 40% 40%,${c[0]},${c[1]});"></div>
            </div>`;
            b.style.animation = `butterflyFly ${15 + Math.random() * 20}s ${Math.random() * 15}s ease-in-out infinite`;
            container.appendChild(b);
        }
    }

    // ==================== SWIMMING FISH ====================
    function createFish() {
        const container = $('#fishContainer');
        if (!container) return;
        const fishEmojis = ['\u{1F41F}', '\u{1F420}', '\u{1F421}', '\u{1F419}', '\u{1FAB8}'];
        for (let i = 0; i < 3; i++) {
            const fish = document.createElement('div');
            fish.className = 'fish';
            fish.textContent = fishEmojis[i % fishEmojis.length];
            fish.style.fontSize = (16 + Math.random() * 12) + 'px';
            fish.style.left = '0';
            fish.style.bottom = (5 + Math.random() * 20) + '%';
            fish.style.animation = (i % 2 === 0 ? 'fishSwim' : 'fishSwimReverse') +
                ` ${18 + Math.random() * 20}s ${Math.random() * 15}s linear infinite`;
            container.appendChild(fish);
        }
    }

    // ==================== AURORA BOREALIS BANDS ====================
    function createAuroraBands() {
        const container = $('#auroraBandContainer');
        if (!container) return;
        for (let i = 1; i <= 3; i++) {
            const band = document.createElement('div');
            band.className = 'aurora-band aurora-band--' + i;
            container.appendChild(band);
        }
    }

    // ==================== WATER SHIMMER ====================
    function createWaterShimmer() {
        const shimmer = document.createElement('div');
        shimmer.className = 'water-shimmer';
        document.body.appendChild(shimmer);
    }

    // ==================== 3D CAROUSEL ====================
    const CAROUSEL_CONSOLES = ['nes', 'snes', 'n64', 'genesis', 'ps1', 'psp', 'gb'];
    let carouselIdx = 0;
    let carouselTimer = null;

    function buildCarousel() {
        const ring = $('#carouselRing');
        const dots = $('#carouselDots');
        if (!ring || !dots) return;
        ring.innerHTML = '';
        dots.innerHTML = '';
        const n = CAROUSEL_CONSOLES.length;
        const step = 360 / n;

        CAROUSEL_CONSOLES.forEach((id, i) => {
            const c = CONSOLES[id];
            const item = document.createElement('div');
            item.className = 'carousel-item';
            item.style.transform = `rotateY(${i * step}deg) translateZ(340px)`;
            item.dataset.console = id;
            item.innerHTML = `
                <div class="carousel-face">
                    <span class="c-emoji">${c.emoji}</span>
                    <div class="c-name">${c.name}</div>
                    <div class="c-info">${c.info}</div>
                    <span class="c-tag" style="background:${c.color};color:${c.textColor}">${c.tag}</span>
                </div>`;
            item.addEventListener('click', (e) => { e.stopPropagation(); wiiZoomToConsole(item, id); });
            ring.appendChild(item);

            const dot = document.createElement('div');
            dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
            dot.addEventListener('click', () => { setCarousel(i); resetCarouselTimer(); });
            dots.appendChild(dot);
        });
        setCarousel(0);
        startCarouselTimer();
    }

    function setCarousel(idx) {
        const ring = $('#carouselRing');
        if (!ring) return;
        const step = 360 / CAROUSEL_CONSOLES.length;
        carouselIdx = idx;
        ring.style.transform = `translateZ(-340px) rotateY(${-idx * step}deg)`;
        $$('.carousel-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
    }

    function startCarouselTimer() {
        clearInterval(carouselTimer);
        carouselTimer = setInterval(() => {
            carouselIdx = (carouselIdx + 1) % CAROUSEL_CONSOLES.length;
            setCarousel(carouselIdx);
        }, 3200);
    }

    function resetCarouselTimer() { startCarouselTimer(); }

    $('#carouselPrev')?.addEventListener('click', () => {
        carouselIdx = (carouselIdx - 1 + CAROUSEL_CONSOLES.length) % CAROUSEL_CONSOLES.length;
        setCarousel(carouselIdx); resetCarouselTimer();
    });

    $('#carouselNext')?.addEventListener('click', () => {
        carouselIdx = (carouselIdx + 1) % CAROUSEL_CONSOLES.length;
        setCarousel(carouselIdx); resetCarouselTimer();
    });

    // ==================== VIEWS ====================
    function showView(id) {
        Object.values(views).forEach(v => v.classList.remove('active'));
        if (views[id]) views[id].classList.add('active');
        $$('.nav-item').forEach(n => n.classList.remove('active'));
        let nav = $(`.nav-item[data-view="${id}"]`);
        if (nav) nav.classList.add('active');
        const titles = { home: 'Home', library: 'Library', settings: 'Settings', emulator: 'Emulator', wiishop: 'Wii Shop', miimaker: 'Mii Maker' };
        $('#topbarTitle').textContent = titles[id] || 'Home';
        $('#topbarBreadcrumb').textContent = titles[id] || 'Home';
        let showEmu = id === 'emulator';
        $('#btnStartStop').style.display = showEmu ? '' : 'none';
        $('#btnReset').style.display = showEmu ? '' : 'none';
        if (id === 'settings') refreshSettingsData();
        closeSidebar();
    }

    // ==================== SIDEBAR ====================
    function openSidebar() { $('#sidebar').classList.add('open'); $('#sidebarOverlay').style.display = 'block'; }
    function closeSidebar() { $('#sidebar').classList.remove('open'); $('#sidebarOverlay').style.display = 'none'; }
    $('#mobileMenuBtn').addEventListener('click', openSidebar);
    $('#sidebarOverlay').addEventListener('click', closeSidebar);

    // ==================== NAVIGATION ====================
    $$('.nav-item[data-view]').forEach(item => {
        item.addEventListener('click', () => showView(item.dataset.view));
    });
    $$('.nav-item[data-console]').forEach(item => {
        item.addEventListener('click', () => {
            activeConsole = item.dataset.console;
            $$('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            let c = CONSOLES[activeConsole];
            if (c) { $('#topbarTitle').textContent = c.name; $('#topbarBreadcrumb').textContent = c.name; }
            showView('library');
        });
    });
    $$('.console-card, .featured-card').forEach(card => {
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            wiiZoomToConsole(card, card.dataset.console);
        });
    });

    // ==================== ROM LOADING ====================
    function openRomLoader() { romFileInput.click(); }
    $('#btnLoadRom').addEventListener('click', openRomLoader);
    $('#btnLoadRom2').addEventListener('click', openRomLoader);
    $('#uploadZone').addEventListener('click', openRomLoader);

    const uploadZone = $('#uploadZone');
    uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
    uploadZone.addEventListener('drop', e => {
        e.preventDefault(); uploadZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) loadRomFile(e.dataTransfer.files[0]);
    });

    romFileInput.addEventListener('change', e => {
        if (e.target.files.length) loadRomFile(e.target.files[0]);
        e.target.value = '';
    });

    function detectConsole(filename) {
        let ext = '.' + filename.split('.').pop().toLowerCase();
        for (let [id, info] of Object.entries(CONSOLES)) {
            if (info.exts.includes(ext)) return id;
        }
        return null;
    }

    function loadRomFile(file) {
        let consoleId = detectConsole(file.name);
        if (!consoleId) { showToast('Unknown ROM format: ' + file.name, 'error'); return; }
        activeConsole = consoleId;
        currentRomName = file.name.replace(/\.[^.]+$/, '');
        let reader = new FileReader();
        reader.onload = e => {
            let romData = new Uint8Array(e.target.result);
            startEmulator(consoleId, romData, file.name);
        };
        reader.readAsArrayBuffer(file);
    }

    function launchEmulatorJS(consoleId, romData, romName) {
        stopEmulator();
        activeConsole = consoleId;
        usingEmulatorJS = true;
        currentRomName = romName || 'Unknown';

        let blobUrl = URL.createObjectURL(new Blob([romData], { type: 'application/octet-stream' }));
        let c = CONSOLES[consoleId];
        canvas.width = c.width; canvas.height = c.height;

        addToLibrary(currentRomName, consoleId);
        $('#emuConsoleLabel').textContent = c.name;
        $('#emuRomLabel').textContent = currentRomName;
        showView('emulator');

        canvas.style.display = 'none';
        let ejsContainer = $('#ejsContainer');
        ejsContainer.style.display = 'block';
        ejsContainer.innerHTML = '';
        const bezel = $('.emulator-bezel');
        if (bezel) bezel.classList.remove('canvas-mode');

        let iframe = document.createElement('iframe');
        iframe.style.cssText = 'width:100%;height:100%;border:none;border-radius:8px;';
        iframe.allow = 'autoplay; fullscreen';

        let gameNameClean = currentRomName.replace(/[^a-zA-Z0-9]/g, '_');
        iframe.src = 'n64-player.html?rom=' + encodeURIComponent(blobUrl) + '&name=' + encodeURIComponent(gameNameClean);

        ejsContainer.appendChild(iframe);

        running = true;
        $('#emuStatusDot').classList.add('on');
        $('#emuStatusLabel').textContent = 'Running (EmulatorJS)';
        $('#btnStartStop').innerHTML = '&#9646;&#9646; Pause';
        showToast('Loaded: ' + currentRomName + ' (EmulatorJS)', 'success');
    }

    function startEmulator(consoleId, romData, romName) {
        stopEmulator();
        activeConsole = consoleId;

        function initEmu() {
            let emu = createEmulator(consoleId);
            if (!emu) { showToast('Console not available', 'error'); return; }
            try { emu.loadROM(romData); } catch (err) { showToast('Load failed: ' + err.message, 'error'); return; }

            activeEmulator = emu;
            currentRomName = romName || 'Unknown';
            let c = CONSOLES[consoleId];
            canvas.width = c.width; canvas.height = c.height;
            const bezel = $('.emulator-bezel');
            if (bezel) bezel.classList.add('canvas-mode');

            addToLibrary(currentRomName, consoleId);
            $('#emuConsoleLabel').textContent = c.name;
            $('#emuRomLabel').textContent = currentRomName;
            showView('emulator');

            running = true; lastTime = performance.now(); fpsTime = lastTime; framesThisSec = 0;
            $('#emuStatusDot').classList.add('on');
            $('#emuStatusLabel').textContent = 'Running';
            $('#btnStartStop').innerHTML = '&#9646;&#9646; Pause';
            showToast('Loaded: ' + currentRomName, 'success');
            renderLoop();
        }

        if (consoleId === 'n64') {
            launchEmulatorJS('n64', romData, romName);
        } else if (window.loadEmuScript && window._emuLoadMap?.[consoleId]) {
            window.loadEmuScript(consoleId).then(initEmu).catch(() => showToast('Failed to load emulator', 'error'));
        } else {
            initEmu();
        }
    }

    function createEmulator(id) {
        switch (id) {
            case 'nes': return new NES();
            case 'snes': return new SNES();
            case 'n64': return new N64();
            case 'gb': return new GameBoy();
            case 'genesis': return new Genesis();
            case 'ps1': return new PS1();
            case 'psp': return new PSP();
            default: return null;
        }
    }

    function stopEmulator() {
        running = false;
        if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
        if (usingEmulatorJS) {
            let ejsContainer = $('#ejsContainer');
            if (ejsContainer) { ejsContainer.innerHTML = ''; ejsContainer.style.display = 'none'; }
            canvas.style.display = '';
            const bezel = $('.emulator-bezel');
            if (bezel) bezel.classList.add('canvas-mode');
            usingEmulatorJS = false;
        }
        activeEmulator = null;
        $('#emuStatusDot').classList.remove('on');
        $('#emuStatusLabel').textContent = 'Stopped';
        $('#btnStartStop').innerHTML = '&#9654; Start';
    }

    function resetEmulator() {
        if (usingEmulatorJS) {
            showToast('Reset not available for EmulatorJS — reload the ROM', 'info');
            return;
        }
        if (!activeEmulator || !activeConsole) return;
        stopEmulator();
        let romData = activeEmulator.romData || activeEmulator.mapper?.rom || activeEmulator.rom;
        if (romData) {
            try { activeEmulator.loadROM(romData); } catch(e) { activeEmulator.reset?.(); }
            running = true; lastTime = performance.now(); fpsTime = lastTime; framesThisSec = 0;
            $('#emuStatusDot').classList.add('on');
            $('#emuStatusLabel').textContent = 'Running';
            $('#btnStartStop').innerHTML = '&#9646;&#9646; Pause';
            renderLoop();
        }
    }

    // ==================== RENDER LOOP ====================
    const imgCache = {};

    function renderLoop() {
        if (!running || (!activeEmulator && !usingEmulatorJS)) return;
        if (usingEmulatorJS) return;
        let now = performance.now();
        let elapsed = now - lastTime;
        let targetMs = 1000 / (60 * speed);
        if (elapsed >= targetMs * 0.8) {
            lastTime = now;
            let frames = Math.min(4, Math.max(1, Math.round(elapsed / targetMs)));
            for (let f = 0; f < frames; f++) activeEmulator.frame();

            let w = canvas.width, h = canvas.height;
            let key = w + 'x' + h;
            if (!imgCache[key]) imgCache[key] = ctx.createImageData(w, h);
            let imgData = imgCache[key];

            let pixels = activeEmulator.pixels
                || activeEmulator.ppu?.pixels
                || activeEmulator.rdp?.pixels
                || null;

            if (pixels) {
                let buf32 = new Uint32Array(imgData.data.buffer);
                let len = Math.min(w * h, pixels.length);
                for (let i = 0; i < len; i++) {
                    let p = pixels[i];
                    buf32[i] = 0xFF000000 | (((p >> 16) & 0xFF) << 16) | ((p & 0xFF) << 16) | (p & 0xFF00);
                }
            }
            ctx.putImageData(imgData, 0, 0);
            framesThisSec += frames;
        }
        if (now - fpsTime >= 1000) {
            $('#emuFps').textContent = framesThisSec + ' FPS';
            framesThisSec = 0; fpsTime = now;
        }
        animFrameId = requestAnimationFrame(renderLoop);
    }

    // ==================== CONTROLS ====================
    const KEY_MAP = {
        'ArrowUp': 'Up', 'ArrowDown': 'Down', 'ArrowLeft': 'Left', 'ArrowRight': 'Right',
        'KeyX': 'A', 'KeyZ': 'B', 'Enter': 'Start',
        'ShiftLeft': 'Select', 'ShiftRight': 'Select',
    };

    document.addEventListener('keydown', e => {
        let m = KEY_MAP[e.code];
        if (m) { e.preventDefault(); keys[m] = 1; updateControllers(); }
        if (e.code === 'Space') { e.preventDefault(); $('#btnStartStop').click(); }
    });
    document.addEventListener('keyup', e => {
        let m = KEY_MAP[e.code];
        if (m) { keys[m] = 0; updateControllers(); }
    });

    function updateControllers() {
        if (!activeEmulator) return;
        let nesKeys = { A: keys.A, B: keys.B, Select: keys.Select, Start: keys.Start, Up: keys.Up, Down: keys.Down, Left: keys.Left, Right: keys.Right };
        if (activeConsole === 'nes' || activeConsole === 'snes') activeEmulator.setController?.(1, nesKeys);
        else if (activeConsole === 'gb') activeEmulator.setKeys?.({ right: keys.Right, left: keys.Left, up: keys.Up, down: keys.Down, a: keys.A, b: keys.B, start: keys.Start, select: keys.Select });
        else if (activeConsole === 'genesis') activeEmulator.setController?.(1, { a: keys.A, b: keys.B, c: keys.A, start: keys.Start, up: keys.Up, down: keys.Down, left: keys.Left, right: keys.Right });
        else if (activeConsole === 'ps1') activeEmulator.setController?.(1, { cross: keys.A, circle: keys.B, select: keys.Select, start: keys.Start, up: keys.Up, down: keys.Down, left: keys.Left, right: keys.Right, l1: 0, r1: 0, l2: 0, r2: 0, triangle: 0, square: 0 });
        else if (activeConsole === 'psp') activeEmulator.setController?.(1, { cross: keys.A, circle: keys.B, select: keys.Select, start: keys.Start, up: keys.Up, down: keys.Down, left: keys.Left, right: keys.Right, l: 0, r: 0, triangle: 0, square: 0 });
    }

    // ==================== BUTTONS ====================
    $('#btnStartStop').addEventListener('click', () => {
        if (usingEmulatorJS) {
            if (running) {
                running = false;
                $('#emuStatusDot').classList.remove('on');
                $('#emuStatusLabel').textContent = 'Paused';
                $('#btnStartStop').innerHTML = '&#9654; Resume';
                showToast('Use EmulatorJS controls to pause/resume', 'info');
            } else {
                running = true;
                $('#emuStatusDot').classList.add('on');
                $('#emuStatusLabel').textContent = 'Running (EmulatorJS)';
                $('#btnStartStop').innerHTML = '&#9646;&#9646; Pause';
            }
            return;
        }
        if (running) {
            running = false;
            if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
            $('#emuStatusDot').classList.remove('on');
            $('#emuStatusLabel').textContent = 'Paused';
            $('#btnStartStop').innerHTML = '&#9654; Resume';
        } else if (activeEmulator) {
            running = true; lastTime = performance.now(); fpsTime = lastTime;
            $('#emuStatusDot').classList.add('on');
            $('#emuStatusLabel').textContent = 'Running';
            $('#btnStartStop').innerHTML = '&#9646;&#9646; Pause';
            renderLoop();
        }
    });

    $('#btnReset').addEventListener('click', resetEmulator);
    $('#emuBtnStart').addEventListener('click', () => $('#btnStartStop').click());
    $('#emuBtnStop').addEventListener('click', () => { stopEmulator(); showView('home'); });
    $('#emuBtnReset').addEventListener('click', resetEmulator);
    $('#emuBtnBack').addEventListener('click', () => { stopEmulator(); showView('home'); });

    $('#emuBtnFullscreen').addEventListener('click', () => {
        if (usingEmulatorJS) {
            let iframe = $('#ejsContainer')?.querySelector('iframe');
            if (iframe && iframe.contentDocument) {
                let fsEl = iframe.contentDocument.querySelector('.ejs_parent') || iframe;
                if (fsEl.requestFullscreen) fsEl.requestFullscreen();
            }
            return;
        }
        let el = views.emulator;
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    });

    $('#emuBtnScreenshot').addEventListener('click', () => {
        if (usingEmulatorJS) {
            showToast('Screenshot available via EmulatorJS toolbar', 'info');
            return;
        }
        let link = document.createElement('a');
        link.download = (currentRomName || 'screenshot') + '.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('Screenshot saved', 'success');
    });

    $('#speedSlider').addEventListener('input', e => {
        speed = parseFloat(e.target.value);
        $('#speedVal').textContent = speed + 'x';
    });

    // ==================== LIBRARY ====================
    function addToLibrary(name, consoleId) {
        if (!gameLibrary.find(g => g.name === name && g.console === consoleId)) {
            gameLibrary.push({ name, console: consoleId });
            renderLibrary();
            renderShopGrid(wiishopCategory);
        }
    }

    function renderLibrary(filter = 'all') {
        let grid = $('#gamesGrid');
        let items = filter === 'all' ? gameLibrary : gameLibrary.filter(g => g.console === filter);
        let empty = $('#libEmpty');
        grid.querySelectorAll('.game-card').forEach(c => c.remove());
        if (items.length === 0) { empty.style.display = ''; return; }
        empty.style.display = 'none';
        items.forEach(game => {
            let c = CONSOLES[game.console];
            let card = document.createElement('div');
            card.className = 'game-card';
            card.innerHTML = `
                <div class="game-card-art" style="background:${c?.color || '#f1f5f9'}">${game.name.charAt(0).toUpperCase()}</div>
                <div class="game-card-info">
                    <div class="game-card-title">${game.name}</div>
                    <div class="game-card-console">${c?.name || game.console}</div>
                </div>`;
            card.addEventListener('click', () => showToast('Load the ROM file to play ' + game.name, 'info'));
            grid.appendChild(card);
        });
        $('#libCount').textContent = gameLibrary.length;
    }

    $$('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderLibrary(btn.dataset.filter);
        });
    });

    // ==================== SETTINGS ====================
    $$('.toggle').forEach(t => t.addEventListener('click', () => t.classList.toggle('on')));
    $('#btnKeyMap').addEventListener('click', () => $('#keyMapModal').classList.toggle('show'));
    $('#modalClose').addEventListener('click', () => $('#keyMapModal').classList.remove('show'));
    $('#keyMapModal').addEventListener('click', e => { if (e.target === e.currentTarget) e.target.classList.remove('show'); });

    function refreshSettingsData() {
        const acctCount = Object.keys(JSON.parse(localStorage.getItem('aerocade_accounts') || '{}')).length;
        const romCount = gameLibrary.length;
        const editCount = JSON.parse(localStorage.getItem('aerocade_shop_edits') || '[]').filter(e => e.videoUrl || e.bg || e.emoji).length;
        const acctEl = document.getElementById('dataAcctCount');
        const romEl = document.getElementById('dataRomCount');
        const editEl = document.getElementById('dataEditCount');
        if (acctEl) acctEl.textContent = acctCount;
        if (romEl) romEl.textContent = romCount;
        if (editEl) editEl.textContent = editCount;
    }

    document.getElementById('btnClearData')?.addEventListener('click', () => {
        if (!confirm('This will clear ALL saved accounts, Miis, ROMs, and shop edits. Are you sure?')) return;
        if (!confirm('Really clear everything? This cannot be undone.')) return;
        localStorage.removeItem('aerocade_accounts');
        localStorage.removeItem('aerocade_session');
        localStorage.removeItem('aerocade_shop_edits');
        gameLibrary.length = 0;
        renderLibrary();
        renderShopGrid('all');
        refreshSettingsData();
        if (window._aeroAcct) window._aeroAcct.updateAdminUI();
        document.getElementById('sidebarUser').style.display = 'none';
        showToast('All data cleared.', 'info');
    });

    // ==================== TOAST ====================
    function showToast(msg, type = 'info') {
        let toast = document.createElement('div');
        toast.className = 'toast ' + type;
        toast.textContent = msg;
        $('#toastContainer').appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px) scale(0.96)';
            toast.style.transition = '0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ==================== WII SHOP ====================
    const SHOP_GAMES = [
        { name: 'Super Mario Bros.', console: 'nes', emoji: '\u{1F34E}', color: '#fee2e2', accent: '#dc2626', bg: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', price: 500, desc: 'The game that defined a generation. Run, jump, and save the Mushroom Kingdom!', rating: 'E', year: 1985, videoUrl: 'https://www.youtube.com/watch?v=FGxOQJqYdm0' },
        { name: 'The Legend of Zelda', console: 'nes', emoji: '\u{1F6E1}', color: '#d1fae5', accent: '#059669', bg: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)', price: 500, desc: 'Explore Hyrule, find 8 Triforce pieces, and defeat Ganon.', rating: 'E', year: 1986, videoUrl: 'https://www.youtube.com/watch?v=X63hDkfm4S0' },
        { name: 'Metroid', console: 'nes', emoji: '\u{1F47E}', color: '#dbeafe', accent: '#2563eb', bg: 'linear-gradient(135deg, #0c0c1d, #1a1a3e, #2d1b69)', price: 500, desc: 'Bounty hunter Samus Aran explores planet Zebes alone.', rating: 'E', year: 1986, videoUrl: 'https://www.youtube.com/watch?v=pO1AVJvKRRM' },
        { name: 'Mega Man 2', console: 'nes', emoji: '\u{1F916}', color: '#dbeafe', accent: '#2563eb', bg: 'linear-gradient(135deg, #141e30, #243b55)', price: 500, desc: 'Defeat 8 Robot Masters and take their powers!', rating: 'E', year: 1988, videoUrl: 'https://www.youtube.com/watch?v=cKzGNg6zGZs' },
        { name: 'Castlevania', console: 'nes', emoji: '\u{1F3DB}', color: '#e0e7ff', accent: '#4338ca', bg: 'linear-gradient(135deg, #1a0000, #3d0000, #5c0000)', price: 500, desc: 'Storm Dracula\'s castle as the legendary Belmont.', rating: 'E', year: 1986, videoUrl: 'https://www.youtube.com/watch?v=Rsw4G8MBnGk' },
        { name: 'Contra', console: 'nes', emoji: '\u{1F3AF}', color: '#fee2e2', accent: '#dc2626', bg: 'linear-gradient(135deg, #1b1b2f, #162447, #1f4068)', price: 500, desc: 'Classic run-and-gun action with a friend!', rating: 'E', year: 1987, videoUrl: 'https://www.youtube.com/watch?v=i3lWUc0qKXc' },
        { name: 'Super Mario World', console: 'snes', emoji: '\u{1F34E}', color: '#f3e8ff', accent: '#7c3aed', bg: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)', price: 800, desc: 'Yoshi\'s Island awaits! Ride Yoshi through 96 levels.', rating: 'E', year: 1990, videoUrl: 'https://www.youtube.com/watch?v=0bMklG5ZnBY' },
        { name: 'The Legend of Zelda: ALTTP', console: 'snes', emoji: '\u{1F6E1}', color: '#d1fae5', accent: '#059669', bg: 'linear-gradient(135deg, #0d1117, #161b22, #21262d)', price: 800, desc: 'The best top-down Zelda. Explore two parallel worlds.', rating: 'E', year: 1991, videoUrl: 'https://www.youtube.com/watch?v=Pq3kxjwZqH4' },
        { name: 'Super Metroid', console: 'snes', emoji: '\u{1F47E}', color: '#e0e7ff', accent: '#4338ca', bg: 'linear-gradient(135deg, #0a0a1a, #1a0a2e, #2a1a3e)', price: 800, desc: 'Atmospheric masterpiece on planet Zebes.', rating: 'E', year: 1994, videoUrl: 'https://www.youtube.com/watch?v=tNHH7zTbXe0' },
        { name: 'Chrono Trigger', console: 'snes', emoji: '\u{269B}', color: '#fef3c7', accent: '#d97706', bg: 'linear-gradient(135deg, #141e30, #243b55, #2c5364)', price: 800, desc: 'Time-travel RPG perfection by the Dream Team.', rating: 'E', year: 1995, videoUrl: 'https://www.youtube.com/watch?v=6bHvIUMtS8Y' },
        { name: 'Final Fantasy VI', console: 'snes', emoji: '\u{2728}', color: '#fce7f3', accent: '#db2777', bg: 'linear-gradient(135deg, #232526, #414345)', price: 800, desc: 'Kefka threatens to destroy the world. 14 playable characters.', rating: 'E', year: 1994, videoUrl: 'https://www.youtube.com/watch?v=sRqFBNWqHWw' },
        { name: 'Donkey Kong Country', console: 'snes', emoji: '\u{1F43C}', color: '#ffedd5', accent: '#ea580c', bg: 'linear-gradient(135deg, #1a1a00, #2d2d00, #4a4a00)', price: 800, desc: 'Pre-rendered 3D graphics were revolutionary in 1994.', rating: 'E', year: 1994, videoUrl: 'https://www.youtube.com/watch?v=dBWsR7T3N64' },
        { name: 'Super Mario 64', console: 'n64', emoji: '\u{1F34E}', color: '#dbeafe', accent: '#2563eb', bg: 'linear-gradient(135deg, #667eea, #764ba2)', price: 1000, desc: 'The game that defined 3D platforming forever.', rating: 'E', year: 1996, videoUrl: 'https://www.youtube.com/watch?v=SwVUz119v2g' },
        { name: 'The Legend of Zelda: OoT', console: 'n64', emoji: '\u{1F6E1}', color: '#d1fae5', accent: '#059669', bg: 'linear-gradient(135deg, #134e5e, #71b280)', price: 1000, desc: 'The greatest adventure of all time. Save Hyrule from Ganondorf.', rating: 'E', year: 1998, videoUrl: 'https://www.youtube.com/watch?v=1orY1rHM8Mo' },
        { name: 'Mario Kart 64', console: 'n64', emoji: '\u{1F3CE}', color: '#fee2e2', accent: '#dc2626', bg: 'linear-gradient(135deg, #c31432, #240b36)', price: 1000, desc: 'Blue shells and friendship destroyers since 1996.', rating: 'E', year: 1996, videoUrl: 'https://www.youtube.com/watch?v=AyKv0Y1gOcM' },
        { name: 'GoldenEye 007', console: 'n64', emoji: '\u{1F52B}', color: '#fef3c7', accent: '#d97706', bg: 'linear-gradient(135deg, #1c1c1c, #2d2d2d, #3a3a3a)', price: 1000, desc: 'The FPS that proved console shooters work.', rating: 'T', year: 1997, videoUrl: 'https://www.youtube.com/watch?v=x2s5E8R7yXo' },
        { name: 'Star Fox 64', console: 'n64', emoji: '\u{1F680}', color: '#e0e7ff', accent: '#4338ca', bg: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)', price: 1000, desc: 'Do a barrel roll! On-rails space combat.', rating: 'E', year: 1997, videoUrl: 'https://www.youtube.com/watch?v=S5tO_4rB7t4' },
        { name: 'Banjo-Kazooie', console: 'n64', emoji: '\u{1F43B}', color: '#ffedd5', accent: '#ea580c', bg: 'linear-gradient(135deg, #56ab2f, #a8e063)', price: 1000, desc: 'Bear and bird duo collect jiggies in magical worlds.', rating: 'E', year: 1998, videoUrl: 'https://www.youtube.com/watch?v=V7Jmg4bR0wE' },
        { name: 'Pok\u00E9mon Red', console: 'gb', emoji: '\u{1F534}', color: '#fee2e2', accent: '#dc2626', bg: 'linear-gradient(135deg, #8b0000, #c0392b, #e74c3c)', price: 400, desc: 'Gotta catch \'em all! Start your journey as a Pok\u00E9mon trainer.', rating: 'E', year: 1996, videoUrl: 'https://www.youtube.com/watch?v=2t4Mx1O3b1g' },
        { name: 'Pok\u00E9mon Blue', console: 'gb', emoji: '\u{1F535}', color: '#dbeafe', accent: '#2563eb', bg: 'linear-gradient(135deg, #000428, #004e92)', price: 400, desc: 'The blue counterpart. Trade to complete your Pok\u00E9dex!', rating: 'E', year: 1996, videoUrl: 'https://www.youtube.com/watch?v=2t4Mx1O3b1g' },
        { name: 'The Legend of Zelda: LA', console: 'gb', emoji: '\u{1F6E1}', color: '#d1fae5', accent: '#059669', bg: 'linear-gradient(135deg, #2c3e50, #4ca1af)', price: 400, desc: 'Link washes up on Koholint Island. Was it all a dream?', rating: 'E', year: 1993, videoUrl: 'https://www.youtube.com/watch?v=sKjRbW9qHJc' },
        { name: 'Tetris', console: 'gb', emoji: '\u{1F9E9}', color: '#f3e8ff', accent: '#7c3aed', bg: 'linear-gradient(135deg, #fc5c7d, #6a82fb)', price: 400, desc: 'The most addictive puzzle game ever made.', rating: 'E', year: 1989, videoUrl: 'https://www.youtube.com/watch?v=dIYbKjH0xOo' },
        { name: 'Super Mario Land', console: 'gb', emoji: '\u{1F34E}', color: '#fef3c7', accent: '#d97706', bg: 'linear-gradient(135deg, #4e54c8, #8f94fb)', price: 400, desc: 'Mario\'s portable debut adventure in Sarasaland.', rating: 'E', year: 1989, videoUrl: 'https://www.youtube.com/watch?v=L3wKlS1P1hI' },
        { name: 'Sonic the Hedgehog', console: 'genesis', emoji: '\u{1F3AC}', color: '#dbeafe', accent: '#2563eb', bg: 'linear-gradient(135deg, #1e3c72, #2a5298)', price: 600, desc: 'Blast through Green Hill Zone at supersonic speed!', rating: 'E', year: 1991, videoUrl: 'https://www.youtube.com/watch?v=aRvfgHqJ6fM' },
        { name: 'Sonic the Hedgehog 2', console: 'genesis', emoji: '\u{1F3AC}', color: '#d1fae5', accent: '#059669', bg: 'linear-gradient(135deg, #11998e, #38ef7d)', price: 600, desc: 'Meet Tails! The definitive 16-bit platformer.', rating: 'E', year: 1992, videoUrl: 'https://www.youtube.com/watch?v=g8X9WJ2rODc' },
        { name: 'Streets of Rage 2', console: 'genesis', emoji: '\u{1F44A}', color: '#fee2e2', accent: '#dc2626', bg: 'linear-gradient(135deg, #b92b27, #1565c0)', price: 600, desc: 'The best beat \'em up on any console. Incredible Yuzo Koshiro soundtrack.', rating: 'T', year: 1992, videoUrl: 'https://www.youtube.com/watch?v=k8kIeKqKf8Y' },
        { name: 'Golden Axe', console: 'genesis', emoji: '\u2694', color: '#ffedd5', accent: '#ea580c', bg: 'linear-gradient(135deg, #3a1c71, #d76d77, #ffaf7b)', price: 600, desc: 'Hack, slash, and ride dragons through a fantasy world.', rating: 'T', year: 1991, videoUrl: 'https://www.youtube.com/watch?v=0Z2fK8sYqD4' },
        { name: 'Phantasy Star IV', console: 'genesis', emoji: '\u{1F30C}', color: '#e0e7ff', accent: '#4338ca', bg: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)', price: 600, desc: 'Epic sci-fi RPG with comic-panel cutscenes.', rating: 'T', year: 1993, videoUrl: 'https://www.youtube.com/watch?v=qJ7tE2VbWnI' },
        { name: 'Crash Bandicoot', console: 'ps1', emoji: '\u{1F34A}', color: '#ffedd5', accent: '#ea580c', bg: 'linear-gradient(135deg, #f12711, #f5af19)', price: 1200, desc: 'Spin through Wumpa Island and stop Dr. Neo Cortex!', rating: 'E', year: 1996, videoUrl: 'https://www.youtube.com/watch?v=MN82XzV0R7k' },
        { name: 'Final Fantasy VII', console: 'ps1', emoji: '\u2728', color: '#dbeafe', accent: '#2563eb', bg: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)', price: 1200, desc: 'Cloud Strife vs Sephiroth. The JRPG that changed everything.', rating: 'T', year: 1997, videoUrl: 'https://www.youtube.com/watch?v=8yQm3cW8kRg' },
        { name: 'Spyro the Dragon', console: 'ps1', emoji: '\u{1F409}', color: '#f3e8ff', accent: '#7c3aed', bg: 'linear-gradient(135deg, #5b247a, #1bcedf)', price: 1200, desc: 'Glide and flame your way through 5 magical worlds.', rating: 'E', year: 1998, videoUrl: 'https://www.youtube.com/watch?v=pFEzY7yNt4A' },
        { name: 'Metal Gear Solid', console: 'ps1', emoji: '\u{1F5E1}', color: '#d1fae5', accent: '#059669', bg: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)', price: 1200, desc: 'Tactical espionage action. Snake? Snaaake!', rating: 'M', year: 1998, videoUrl: 'https://www.youtube.com/watch?v=qJzU8DhA4xY' },
    ];

    let wiishopCategory = 'all';
    let wiishopAudioCtx = null;
    let wiishopMusicPlaying = false;
    let wiishopMusicNodes = [];

    function renderShopGrid(filter) {
        wiishopCategory = filter || 'all';
        const grid = $('#wiishopGrid');
        if (!grid) return;
        const games = wiishopCategory === 'all' ? SHOP_GAMES : SHOP_GAMES.filter(g => g.console === wiishopCategory);
        grid.innerHTML = games.map((g, i) => {
            const c = CONSOLES[g.console];
            const loaded = gameLibrary.find(l => l.name === g.name);
            const runningGame = loaded && running && activeConsole === g.console;
            let btnClass = 'get', btnText = 'Get';
            if (runningGame) { btnClass = 'playing'; btnText = 'Playing'; }
            else if (loaded) { btnClass = 'loaded'; btnText = 'Loaded'; }
            return `<div class="wiishop-card" data-console="${g.console}" data-name="${g.name}" data-idx="${i}" style="animation-delay:${i * 0.04}s">
                <div class="wiishop-card-art" style="background:${g.bg}">
                    <span class="wiishop-cover-emoji">${g.emoji}</span>
                    <div class="wiishop-cover-title">${g.name}</div>
                    <div class="wiishop-cover-badge">${g.rating}</div>
                    <div class="wiishop-cover-year">${g.year}</div>
                    <div class="wiishop-cover-shine"></div>
                </div>
                <div class="wiishop-card-body">
                    <div class="wiishop-card-name">${g.name}</div>
                    <div class="wiishop-card-console">${c ? c.name : g.console} &middot; ${g.desc.split('.')[0]}</div>
                    <div class="wiishop-card-bottom">
                        <span class="wiishop-card-price">${g.price.toLocaleString()}</span>
                        <button class="wiishop-card-btn ${btnClass}" data-console="${g.console}" data-name="${g.name}">${btnText}</button>
                    </div>
                </div>
            </div>`;
        }).join('');

        grid.querySelectorAll('.wiishop-card-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const con = btn.dataset.console;
                if (btn.classList.contains('loaded') || btn.classList.contains('playing')) {
                    activeConsole = con;
                    showView('library');
                    return;
                }
                activeConsole = con;
                romFileInput.accept = (CONSOLES[con]?.exts || []).join(',');
                romFileInput.click();
            });
        });

        grid.querySelectorAll('.wiishop-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const rect = card.getBoundingClientRect();
                const ripple = document.createElement('div');
                ripple.className = 'wiishop-card-ripple';
                ripple.style.left = (e.clientX - rect.left - 100) + 'px';
                ripple.style.top = (e.clientY - rect.top - 100) + 'px';
                card.appendChild(ripple);
                setTimeout(() => ripple.remove(), 600);

                const idx = parseInt(card.dataset.idx);
                openGameDetail(idx);
            });

            card.addEventListener('mouseenter', () => {
                const rect = card.getBoundingClientRect();
                for (let j = 0; j < 3; j++) {
                    const b = document.createElement('div');
                    b.className = 'wiishop-card-hover-bubble';
                    const size = 4 + Math.random() * 8;
                    b.style.width = size + 'px';
                    b.style.height = size + 'px';
                    b.style.left = (Math.random() * rect.width) + 'px';
                    b.style.bottom = '0';
                    b.style.background = 'radial-gradient(circle, rgba(33,150,243,0.3), transparent)';
                    card.appendChild(b);
                    setTimeout(() => b.remove(), 800);
                }
            });
        });
    }

    function openGameDetail(idx) {
        const g = SHOP_GAMES[idx];
        if (!g) return;
        const c = CONSOLES[g.console];
        const modal = $('#gameDetailModal');
        if (!modal) return;
        const loaded = gameLibrary.find(l => l.name === g.name);
        const runningGame = loaded && running && activeConsole === g.console;
        let btnClass = 'get', btnText = 'Get';
        if (runningGame) { btnClass = 'playing'; btnText = 'Playing'; }
        else if (loaded) { btnClass = 'loaded'; btnText = 'Loaded'; }

        let videoHtml = '';
        if (g.videoUrl) {
            let embedUrl = g.videoUrl;
            if (g.videoUrl.includes('youtu.be/')) {
                embedUrl = g.videoUrl.replace('youtu.be/', 'youtube.com/embed/');
            } else if (g.videoUrl.includes('youtube.com/watch')) {
                embedUrl = g.videoUrl.replace('watch?v=', 'embed/');
            }
            videoHtml = `<div class="gd-video-wrap"><iframe src="${embedUrl}" frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe></div>`;
        } else {
            videoHtml = `<div class="gd-video-placeholder">
                <div class="gd-video-icon">\u{1F3AC}</div>
                <p>No video preview available</p>
                <span>Video URL can be set in the game data</span>
            </div>`;
        }

        modal.querySelector('.gd-cover').style.background = g.bg;
        modal.querySelector('.gd-cover-emoji').textContent = g.emoji;
        modal.querySelector('.gd-cover-title').textContent = g.name;
        modal.querySelector('.gd-cover-badge').textContent = g.rating;
        modal.querySelector('.gd-cover-year').textContent = g.year;
        modal.querySelector('.gd-name').textContent = g.name;
        const consoleEl = modal.querySelector('.gd-console');
        consoleEl.textContent = (c ? c.name : g.console);
        consoleEl.setAttribute('data-cons', g.console);
        const pillEl = modal.querySelector('.gd-console-pill');
        if (pillEl) { pillEl.textContent = (c ? c.name : g.console); pillEl.setAttribute('data-cons', g.console); }
        modal.querySelector('.gd-desc').textContent = g.desc;
        modal.querySelector('.gd-price-val').textContent = g.price.toLocaleString();
        modal.querySelector('.gd-video-section').innerHTML = videoHtml;
        const actionBtn = modal.querySelector('.gd-action-btn');
        actionBtn.className = `gd-action-btn ${btnClass}`;
        actionBtn.textContent = btnText;
        actionBtn.dataset.console = g.console;
        actionBtn.dataset.name = g.name;

        modal.classList.add('show');
        modal.dataset.idx = idx;

        const gdAdminEdit = document.getElementById('gdAdminEdit');
        if (gdAdminEdit) gdAdminEdit.dataset.gameIdx = idx;
    }

    function closeGameDetail() {
        const modal = $('#gameDetailModal');
        if (modal) modal.classList.remove('show');
        const editModal = document.getElementById('gameEditModal');
        if (editModal) editModal.classList.remove('show');
    }

    document.addEventListener('click', e => {
        if (e.target.id === 'gameDetailModal' || e.target.closest('.gd-close')) closeGameDetail();
        if (e.target.id === 'gameEditModal') e.target.classList.remove('show');
    });

    document.addEventListener('click', e => {
        const actionBtn = e.target.closest('.gd-action-btn');
        if (!actionBtn) return;
        const con = actionBtn.dataset.console;
        if (actionBtn.classList.contains('loaded') || actionBtn.classList.contains('playing')) {
            closeGameDetail();
            activeConsole = con;
            showView('library');
            return;
        }
        activeConsole = con;
        romFileInput.accept = (CONSOLES[con]?.exts || []).join(',');
        closeGameDetail();
        romFileInput.click();
    });

    $('#wiishopCategories')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.wiishop-cat');
        if (!btn) return;
        $$('.wiishop-cat').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderShopGrid(btn.dataset.cat);
    });

    // ==================== JAZZY MUSIC (Web Audio API) ====================
    function createJazzyMusic() {
        if (wiishopAudioCtx) return;
        wiishopAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const ctx = wiishopAudioCtx;

        function playNote(freq, start, dur, gain, type) {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = type || 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
            g.gain.setValueAtTime(0, ctx.currentTime + start);
            g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.02);
            g.gain.setValueAtTime(gain, ctx.currentTime + start + dur - 0.05);
            g.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur);
            osc.connect(g).connect(ctx.destination);
            osc.start(ctx.currentTime + start);
            osc.stop(ctx.currentTime + start + dur);
            wiishopMusicNodes.push(osc);
        }

        function playChord(notes, start, dur, gain, type) {
            notes.forEach(f => playNote(f, start, dur, gain / notes.length, type));
        }

        const jazzChords = [
            [261.63, 329.63, 392.00, 466.16],
            [293.66, 369.99, 440.00, 523.25],
            [220.00, 277.18, 329.63, 415.30],
            [246.94, 311.13, 369.99, 466.16],
            [261.63, 311.13, 392.00, 466.16],
            [196.00, 246.94, 293.66, 369.99],
        ];

        const bassNotes = [130.81, 146.83, 110.00, 123.47, 130.81, 98.00];

        function scheduleLoop() {
            const chordDur = 0.8;
            const loopLen = jazzChords.length * chordDur;

            for (let rep = 0; rep < 100; rep++) {
                const offset = rep * loopLen;
                jazzChords.forEach((chord, i) => {
                    const t = offset + i * chordDur;
                    playChord(chord, t, chordDur - 0.05, 0.06, 'sine');
                    playNote(bassNotes[i], t, chordDur - 0.1, 0.1, 'triangle');
                    playNote(bassNotes[i] * 2, t + 0.05, chordDur * 0.4 - 0.05, 0.04, 'triangle');
                    if (Math.random() > 0.5) {
                        const melodyOffset = chordDur * 0.5;
                        const melodyNote = chord[Math.floor(Math.random() * chord.length)] * (Math.random() > 0.5 ? 2 : 1);
                        playNote(melodyNote, t + melodyOffset, chordDur * 0.3, 0.03, 'sine');
                    }
                });
            }

            setTimeout(() => {
                if (wiishopMusicPlaying) scheduleLoop();
            }, (loopLen * 95) * 1000);
        }

        scheduleLoop();
    }

    function stopJazzyMusic() {
        if (wiishopAudioCtx) {
            wiishopAudioCtx.close().catch(() => {});
            wiishopAudioCtx = null;
        }
        wiishopMusicNodes = [];
        wiishopMusicPlaying = false;
        const btn = $('#wiishopMusicBtn');
        if (btn) btn.innerHTML = '&#127925; Music: OFF';
    }

    $('#wiishopMusicBtn')?.addEventListener('click', () => {
        if (wiishopMusicPlaying) {
            stopJazzyMusic();
        } else {
            wiishopMusicPlaying = true;
            createJazzyMusic();
            const btn = $('#wiishopMusicBtn');
            if (btn) btn.innerHTML = '&#127925; Music: ON';
        }
    });

    // ==================== INIT ====================
    createBubbles();
    createClouds();
    createBokeh();
    createLeaves();
    createLensFlares();
    createWaterDrops();
    createLightRays();
    createRipples();
    createSparkles();
    createStars();
    createPrismaticBands();
    createGlowOrbs();
    createPetals();
    createCornerStreaks();
    createButterflies();
    createFish();
    createAuroraBands();
    createWaterShimmer();
    initParallax();
    initWiiCursor();
    init3DCard();
    buildCarousel();
    renderLibrary();
    renderShopGrid('all');
    showToast('Welcome! Load a ROM to begin.', 'info');
    initProfile();

/* ==================== PROFILE (Auth + Mii Maker) ==================== */
function initProfile() {
    const LS_KEY = 'aerocade_accounts';
    const SESSION_KEY = 'aerocade_session';

    const FACES = ['oval','round','long','angular','soft'];
    const SKINS = ['#fce7f3','#ffe4cc','#fcd34d','#f59e0b','#d4a574','#b08968','#92613e','#6b4423','#4a2c0f'];
    const HAIR_STYLES = ['none','short','medium','long','ponytail','bun','spiky','curly','mohawk','buzzcut'];
    const HAIR_COLORS = ['#1a1a2e','#78350f','#d97706','#ef4444','#8b5cf6','#ec4899','#f3f4f6','#fcd34d'];
    const EYE_SHAPES = ['normal','big','small','narrow','wide','sleepy','bright'];
    const EYE_COLORS = ['#1e293b','#2563eb','#059669','#78350f','#8b5cf6','#f97316'];
    const NOSE_SHAPES = ['small','medium','large','pointed','round','flat'];
    const MOUTH_SHAPES = ['smile','neutral','open','smirk','grin','pout'];
    const BROW_STYLES = ['normal','thick','thin','arched','flat','angry'];
    const GLASSES_SET = ['none','round','square','aviator','cat-eye','half-rim'];
    const HAT_SET = ['none','cap','beanie','tophat','headband','bow'];
    const SHIRT_COLORS = ['#4a5568','#dc2626','#2563eb','#059669','#d97706','#7c3aed','#ec4899','#1e293b','#f97316','#06b6d4'];
    const BODY_TYPES = ['normal','slim','wide','tall','short'];
    const BODY_COLORS = ['#4a5568','#2563eb','#dc2626','#059669','#1e293b'];
    const ACCESSORIES = ['none','earring','necklace','scarf','bowtie'];

    const DEFAULT_MII = {
        face: 'oval', skin: '#fce7f3', hair: 'short', hairColor: '#1a1a2e',
        eyeShape: 'normal', eyeColor: '#1e293b', nose: 'small', mouth: 'smile',
        brows: 'normal', glasses: 'none', hat: 'none', shirtColor: '#4a5568',
        bodyType: 'normal', bodyColor: '#4a5568', accessory: 'none'
    };

    let currentMii = { ...DEFAULT_MII };
    let activeTab = 'face';

    const TAB_ITEMS = {
        face: [
            { label: 'Face Shape', key: 'face', items: FACES },
            { label: 'Skin', key: 'skin', items: SKINS, color: true }
        ],
        hair: [
            { label: 'Style', key: 'hair', items: HAIR_STYLES },
            { label: 'Color', key: 'hairColor', items: HAIR_COLORS, color: true }
        ],
        eyes: [
            { label: 'Shape', key: 'eyeShape', items: EYE_SHAPES },
            { label: 'Color', key: 'eyeColor', items: EYE_COLORS, color: true }
        ],
        features: [
            { label: 'Nose', key: 'nose', items: NOSE_SHAPES },
            { label: 'Mouth', key: 'mouth', items: MOUTH_SHAPES },
            { label: 'Brows', key: 'brows', items: BROW_STYLES },
            { label: 'Glasses', key: 'glasses', items: GLASSES_SET }
        ],
        style: [
            { label: 'Hat', key: 'hat', items: HAT_SET },
            { label: 'Shirt', key: 'shirtColor', items: SHIRT_COLORS, color: true },
            { label: 'Body Type', key: 'bodyType', items: BODY_TYPES },
            { label: 'Body Color', key: 'bodyColor', items: BODY_COLORS, color: true },
            { label: 'Accessory', key: 'accessory', items: ACCESSORIES }
        ]
    };

    function getAccounts() { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
    function saveAccounts(a) { localStorage.setItem(LS_KEY, JSON.stringify(a)); }
    function getSession() { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    function saveSession(s) { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
    function clearSession() { localStorage.removeItem(SESSION_KEY); }
    function isAdmin() { const s = getSession(); return s && s.role === 'admin'; }

    function updateSidebarUser() {
        const s = getSession();
        const el = document.getElementById('sidebarUser');
        const miiEl = document.getElementById('sidebarUserMii');
        const nameEl = document.getElementById('sidebarUserName');
        const roleEl = document.getElementById('sidebarUserRole');
        if (!s) { el.style.display = 'none'; return; }
        el.style.display = 'flex';
        miiEl.innerHTML = renderMiiSvg(s.mii || DEFAULT_MII, 36, 42);
        miiEl.style.background = 'linear-gradient(180deg, #e3f2fd, #90caf9)';
        nameEl.textContent = s.username;
        roleEl.textContent = s.role === 'admin' ? '★ Admin' : 'Member';
        roleEl.style.color = s.role === 'admin' ? '#818cf8' : '';
    }

    function updateAdminUI() {
        const editBtn = document.getElementById('gdAdminEdit');
        if (editBtn) editBtn.style.display = isAdmin() ? 'block' : 'none';
    }

    // === SVG Mii Renderer (Wii-style 3D) ===
    let _miiUid = 0;
    function renderMiiSvg(mii, w, h) {
        w = w || 180; h = h || 220;
        const m = { ...DEFAULT_MII, ...mii };
        const uid = 'm' + (++_miiUid);
        const skin = m.skin;
        const shirt = m.shirtColor || m.bodyColor || '#4a5568';
        const hairC = m.hairColor;
        const browC = darken(hairC, 8);

        // Mii proportions: head is huge, body is small rounded blob
        const headCX = w / 2;
        const headCY = h * 0.34;
        const headRX = w * 0.28;
        const headRY = headRX * 1.05;
        const bodyW = w * 0.42;
        const bodyH = h * 0.28;
        const bodyX = headCX - bodyW / 2;
        const bodyY = h - bodyH - h * 0.03;

        // Neck area (skin color bridge between head and body)
        const neckTop = headCY + headRY - 6;
        const neckBot = bodyY + 4;

        let svg = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;
        svg += `<defs>`;
        // 3D head gradient - sphere-like shading
        svg += `<radialGradient id="${uid}sk" cx="38%" cy="32%" r="65%" fx="35%" fy="28%">`;
        svg += `<stop offset="0%" stop-color="${lighten(skin, 30)}"/>`;
        svg += `<stop offset="45%" stop-color="${lighten(skin, 10)}"/>`;
        svg += `<stop offset="100%" stop-color="${darken(skin, 8)}"/>`;
        svg += `</radialGradient>`;
        // 3D body gradient
        svg += `<linearGradient id="${uid}bd" x1="0" y1="0" x2="0" y2="1">`;
        svg += `<stop offset="0%" stop-color="${lighten(shirt, 12)}"/>`;
        svg += `<stop offset="60%" stop-color="${shirt}"/>`;
        svg += `<stop offset="100%" stop-color="${darken(shirt, 15)}"/>`;
        svg += `</linearGradient>`;
        // Hair highlight
        svg += `<linearGradient id="${uid}hr" x1="0.3" y1="0" x2="0.7" y2="1">`;
        svg += `<stop offset="0%" stop-color="${lighten(hairC, 18)}"/>`;
        svg += `<stop offset="100%" stop-color="${hairC}"/>`;
        svg += `</linearGradient>`;
        // Drop shadow filter
        svg += `<filter id="${uid}ds" x="-20%" y="-10%" width="140%" height="140%">`;
        svg += `<feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="rgba(0,0,0,0.18)"/>`;
        svg += `</filter>`;
        // Head inner shadow for 3D rim
        svg += `<radialGradient id="${uid}hs" cx="50%" cy="50%" r="50%">`;
        svg += `<stop offset="82%" stop-color="transparent"/>`;
        svg += `<stop offset="100%" stop-color="${darken(skin, 18)}" stop-opacity="0.25"/>`;
        svg += `</radialGradient>`;
        svg += `</defs>`;

        // === BODY (rounded trapezoid, 3D shaded) ===
        svg += `<path d="M${bodyX + bodyW * 0.15},${bodyY}`;
        svg += ` Q${bodyX},${bodyY + 8} ${bodyX + 2},${bodyY + bodyH * 0.7}`;
        svg += ` L${bodyX + 4},${bodyY + bodyH}`;
        svg += ` L${bodyX + bodyW - 4},${bodyY + bodyH}`;
        svg += ` L${bodyX + bodyW - 2},${bodyY + bodyH * 0.7}`;
        svg += ` Q${bodyX + bodyW},${bodyY + 8} ${bodyX + bodyW * 0.85},${bodyY}`;
        svg += ` Z" fill="url(#${uid}bd)" stroke="${darken(shirt, 20)}" stroke-width="0.8"/>`;
        // Shirt collar detail
        svg += `<path d="M${headCX - 6},${bodyY + 3} L${headCX},${bodyY + 10} L${headCX + 6},${bodyY + 3}" fill="none" stroke="${darken(shirt, 25)}" stroke-width="0.8" opacity="0.5"/>`;

        // === NECK (skin bridge) ===
        svg += `<ellipse cx="${headCX}" cy="${(neckTop + neckBot) / 2}" rx="12" ry="${(neckBot - neckTop) / 2 + 2}" fill="${darken(skin, 5)}"/>`;

        // === HEAD (3D sphere) ===
        // Head shadow on body
        svg += `<ellipse cx="${headCX}" cy="${neckTop + 4}" rx="${headRX * 0.8}" ry="6" fill="rgba(0,0,0,0.08)"/>`;
        // Main head sphere
        svg += `<ellipse cx="${headCX}" cy="${headCY}" rx="${headRX}" ry="${headRY}" fill="url(#${uid}sk)" filter="url(#${uid}ds)"/>`;
        // 3D rim shading overlay
        svg += `<ellipse cx="${headCX}" cy="${headCY}" rx="${headRX}" ry="${headRY}" fill="url(#${uid}hs)"/>`;
        // Specular highlight (shiny spot)
        svg += `<ellipse cx="${headCX - headRX * 0.18}" cy="${headCY - headRY * 0.28}" rx="${headRX * 0.22}" ry="${headRY * 0.15}" fill="white" opacity="0.28"/>`;
        // Subtle cheek blush
        svg += `<ellipse cx="${headCX - headRX * 0.55}" cy="${headCY + headRY * 0.25}" rx="8" ry="5" fill="#ffb3b3" opacity="0.2"/>`;
        svg += `<ellipse cx="${headCX + headRX * 0.55}" cy="${headCY + headRY * 0.25}" rx="8" ry="5" fill="#ffb3b3" opacity="0.2"/>`;

        // === HAIR (bold geometric Mii-style shapes) ===
        const hairW = headRX + 4;
        const hairTop = headCY - headRY;
        const hcx = headCX;
        const hairDefs = {
            none: '',
            short: `<path d="M${hcx - hairW},${headCY - headRY * 0.35} Q${hcx - hairW - 3},${hairTop - 10} ${hcx},${hairTop - 14} Q${hcx + hairW + 3},${hairTop - 10} ${hcx + hairW},${headCY - headRY * 0.35}" fill="url(#${uid}hr)" stroke="${darken(hairC, 15)}" stroke-width="0.5"/>`,
            medium: `<path d="M${hcx - hairW - 2},${headCY - headRY * 0.1} Q${hcx - hairW - 4},${hairTop - 14} ${hcx},${hairTop - 16} Q${hcx + hairW + 4},${hairTop - 14} ${hcx + hairW + 2},${headCY - headRY * 0.1} L${hcx + hairW - 5},${headCY + 6} Q${hcx + 20},${headCY - 2} ${hcx},${headCY - 4} Q${hcx - 20},${headCY - 2} ${hcx - hairW + 5},${headCY + 6} Z" fill="url(#${uid}hr)" stroke="${darken(hairC, 15)}" stroke-width="0.5"/>`,
            long: `<path d="M${hcx - hairW - 3},${headCY - headRY * 0.1} Q${hcx - hairW - 5},${hairTop - 14} ${hcx},${hairTop - 18} Q${hcx + hairW + 5},${hairTop - 14} ${hcx + hairW + 3},${headCY - headRY * 0.1} L${hcx + hairW + 5},${headCY + headRY * 0.8} Q${hcx + 30},${headCY + headRY * 0.4} ${hcx},${headCY + headRY * 0.35} Q${hcx - 30},${headCY + headRY * 0.4} ${hcx - hairW - 5},${headCY + headRY * 0.8} Z" fill="url(#${uid}hr)" stroke="${darken(hairC, 15)}" stroke-width="0.5"/>`,
            ponytail: `<path d="M${hcx - hairW},${headCY - headRY * 0.35} Q${hcx - hairW - 3},${hairTop - 10} ${hcx},${hairTop - 14} Q${hcx + hairW + 3},${hairTop - 10} ${hcx + hairW},${headCY - headRY * 0.35}" fill="url(#${uid}hr)" stroke="${darken(hairC, 15)}" stroke-width="0.5"/><path d="M${hcx + hairW - 8},${hairTop + 4} Q${hcx + hairW + 18},${hairTop + 10} ${hcx + hairW + 15},${headCY + headRY * 0.6} Q${hcx + hairW + 10},${headCY + headRY * 0.8} ${hcx + hairW},${headCY + headRY * 0.55}" fill="url(#${uid}hr)" stroke="${darken(hairC, 15)}" stroke-width="0.5"/>`,
            bun: `<path d="M${hcx - hairW},${headCY - headRY * 0.35} Q${hcx - hairW - 3},${hairTop - 10} ${hcx},${hairTop - 14} Q${hcx + hairW + 3},${hairTop - 10} ${hcx + hairW},${headCY - headRY * 0.35}" fill="url(#${uid}hr)" stroke="${darken(hairC, 15)}" stroke-width="0.5"/><circle cx="${hcx}" cy="${hairTop - 12}" r="12" fill="url(#${uid}hr)" stroke="${darken(hairC, 15)}" stroke-width="0.5"/>`,
            spiky: `<path d="M${hcx - hairW - 2},${headCY - headRY * 0.2} L${hcx - hairW + 5},${hairTop - 18} L${hcx - 22},${headCY - headRY * 0.5} L${hcx - 10},${hairTop - 28} L${hcx},${headCY - headRY * 0.45} L${hcx + 10},${hairTop - 28} L${hcx + 22},${headCY - headRY * 0.5} L${hcx + hairW - 5},${hairTop - 18} L${hcx + hairW + 2},${headCY - headRY * 0.2}" fill="url(#${uid}hr)" stroke="${darken(hairC, 15)}" stroke-width="0.5"/>`,
            curly: `<path d="M${hcx - hairW - 4},${headCY - headRY * 0.05} Q${hcx - hairW - 6},${hairTop - 12} ${hcx},${hairTop - 16} Q${hcx + hairW + 6},${hairTop - 12} ${hcx + hairW + 4},${headCY - headRY * 0.05}" fill="url(#${uid}hr)" stroke="${darken(hairC, 15)}" stroke-width="0.5"/><circle cx="${hcx - hairW + 8}" cy="${hairTop + 8}" r="10" fill="url(#${uid}hr)"/><circle cx="${hcx + hairW - 8}" cy="${hairTop + 8}" r="10" fill="url(#${uid}hr)"/><circle cx="${hcx - 18}" cy="${hairTop - 4}" r="11" fill="url(#${uid}hr)"/><circle cx="${hcx + 18}" cy="${hairTop - 4}" r="11" fill="url(#${uid}hr)"/><circle cx="${hcx}" cy="${hairTop - 12}" r="11" fill="url(#${uid}hr)"/>`,
            mohawk: `<path d="M${hcx - 7},${headCY - headRY * 0.3} Q${hcx - 9},${hairTop - 28} ${hcx},${hairTop - 35} Q${hcx + 9},${hairTop - 28} ${hcx + 7},${headCY - headRY * 0.3}" fill="url(#${uid}hr)" stroke="${darken(hairC, 15)}" stroke-width="0.5"/>`,
            buzzcut: `<path d="M${hcx - hairW + 2},${headCY - headRY * 0.38} Q${hcx - hairW - 1},${hairTop - 6} ${hcx},${hairTop - 8} Q${hcx + hairW + 1},${hairTop - 6} ${hcx + hairW - 2},${headCY - headRY * 0.38}" fill="url(#${uid}hr)" opacity="0.65" stroke="${darken(hairC, 15)}" stroke-width="0.3"/>`
        };
        svg += hairDefs[m.hair] || '';

        // === EYEBROWS (thick Mii-style arcs) ===
        const browGap = headRX * 0.42;
        const browY2 = headCY - headRY * 0.02;
        const browW2 = headRX * 0.32;
        const browDefs = {
            normal: `<path d="M${hcx - browGap - browW2},${browY2} Q${hcx - browGap},${browY2 - 6} ${hcx - browGap + browW2},${browY2}" fill="none" stroke="${browC}" stroke-width="2.5" stroke-linecap="round"/><path d="M${hcx + browGap - browW2},${browY2} Q${hcx + browGap},${browY2 - 6} ${hcx + browGap + browW2},${browY2}" fill="none" stroke="${browC}" stroke-width="2.5" stroke-linecap="round"/>`,
            thick: `<path d="M${hcx - browGap - browW2 - 1},${browY2 + 1} Q${hcx - browGap},${browY2 - 7} ${hcx - browGap + browW2 + 1},${browY2 + 1}" fill="${browC}"/><path d="M${hcx + browGap - browW2 - 1},${browY2 + 1} Q${hcx + browGap},${browY2 - 7} ${hcx + browGap + browW2 + 1},${browY2 + 1}" fill="${browC}"/>`,
            thin: `<path d="M${hcx - browGap - browW2},${browY2} Q${hcx - browGap},${browY2 - 5} ${hcx - browGap + browW2},${browY2}" fill="none" stroke="${browC}" stroke-width="1.2" stroke-linecap="round"/><path d="M${hcx + browGap - browW2},${browY2} Q${hcx + browGap},${browY2 - 5} ${hcx + browGap + browW2},${browY2}" fill="none" stroke="${browC}" stroke-width="1.2" stroke-linecap="round"/>`,
            arched: `<path d="M${hcx - browGap - browW2 - 1},${browY2 + 2} Q${hcx - browGap},${browY2 - 10} ${hcx - browGap + browW2 + 1},${browY2 + 2}" fill="none" stroke="${browC}" stroke-width="2" stroke-linecap="round"/><path d="M${hcx + browGap - browW2 - 1},${browY2 + 2} Q${hcx + browGap},${browY2 - 10} ${hcx + browGap + browW2 + 1},${browY2 + 2}" fill="none" stroke="${browC}" stroke-width="2" stroke-linecap="round"/>`,
            flat: `<line x1="${hcx - browGap - browW2}" y1="${browY2}" x2="${hcx - browGap + browW2}" y2="${browY2}" stroke="${browC}" stroke-width="3" stroke-linecap="round"/><line x1="${hcx + browGap - browW2}" y1="${browY2}" x2="${hcx + browGap + browW2}" y2="${browY2}" stroke="${browC}" stroke-width="3" stroke-linecap="round"/>`,
            angry: `<path d="M${hcx - browGap - browW2},${browY2 + 5} L${hcx - browGap + browW2},${browY2 - 3}" stroke="${browC}" stroke-width="2.5" stroke-linecap="round"/><path d="M${hcx + browGap - browW2},${browY2 - 3} L${hcx + browGap + browW2},${browY2 + 5}" stroke="${browC}" stroke-width="2.5" stroke-linecap="round"/>`
        };
        svg += browDefs[m.brows] || browDefs.normal;

        // === EYES (Mii-style: white oval + dark oval iris + specular dot) ===
        const eyeGap = headRX * 0.34;
        const eyeY2 = headCY + headRY * 0.08;
        const eyeDefs = {
            normal: (ex, ey) => {
                const ew = 7, eh = 8;
                return `<ellipse cx="${ex}" cy="${ey}" rx="${ew}" ry="${eh}" fill="white" stroke="#2d2d2d" stroke-width="0.8"/>` +
                    `<ellipse cx="${ex + 0.5}" cy="${ey + 1}" rx="${ew * 0.55}" ry="${eh * 0.6}" fill="${m.eyeColor}"/>` +
                    `<ellipse cx="${ex + 0.5}" cy="${ey + 1}" rx="${ew * 0.35}" ry="${eh * 0.38}" fill="black"/>` +
                    `<circle cx="${ex + 2}" cy="${ey - 2}" r="2.2" fill="white" opacity="0.9"/>`;
            },
            big: (ex, ey) => {
                const ew = 9, eh = 10.5;
                return `<ellipse cx="${ex}" cy="${ey}" rx="${ew}" ry="${eh}" fill="white" stroke="#2d2d2d" stroke-width="0.8"/>` +
                    `<ellipse cx="${ex + 0.5}" cy="${ey + 1}" rx="${ew * 0.55}" ry="${eh * 0.58}" fill="${m.eyeColor}"/>` +
                    `<ellipse cx="${ex + 0.5}" cy="${ey + 1}" rx="${ew * 0.33}" ry="${eh * 0.36}" fill="black"/>` +
                    `<circle cx="${ex + 2.5}" cy="${ey - 2.5}" r="3" fill="white" opacity="0.9"/>`;
            },
            small: (ex, ey) => {
                const ew = 5, eh = 5.5;
                return `<ellipse cx="${ex}" cy="${ey}" rx="${ew}" ry="${eh}" fill="white" stroke="#2d2d2d" stroke-width="0.8"/>` +
                    `<ellipse cx="${ex + 0.3}" cy="${ey + 0.5}" rx="${ew * 0.55}" ry="${eh * 0.6}" fill="${m.eyeColor}"/>` +
                    `<ellipse cx="${ex + 0.3}" cy="${ey + 0.5}" rx="${ew * 0.32}" ry="${eh * 0.36}" fill="black"/>` +
                    `<circle cx="${ex + 1.5}" cy="${ey - 1}" r="1.5" fill="white" opacity="0.9"/>`;
            },
            narrow: (ex, ey) => {
                const ew = 8, eh = 4.5;
                return `<ellipse cx="${ex}" cy="${ey}" rx="${ew}" ry="${eh}" fill="white" stroke="#2d2d2d" stroke-width="0.8"/>` +
                    `<ellipse cx="${ex + 0.5}" cy="${ey}" rx="${ew * 0.45}" ry="${eh * 0.7}" fill="${m.eyeColor}"/>` +
                    `<ellipse cx="${ex + 0.5}" cy="${ey}" rx="${ew * 0.28}" ry="${eh * 0.5}" fill="black"/>` +
                    `<circle cx="${ex + 2}" cy="${ey - 1}" r="1.5" fill="white" opacity="0.9"/>`;
            },
            wide: (ex, ey) => {
                const ew = 10, eh = 11;
                return `<ellipse cx="${ex}" cy="${ey}" rx="${ew}" ry="${eh}" fill="white" stroke="#2d2d2d" stroke-width="0.8"/>` +
                    `<ellipse cx="${ex + 0.5}" cy="${ey + 1}" rx="${ew * 0.52}" ry="${eh * 0.56}" fill="${m.eyeColor}"/>` +
                    `<ellipse cx="${ex + 0.5}" cy="${ey + 1}" rx="${ew * 0.32}" ry="${eh * 0.35}" fill="black"/>` +
                    `<circle cx="${ex + 2.5}" cy="${ey - 3}" r="3.2" fill="white" opacity="0.9"/>`;
            },
            sleepy: (ex, ey) => {
                const ew = 7, eh = 6;
                return `<ellipse cx="${ex}" cy="${ey + 1}" rx="${ew}" ry="${eh}" fill="white" stroke="#2d2d2d" stroke-width="0.8"/>` +
                    `<ellipse cx="${ex}" cy="${ey + 2}" rx="${ew * 0.5}" ry="${eh * 0.5}" fill="${m.eyeColor}"/>` +
                    `<ellipse cx="${ex}" cy="${ey + 2}" rx="${ew * 0.3}" ry="${eh * 0.32}" fill="black"/>` +
                    `<path d="M${ex - ew - 1},${ey - 4} Q${ex},${ey - 6} ${ex + ew + 1},${ey - 3}" fill="none" stroke="#2d2d2d" stroke-width="1.5" stroke-linecap="round"/>` +
                    `<circle cx="${ex + 1.5}" cy="${ey - 1}" r="1.8" fill="white" opacity="0.9"/>`;
            },
            bright: (ex, ey) => {
                const ew = 8, eh = 9;
                return `<ellipse cx="${ex}" cy="${ey}" rx="${ew}" ry="${eh}" fill="white" stroke="#2d2d2d" stroke-width="0.8"/>` +
                    `<ellipse cx="${ex}" cy="${ey + 0.5}" rx="${ew * 0.55}" ry="${eh * 0.55}" fill="${m.eyeColor}"/>` +
                    `<ellipse cx="${ex}" cy="${ey + 0.5}" rx="${ew * 0.33}" ry="${eh * 0.35}" fill="black"/>` +
                    `<circle cx="${ex + 2}" cy="${ey - 2.5}" r="2.8" fill="white" opacity="0.95"/>` +
                    `<circle cx="${ex - 1.5}" cy="${ey + 2}" r="1.2" fill="white" opacity="0.5"/>`;
            }
        };
        const drawEye2 = eyeDefs[m.eyeShape] || eyeDefs.normal;
        svg += drawEye2(hcx - eyeGap, eyeY2);
        svg += drawEye2(hcx + eyeGap, eyeY2);

        // === NOSE (Mii-style: small simple shape) ===
        const noseY2 = eyeY2 + headRY * 0.24;
        const noseDefs = {
            small: `<ellipse cx="${hcx}" cy="${noseY2}" rx="3" ry="2.5" fill="${darken(skin, 15)}" opacity="0.55"/>`,
            medium: `<path d="M${hcx - 3.5},${noseY2 - 2} L${hcx},${noseY2 + 4} L${hcx + 3.5},${noseY2 - 2}" fill="none" stroke="${darken(skin, 18)}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`,
            large: `<ellipse cx="${hcx}" cy="${noseY2}" rx="5.5" ry="4.5" fill="${darken(skin, 12)}" opacity="0.45"/>`,
            pointed: `<path d="M${hcx},${noseY2 - 5} L${hcx - 3},${noseY2 + 3} L${hcx + 3},${noseY2 + 3} Z" fill="${darken(skin, 12)}" opacity="0.5"/>`,
            round: `<circle cx="${hcx}" cy="${noseY2}" r="4" fill="${darken(skin, 12)}" opacity="0.45"/>`,
            flat: `<line x1="${hcx - 3.5}" y1="${noseY2}" x2="${hcx + 3.5}" y2="${noseY2}" stroke="${darken(skin, 18)}" stroke-width="1.5" stroke-linecap="round"/>`
        };
        svg += noseDefs[m.nose] || noseDefs.small;

        // === MOUTH (Mii-style: simple curves) ===
        const mouthY2 = noseY2 + headRY * 0.28;
        const mw = headRX * 0.25;
        const mouthDefs = {
            smile: `<path d="M${hcx - mw},${mouthY2 - 1} Q${hcx},${mouthY2 + mw * 0.8} ${hcx + mw},${mouthY2 - 1}" fill="none" stroke="#d44" stroke-width="2" stroke-linecap="round"/>`,
            neutral: `<line x1="${hcx - mw}" y1="${mouthY2 + 1}" x2="${hcx + mw}" y2="${mouthY2 + 1}" stroke="#d44" stroke-width="2" stroke-linecap="round"/>`,
            open: `<ellipse cx="${hcx}" cy="${mouthY2 + 2}" rx="${mw * 0.9}" ry="${mw * 0.55}" fill="#c33"/><ellipse cx="${hcx}" cy="${mouthY2 + 1}" rx="${mw * 0.7}" ry="${mw * 0.35}" fill="#e55"/>`,
            smirk: `<path d="M${hcx - mw},${mouthY2 + 1} Q${hcx + 2},${mouthY2 + mw * 0.7} ${hcx + mw},${mouthY2 - 2}" fill="none" stroke="#d44" stroke-width="2" stroke-linecap="round"/>`,
            grin: `<path d="M${hcx - mw - 2},${mouthY2} Q${hcx},${mouthY2 + mw} ${hcx + mw + 2},${mouthY2}" fill="white" stroke="#d44" stroke-width="1.5"/><line x1="${hcx - mw}" y1="${mouthY2 + 0.5}" x2="${hcx + mw}" y2="${mouthY2 + 0.5}" stroke="#d44" stroke-width="0.8"/>`,
            pout: `<path d="M${hcx - mw},${mouthY2 + 4} Q${hcx},${mouthY2 - 2} ${hcx + mw},${mouthY2 + 4}" fill="none" stroke="#d44" stroke-width="2" stroke-linecap="round"/>`
        };
        svg += mouthDefs[m.mouth] || mouthDefs.smile;

        // === GLASSES (Mii-style thick frames) ===
        if (m.glasses !== 'none') {
            const gx = eyeGap;
            const gy = eyeY2;
            const ghw = headRX * 0.3;
            const ghh = headRY * 0.26;
            const gdefs = {
                round: `<circle cx="${hcx - gx}" cy="${gy}" r="${ghw}" fill="none" stroke="#2d2d2d" stroke-width="2.2"/><circle cx="${hcx + gx}" cy="${gy}" r="${ghw}" fill="none" stroke="#2d2d2d" stroke-width="2.2"/><line x1="${hcx - gx + ghw}" y1="${gy}" x2="${hcx + gx - ghw}" y2="${gy}" stroke="#2d2d2d" stroke-width="2"/>`,
                square: `<rect x="${hcx - gx - ghw}" y="${gy - ghh}" width="${ghw * 2}" height="${ghh * 2}" rx="3" fill="none" stroke="#2d2d2d" stroke-width="2.2"/><rect x="${hcx + gx - ghw}" y="${gy - ghh}" width="${ghw * 2}" height="${ghh * 2}" rx="3" fill="none" stroke="#2d2d2d" stroke-width="2.2"/><line x1="${hcx - gx + ghw}" y1="${gy}" x2="${hcx + gx - ghw}" y2="${gy}" stroke="#2d2d2d" stroke-width="2"/>`,
                aviator: `<path d="M${hcx - gx - ghw - 2},${gy - 2} Q${hcx - gx},${gy - ghh - 4} ${hcx - gx + ghw + 2},${gy - 2} Q${hcx - gx},${gy + ghh + 4} ${hcx - gx - ghw - 2},${gy - 2}" fill="none" stroke="#5c3a1a" stroke-width="2"/><path d="M${hcx + gx - ghw - 2},${gy - 2} Q${hcx + gx},${gy - ghh - 4} ${hcx + gx + ghw + 2},${gy - 2} Q${hcx + gx},${gy + ghh + 4} ${hcx + gx - ghw - 2},${gy - 2}" fill="none" stroke="#5c3a1a" stroke-width="2"/><line x1="${hcx - gx + ghw}" y1="${gy}" x2="${hcx + gx - ghw}" y2="${gy}" stroke="#5c3a1a" stroke-width="2"/>`,
                'cat-eye': `<path d="M${hcx - gx - ghw - 3},${gy + 2} L${hcx - gx - ghw + 2},${gy - ghh - 2} L${hcx - gx + ghw + 2},${gy - ghh} L${hcx - gx + ghw + 1},${gy + ghh}" fill="none" stroke="#2d2d2d" stroke-width="2.2"/><path d="M${hcx + gx + ghw + 3},${gy + 2} L${hcx + gx + ghw - 2},${gy - ghh - 2} L${hcx + gx - ghw - 2},${gy - ghh} L${hcx + gx - ghw - 1},${gy + ghh}" fill="none" stroke="#2d2d2d" stroke-width="2.2"/><line x1="${hcx - gx + ghw + 1}" y1="${gy}" x2="${hcx + gx - ghw - 1}" y2="${gy}" stroke="#2d2d2d" stroke-width="2"/>`,
                'half-rim': `<line x1="${hcx - gx - ghw}" y1="${gy}" x2="${hcx - gx + ghw}" y2="${gy}" stroke="#2d2d2d" stroke-width="2.5"/><path d="M${hcx - gx - ghw},${gy} Q${hcx - gx},${gy + ghh + 2} ${hcx - gx + ghw},${gy}" fill="none" stroke="#2d2d2d" stroke-width="1.5"/><line x1="${hcx + gx - ghw}" y1="${gy}" x2="${hcx + gx + ghw}" y2="${gy}" stroke="#2d2d2d" stroke-width="2.5"/><path d="M${hcx + gx - ghw},${gy} Q${hcx + gx},${gy + ghh + 2} ${hcx + gx + ghw},${gy}" fill="none" stroke="#2d2d2d" stroke-width="1.5"/><line x1="${hcx - gx + ghw}" y1="${gy}" x2="${hcx + gx - ghw}" y2="${gy}" stroke="#2d2d2d" stroke-width="2"/>`
            };
            svg += gdefs[m.glasses] || gdefs.round;
        }

        // === HAT (3D shaded Mii-style) ===
        if (m.hat !== 'none') {
            const hatDefs = {
                cap: `<path d="M${hcx - hairW - 5},${hairTop + 6} Q${hcx - hairW - 5},${hairTop - 16} ${hcx},${hairTop - 18} Q${hcx + hairW + 5},${hairTop - 16} ${hcx + hairW + 5},${hairTop + 6}" fill="#2563eb" stroke="#1d4ed8" stroke-width="0.8"/><ellipse cx="${hcx}" cy="${hairTop + 6}" rx="${hairW + 6}" ry="5" fill="#2563eb"/><rect x="${hcx + hairW - 6}" y="${hairTop - 2}" width="22" height="6" rx="3" fill="#1d4ed8"/>`,
                beanie: `<path d="M${hcx - hairW - 4},${hairTop + 8} Q${hcx - hairW - 6},${hairTop - 14} ${hcx},${hairTop - 18} Q${hcx + hairW + 6},${hairTop - 14} ${hcx + hairW + 4},${hairTop + 8}" fill="#dc2626" stroke="#b91c1c" stroke-width="0.8"/><ellipse cx="${hcx}" cy="${hairTop + 8}" rx="${hairW + 5}" ry="5" fill="#b91c1c"/><circle cx="${hcx}" cy="${hairTop - 18}" r="5" fill="#f5f5f5"/>`,
                tophat: `<rect x="${hcx - 24}" y="${hairTop - 42}" width="48" height="34" rx="4" fill="#1e293b" stroke="#0f172a" stroke-width="0.8"/><ellipse cx="${hcx}" cy="${hairTop - 8}" rx="${hairW + 8}" ry="5" fill="#1e293b"/><rect x="${hcx - 22}" y="${hairTop - 14}" width="44" height="6" rx="2" fill="#7c3aed"/>`,
                headband: `<rect x="${hcx - hairW - 5}" y="${hairTop + 4}" width="${(hairW + 5) * 2}" height="5" rx="2.5" fill="#ef4444" stroke="#dc2626" stroke-width="0.5"/>`,
                bow: `<path d="M${hcx},${hairTop + 2} Q${hcx - 12},${hairTop - 12} ${hcx - 20},${hairTop + 2} Q${hcx - 12},${hairTop + 10} ${hcx},${hairTop + 2}" fill="#ec4899" stroke="#be185d" stroke-width="0.5"/><path d="M${hcx},${hairTop + 2} Q${hcx + 12},${hairTop - 12} ${hcx + 20},${hairTop + 2} Q${hcx + 12},${hairTop + 10} ${hcx},${hairTop + 2}" fill="#ec4899" stroke="#be185d" stroke-width="0.5"/><circle cx="${hcx}" cy="${hairTop + 2}" r="2.5" fill="#be185d"/>`
            };
            svg += hatDefs[m.hat] || '';
        }

        // === ACCESSORIES ===
        if (m.accessory === 'earring') {
            svg += `<circle cx="${hcx - headRX - 3}" cy="${headCY + headRY * 0.35}" r="2.5" fill="#f5c542" stroke="#d4a017" stroke-width="0.5"/>`;
            svg += `<circle cx="${hcx + headRX + 3}" cy="${headCY + headRY * 0.35}" r="2.5" fill="#f5c542" stroke="#d4a017" stroke-width="0.5"/>`;
        } else if (m.accessory === 'necklace') {
            svg += `<path d="M${hcx - 14},${bodyY + 3} Q${hcx},${bodyY + 14} ${hcx + 14},${bodyY + 3}" fill="none" stroke="#f5c542" stroke-width="1.5"/>`;
            svg += `<circle cx="${hcx}" cy="${bodyY + 12}" r="2.5" fill="#f5c542" stroke="#d4a017" stroke-width="0.5"/>`;
        } else if (m.accessory === 'bowtie') {
            svg += `<path d="M${hcx},${bodyY + 1} L${hcx - 8},${bodyY - 4} L${hcx - 8},${bodyY + 6} Z" fill="#ef4444" stroke="#dc2626" stroke-width="0.5"/>`;
            svg += `<path d="M${hcx},${bodyY + 1} L${hcx + 8},${bodyY - 4} L${hcx + 8},${bodyY + 6} Z" fill="#ef4444" stroke="#dc2626" stroke-width="0.5"/>`;
            svg += `<circle cx="${hcx}" cy="${bodyY + 1}" r="2" fill="#dc2626"/>`;
        } else if (m.accessory === 'scarf') {
            svg += `<path d="M${hcx - 18},${bodyY + 1} Q${hcx},${bodyY + 10} ${hcx + 18},${bodyY + 1}" fill="#3b82f6" stroke="#2563eb" stroke-width="0.8"/>`;
            svg += `<rect x="${hcx - 3}" y="${bodyY + 5}" width="6" height="14" rx="2.5" fill="#3b82f6"/>`;
        }

        svg += '</svg>';
        return svg;
    }

    function lighten(hex, pct) {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.min(255, (num >> 16) + Math.round(2.55 * pct));
        const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(2.55 * pct));
        const b = Math.min(255, (num & 0xff) + Math.round(2.55 * pct));
        return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    }

    function darken(hex, pct) {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.max(0, (num >> 16) - Math.round(2.55 * pct));
        const g = Math.max(0, ((num >> 8) & 0xff) - Math.round(2.55 * pct));
        const b = Math.max(0, (num & 0xff) - Math.round(2.55 * pct));
        return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    }

    // === Render SVG into stage ===
    function renderStage() {
        const svgEl = document.getElementById('profileMiiSvg');
        if (svgEl) svgEl.innerHTML = renderMiiSvg(currentMii);
        const nameEl = document.getElementById('profileMiiDisplayName');
        if (nameEl) nameEl.textContent = document.getElementById('profileNameInput')?.value || 'Your Mii';
        const roleEl = document.getElementById('profileMiiRole');
        if (roleEl) {
            const s = getSession();
            roleEl.textContent = s ? (s.role === 'admin' ? '★ Admin' : 'Member') : '';
        }
    }

    // === Tab / Panel System ===
    function renderPanels() {
        const panels = document.getElementById('profilePanels');
        if (!panels) return;
        const defs = TAB_ITEMS[activeTab] || [];
        let html = '';
        defs.forEach(def => {
            html += `<div class="profile-panel-section"><div class="profile-panel-label">${def.label}</div><div class="profile-panel-row">`;
            def.items.forEach(item => {
                const val = currentMii[def.key];
                const isActive = val === item;
                if (def.color) {
                    html += `<div class="profile-color${isActive ? ' active' : ''}" data-key="${def.key}" data-val="${item}" style="background:${item}"></div>`;
                } else {
                    html += `<div class="profile-chip${isActive ? ' active' : ''}" data-key="${def.key}" data-val="${item}">${item === 'none' ? 'None' : item}</div>`;
                }
            });
            html += '</div></div>';
        });
        panels.innerHTML = html;

        panels.querySelectorAll('.profile-chip, .profile-color').forEach(el => {
            el.addEventListener('click', () => {
                currentMii[el.dataset.key] = el.dataset.val;
                renderStage();
                renderPanels();
            });
        });
    }

    function switchTab(tab) {
        activeTab = tab;
        document.querySelectorAll('.profile-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        renderPanels();
    }

    // === Saved Accounts Grid (reusable for auth + bottom) ===
    function renderSavedAccounts(containerId, showSwitch) {
        const el = document.getElementById(containerId);
        if (!el) return;
        const accounts = getAccounts();
        const session = getSession();
        const names = Object.keys(accounts);
        if (!names.length) { el.innerHTML = ''; return; }
        let html = '';
        names.forEach(name => {
            const a = accounts[name];
            const mii = { ...DEFAULT_MII, ...(a.mii || {}) };
            const isActive = session?.username === name;
            const roleLabel = a.role === 'admin' ? '★ Admin' : 'Member';
            html += `<div class="profile-saved-card${isActive ? ' active' : ''}" data-user="${name}">
                <div class="profile-saved-mini">${renderMiiSvg(mii, 40, 48)}</div>
                <div class="profile-saved-card-name">${name}</div>
                <div class="profile-saved-card-role">${roleLabel}</div>
                <button class="profile-saved-card-del" data-del="${name}">&times;</button>
            </div>`;
        });
        el.innerHTML = html;

        if (showSwitch) {
            el.querySelectorAll('.profile-saved-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    if (e.target.closest('.profile-saved-card-del')) return;
                    const name = card.dataset.user;
                    const a = accounts[name];
                    saveSession({ username: name, role: a.role, mii: a.mii });
                    currentMii = { ...DEFAULT_MII, ...(a.mii || {}) };
                    document.getElementById('profileNameInput').value = name;
                    showEditor();
                    renderStage();
                    renderPanels();
                    renderSavedAccounts('profileSavedGrid', true);
                    renderSavedAccounts('profileSavedGridBottom', false);
                    updateSidebarUser();
                    updateAdminUI();
                    showToast(`Switched to ${name}`, 'success');
                });
            });
        }

        el.querySelectorAll('.profile-saved-card-del').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const name = btn.dataset.del;
                if (!confirm(`Delete account "${name}"?`)) return;
                const accts = getAccounts();
                delete accts[name];
                saveAccounts(accts);
                const s = getSession();
                if (s?.username === name) clearSession();
                renderSavedAccounts('profileSavedGrid', true);
                renderSavedAccounts('profileSavedGridBottom', false);
                if (!getSession()) showAuth();
                updateSidebarUser();
                updateAdminUI();
                showToast(`Account "${name}" deleted.`, 'info');
            });
        });
    }

    function showAuth() {
        const auth = document.getElementById('profileAuth');
        const editor = document.getElementById('profileEditor');
        if (auth) auth.style.display = '';
        if (editor) editor.style.display = 'none';
        renderSavedAccounts('profileSavedGrid', true);
        const miiEl = document.getElementById('profileAuthMii');
        if (miiEl) miiEl.innerHTML = renderMiiSvg(DEFAULT_MII, 64, 64);
    }

    function showEditor() {
        const auth = document.getElementById('profileAuth');
        const editor = document.getElementById('profileEditor');
        if (auth) auth.style.display = 'none';
        if (editor) editor.style.display = '';
        const s = getSession();
        if (s) {
            document.getElementById('profileNameInput').value = s.username;
            currentMii = { ...DEFAULT_MII, ...(s.mii || {}) };
        }
        renderStage();
        renderPanels();
    }

    // === Auth Handlers ===
    document.getElementById('profileLoginBtn')?.addEventListener('click', () => {
        const u = document.getElementById('profileLoginUser').value.trim();
        const p = document.getElementById('profileLoginPass').value;
        const err = document.getElementById('profileAuthError');
        err.textContent = '';
        if (!u || !p) { err.textContent = 'Please fill in all fields.'; return; }
        const accounts = getAccounts();
        if (!accounts[u]) { err.textContent = 'Account not found.'; return; }
        if (accounts[u].password !== p) { err.textContent = 'Wrong password.'; return; }
        saveSession({ username: u, role: accounts[u].role, mii: accounts[u].mii });
        currentMii = { ...DEFAULT_MII, ...(accounts[u].mii || {}) };
        showEditor();
        updateSidebarUser();
        updateAdminUI();
        renderSavedAccounts('profileSavedGridBottom', false);
        showToast(`Welcome back, ${u}!`, 'success');
    });

    document.getElementById('profileRegBtn')?.addEventListener('click', () => {
        const u = document.getElementById('profileRegUser').value.trim();
        const p = document.getElementById('profileRegPass').value;
        const c = document.getElementById('profileRegConfirm').value;
        const err = document.getElementById('profileAuthError');
        err.textContent = '';
        if (!u || !p) { err.textContent = 'Please fill in all fields.'; return; }
        if (p.length < 4) { err.textContent = 'Password must be 4+ characters.'; return; }
        if (p !== c) { err.textContent = 'Passwords do not match.'; return; }
        const accounts = getAccounts();
        if (accounts[u]) { err.textContent = 'Username taken.'; return; }
        accounts[u] = { password: p, role: Object.keys(accounts).length === 0 ? 'admin' : 'member', mii: { ...DEFAULT_MII }, created: Date.now() };
        saveAccounts(accounts);
        saveSession({ username: u, role: accounts[u].role, mii: accounts[u].mii });
        currentMii = { ...DEFAULT_MII };
        showEditor();
        updateSidebarUser();
        updateAdminUI();
        renderSavedAccounts('profileSavedGridBottom', false);
        showToast(`Account created! Welcome, ${u}!`, 'success');
    });

    document.getElementById('profileShowReg')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('profileLoginForm').style.display = 'none';
        document.getElementById('profileRegForm').style.display = '';
        document.getElementById('profileAuthError').textContent = '';
    });

    document.getElementById('profileShowLogin')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('profileRegForm').style.display = 'none';
        document.getElementById('profileLoginForm').style.display = '';
        document.getElementById('profileAuthError').textContent = '';
    });

    // === Editor Handlers ===
    document.getElementById('profileTab')?.addEventListener('click', () => {}); // handled via delegation
    document.getElementById('profileTabs')?.addEventListener('click', (e) => {
        const tab = e.target.closest('.profile-tab');
        if (tab) switchTab(tab.dataset.tab);
    });

    document.getElementById('profileRandomBtn')?.addEventListener('click', () => {
        const pick = arr => arr[Math.floor(Math.random() * arr.length)];
        currentMii = {
            face: pick(FACES), skin: pick(SKINS), hair: pick(HAIR_STYLES),
            hairColor: pick(HAIR_COLORS), eyeShape: pick(EYE_SHAPES), eyeColor: pick(EYE_COLORS),
            nose: pick(NOSE_SHAPES), mouth: pick(MOUTH_SHAPES), brows: pick(BROW_STYLES),
            glasses: pick(GLASSES_SET), hat: pick(HAT_SET), shirtColor: pick(SHIRT_COLORS),
            bodyType: pick(BODY_TYPES), bodyColor: pick(BODY_COLORS), accessory: pick(ACCESSORIES)
        };
        renderStage();
        renderPanels();
        showToast('Random Mii generated!', 'info');
    });

    document.getElementById('profileSaveBtn')?.addEventListener('click', () => {
        const name = document.getElementById('profileNameInput')?.value.trim();
        if (!name) { showToast('Enter a name.', 'error'); return; }
        const accounts = getAccounts();
        const isNew = !accounts[name];
        const role = isNew ? (Object.keys(accounts).length === 0 ? 'admin' : 'member') : accounts[name].role;
        accounts[name] = { password: accounts[name]?.password || 'mii', role, mii: { ...currentMii } };
        saveAccounts(accounts);
        saveSession({ username: name, role, mii: { ...currentMii } });
        updateSidebarUser();
        updateAdminUI();
        renderSavedAccounts('profileSavedGrid', true);
        renderSavedAccounts('profileSavedGridBottom', false);
        showToast(isNew ? `Mii "${name}" created! (First account = Admin)` : `Mii "${name}" updated!`, 'success');
    });

    document.getElementById('profileSignOutBtn')?.addEventListener('click', () => {
        clearSession();
        showAuth();
        updateSidebarUser();
        showToast('Signed out.', 'info');
    });

    // === Sidebar Account Button ===
    document.getElementById('btnAccount')?.addEventListener('click', () => {
        switchView('viewMiiMaker');
    });

    // === Admin Game Edit (preserved from old system) ===
    const gdAdminEdit = document.getElementById('gdAdminEdit');
    if (gdAdminEdit) {
        gdAdminEdit.addEventListener('click', () => {
            if (!isAdmin()) return;
            const idx = gdAdminEdit.dataset.gameIdx;
            const game = SHOP_GAMES[idx];
            if (!game) return;
            document.getElementById('geVideoUrl').value = game.videoUrl || '';
            document.getElementById('geCoverBg').value = game.bg || '';
            document.getElementById('geCoverEmoji').value = game.emoji || '';
            document.getElementById('geDesc').value = game.desc || '';
            document.getElementById('gameEditModal').classList.add('show');
            document.getElementById('gameEditModal').dataset.gameIdx = idx;
        });
    }

    document.getElementById('geClose')?.addEventListener('click', () => {
        document.getElementById('gameEditModal').classList.remove('show');
    });

    document.getElementById('geSaveBtn')?.addEventListener('click', () => {
        const idx = document.getElementById('gameEditModal').dataset.gameIdx;
        const game = SHOP_GAMES[idx];
        if (!game) return;
        game.videoUrl = document.getElementById('geVideoUrl').value.trim();
        game.bg = document.getElementById('geCoverBg').value.trim() || game.bg;
        game.emoji = document.getElementById('geCoverEmoji').value.trim() || game.emoji;
        game.desc = document.getElementById('geDesc').value.trim() || game.desc;
        localStorage.setItem('aerocade_shop_edits', JSON.stringify(
            SHOP_GAMES.map(g => ({ name: g.name, videoUrl: g.videoUrl, bg: g.bg, emoji: g.emoji, desc: g.desc }))
        ));
        document.getElementById('gameEditModal').classList.remove('show');
        renderShopGrid(document.querySelector('.wiishop-cat.active')?.dataset.cat || 'all');
        showToast('Game updated!', 'success');
    });

    // Load saved admin edits
    (function loadShopEdits() {
        try {
            const saved = JSON.parse(localStorage.getItem('aerocade_shop_edits') || '[]');
            saved.forEach(s => {
                const g = SHOP_GAMES.find(x => x.name === s.name);
                if (g) Object.assign(g, s);
            });
        } catch(e) {}
    })();

    // Expose for other modules
    window._aeroAcct = { isAdmin, updateAdminUI, getSession };

    // === Initial render ===
    const session = getSession();
    if (session) {
        currentMii = { ...DEFAULT_MII, ...(session.mii || {}) };
        showEditor();
        renderSavedAccounts('profileSavedGridBottom', false);
    } else {
        showAuth();
    }
    updateSidebarUser();
    updateAdminUI();
}
})();
