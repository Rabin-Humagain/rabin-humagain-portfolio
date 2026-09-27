/* =========================================================
   Rabin Humagain — Portfolio
   Interactions & motion  ·  vanilla JS, zero dependencies
   ========================================================= */
(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------------------------------------------------------
     1. Preloader
     --------------------------------------------------------- */
  const preloader = $('#preloader');
  function hidePreloader() {
    if (!preloader) return;
    preloader.classList.add('is-done');
    setTimeout(() => preloader.remove(), 700);
  }
  window.addEventListener('load', () => setTimeout(hidePreloader, 350));
  // Safety net in case `load` is slow / already fired
  setTimeout(hidePreloader, 3200);

  /* ---------------------------------------------------------
     2. Theme (persisted, respects system on first visit)
     --------------------------------------------------------- */
  const root = document.documentElement;
  const themeToggle = $('#themeToggle');

  function getPreferredTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f4f5fb' : '#06070d');
  }

  applyTheme(getPreferredTheme());

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      applyTheme(next);
      localStorage.setItem('theme', next);
    });
  }

  /* ---------------------------------------------------------
     3. Navbar state + scroll progress + active link + back-to-top
     --------------------------------------------------------- */
  const nav = $('#nav');
  const progress = $('#scrollProgress');
  const toTop = $('#toTop');
  const navLinks = $$('.nav__link:not(.nav__link--cta)');
  const sections = $$('main section[id]');

  let ticking = false;
  function onScroll() {
    const y = window.scrollY;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docH > 0 ? (y / docH) * 100 : 0;

    if (nav) nav.classList.toggle('is-scrolled', y > 12);
    if (progress) progress.style.width = pct + '%';
    if (toTop) toTop.classList.toggle('is-visible', y > 480);

    // active section
    let current = sections.length ? sections[0].id : '';
    for (const s of sections) {
      if (y >= s.offsetTop - 140) current = s.id;
    }
    navLinks.forEach((link) => {
      link.classList.toggle('is-active', link.getAttribute('href') === '#' + current);
    });

    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(onScroll);
    }
  }, { passive: true });
  onScroll();

  if (toTop) {
    toTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* ---------------------------------------------------------
     4. Mobile menu
     --------------------------------------------------------- */
  const navToggle = $('#navToggle');
  const navLinksWrap = $('#navLinks');

  function closeMenu() {
    document.body.classList.remove('menu-open');
    document.body.classList.remove('is-locked');
    if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
  }

  if (navToggle) {
    navToggle.addEventListener('click', () => {
      const open = document.body.classList.toggle('menu-open');
      document.body.classList.toggle('is-locked', open);
      navToggle.setAttribute('aria-expanded', String(open));
    });
  }

  if (navLinksWrap) {
    navLinksWrap.addEventListener('click', (e) => {
      if (e.target.closest('a')) closeMenu();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 860) closeMenu();
  });

  /* ---------------------------------------------------------
     5. Reveal on scroll (with optional stagger delay)
     --------------------------------------------------------- */
  const revealEls = $$('.reveal');
  revealEls.forEach((el) => {
    const d = el.getAttribute('data-delay');
    if (d) el.style.setProperty('--rd', d + 'ms');
  });

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -60px 0px' });
    revealEls.forEach((el) => io.observe(el));
  }

  /* ---------------------------------------------------------
     6. Skill bars + stat counters (animate when visible)
     --------------------------------------------------------- */
  const bars = $$('.bar');
  const counters = $$('.stat__num');

  function animateBars() {
    bars.forEach((bar) => {
      const level = Math.max(0, Math.min(100, Number(bar.dataset.level) || 0));
      const fill = $('.bar__fill', bar);
      if (fill) {
        setTimeout(() => { fill.style.width = level + '%'; }, reduceMotion ? 0 : 120);
      }
    });
  }

  function animateCounters() {
    counters.forEach((el) => {
      const target = Number(el.dataset.count) || 0;
      const suffix = el.dataset.suffix || '';
      if (reduceMotion) { el.textContent = target + suffix; return; }

      const duration = 1400;
      const start = performance.now();
      function step(now) {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (t < 1) requestAnimationFrame(step);
        else el.textContent = target + suffix;
      }
      requestAnimationFrame(step);
    });
  }

  if ('IntersectionObserver' in window) {
    const statBox = $('.stats');
    if (statBox) {
      const o = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { animateCounters(); o.disconnect(); }
        });
      }, { threshold: 0.4 });
      o.observe(statBox);
    }

    const skillsBox = $('.skills');
    if (skillsBox) {
      const o = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { animateBars(); o.disconnect(); }
        });
      }, { threshold: 0.25 });
      o.observe(skillsBox);
    }
  } else {
    animateCounters();
    animateBars();
  }

  /* ---------------------------------------------------------
     7. Hero typewriter
     --------------------------------------------------------- */
  const typeEl = $('#typewriter');
  const phrases = [
    'clean websites.',
    'interactive experiences.',
    'simple solutions.',
    'things that actually work.'
  ];

  if (typeEl) {
    if (reduceMotion) {
      typeEl.textContent = phrases[0];
    } else {
      let p = 0, c = 0, deleting = false;
      (function tick() {
        const word = phrases[p];
        typeEl.textContent = word.slice(0, c);

        let delay = deleting ? 45 : 85;
        if (!deleting && c === word.length) { deleting = true; delay = 1600; }
        else if (deleting && c === 0) { deleting = false; p = (p + 1) % phrases.length; delay = 320; }
        else { c += deleting ? -1 : 1; }

        setTimeout(tick, delay);
      })();
    }
  }

  /* ---------------------------------------------------------
     8. Project filter
     --------------------------------------------------------- */
  const filters = $$('.filter');
  const projects = $$('.project');

  filters.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.filter;
      filters.forEach((b) => {
        const active = b === btn;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-selected', String(active));
      });

      projects.forEach((card) => {
        const match = key === 'all' || card.dataset.category === key;
        if (match) {
          card.classList.remove('is-hidden');
          card.style.animation = 'none';
          void card.offsetWidth;
          card.style.animation = reduceMotion ? '' : 'fadeUp .5s var(--ease-out) both';
        } else {
          card.classList.add('is-hidden');
        }
      });
    });
  });

  // Inject the fadeUp keyframes used by the filter
  if (!document.getElementById('pf-keyframes')) {
    const st = document.createElement('style');
    st.id = 'pf-keyframes';
    st.textContent = '@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}';
    document.head.appendChild(st);
  }

  /* ---------------------------------------------------------
     9. Card tilt + magnetic buttons + cursor glow (desktop only)
     --------------------------------------------------------- */
  if (isDesktop && !reduceMotion) {
    document.body.classList.add('has-cursor');

    const glow = $('#cursorGlow');
    let gx = window.innerWidth / 2, gy = window.innerHeight / 2;
    let cx = gx, cy = gy;

    window.addEventListener('mousemove', (e) => {
      gx = e.clientX; gy = e.clientY;
    }, { passive: true });

    (function loopGlow() {
      cx += (gx - cx) * 0.12;
      cy += (gy - cy) * 0.12;
      if (glow) glow.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      requestAnimationFrame(loopGlow);
    })();

    // Tilt on cards
    const tiltEls = $$('.project, .skills__card');
    tiltEls.forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform =
          `perspective(900px) rotateX(${(-py * 5).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg) translateY(-6px)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    });

    // Magnetic buttons
    $$('.magnetic').forEach((btn) => {
      btn.addEventListener('mousemove', (e) => {
        const r = btn.getBoundingClientRect();
        const mx = (e.clientX - r.left - r.width / 2) * 0.22;
        const my = (e.clientY - r.top - r.height / 2) * 0.28;
        btn.style.transform = `translate(${mx.toFixed(1)}px, ${my.toFixed(1)}px)`;
      });
      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
    });
  }

  /* ---------------------------------------------------------
     10. Copy email
     --------------------------------------------------------- */
  const copyBtn = $('#copyEmail');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const email = copyBtn.dataset.email || '';
      try {
        await navigator.clipboard.writeText(email);
      } catch (_) {
        const tmp = document.createElement('textarea');
        tmp.value = email;
        tmp.style.position = 'fixed';
        tmp.style.opacity = '0';
        document.body.appendChild(tmp);
        tmp.select();
        try { document.execCommand('copy'); } catch (e) { /* noop */ }
        tmp.remove();
      }
      copyBtn.classList.add('is-copied');
      const label = $('.contact__txt span', copyBtn);
      const original = label ? label.textContent : '';
      if (label) label.textContent = 'Copied to clipboard!';
      setTimeout(() => {
        copyBtn.classList.remove('is-copied');
        if (label) label.textContent = original;
      }, 1900);
    });
  }

  /* ---------------------------------------------------------
     11. Local clock + year
     --------------------------------------------------------- */
  const clockEl = $('#localTime');
  if (clockEl) {
    const tickClock = () => {
      const now = new Date();
      const p = (n) => String(n).padStart(2, '0');
      clockEl.textContent = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
    };
    tickClock();
    setInterval(tickClock, 1000);
  }

  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------------------------------------------------------
     12. Contact form (Formspree)
     --------------------------------------------------------- */
  const form = $('#contactForm');
  const status = $('#formStatus');
  const submitBtn = $('#submitBtn');
  const submitLabel = submitBtn ? $('.btn__label', submitBtn) : null;
  const originalLabel = submitLabel ? submitLabel.innerHTML : '';

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }

      submitBtn.disabled = true;
      submitBtn.classList.add('is-loading');
      if (submitLabel) submitLabel.innerHTML = 'Sending…';
      if (status) { status.textContent = ''; status.className = 'form__status'; }

      try {
        const res = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' }
        });

        if (res.ok) {
          if (status) { status.textContent = 'Message sent — I\'ll get back to you soon!'; status.className = 'form__status is-ok'; }
          form.reset();
        } else {
          if (status) { status.textContent = 'Something went wrong. Please try again.'; status.className = 'form__status is-err'; }
        }
      } catch (_) {
        if (status) { status.textContent = 'Network error — please check your connection.'; status.className = 'form__status is-err'; }
      } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('is-loading');
        if (submitLabel) submitLabel.innerHTML = originalLabel;
      }
    });
  }
})();
