(function () {
  const root = document.documentElement;
  const header = document.querySelector('.nav');
  const navLinks = Array.from(document.querySelectorAll('.nav a'));
  const cards = Array.from(document.querySelectorAll('.card'));
  const cardsAndSections = Array.from(document.querySelectorAll('.card, .project, .hero, .featured h2'));
  const footerText = document.querySelector('footer p');

  // Theme handling
  const themeToggle = document.createElement('button');
  themeToggle.className = 'theme-toggle';
  themeToggle.type = 'button';
  themeToggle.setAttribute('aria-label', 'Toggle theme');

  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)');
  const savedTheme = localStorage.getItem('theme');

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    themeToggle.textContent = theme === 'dark' ? 'Dark mode' : 'Light mode';
  }

  function getDefaultTheme() {
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
    return systemPrefersDark.matches ? 'dark' : 'light';
  }

  function toggleTheme() {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('theme', next);
  }

  applyTheme(getDefaultTheme());
  systemPrefersDark.addEventListener('change', (event) => {
    if (!localStorage.getItem('theme')) {
      applyTheme(event.matches ? 'dark' : 'light');
    }
  });
  themeToggle.addEventListener('click', toggleTheme);

  const nav = header?.querySelector('nav');
  if (nav) {
    nav.appendChild(themeToggle);
  }

  // Active nav link
  const currentPath = location.pathname.split('/').pop() || 'index.html';
  navLinks.forEach((link) => {
    const href = link.getAttribute('href');
    if (!href) return;
    if (href === currentPath || (currentPath === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  // Header shrink on scroll
  const onScroll = () => {
    if (!header) return;
    const isScrolled = window.scrollY > 12;
    header.classList.toggle('is-scrolled', isScrolled);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Scroll reveal for cards/sections
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReducedMotion && 'IntersectionObserver' in window) {
    cardsAndSections.forEach((el) => el.classList.add('reveal'));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    cardsAndSections.forEach((el) => observer.observe(el));
  } else {
    cardsAndSections.forEach((el) => el.classList.add('is-visible'));
  }

  // Footer year
  if (footerText) {
    footerText.remove();
  }

  // Drag-to-move cards (snap to invisible grid, keep position until refresh)
  let activeCard = null;
  let startX = 0;
  let startY = 0;
  let startTx = 0;
  let startTy = 0;
  let currentTx = 0;
  let currentTy = 0;
  let rafId = null;
  const GRID = 40;
  const DRAG_THRESHOLD = 5;
  let moved = false;

  function parsePosition(el) {
    return {
      tx: Number(el.dataset.tx || 0),
      ty: Number(el.dataset.ty || 0),
    };
  }

  function onPointerDown(e) {
    if (e.target.closest('.card-open')) return; // allow button to work
    e.preventDefault();
    const target = e.currentTarget;
    const { tx, ty } = parsePosition(target);
    activeCard = target;
    startX = e.clientX;
    startY = e.clientY;
    startTx = tx;
    startTy = ty;
    currentTx = tx;
    currentTy = ty;
    target.setPointerCapture(e.pointerId);
    target.classList.add('is-dragging');
    moved = false;
    rafId = requestAnimationFrame(updatePosition);
  }

  function onPointerMove(e) {
    if (!activeCard) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    currentTx = startTx + dx;
    currentTy = startTy + dy;
    if (!moved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      moved = true;
    }
  }

  function onPointerUp(e) {
    if (!activeCard) return;
    activeCard.releasePointerCapture(e.pointerId);
    activeCard.classList.remove('is-dragging');
    const snappedX = Math.round(currentTx / GRID) * GRID;
    const snappedY = Math.round(currentTy / GRID) * GRID;
    activeCard.dataset.tx = snappedX;
    activeCard.dataset.ty = snappedY;
    activeCard.style.transform = `translate(${snappedX}px, ${snappedY}px)`;
    activeCard = null;
    cancelAnimationFrame(rafId);
  }

  function updatePosition() {
    if (activeCard) {
      activeCard.style.transform = `translate(${currentTx}px, ${currentTy}px)`;
      rafId = requestAnimationFrame(updatePosition);
    }
  }

  cards.forEach((card) => {
    // Apply persisted position (if any)
    const { tx, ty } = parsePosition(card);
    if (tx !== 0 || ty !== 0) {
      card.style.transform = `translate(${tx}px, ${ty}px)`;
    }

    card.addEventListener('pointerdown', onPointerDown);
    card.addEventListener('pointermove', onPointerMove);
    card.addEventListener('pointerup', onPointerUp);
    card.addEventListener('pointercancel', onPointerUp);
    card.addEventListener('lostpointercapture', onPointerUp);

    card.addEventListener('click', (e) => {
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
  });

  // Card open button navigates
  document.querySelectorAll('.card-open').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const card = e.currentTarget.closest('.card');
      const href = card?.dataset.href;
      if (href) {
        window.location.href = href;
      }
    });
  });
})(); 
