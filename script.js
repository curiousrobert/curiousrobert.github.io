/* ============================================================
   cursioustudio // interaction + animation engine (FINAL)
   ------------------------------------------------------------
   Fixes:
   - No horizontal shift on click / modal open: the scrollbar
     is always reserved via CSS, so JS never compensates.
   - Grid erase after intro: tiles visible by default, reveal
     state pinned with inline opacity — no path back to hidden.
   - Blurry card text: no hover scale, transforms cleared when
     idle, text layers snapped to whole pixels.
   - First project (01) links directly to project-template.html.
   - Red overlay full-size opacity-only + canvas crossfade.
   - Self-healing canvas sizing, per-tile isolation, double-init
     guard, reduced-motion support, CSP-friendly, no innerHTML.
   ============================================================ */

(function () {
    'use strict';

    document.documentElement.classList.add('js-anim');

    /* ---------- Data (frozen → cannot be mutated) ---------- */
    const RAW_PROJECTS = [
        { id: 1, title: 'KINETIC TYPE', category: '3D & Typography', client: 'Nike Lab', year: '2026', tools: 'Cinema 4D, Octane', speed: 1.5, pattern: 'waves' },
        { id: 2, title: 'NEON FLUIDS', category: 'VFX Simulation', client: 'Sony Music', year: '2025', tools: 'Houdini, Nuke', speed: 2.0, pattern: 'circles' },
        { id: 3, title: 'CYBER ARCH', category: 'Spatial Experience', client: 'Balenciaga', year: '2026', tools: 'Unreal Engine 5', speed: 1.2, pattern: 'grid' },
        { id: 4, title: 'CHRONO MOTION', category: 'Title Sequence', client: 'A24 Films', year: '2025', tools: 'After Effects', speed: 2.5, pattern: 'spiral' },
        { id: 5, title: 'ABSTRACT FORM', category: 'Brand Identity', client: 'Apple Vision', year: '2026', tools: 'Blender, Cycles', speed: 1.8, pattern: 'waves' },
        { id: 6, title: 'QUANTUM SHIFT', category: 'Commercial Spot', client: 'Porsche', year: '2025', tools: 'Houdini, Redshift', speed: 3.0, pattern: 'particles' },
        { id: 7, title: 'ORBITAL GLOW', category: 'Interactive Art', client: 'Tate Modern', year: '2026', tools: 'Three.js, WebGL', speed: 1.1, pattern: 'circles' },
        { id: 8, title: 'SYNTH PULSE', category: 'Music Video', client: 'Warner Records', year: '2025', tools: 'C4D, After Effects', speed: 2.2, pattern: 'spiral' },
        { id: 9, title: 'METAMORPH', category: 'VFX & CGI', client: 'Vogue Tech', year: '2026', tools: 'ZBrush, Houdini', speed: 1.7, pattern: 'particles' },
        { id: 10, title: 'ECHO MATRIX', category: 'Dynamic Identity', client: 'Spotify', year: '2025', tools: 'Processing, AE', speed: 2.4, pattern: 'grid' },
        { id: 11, title: 'PRISM SHADOW', category: 'Light Installation', client: 'MoMA', year: '2026', tools: 'TouchDesigner', speed: 1.3, pattern: 'waves' },
        { id: 12, title: 'AERO DYNAMICS', category: 'Product Film', client: 'Dyson', year: '2025', tools: 'Cinema 4D, Redshift', speed: 2.8, pattern: 'circles' },
        { id: 13, title: 'HYPER LOOP', category: 'Broadcast Package', client: 'HBO Max', year: '2026', tools: 'After Effects, C4D', speed: 1.9, pattern: 'spiral' },
        { id: 14, title: 'ZERO GRAVITY', category: 'Experimental 3D', client: 'SpaceX', year: '2026', tools: 'Unreal Engine 5', speed: 2.1, pattern: 'particles' }
    ];

    const PROJECTS = RAW_PROJECTS.map(p => Object.freeze({ ...p }));
    Object.freeze(PROJECTS);

    /* ---------- Constants ---------- */
    const MAX_DPR = 2;
    const REDUCED_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const FINE_POINTER = !!(window.matchMedia && window.matchMedia('(pointer: fine)').matches);
    const MAX_TILT = 7;
    const MAX_SHIFT = 12;
    const HOVER_SCALE = 1; // no upscaling → crisp text; tilt still gives depth
    const FORCE_REVEAL_MS = 1200;
    const SIZE_RETRY_MS = 400;
    const SIZE_MAX_ATTEMPTS = 15;

    /* ---------- Safe DOM helpers ---------- */
    function $(id) { return document.getElementById(id); }
    function pad2(n) { return String(n).padStart(2, '0'); }

    /* ---------- State (private) ---------- */
    const state = {
        initialized: false,
        tiles: [],
        canvasItems: [],
        canvasObservers: [],
        parallaxItems: [],
        sizingAttempts: 0,
        sizingTimer: null,
        openModalEl: null,
        lastFocused: null,
        animPlaying: false,
        animRaf: null,
        animLastTime: 0,
        modalRaf: null,
        revealForced: false,
    };

    /* ============================================================
       MODALS (open / close / focus management)
       ============================================================ */
    function getOpenModal() { return state.openModalEl; }

    /* Scroll-lock — NO padding compensation needed because the
       scrollbar is always reserved (CSS). This cannot shift the
       page horizontally. */
    function syncBodyScroll() {
        document.body.classList.toggle('overflow-hidden', Boolean(getOpenModal()));
    }

    function openModal(id) {
        const modal = $(id);
        if (!modal) return;
        state.lastFocused = document.activeElement;
        state.openModalEl = modal;
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        modal.removeAttribute('inert');
        syncBodyScroll();
        const autoFocusEl = modal.querySelector('[data-focus]');
        if (autoFocusEl) autoFocusEl.focus();
    }

    function closeModal(id) {
        const modal = $(id);
        if (!modal) return;
        const wasActive = modal.classList.contains('active');
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        modal.setAttribute('inert', '');
        if (state.openModalEl === modal) state.openModalEl = null;
        syncBodyScroll();
        if (wasActive && state.lastFocused && state.lastFocused.focus && modal.contains(document.activeElement)) {
            state.lastFocused.focus();
        }
    }

    function toggleModal(id) {
        const modal = $(id);
        if (!modal) return;
        modal.classList.contains('active') ? closeModal(id) : openModal(id);
    }

    function closeAllModals() {
        ['info-modal', 'contact-modal', 'project-modal'].forEach(closeModal);
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { closeAllModals(); return; }
        const modal = getOpenModal();
        if (!modal || e.key !== 'Tab') return;
        const focusables = Array.from(modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )).filter(el => !el.hasAttribute('disabled'));
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault(); first.focus();
        }
    });

    /* ============================================================
       TOAST
       ============================================================ */
    let toastTimer = null;

    function showToast(message) {
        const toast = $('toast');
        if (!toast) return;
        toast.textContent = String(message);
        toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-2');
        toast.classList.add('opacity-100');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-2');
        }, 3200);
    }

    /* ============================================================
       PREVIEW INDICATOR (text under the grid)
       ============================================================ */
    function setPreviewText(project, index) {
        const titleEl = $('preview-title');
        const nameEl = $('preview-name');
        if (titleEl) titleEl.textContent = `${project.category} // ${project.client}`;
        if (nameEl) nameEl.textContent = `${pad2(index + 1)} / ${PROJECTS.length} — ${project.title}`;
    }

    function resetPreviewText() {
        const titleEl = $('preview-title');
        const nameEl = $('preview-name');
        if (titleEl) titleEl.textContent = 'Hover over any square to preview project';
        if (nameEl) nameEl.textContent = `01 / ${PROJECTS.length} Interactive Work`;
    }

    /* ============================================================
       GRID RENDERING (DOM APIs only — no innerHTML)
       ============================================================ */
    function buildTile(project, index) {
        const tile = document.createElement('li');

        tile.className = [
            'tile group/tile relative aspect-square w-full overflow-hidden rounded-[4px]',
            'bg-studioBlue cursor-pointer',
            'hover:!z-30 focus-within:outline-none',
        ].join(' ');
        tile.style.animationDelay = `${Math.min(index * 70, 700)}ms`;

        /* --- generative motion canvas (crossfades OUT on hover) --- */
        const canvas = document.createElement('canvas');
        canvas.id = `canvas-${project.id}`;
        canvas.className = [
            'absolute inset-0 w-full h-full block will-change-transform',
            'opacity-[0.85] group-hover/tile:opacity-0 transition-opacity duration-300',
        ].join(' ');
        canvas.setAttribute('aria-hidden', 'true');

        /* --- index badge --- */
        const badge = document.createElement('div');
        badge.className = [
            'absolute top-2 left-2 text-[10px] font-mono text-white/80 tracking-widest z-10',
            'pointer-events-none will-change-transform group-hover/tile:opacity-0 transition-opacity duration-200',
        ].join(' ');
        badge.textContent = pad2(index + 1);

        /* --- full-area accessible button --- */
        const openBtn = document.createElement('button');
        openBtn.type = 'button';
        openBtn.className = [
            'absolute inset-0 z-10 w-full h-full bg-transparent cursor-pointer rounded-[4px]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2',
        ].join(' ');
        openBtn.setAttribute('aria-label', `Open project ${project.title}`);
        openBtn.dataset.openProject = String(project.id);

        /* --- red preview overlay: full-size, opacity-only reveal.
               It always covers the whole tile → blue never shows.
               NOTE: no will-change on text layers (blur source). --- */
        const preview = document.createElement('div');
        preview.className = [
            'absolute inset-0 z-20 flex flex-col justify-between p-5',
            'bg-studioRed text-white cursor-pointer',
            'opacity-0 pointer-events-none transition-opacity duration-300',
            'group-hover/tile:opacity-100 group-hover/tile:pointer-events-auto',
            'group-focus-within/tile:opacity-100 group-focus-within/tile:pointer-events-auto',
        ].join(' ');
        preview.dataset.openProject = String(project.id);

        const previewHead = document.createElement('div');
        const previewNum = document.createElement('span');
        previewNum.className = 'text-[10px] font-mono uppercase tracking-widest text-white/80';
        previewNum.textContent = `Project ${pad2(index + 1)}`;
        const previewTitle = document.createElement('h4');
        previewTitle.className = 'text-base font-bold leading-tight mt-0.5 text-white';
        previewTitle.textContent = project.title;
        const previewCat = document.createElement('p');
        previewCat.className = 'text-[11px] text-white/90 mt-1 line-clamp-2';
        previewCat.textContent = project.category;
        previewHead.append(previewNum, previewTitle, previewCat);

        const previewFoot = document.createElement('div');
        previewFoot.className = 'flex items-end justify-between mt-2 gap-2';

        const clientChip = document.createElement('span');
        clientChip.className = 'text-[10px] font-medium bg-black/20 px-2 py-0.5 rounded text-white/90 truncate';
        clientChip.textContent = project.client;

        const viewBtn = document.createElement('button');
        viewBtn.type = 'button';
        viewBtn.className = [
            'px-2.5 py-1 bg-white text-studioRed text-xs font-bold rounded',
            'hover:bg-slate-100 transition-colors shrink-0',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
        ].join(' ');
        viewBtn.textContent = 'View →';
        viewBtn.dataset.openProject = String(project.id);

        previewFoot.append(clientChip, viewBtn);
        preview.append(previewHead, previewFoot);
        tile.append(canvas, openBtn, badge, preview);

        /* --- element refs for parallax --- */
        tile._canvas = canvas;
        tile._badge = badge;
        tile._previewLayers = [previewHead, previewFoot];

        /* --- preview text updates --- */
        tile.addEventListener('mouseenter', () => setPreviewText(project, index));
        tile.addEventListener('mouseleave', resetPreviewText);
        tile.addEventListener('focusin', () => setPreviewText(project, index));
        tile.addEventListener('focusout', (e) => {
            if (!tile.contains(e.relatedTarget)) resetPreviewText();
        });

        /* --- ERASE-PROOF reveal completion:
               pin opacity 1 and free the animation so the parallax
               inline transform can take over. The tile can never
               fall back to a hidden state. --- */
        tile.addEventListener('animationend', () => {
            tile.classList.add('is-visible');
            tile.style.opacity = '1';
            tile.style.animation = 'none';
        }, { once: true });

        return tile;
    }

    /* ============================================================
       PARALLAX TILT ENGINE (smooth, rAF-lerped, blur-free)
       ============================================================ */
    function registerParallax(tile) {
        if (REDUCED_MOTION || !FINE_POINTER) return;

        const item = {
            el: tile,
            canvas: tile._canvas,
            badge: tile._badge,
            layers: tile._previewLayers,
            rx: 0, ry: 0, s: 1,
            trx: 0, try_: 0, ts: 1,
            shiftX: 0, shiftY: 0,
            tShiftX: 0, tShiftY: 0,
            active: false,
        };

        function updateFromEvent(e) {
            const r = item.el.getBoundingClientRect();
            if (!r.width || !r.height) return;
            const nx = (e.clientX - r.left) / r.width - 0.5;
            const ny = (e.clientY - r.top) / r.height - 0.5;
            item.trx = -ny * MAX_TILT;
            item.try_ = nx * MAX_TILT;
            item.tShiftX = -nx * MAX_SHIFT;
            item.tShiftY = -ny * MAX_SHIFT;
        }

        tile.addEventListener('mouseenter', (e) => {
            item.active = true;
            item.ts = HOVER_SCALE;
            updateFromEvent(e);
        });

        tile.addEventListener('mousemove', (e) => {
            if (item.active) updateFromEvent(e);
        });

        tile.addEventListener('mouseleave', () => {
            item.active = false;
            item.trx = 0;
            item.try_ = 0;
            item.ts = 1;
            item.tShiftX = 0;
            item.tShiftY = 0;
        });

        tile.addEventListener('focusin', () => { item.ts = HOVER_SCALE; });
        tile.addEventListener('focusout', () => { item.ts = 1; });

        state.parallaxItems.push(item);
    }

    function updateParallax() {
        if (!state.parallaxItems.length) return;
        const k = 0.14;
        const EPS = 0.05;

        for (const it of state.parallaxItems) {
            it.rx += (it.trx - it.rx) * k;
            it.ry += (it.try_ - it.ry) * k;
            it.s += (it.ts - it.s) * k;
            it.shiftX += (it.tShiftX - it.shiftX) * k;
            it.shiftY += (it.tShiftY - it.shiftY) * k;

            const idle = !it.active &&
                Math.abs(it.rx) < EPS && Math.abs(it.ry) < EPS &&
                Math.abs(it.s - 1) < EPS &&
                Math.abs(it.shiftX) < EPS && Math.abs(it.shiftY) < EPS;

            if (idle) {
                it.el.style.transform = '';
                if (it.canvas) it.canvas.style.transform = '';
                if (it.badge) it.badge.style.transform = '';
                for (const layer of it.layers) {
                    if (layer) layer.style.transform = '';
                }
                continue;
            }

            it.el.style.transform =
                `perspective(900px) rotateX(${it.rx.toFixed(2)}deg) rotateY(${it.ry.toFixed(2)}deg) scale(${it.s.toFixed(3)})`;

            const shallow = `translate3d(${it.shiftX.toFixed(1)}px, ${it.shiftY.toFixed(1)}px, 0)`;
            if (it.canvas) it.canvas.style.transform = shallow;
            if (it.badge) it.badge.style.transform = shallow;

            const deep = `translate3d(${Math.round(it.shiftX * -0.6)}px, ${Math.round(it.shiftY * -0.6)}px, 0)`;
            for (const layer of it.layers) {
                if (layer) layer.style.transform = deep;
            }
        }
    }

    /* ============================================================
       CANVAS SIZING (responsive + self-healing)
       ============================================================ */
    function fitTileCanvas(item) {
        try {
            const rect = item.canvas.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return false;
            const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
            const w = Math.round(rect.width * dpr);
            const h = Math.round(rect.height * dpr);
            if (w === item.canvas.width && h === item.canvas.height) return true;
            item.canvas.width = w;
            item.canvas.height = h;
            return true;
        } catch (err) {
            return false;
        }
    }

    function fitAllTileCanvases() {
        let allSized = true;
        for (const item of state.canvasItems) {
            if (!fitTileCanvas(item)) allSized = false;
        }
        return allSized;
    }

    function scheduleSizingRetry() {
        if (state.sizingTimer !== null) return;
        if (state.sizingAttempts >= SIZE_MAX_ATTEMPTS) return;
        state.sizingAttempts += 1;
        state.sizingTimer = window.setTimeout(() => {
            state.sizingTimer = null;
            if (fitAllTileCanvases()) return;
            if (!state.animPlaying) startAnimation();
            scheduleSizingRetry();
        }, SIZE_RETRY_MS);
    }

    function initCanvasSizing() {
        if (typeof ResizeObserver === 'function') {
            for (const item of state.canvasItems) {
                try {
                    const ro = new ResizeObserver(() => fitTileCanvas(item));
                    ro.observe(item.canvas.parentElement);
                    state.canvasObservers.push(ro);
                } catch (err) { /* ignore observer errors */ }
            }
        } else {
            window.addEventListener('resize', fitAllTileCanvases);
        }
        if (!fitAllTileCanvases()) scheduleSizingRetry();
    }

    /* ============================================================
       SCROLL REVEAL — VISIBILITY IS GUARANTEED
       ============================================================ */
    function revealAllTiles() {
        if (state.revealForced) return;
        state.revealForced = true;

        for (const tile of state.tiles) {
            tile.classList.add('is-visible');
            tile.style.opacity = '1';
        }
        for (const item of state.canvasItems) {
            item.visible = true;
        }
    }

    function initReveal() {
        if (typeof IntersectionObserver !== 'function' || REDUCED_MOTION) {
            revealAllTiles();
            return;
        }

        try {
            const observer = new IntersectionObserver((entries) => {
                for (const entry of entries) {
                    const tile = entry.target;
                    const item = tile._canvasItem;

                    if (entry.isIntersecting) {
                        tile.classList.add('is-visible');
                        if (item) item.visible = true;
                    } else if (item) {
                        item.visible = false;
                    }
                }
            }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

            for (const tile of state.tiles) {
                observer.observe(tile);
            }
        } catch (err) {
            revealAllTiles();
            return;
        }

        window.setTimeout(revealAllTiles, FORCE_REVEAL_MS);
    }

    /* ============================================================
       GENERATIVE MOTION (single rAF loop, delta-time based)
       ============================================================ */
    function drawTileFrame(item) {
        const { ctx, canvas, project } = item;
        const w = canvas.width;
        const h = canvas.height;
        if (!w || !h || !ctx) return;

        const s = item.time * 1.2;

        ctx.fillStyle = '#002BFF';
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = Math.max(2, w * 0.015);

        try {
            switch (project.pattern) {
                case 'waves': {
                    const amp = h * 0.14;
                    ctx.beginPath();
                    for (let x = 0; x <= w; x += 6) {
                        const y = h / 2 + Math.sin(x * 0.03 + s) * amp;
                        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                    }
                    ctx.stroke();
                    break;
                }
                case 'circles': {
                    const radius = (Math.sin(s) * 0.3 + 0.5) * (w / 2.6);
                    ctx.beginPath();
                    ctx.arc(w / 2, h / 2, Math.abs(radius), 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                }
                case 'grid': {
                    const size = w * 0.16;
                    ctx.beginPath();
                    for (let x = size / 2; x < w; x += size) {
                        for (let y = size / 2; y < h; y += size) {
                            const offset = Math.sin(s + (x + y) * 0.01) * size * 0.2;
                            ctx.rect(x + offset, y + offset, size * 0.4, size * 0.4);
                        }
                    }
                    ctx.stroke();
                    break;
                }
                case 'spiral': {
                    ctx.beginPath();
                    for (let i = 0; i < 60; i++) {
                        const angle = 0.2 * i + s;
                        const r = (w * 0.02) * i;
                        const x = w / 2 + r * Math.cos(angle);
                        const y = h / 2 + r * Math.sin(angle);
                        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                    }
                    ctx.stroke();
                    break;
                }
                case 'particles': {
                    for (let i = 0; i < 8; i++) {
                        const px = (Math.sin(s + i) * 0.3 + 0.5) * w;
                        const py = (Math.cos(s * 0.8 + i) * 0.3 + 0.5) * h;
                        ctx.beginPath();
                        ctx.arc(px, py, Math.max(6, w * 0.04), 0, Math.PI * 2);
                        ctx.fill();
                    }
                    break;
                }
            }
        } catch (err) {
            console.error('Tile draw error:', err);
        }
    }

    function animationTick(now) {
        if (!state.animPlaying) return;

        try { updateParallax(); } catch (err) { /* never kill the loop */ }

        const dt = Math.min((now - state.animLastTime) || 16.67, 50);
        state.animLastTime = now;

        for (const item of state.canvasItems) {
            if (!item.visible) continue;
            item.time += (dt / 1000) * item.project.speed;
            drawTileFrame(item);
        }

        state.animRaf = requestAnimationFrame(animationTick);
    }

    function startAnimation() {
        if (state.animPlaying || state.canvasItems.length === 0) return;
        state.animPlaying = true;
        state.animLastTime = performance.now();
        state.animRaf = requestAnimationFrame(animationTick);
    }

    function stopAnimation() {
        state.animPlaying = false;
        if (state.animRaf !== null) {
            cancelAnimationFrame(state.animRaf);
            state.animRaf = null;
        }
    }

    document.addEventListener('visibilitychange', () => {
        document.hidden ? stopAnimation() : startAnimation();
    });

    /* ============================================================
       PROJECT MODAL + ITS ANIMATION
       ============================================================ */
    function fitModalCanvas() {
        try {
            const canvas = $('modal-canvas');
            if (!canvas) return;
            const host = canvas.parentElement;
            const rect = host.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
            canvas.width = Math.round(rect.width * dpr);
            canvas.height = Math.round(rect.height * dpr);
        } catch (err) { /* ignore */ }
    }

    function renderModalFrame() {
        const canvas = $('modal-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        if (!w || !h) return;

        const t = performance.now() / 1000;

        ctx.fillStyle = '#0A0A0B';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h / 2;
        const maxR = Math.min(w, h) / 2;

        for (let i = 0; i < 20; i++) {
            const radius = (i * maxR / 20 + t * (maxR / 8)) % maxR;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 30, 30, ${1 - radius / maxR})`;
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }

    function stopModalAnimation() {
        if (state.modalRaf !== null) {
            cancelAnimationFrame(state.modalRaf);
            state.modalRaf = null;
        }
    }

    function openProjectModal(projectId) {
        const id = Number(projectId);
        if (!Number.isInteger(id)) return;

        const project = PROJECTS.find(p => p.id === id);
        if (!project) return;

        const titleEl = $('project-title');
        const categoryEl = $('modal-category');
        const clientEl = $('modal-client');
        const yearEl = $('modal-year');
        const toolsEl = $('modal-tools');
        const descEl = $('modal-desc');

        if (titleEl) titleEl.textContent = project.title;
        if (categoryEl) categoryEl.textContent = project.category;
        if (clientEl) clientEl.textContent = project.client;
        if (yearEl) yearEl.textContent = project.year;
        if (toolsEl) toolsEl.textContent = project.tools;
        if (descEl) {
            descEl.textContent =
                `A ${project.category} commission for ${project.client} (${project.year}), crafted with ${project.tools}. ` +
                `The piece investigates kinetic rhythm, spatial depth, and brand narrative through real-time motion design.`;
        }

        fitModalCanvas();
        openModal('project-modal');

        stopModalAnimation();
        const loop = () => {
            if (!getOpenModal() || !$('project-modal').classList.contains('active')) {
                state.modalRaf = null;
                return;
            }
            try { renderModalFrame(); } catch (err) { console.error('Modal render error:', err); }
            state.modalRaf = requestAnimationFrame(loop);
        };
        state.modalRaf = requestAnimationFrame(loop);
    }

    /* ============================================================
       EVENT DELEGATION (single listener — CSP-friendly, safe)
       ============================================================ */
    document.addEventListener('click', (e) => {
        const projectTrigger = e.target.closest('[data-open-project]');
        if (projectTrigger) {
            /* Project 01 opens the template page (the first case study) */
            if (projectTrigger.dataset.openProject === '1') {
                window.location.assign('project-template.html');
                return;
            }
            openProjectModal(projectTrigger.dataset.openProject);
            return;
        }

        const toggleTrigger = e.target.closest('[data-modal-toggle]');
        if (toggleTrigger) { toggleModal(toggleTrigger.dataset.modalToggle); return; }

        const closeTrigger = e.target.closest('[data-modal-close]');
        if (closeTrigger) { closeModal(closeTrigger.dataset.modalClose); return; }

        const toastTrigger = e.target.closest('[data-toast]');
        if (toastTrigger) { showToast(toastTrigger.dataset.toast); return; }

        if (e.target.classList.contains('modal-overlay')) closeModal(e.target.id);
    });

    /* ============================================================
       CONTACT FORM (client-side validation with inline errors)
       ============================================================ */
    function initContactForm() {
        const form = $('contact-form');
        if (!form) return;

        const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        const fields = [
            { key: 'name', validate: v => v.length >= 2, message: 'Please enter your name (at least 2 characters).' },
            { key: 'email', validate: v => EMAIL_RE.test(v), message: 'Please enter a valid email address.' },
            { key: 'details', validate: v => v.length >= 10, message: 'Tell us a bit more (at least 10 characters).' },
        ];

        fields.forEach(({ key }) => {
            const input = form.elements[key];
            if (!input) return;
            const err = document.createElement('p');
            err.className = 'form-error is-hidden';
            err.setAttribute('role', 'alert');
            input.after(err);
        });

        function setError(key, message) {
            const input = form.elements[key];
            const err = input && input.nextElementSibling;
            if (err && err.classList.contains('form-error')) {
                err.textContent = message;
                err.classList.remove('is-hidden');
            }
            if (input) input.setAttribute('aria-invalid', 'true');
        }

        function clearError(key) {
            const input = form.elements[key];
            const err = input && input.nextElementSibling;
            if (err && err.classList.contains('form-error')) {
                err.classList.add('is-hidden');
                err.textContent = '';
            }
            if (input) input.removeAttribute('aria-invalid');
        }

        form.addEventListener('submit', (e) => {
            e.preventDefault();

            let valid = true;
            let firstInvalid = null;

            fields.forEach(({ key, validate, message }) => {
                const input = form.elements[key];
                if (!input) return;
                const value = input.value.trim();

                if (!validate(value)) {
                    setError(key, message);
                    valid = false;
                    if (!firstInvalid) firstInvalid = input;
                } else {
                    clearError(key);
                }
            });

            if (!valid) {
                if (firstInvalid) firstInvalid.focus();
                return;
            }

            showToast('Thank you for your message! Our studio team will get back to you shortly.');
            form.reset();
            fields.forEach(({ key }) => clearError(key));
            closeModal('contact-modal');
        });
    }

    /* ============================================================
       INIT (idempotent + isolated)
       ============================================================ */
    function runInit() {
        const gridContainer = $('grid-container');
        if (!gridContainer) return;

        const yearEl = $('year');
        if (yearEl) yearEl.textContent = String(new Date().getFullYear());

        PROJECTS.forEach((project, index) => {
            try {
                const tile = buildTile(project, index);
                state.tiles.push(tile);
                gridContainer.appendChild(tile);
                registerParallax(tile);
            } catch (err) {
                console.error('Tile build error:', err);
            }
        });
        resetPreviewText();

        PROJECTS.forEach(project => {
            const canvas = $(`canvas-${project.id}`);
            if (!canvas) return;
            try {
                const item = {
                    canvas,
                    ctx: canvas.getContext('2d'),
                    project,
                    time: Math.random() * 100,
                    visible: true,
                };
                fitTileCanvas(item);
                item.canvas.parentElement._canvasItem = item;
                state.canvasItems.push(item);
            } catch (err) {
                console.error('Canvas init error:', err);
            }
        });

        initCanvasSizing();
        initReveal();

        if (REDUCED_MOTION) {
            state.canvasItems.forEach(drawTileFrame);
        } else {
            startAnimation();
        }

        fitModalCanvas();
        if (typeof ResizeObserver === 'function') {
            try {
                const modalHost = $('modal-canvas').parentElement;
                const ro = new ResizeObserver(() => {
                    if (getOpenModal() === $('project-modal')) fitModalCanvas();
                });
                ro.observe(modalHost);
                state.canvasObservers.push(ro);
            } catch (err) { /* ignore */ }
        }

        initContactForm();
    }

    function init() {
        if (state.initialized) return;
        state.initialized = true;

        try {
            runInit();
        } catch (err) {
            console.error('Init error:', err);
            revealAllTiles();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

    window.addEventListener('load', () => {
        if (state.initialized) {
            fitAllTileCanvases();
            revealAllTiles();
            if (!state.animPlaying && !REDUCED_MOTION) startAnimation();
        } else {
            init();
        }
    });

    window.addEventListener('error', (e) => console.error('Unexpected error:', e.message));
})();