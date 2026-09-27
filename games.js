/* =========================================================
   Rabin Humagain — Portfolio arcade
   Overlay controller + self-contained canvas games. No dependencies.

   Adding a game later:
     1. add a module to GAMES below with start() / stop()
     2. put its markup inside #arcadeOverlay
     3. add a Play button with a data-game="<id>" attribute
   ========================================================= */
(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const TAU = Math.PI * 2;

  /* ---------------------------------------------------------
     Safe storage (private mode / disabled storage shouldn't throw)
     --------------------------------------------------------- */
  function read(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, value) {
    try { window.localStorage.setItem(key, String(value)); } catch (e) { /* ignore */ }
  }
  function readInt(key) {
    const v = parseInt(read(key) || '0', 10);
    return Number.isNaN(v) ? 0 : v;
  }

  function withAlpha(colour, a) {
    if (!colour) return 'rgba(255,255,255,' + a + ')';
    const c = String(colour).trim();
    if (c.charAt(0) === '#') {
      let h = c.slice(1);
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      const n = parseInt(h, 16);
      if (!Number.isNaN(n)) {
        return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
      }
    }
    return c;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
    ));
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
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
     Game: Neon Serpents  (slither-style arena)
     ========================================================= */
  const BEST_KEY = 'rabin.serpents.best';
  const NAMES = ['Nova', 'Zephyr', 'Kite', 'Onyx', 'Pixel', 'Quark', 'Rune',
    'Sable', 'Talon', 'Vex', 'Wisp', 'Ember', 'Fable', 'Glint'];

  const W = {
    radius: 1300,
    pelletCount: 620,
    maxPellets: 900,
    pelletR: 5,
    bots: 12,
    baseSpeed: 158,
    boostSpeed: 272,
    turnRate: 4.6,
    spacing: 6,
    baseSegments: 20,
    maxSegments: 260,
    baseRadius: 7.4,
    boostDrain: 7
  };

  let canvas, ctx, stage;
  let dpr = 1;
  let snakes = [];
  let pellets = [];
  let player = null;
  let playerColour = '#22d3ee';
  let cam = { x: 0, y: 0, zoom: 1 };
  let viewHalf = 900;
  let running = false;
  let rafId = 0;
  let lastT = 0;
  let hudTimer = 0;
  let pointer = { x: 0, y: 0, active: false, boosting: false };
  let theme = { bg: '#06070d', text: '#eef1f8', muted: '#8b95b0', grid: 'rgba(255,255,255,.08)', accents: ['#7c5cff'] };
  let els = {};
  let built = false;
  let lowPower = false;

  function refreshTheme() {
    const cs = getComputedStyle(document.documentElement);
    const get = (n, fallback) => cs.getPropertyValue(n).trim() || fallback;
    theme = {
      bg: get('--bg', '#06070d'),
      text: get('--text', '#eef1f8'),
      muted: get('--muted', '#8b95b0'),
      grid: get('--border', 'rgba(255,255,255,.08)'),
      accents: [
        get('--violet', '#7c5cff'),
        get('--cyan', '#22d3ee'),
        get('--pink', '#ff5c8a'),
        get('--lime', '#a3e635'),
        get('--amber', '#f5a524'),
        get('--blue', '#4f8cff')
      ]
    };
  }

  function segCountFor(score) {
    return Math.min(W.maxSegments, W.baseSegments + Math.floor(score * 0.55));
  }

  function radiusOf(s) {
    return W.baseRadius + Math.min(9, s.score * 0.05);
  }

  function makeSnake(x, y, angle, colour, isPlayer, name) {
    const s = {
      x: x, y: y,
      angle: angle,
      targetAngle: angle,
      colour: colour,
      isPlayer: isPlayer,
      name: name,
      score: isPlayer ? 0 : 12 + Math.floor(Math.random() * 55),
      segments: [],
      boosting: false,
      alive: true,
      thinkTimer: Math.random() * 0.18,
      wanderAngle: angle,
      reckless: Math.random(),
      respawnAt: 0
    };
    const count = segCountFor(s.score);
    for (let i = 0; i < count; i++) {
      s.segments.push({
        x: x - Math.cos(angle) * i * W.spacing,
        y: y - Math.sin(angle) * i * W.spacing
      });
    }
    return s;
  }

  function randomPoint() {
    const a = Math.random() * TAU;
    // Keep clear of the centre so the player never spawns into a rival.
    const d = 520 + Math.random() * (W.radius - 800);
    return { x: Math.cos(a) * d, y: Math.sin(a) * d };
  }

  function findSpawnPoint() {
    for (let attempt = 0; attempt < 26; attempt++) {
      const p = randomPoint();
      let ok = true;
      for (let i = 0; i < snakes.length; i++) {
        const o = snakes[i];
        if (!o.alive) continue;
        if (Math.hypot(o.x - p.x, o.y - p.y) < 320) { ok = false; break; }
      }
      if (ok) return p;
    }
    return randomPoint();
  }

  function spawnPellet(x, y, colour, r) {
    // Death drops can outnumber the base field over a long session — cap it.
    if (pellets.length >= W.maxPellets) pellets.shift();
    pellets.push({
      x: x, y: y,
      colour: colour || pick(theme.accents),
      r: r || W.pelletR,
      phase: Math.random() * TAU
    });
  }

  function scatterPellets(n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const d = Math.sqrt(Math.random()) * (W.radius - 60);
      spawnPellet(Math.cos(a) * d, Math.sin(a) * d);
    }
  }

  function updateSnake(s, dt) {
    let diff = s.targetAngle - s.angle;
    diff = ((diff + Math.PI) % TAU + TAU) % TAU - Math.PI;
    const maxTurn = W.turnRate * dt;
    s.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));

    const boosting = s.boosting && s.score > 0;
    const speed = boosting ? W.boostSpeed : W.baseSpeed;

    s.x += Math.cos(s.angle) * speed * dt;
    s.y += Math.sin(s.angle) * speed * dt;

    if (boosting) s.score = Math.max(0, s.score - W.boostDrain * dt);

    // Rope follow: each segment sits exactly one spacing behind the previous.
    const segs = s.segments;
    segs[0].x = s.x;
    segs[0].y = s.y;
    for (let i = 1; i < segs.length; i++) {
      const p = segs[i - 1];
      const c = segs[i];
      const dx = c.x - p.x;
      const dy = c.y - p.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      c.x = p.x + (dx / d) * W.spacing;
      c.y = p.y + (dy / d) * W.spacing;
    }

    const want = segCountFor(s.score);
    while (segs.length < want) {
      // Extend in line with the tail, one spacing out — otherwise a new segment
      // spawns on top of the last one and the body visibly pinches.
      const last = segs[segs.length - 1];
      const prev = segs[segs.length - 2] || last;
      const dx = last.x - prev.x;
      const dy = last.y - prev.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      segs.push({ x: last.x + (dx / d) * W.spacing, y: last.y + (dy / d) * W.spacing });
    }
    while (segs.length > want) segs.pop();
  }

  function botThink(b) {
    const dc = Math.hypot(b.x, b.y);
    if (dc > W.radius - 300) {
      b.targetAngle = Math.atan2(-b.y, -b.x);
      b.boosting = false;
      return;
    }

    // Look ahead and dodge anything in the way. Better bots see further;
    // sloppy ones don't, so the arena actually produces casualties.
    const look = 78 + b.reckless * 44;
    const dangerR2 = 3600 + b.reckless * 2800;
    const ax = b.x + Math.cos(b.angle) * look;
    const ay = b.y + Math.sin(b.angle) * look;
    let danger = null;

    for (let i = 0; i < snakes.length && !danger; i++) {
      const o = snakes[i];
      if (o === b || !o.alive) continue;
      const segs = o.segments;
      for (let j = 0; j < segs.length; j += 3) {
        const dx = segs[j].x - ax;
        const dy = segs[j].y - ay;
        if (dx * dx + dy * dy < dangerR2) { danger = segs[j]; break; }
      }
    }

    if (danger) {
      b.targetAngle = Math.atan2(b.y - danger.y, b.x - danger.x);
      b.boosting = false;
      return;
    }

    // Otherwise chase the nearest pellet.
    let best = null;
    let bestD = 430 * 430;
    for (let i = 0; i < pellets.length; i++) {
      const p = pellets[i];
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD) { bestD = d2; best = p; }
    }

    if (best) {
      b.targetAngle = Math.atan2(best.y - b.y, best.x - b.x);
      b.boosting = b.score > 70 && Math.random() < 0.22;
    } else {
      b.wanderAngle += (Math.random() - 0.5) * 1.1;
      b.targetAngle = b.wanderAngle;
      b.boosting = false;
    }
  }

  function eatPellets(s) {
    const head = s.segments[0];
    const r = radiusOf(s) + W.pelletR + 6;
    const r2 = r * r;

    for (let i = pellets.length - 1; i >= 0; i--) {
      const p = pellets[i];
      const dx = p.x - head.x;
      const dy = p.y - head.y;
      if (dx * dx + dy * dy < r2) {
        pellets.splice(i, 1);
        s.score += 1;
        const a = Math.random() * TAU;
        const d = Math.sqrt(Math.random()) * (W.radius - 60);
        spawnPellet(Math.cos(a) * d, Math.sin(a) * d);
      }
    }
  }

  function killSnake(s) {
    if (!s.alive) return;
    s.alive = false;

    for (let i = 0; i < s.segments.length; i += 3) {
      spawnPellet(s.segments[i].x, s.segments[i].y, s.colour, W.pelletR + 2.5);
    }

    if (s.isPlayer) {
      onPlayerDeath(s);
    } else {
      s.respawnAt = performance.now() + 1600 + Math.random() * 1800;
    }
  }

  function checkCollisions() {
    for (let a = 0; a < snakes.length; a++) {
      const s = snakes[a];
      if (!s.alive) continue;

      const head = s.segments[0];
      const rs = radiusOf(s);

      if (Math.hypot(head.x, head.y) > W.radius) { killSnake(s); continue; }

      for (let b = 0; b < snakes.length; b++) {
        if (a === b) continue;
        const o = snakes[b];
        if (!o.alive) continue;

        // Cheap bounding rejection before the segment sweep.
        const bx = o.x - head.x;
        const by = o.y - head.y;
        const bound = o.segments.length * W.spacing + 90;
        if (bx * bx + by * by > bound * bound) continue;

        const hitR = rs + radiusOf(o) - 3;
        const hitR2 = hitR * hitR;
        const segs = o.segments;

        for (let i = 3; i < segs.length; i += 2) {
          const dx = segs[i].x - head.x;
          const dy = segs[i].y - head.y;
          if (dx * dx + dy * dy < hitR2) { killSnake(s); break; }
        }
        if (!s.alive) break;
      }
    }
  }

  function respawnBots(now) {
    for (let i = 0; i < snakes.length; i++) {
      const s = snakes[i];
      if (s.isPlayer || s.alive || !s.respawnAt || now < s.respawnAt) continue;
      const p = findSpawnPoint();
      const fresh = makeSnake(p.x, p.y, Math.random() * TAU, s.colour, false, s.name);
      snakes[i] = fresh;
    }
  }

  function onPlayerDeath(s) {
    running = false;
    pointer.boosting = false;

    const len = s.segments.length;
    const prevBest = readInt(BEST_KEY);
    const isBest = len > prevBest;
    if (isBest) write(BEST_KEY, len);
    els.best.textContent = String(Math.max(prevBest, len));

    els.msg.textContent = 'Crashed at length ' + len + '.';
    els.msg.className = 'arcade__msg is-lose';

    showCard(
      'Crashed',
      isBest
        ? 'You reached length ' + len + ' — a new personal best.'
        : 'You reached length ' + len + '. Best so far: ' + prevBest + '.',
      'Play again'
    );
  }

  /* ---------------- rendering ---------------- */

  function drawArena() {
    const half = viewHalf + 140;
    const left = cam.x - half;
    const right = cam.x + half;
    const top = cam.y - half;
    const bottom = cam.y + half;
    const step = 120;

    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1 / cam.zoom;
    ctx.beginPath();
    for (let x = Math.floor(left / step) * step; x < right; x += step) {
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    for (let y = Math.floor(top / step) * step; y < bottom; y += step) {
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, W.radius, 0, TAU);
    ctx.strokeStyle = withAlpha(theme.accents[0], 0.55);
    ctx.lineWidth = 5 / cam.zoom;
    ctx.stroke();
  }

  function drawPellets(now) {
    const pulse = 1 + Math.sin(now / 430) * 0.14;
    const half = viewHalf + 40;
    const groups = new Map();

    for (let i = 0; i < pellets.length; i++) {
      const p = pellets[i];
      if (Math.abs(p.x - cam.x) > half || Math.abs(p.y - cam.y) > half) continue;
      let arr = groups.get(p.colour);
      if (!arr) { arr = []; groups.set(p.colour, arr); }
      arr.push(p);
    }

    ctx.globalAlpha = 0.92;
    groups.forEach((arr, colour) => {
      ctx.beginPath();
      for (let i = 0; i < arr.length; i++) {
        const p = arr[i];
        const r = p.r * pulse;
        ctx.moveTo(p.x + r, p.y);
        ctx.arc(p.x, p.y, r, 0, TAU);
      }
      ctx.fillStyle = colour;
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawSnake(s, now) {
    const segs = s.segments;
    if (segs.length < 2) return;
    const r = radiusOf(s);

    ctx.beginPath();
    ctx.moveTo(segs[0].x, segs[0].y);
    for (let i = 1; i < segs.length; i++) ctx.lineTo(segs[i].x, segs[i].y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // outer glow
    ctx.strokeStyle = withAlpha(s.colour, 0.18);
    ctx.lineWidth = r * 2 + 13;
    ctx.stroke();

    // body
    ctx.strokeStyle = s.colour;
    ctx.lineWidth = r * 2;
    ctx.stroke();

    // boost shimmer
    if (s.boosting && s.score > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.18 + Math.sin(now / 90) * 0.1).toFixed(3) + ')';
      ctx.lineWidth = r * 1.1;
      ctx.stroke();
    }

    // eyes
    const head = segs[0];
    const ex = Math.cos(s.angle);
    const ey = Math.sin(s.angle);
    const px = -ey;
    const py = ex;
    const off = r * 0.42;
    const fwd = r * 0.34;
    const eyeR = r * 0.3;

    for (let k = 0; k < 2; k++) {
      const sgn = k === 0 ? 1 : -1;
      const cx = head.x + ex * fwd + px * off * sgn;
      const cy = head.y + ey * fwd + py * off * sgn;
      ctx.beginPath();
      ctx.arc(cx, cy, eyeR, 0, TAU);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + ex * eyeR * 0.42, cy + ey * eyeR * 0.42, eyeR * 0.52, 0, TAU);
      ctx.fillStyle = '#0a0b14';
      ctx.fill();
    }

    // name
    if (s.name) {
      ctx.font = '600 ' + (12.5 / cam.zoom).toFixed(1) + 'px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = s.isPlayer ? theme.text : withAlpha(theme.text, 0.68);
      ctx.fillText(s.name, head.x, head.y - r - 9 / cam.zoom);
    }
  }

  function render(now) {
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    if (!player) return;

    const targetZoom = Math.max(0.58, 1.06 - player.segments.length * 0.0013);
    cam.zoom += (targetZoom - cam.zoom) * 0.05;
    cam.x += (player.x - cam.x) * 0.16;
    cam.y += (player.y - cam.y) * 0.16;
    viewHalf = Math.max(w, h) / (2 * cam.zoom) + 60;

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    drawArena();
    drawPellets(now);

    for (let i = 0; i < snakes.length; i++) {
      const s = snakes[i];
      if (s.alive && !s.isPlayer) drawSnake(s, now);
    }
    if (player && player.alive) drawSnake(player, now);

    ctx.restore();
  }

  /* ---------------- simulation ---------------- */

  function update(dt, now) {
    if (pointer.active && player && player.alive) {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const dx = pointer.x - w / 2;
      const dy = pointer.y - h / 2;
      if (dx * dx + dy * dy > 64) player.targetAngle = Math.atan2(dy, dx);
    }

    for (let i = 0; i < snakes.length; i++) {
      const s = snakes[i];
      if (!s.alive) continue;

      if (s.isPlayer) {
        s.boosting = pointer.boosting && s.score > 0;
      } else {
        s.thinkTimer -= dt;
        if (s.thinkTimer <= 0) {
          botThink(s);
          s.thinkTimer = 0.09 + Math.random() * 0.07;
        }
      }

      updateSnake(s, dt);
      eatPellets(s);
    }

    checkCollisions();
    respawnBots(now);

    while (pellets.length < W.pelletCount) {
      const a = Math.random() * TAU;
      const d = Math.sqrt(Math.random()) * (W.radius - 60);
      spawnPellet(Math.cos(a) * d, Math.sin(a) * d);
    }

    hudTimer -= dt;
    if (hudTimer <= 0) { updateHud(); hudTimer = 0.15; }
  }

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - lastT) / 1000 || 0);
    lastT = now;

    if (running) update(dt, now);
    render(now);
  }

  /* ---------------- HUD ---------------- */

  function updateHud() {
    if (!player || !els.score) return;

    els.score.textContent = String(player.segments.length);

    let rivals = 0;
    for (let i = 0; i < snakes.length; i++) {
      if (snakes[i].alive && !snakes[i].isPlayer) rivals++;
    }
    els.alive.textContent = String(rivals);

    const ranked = snakes.filter((s) => s.alive).sort((a, b) => b.segments.length - a.segments.length);
    const top = ranked.slice(0, 5);
    let playerRank = ranked.indexOf(player);

    const rows = [];
    top.forEach((s, i) => rows.push(rowFor(s, i + 1)));
    if (player && player.alive && playerRank >= 5) {
      rows.push('<li class="is-you bl-gap">…</li>');
      rows.push(rowFor(player, playerRank + 1));
    }
    els.boardList.innerHTML = rows.join('');
  }

  function rowFor(s, rank) {
    return '<li' + (s.isPlayer ? ' class="is-you"' : '') + '>'
      + '<span class="bl-rank">' + rank + '</span>'
      + '<span class="bl-dot" style="--c:' + escapeHtml(s.colour) + '"></span>'
      + '<span class="bl-name">' + escapeHtml(s.name) + '</span>'
      + '<span class="bl-len">' + s.segments.length + '</span>'
      + '</li>';
  }

  /* ---------------- card + round ---------------- */

  function showCard(title, text, label) {
    if (!els.card) return;
    els.cardTitle.textContent = title;
    els.cardText.textContent = text;
    els.playLabel.textContent = label;
    els.card.hidden = false;
    els.card.classList.remove('is-faded');
  }

  function hideCard() {
    if (!els.card) return;
    els.card.classList.add('is-faded');
    window.setTimeout(() => { els.card.hidden = true; }, 320);
  }

  function newRound() {
    snakes = [];
    pellets = [];
    playerColour = theme.accents[1] || '#22d3ee';
    player = makeSnake(0, 0, 0, playerColour, true, 'You');
    snakes.push(player);

    const botColours = theme.accents.filter((c) => c !== playerColour);
    for (let i = 0; i < W.bots; i++) {
      const p = findSpawnPoint();
      snakes.push(makeSnake(p.x, p.y, Math.random() * TAU, botColours[i % botColours.length], false, NAMES[i % NAMES.length]));
    }

    scatterPellets(W.pelletCount);
    cam.x = 0;
    cam.y = 0;
    cam.zoom = 1;
    pointer.active = false;
    pointer.boosting = false;

    els.msg.textContent = '';
    els.msg.className = 'arcade__msg';
    els.best.textContent = String(readInt(BEST_KEY));
    updateHud();
  }

  function play() {
    hideCard();
    newRound();
    running = true;
    lastT = performance.now();
  }

  /* ---------------- canvas plumbing ---------------- */

  function resize() {
    if (!canvas || !stage) return;

    // clientWidth/Height are layout sizes, so they ignore the panel's opening
    // transform, and they match the canvas's own 100% box (offset* would include
    // the stage border). getBoundingClientRect() would report the scaled-down
    // box and leave the canvas rendering at the wrong resolution.
    const boxW = stage.clientWidth;
    const boxH = stage.clientHeight;
    if (boxW < 2 || boxH < 2) return;

    dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2);
    const w = Math.max(1, Math.round(boxW * dpr));
    const h = Math.max(1, Math.round(boxH * dpr));

    // Assigning width/height wipes the canvas, so only do it on a real change.
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
  }

  function bindInput() {
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.active = true;
    });

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.active = true;
      pointer.boosting = true;
    });

    window.addEventListener('pointerup', () => { pointer.boosting = false; });
    window.addEventListener('pointercancel', () => { pointer.boosting = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function onKeyDown(e) {
    if (e.key === ' ' || e.code === 'Space') {
      if (!running) return;
      e.preventDefault();
      pointer.boosting = true;
    }
  }

  function onKeyUp(e) {
    if (e.key === ' ' || e.code === 'Space') pointer.boosting = false;
  }

  /* ---------------------------------------------------------
     Registry
     --------------------------------------------------------- */
  const GAMES = {
    serpents: {
      start() {
        if (!built) {
          canvas = $('#spCanvas');
          stage = $('#spStage');
          if (!canvas || !stage) return;
          ctx = canvas.getContext('2d');

          els = {
            score: $('#spScore'),
            best: $('#spBest'),
            alive: $('#spAlive'),
            msg: $('#spMsg'),
            boardList: $('#spBoardList'),
            card: $('#spCard'),
            cardTitle: $('#spCardTitle'),
            cardText: $('#spCardText'),
            playLabel: $('#spPlayLabel')
          };

          const small = window.innerWidth < 720;
          lowPower = small;
          W.bots = small ? 7 : 12;
          W.pelletCount = small ? 380 : 620;
          W.maxPellets = small ? 560 : 900;

          bindInput();
          const playBtn = $('#spPlay');
          if (playBtn) playBtn.addEventListener('click', play);
          const restart = $('#spRestart');
          if (restart) restart.addEventListener('click', play);

          if (window.ResizeObserver) {
            new ResizeObserver(() => { if (overlay && !overlay.hidden) resize(); }).observe(stage);
          } else {
            window.addEventListener('resize', () => { if (overlay && !overlay.hidden) resize(); });
          }

          built = true;
        }

        refreshTheme();
        resize();
        newRound();
        showCard(
          'Neon Serpents',
          'Eat the glowing pellets to grow. Steer with your pointer or finger. Hold to boost — but it burns your length.',
          'Play'
        );
        running = false;
        lastT = performance.now();
        if (!rafId) rafId = requestAnimationFrame(frame);
      },

      stop() {
        running = false;
        pointer.boosting = false;
        pointer.active = false;
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      },

      onKeyDown: onKeyDown,
      onKeyUp: onKeyUp
    }
  };

  /* ---------------------------------------------------------
     Wiring
     --------------------------------------------------------- */
  document.querySelectorAll('[data-game]').forEach((btn) => {
    btn.addEventListener('click', () => openOverlay(btn.dataset.game));
  });

  const playBtn = $('#playSerpents');
  if (playBtn) playBtn.addEventListener('click', () => openOverlay('serpents'));

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target.closest('[data-arcade-close]')) closeOverlay();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (!overlay || overlay.hidden) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      closeOverlay();
      return;
    }

    trapFocus(e);
    if (activeId && GAMES[activeId] && GAMES[activeId].onKeyDown) GAMES[activeId].onKeyDown(e);
  });

  document.addEventListener('keyup', (e) => {
    if (!overlay || overlay.hidden) return;
    if (activeId && GAMES[activeId] && GAMES[activeId].onKeyUp) GAMES[activeId].onKeyUp(e);
  });
})();
