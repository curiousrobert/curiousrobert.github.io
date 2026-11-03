/* ============================================================
   cursioustudio // project template interactions
   - Hero canvas: animated red/blue motion loop.
   - Two "Motion Study" canvases: ready for your own drawing code.
   - Gallery lightbox (click to enlarge, Escape / outside closes),
     scroll-lock WITHOUT horizontal shift (scrollbar reserved via CSS).
   - Scroll reveal (visible by default — cannot disappear).
   - Reduced-motion respected; no innerHTML; CSP-friendly.
   ============================================================ */

(function () {
    'use strict';

    document.documentElement.classList.add('js-anim');

    const REDUCED_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    function $(id) { return document.getElementById(id); }

    /* ---------- Reveal (visible by default) ---------- */
    function revealAll() {
        document.querySelectorAll('.reveal').forEach(el => el.classList.add('is-visible'));
    }

    function initReveal() {
        if (typeof IntersectionObserver !== 'function' || REDUCED_MOTION) {
            revealAll();
            return;
        }
        try {
            const observer = new IntersectionObserver(entries => {
                for (const entry of entries) {
                    if (entry.isIntersecting) entry.target.classList.add('is-visible');
                }
            }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
            document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
        } catch (err) {
            revealAll();
            return;
        }
        window.setTimeout(revealAll, 1400);
    }

    /* ---------- Canvas engine ---------- */
    const canvases = [];
    let rafId = null;
    let lastTime = 0;

    function setupCanvas(id, draw) {
        const canvas = $(id);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const item = { canvas, ctx, draw, time: Math.random() * 100 };

        function fit() {
            const rect = canvas.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.round(rect.width * dpr);
            canvas.height = Math.round(rect.height * dpr);
        }

        fit();

        if (typeof ResizeObserver === 'function') {
            try {
                const ro = new ResizeObserver(fit);
                ro.observe(canvas.parentElement);
            } catch (err) { /* ignore */ }
        } else {
            window.addEventListener('resize', fit);
        }

        let attempts = 0;
        const retry = setInterval(() => {
            attempts += 1;
            const rect = canvas.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                fit();
                clearInterval(retry);
            } else if (attempts > 15) {
                clearInterval(retry);
            }
        }, 400);

        canvases.push(item);
    }

    function drawHero(item) {
        const { ctx, canvas } = item;
        const w = canvas.width;
        const h = canvas.height;
        if (!w || !h) return;

        const t = item.time;
        ctx.fillStyle = '#0A0A0B';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h / 2;
        const maxR = Math.min(w, h) / 2;

        for (let i = 0; i < 22; i++) {
            const radius = (i * maxR / 22 + t * (maxR / 7)) % maxR;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 30, 30, ${1 - radius / maxR})`;
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }

    function drawStudy1(item) {
        const { ctx, canvas } = item;
        const w = canvas.width;
        const h = canvas.height;
        if (!w || !h) return;

        const t = item.time;
        ctx.fillStyle = '#002BFF';
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = Math.max(2, w * 0.012);

        const size = w * 0.14;
        ctx.beginPath();
        for (let x = size / 2; x < w; x += size) {
            for (let y = size / 2; y < h; y += size) {
                const offset = Math.sin(t + (x + y) * 0.01) * size * 0.25;
                ctx.rect(x + offset, y + offset, size * 0.4, size * 0.4);
            }
        }
        ctx.stroke();
    }

    function drawStudy2(item) {
        const { ctx, canvas } = item;
        const w = canvas.width;
        const h = canvas.height;
        if (!w || !h) return;

        const t = item.time;
        ctx.fillStyle = '#0A0A0B';
        ctx.fillRect(0, 0, w, h);

        for (let i = 0; i < 14; i++) {
            const angle = t * 0.6 + i * (Math.PI * 2 / 14);
            const radius = Math.min(w, h) * 0.3 + Math.sin(t + i) * 20;
            const x = w / 2 + Math.cos(angle) * radius;
            const y = h / 2 + Math.sin(angle) * radius;
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fillStyle = i % 2 === 0 ? '#FF1E1E' : '#002BFF';
            ctx.fill();
        }
    }

    function tick(now) {
        if (!rafId) return;
        const dt = Math.min((now - lastTime) || 16.67, 50);
        lastTime = now;

        for (const item of canvases) {
            item.time += dt / 1000;
            try { item.draw(item); } catch (err) { /* isolated */ }
        }
        rafId = requestAnimationFrame(tick);
    }

    function startAnimation() {
        if (rafId || canvases.length === 0) return;
        lastTime = performance.now();
        rafId = requestAnimationFrame(tick);
    }

    function stopAnimation() {
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    }

    document.addEventListener('visibilitychange', () => {
        document.hidden ? stopAnimation() : startAnimation();
    });

    /* ---------- Lightbox (no scroll compensation — scrollbar reserved) ---------- */
    const lightbox = $('lightbox');
    const lightboxImg = $('lightbox-img');
    const lightboxCaption = $('lightbox-caption');
    const lightboxClose = $('lightbox-close');

    function lockScroll(lock) {
        document.body.classList.toggle('overflow-hidden', lock);
    }

    function openLightbox(src, caption) {
        if (!lightbox || !lightboxImg) return;
        lightboxImg.src = src;
        if (lightboxCaption) lightboxCaption.textContent = caption;
        lightbox.classList.add('active');
        lightbox.setAttribute('aria-hidden', 'false');
        lightbox.removeAttribute('inert');
        lockScroll(true);
        if (lightboxClose) lightboxClose.focus();
    }

    function closeLightbox() {
        if (!lightbox) return;
        lightbox.classList.remove('active');
        lightbox.setAttribute('aria-hidden', 'true');
        lightbox.setAttribute('inert', '');
        lockScroll(false);
    }

    document.addEventListener('click', (e) => {
        const item = e.target.closest('.gallery-item');
        if (item) {
            const img = item.querySelector('img');
            const full = item.dataset.full || img.src;
            const caption = img.alt || '';
            openLightbox(full, caption);
            return;
        }
        if (e.target === lightbox || e.target === lightboxClose) closeLightbox();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLightbox();
    });

    /* ---------- Init ---------- */
    function init() {
        const yearEl = $('year');
        if (yearEl) yearEl.textContent = String(new Date().getFullYear());

        setupCanvas('hero-canvas', drawHero);
        setupCanvas('anim-canvas-1', drawStudy1);
        setupCanvas('anim-canvas-2', drawStudy2);

        initReveal();

        if (REDUCED_MOTION) {
            canvases.forEach(item => item.draw(item));
        } else {
            startAnimation();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

    window.addEventListener('load', () => {
        if (!rafId && !REDUCED_MOTION) startAnimation();
    });
})();