/* =========================================================
   Rabin Humagain — Portfolio arcade
   Self-contained games + overlay controller. No dependencies.

   Adding a game later:
     1. add a module to GAMES below with start() / stop()
     2. drop its markup inside #arcadeOverlay (or build it in start())
     3. add a Play button with a data-game="<id>" attribute
   ========================================================= */
(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);

  /* ---------------------------------------------------------
     Safe storage (private mode / disabled storage shouldn't throw)
     --------------------------------------------------------- */
  function read(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, value) {
    try { window.localStorage.setItem(key, String(value)); } catch (e) { /* ignore */ }
  }

  /* ---------------------------------------------------------
     Overlay controller
     --------------------------------------------------------- */
  const overlay = $('#arcadeOverlay');
  const panel = $('#arcadePanel');
  let lastFocused = null;
  let activeId = null;

  function openOverlay(id) {
    if (!overlay || !GAMES[id]) return;
    lastFocused = document.activeElement;
    activeId = id;

    overlay.hidden = false;
    document.body.classList.add('is-locked');
    requestAnimationFrame(() => overlay.classList.add('is-open'));

    GAMES[id].start();
    if (panel) panel.focus();
  }

  function closeOverlay() {
    if (!overlay || overlay.hidden) return;

    if (activeId && GAMES[activeId] && GAMES[activeId].stop) GAMES[activeId].stop();
    activeId = null;

    overlay.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    window.setTimeout(() => {
      if (!overlay.classList.contains('is-open')) overlay.hidden = true;
    }, 400);

    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function trapFocus(e) {
    if (e.key !== 'Tab' || !panel) return;
    const nodes = Array.from(
      panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter((el) => !el.disabled && el.offsetParent !== null);
    if (nodes.length < 2) return;

    const first = nodes[0];
    const last = nodes[nodes.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  /* =========================================================
     Game: Code Breaker
     ========================================================= */
  const COLOURS = [
    { name: 'Violet', token: 'var(--violet)' },
    { name: 'Cyan', token: 'var(--cyan)' },
    { name: 'Pink', token: 'var(--pink)' },
    { name: 'Lime', token: 'var(--lime)' },
    { name: 'Amber', token: 'var(--amber)' },
    { name: 'Blue', token: 'var(--blue)' }
  ];
  const PEGS = 4;
  const MAX_GUESSES = 8;
  const BEST_KEY = 'rabin.cb.best';

  let secret = [];
  let guesses = [];
  let current = [null, null, null, null];
  let cursor = 0;
  let over = false;
  let built = false;

  let boardEl, paletteEl, scoreEl, bestEl, guessEl, msgEl, submitEl, clearEl;

  function getBest() {
    const v = parseInt(read(BEST_KEY) || '0', 10);
    return Number.isNaN(v) ? 0 : v;
  }

  function scoreFor(used) {
    return (MAX_GUESSES + 1 - used) * 100;
  }

  function evaluate(secretArr, guessArr) {
    const s = secretArr.slice();
    const g = guessArr.slice();
    let hits = 0;
    let near = 0;

    for (let i = 0; i < PEGS; i++) {
      if (g[i] === s[i]) { hits++; s[i] = -1; g[i] = -1; }
    }
    for (let i = 0; i < PEGS; i++) {
      if (g[i] === -1) continue;
      const j = s.indexOf(g[i]);
      if (j > -1) { near++; s[j] = -1; }
    }
    return { hits, near };
  }

  function setMsg(text, kind) {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.className = 'arcade__msg' + (kind ? ' is-' + kind : '');
  }

  function setMsgWithCode(prefix, kind) {
    if (!msgEl) return;
    msgEl.textContent = prefix;
    secret.forEach((id) => {
      const dot = document.createElement('span');
      dot.className = 'peg peg--show';
      dot.style.setProperty('--c', COLOURS[id].token);
      msgEl.appendChild(dot);
    });
    msgEl.className = 'arcade__msg' + (kind ? ' is-' + kind : '');
  }

  function buildBoard() {
    if (!boardEl) return;
    boardEl.innerHTML = '';
    for (let r = 0; r < MAX_GUESSES; r++) {
      const row = document.createElement('div');
      row.className = 'cb__row';

      const num = document.createElement('span');
      num.className = 'cb__num';
      num.textContent = String(r + 1);
      row.appendChild(num);

      for (let c = 0; c < PEGS; c++) {
        const slot = document.createElement('span');
        slot.className = 'cb__slot';
        slot.dataset.row = String(r);
        slot.dataset.col = String(c);
        row.appendChild(slot);
      }

      const fb = document.createElement('div');
      fb.className = 'cb__fb';
      for (let i = 0; i < PEGS; i++) fb.appendChild(document.createElement('i'));
      row.appendChild(fb);

      boardEl.appendChild(row);
    }
  }

  function buildPalette() {
    if (!paletteEl) return;
    paletteEl.innerHTML = '';
    COLOURS.forEach((colour, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch';
      btn.dataset.colour = String(i);
      btn.setAttribute('aria-label', colour.name + ' (key ' + (i + 1) + ')');
      btn.style.setProperty('--c', colour.token);

      const dot = document.createElement('span');
      dot.className = 'swatch__dot';

      const key = document.createElement('span');
      key.className = 'swatch__key';
      key.textContent = String(i + 1);

      btn.appendChild(dot);
      btn.appendChild(key);
      paletteEl.appendChild(btn);
    });
  }

  function render() {
    if (!boardEl) return;
    const rows = boardEl.children;

    for (let r = 0; r < MAX_GUESSES; r++) {
      const row = rows[r];
      if (!row) continue;

      const isPast = r < guesses.length;
      const isActive = r === guesses.length && !over;

      row.classList.toggle('cb__row--past', isPast);
      row.classList.toggle('cb__row--active', isActive);

      const slots = row.querySelectorAll('.cb__slot');
      const fbPegs = row.querySelectorAll('.cb__fb i');

      if (isPast) {
        const g = guesses[r];
        slots.forEach((slot, i) => {
          slot.style.setProperty('--c', COLOURS[g.pegs[i]].token);
          slot.classList.add('cb__slot--filled');
          slot.classList.remove('cb__slot--cursor');
        });
        const marks = [];
        for (let i = 0; i < g.hits; i++) marks.push('hit');
        for (let i = 0; i < g.near; i++) marks.push('near');
        fbPegs.forEach((f, i) => { f.className = marks[i] || ''; });
      } else if (isActive) {
        slots.forEach((slot, i) => {
          const v = current[i];
          if (v === null) {
            slot.style.removeProperty('--c');
            slot.classList.remove('cb__slot--filled');
          } else {
            slot.style.setProperty('--c', COLOURS[v].token);
            slot.classList.add('cb__slot--filled');
          }
          slot.classList.toggle('cb__slot--cursor', i === cursor);
        });
        fbPegs.forEach((f) => { f.className = ''; });
      } else {
        slots.forEach((slot) => {
          slot.style.removeProperty('--c');
          slot.classList.remove('cb__slot--filled', 'cb__slot--cursor');
        });
        fbPegs.forEach((f) => { f.className = ''; });
      }
    }

    if (guessEl) {
      const shown = over ? guesses.length : Math.min(guesses.length + 1, MAX_GUESSES);
      guessEl.textContent = shown + ' / ' + MAX_GUESSES;
    }
    if (clearEl) clearEl.disabled = over;
    if (submitEl) submitEl.disabled = over;
    scrollToActive();
  }

  /* The board is the only scrolling region — keep the active row in view. */
  function scrollToActive() {
    if (!boardEl || boardEl.scrollHeight <= boardEl.clientHeight) return;
    const row = boardEl.children[Math.min(guesses.length, MAX_GUESSES - 1)];
    if (!row) return;

    const rowTop = row.offsetTop - boardEl.offsetTop;
    const rowBottom = rowTop + row.offsetHeight;
    const viewBottom = boardEl.scrollTop + boardEl.clientHeight;

    if (rowBottom > viewBottom) {
      boardEl.scrollTop = rowBottom - boardEl.clientHeight + 6;
    } else if (rowTop < boardEl.scrollTop) {
      boardEl.scrollTop = Math.max(0, rowTop - 6);
    }
  }

  function popSlot(index) {
    if (!boardEl) return;
    const row = boardEl.children[guesses.length];
    if (!row) return;
    const slot = row.querySelectorAll('.cb__slot')[index];
    if (!slot) return;
    slot.classList.remove('cb__slot--pop');
    void slot.offsetWidth;
    slot.classList.add('cb__slot--pop');
  }

  function syncPalette() {
    if (!paletteEl) return;
    const used = current[cursor];
    paletteEl.querySelectorAll('.swatch').forEach((b) => {
      b.setAttribute('aria-pressed', String(Number(b.dataset.colour) === used));
    });
  }

  function place(colourId) {
    if (over) return;
    current[cursor] = colourId;
    popSlot(cursor);
    if (cursor < PEGS - 1) cursor++;
    render();
    syncPalette();
  }

  function newGame() {
    secret = Array.from({ length: PEGS }, () => Math.floor(Math.random() * COLOURS.length));
    guesses = [];
    current = new Array(PEGS).fill(null);
    cursor = 0;
    over = false;

    if (scoreEl) scoreEl.textContent = '—';
    if (bestEl) bestEl.textContent = String(getBest());
    setMsg('Pick a colour to make your first guess.', 'info');
    render();
    syncPalette();
  }

  function submit() {
    if (over) return;
    if (current.some((v) => v === null)) {
      setMsg('Fill all four slots first.', 'info');
      return;
    }

    const result = evaluate(secret, current);
    guesses.push({ pegs: current.slice(), hits: result.hits, near: result.near });
    current = new Array(PEGS).fill(null);
    cursor = 0;

    if (result.hits === PEGS) {
      over = true;
      const score = scoreFor(guesses.length);
      const isBest = score > getBest();
      if (isBest) write(BEST_KEY, score);

      if (scoreEl) scoreEl.textContent = String(score);
      if (bestEl) bestEl.textContent = String(getBest());

      setMsg(
        'Cracked it in ' + guesses.length + (guesses.length === 1 ? ' guess' : ' guesses') +
        (isBest ? ' — new best score!' : ' — +' + score + ' points'),
        'win'
      );
    } else if (guesses.length >= MAX_GUESSES) {
      over = true;
      if (scoreEl) scoreEl.textContent = '0';
      setMsgWithCode('Out of guesses — the code was ', 'lose');
    } else {
      const h = result.hits;
      const n = result.near;
      setMsg(
        h + ' in the right spot' + (h === 1 ? '' : 's') + ', ' +
        n + ' right colour in the wrong spot' + (n === 1 ? '' : 's') + '.',
        'info'
      );
    }

    render();
    syncPalette();
  }

  function clearRow() {
    if (over) return;
    current = new Array(PEGS).fill(null);
    cursor = 0;
    setMsg('Row cleared.', 'info');
    render();
    syncPalette();
  }

  function onKey(e) {
    if (!overlay || overlay.hidden) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      closeOverlay();
      return;
    }

    trapFocus(e);
    if (over) return;

    if (e.key >= '1' && e.key <= String(COLOURS.length)) {
      e.preventDefault();
      place(parseInt(e.key, 10) - 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      cursor = (cursor - 1 + PEGS) % PEGS;
      render();
      syncPalette();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      cursor = (cursor + 1) % PEGS;
      render();
      syncPalette();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      if (current[cursor] !== null) {
        current[cursor] = null;
      } else if (cursor > 0) {
        cursor--;
        current[cursor] = null;
      }
      render();
      syncPalette();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  }

  /* ---------------------------------------------------------
     Registry
     --------------------------------------------------------- */
  const GAMES = {
    'code-breaker': {
      start() {
        if (!built) {
          boardEl = $('#cbBoard');
          paletteEl = $('#cbPalette');
          scoreEl = $('#cbScore');
          bestEl = $('#cbBest');
          guessEl = $('#cbGuess');
          msgEl = $('#cbMsg');
          submitEl = $('#cbSubmit');
          clearEl = $('#cbClear');

          buildBoard();
          buildPalette();
          bindCodeBreaker();
          built = true;
          newGame();
        } else if (over) {
          newGame();
        }
      },
      stop() {
        /* turn-based: nothing to tear down */
      }
    }
  };

  function bindCodeBreaker() {
    if (boardEl) {
      boardEl.addEventListener('click', (e) => {
        const slot = e.target.closest('.cb__slot');
        if (!slot || over) return;
        if (Number(slot.dataset.row) !== guesses.length) return;
        cursor = Number(slot.dataset.col);
        render();
        syncPalette();
      });
    }

    if (paletteEl) {
      paletteEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.swatch');
        if (!btn || over) return;
        place(Number(btn.dataset.colour));
      });
    }

    if (submitEl) submitEl.addEventListener('click', submit);
    if (clearEl) clearEl.addEventListener('click', clearRow);

    const restart = $('#cbRestart');
    if (restart) restart.addEventListener('click', newGame);
  }

  /* ---------------------------------------------------------
     Wiring
     --------------------------------------------------------- */
  document.querySelectorAll('[data-game]').forEach((btn) => {
    btn.addEventListener('click', () => openOverlay(btn.dataset.game));
  });

  const playBtn = $('#playCodeBreaker');
  if (playBtn) playBtn.addEventListener('click', () => openOverlay('code-breaker'));

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target.closest('[data-arcade-close]')) closeOverlay();
    });
  }

  document.addEventListener('keydown', onKey);
})();
