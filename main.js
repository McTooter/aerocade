(() => {
    const $ = s => document.querySelector(s);
    const $$ = s => document.querySelectorAll(s);

    const canvas = $('#emulatorCanvas');
    const ctx = canvas.getContext('2d');
    const romFileInput = $('#romFileInput');
    const views = { home: $('#viewHome'), library: $('#viewLibrary'), settings: $('#viewSettings'), emulator: $('#viewEmulator') };

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
        for (let i = 0; i < 15; i++) {
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
        for (let i = 0; i < 6; i++) {
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
        for (let i = 0; i < 10; i++) {
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
        for (let i = 0; i < 8; i++) {
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
        for (let i = 0; i < 4; i++) {
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
        for (let i = 0; i < 12; i++) {
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
        for (let i = 0; i < 8; i++) {
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
        setInterval(spawnRipple, 2500);
        setTimeout(spawnRipple, 500);
        setTimeout(spawnRipple, 1200);
    }

    // ==================== MOUSE PARALLAX ====================
    function initParallax() {
        let ticking = false;
        document.addEventListener('mousemove', e => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                const cx = (e.clientX / window.innerWidth - 0.5) * 2;
                const cy = (e.clientY / window.innerHeight - 0.5) * 2;
                document.documentElement.style.setProperty('--parallax-x', (cx * 8) + 'px');
                document.documentElement.style.setProperty('--parallax-y', (cy * 6) + 'px');
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

        const style = document.createElement('style');
        style.textContent = `*, *::before, *::after { cursor: none !important; }`;
        document.head.appendChild(style);

        document.addEventListener('mousemove', e => {
            mx = e.clientX; my = e.clientY;
            if (!visible) {
                visible = true;
                cursor.style.opacity = '1';
                cursor.style.transition = 'opacity 0.3s ease';
            }
        });

        document.addEventListener('mouseleave', () => {
            visible = false;
            cursor.style.opacity = '0';
        });

        function tick() {
            curX += (mx - curX) * 0.25;
            curY += (my - curY) * 0.25;
            cursor.style.left = curX + 'px';
            cursor.style.top = curY + 'px';
            requestAnimationFrame(tick);
        }
        tick();

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
        for (let i = 0; i < 12; i++) {
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
        for (let i = 0; i < 20; i++) {
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
        for (let i = 0; i < 4; i++) {
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
        for (let i = 0; i < 5; i++) {
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
        for (let i = 0; i < 6; i++) {
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
        for (let i = 0; i < 6; i++) {
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
        for (let i = 0; i < 5; i++) {
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
        const titles = { home: 'Home', library: 'Library', settings: 'Settings', emulator: 'Emulator' };
        $('#topbarTitle').textContent = titles[id] || 'Home';
        $('#topbarBreadcrumb').textContent = titles[id] || 'Home';
        let showEmu = id === 'emulator';
        $('#btnStartStop').style.display = showEmu ? '' : 'none';
        $('#btnReset').style.display = showEmu ? '' : 'none';
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
            if (consoleId === 'n64') {
                launchEmulatorJS('n64', romData, file.name);
            } else {
                startEmulator(consoleId, romData, file.name);
            }
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
        let emu = createEmulator(consoleId);
        if (!emu) { showToast('Console not available', 'error'); return; }
        try { emu.loadROM(romData); } catch (err) { showToast('Load failed: ' + err.message, 'error'); return; }

        activeEmulator = emu;
        currentRomName = romName || 'Unknown';
        let c = CONSOLES[consoleId];
        canvas.width = c.width; canvas.height = c.height;

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
    showToast('Welcome! Load a ROM to begin.', 'info');
})();
