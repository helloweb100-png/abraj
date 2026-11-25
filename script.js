/* ==========================================================================
   ABRAJ · script.js
   Sin librerías: Web Animations, canvas y requestAnimationFrame.
   Regla de oro: si algo falla, el contenido queda visible (los estados
   ocultos solo existen bajo la clase .rdy, que se agrega al arrancar).
   ========================================================================== */

/* Único lugar donde vive el número de WhatsApp (formato internacional sin "+").
   Si un valor queda vacío, se ocultan los CTA de WhatsApp y el envío del formulario. */
const WHATSAPP = { principal: '524439425320', edomex: '525656866128' };

(() => {
  'use strict';

  const doc = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const isDesktop = () => matchMedia('(min-width: 1024px)').matches;
  const safe = (fn, name) => { try { return fn(); } catch (err) { console.warn('[ABRAJ]', name || fn.name, err); } };

  // Liberación garantizada del bloqueo de scroll y marca de "JS listo"
  setTimeout(() => doc.classList.remove('is-loading'), 2400);
  doc.classList.add('rdy');

  let ready = false;          // el cargador ya terminó
  let loaderDone = false;

  /* ------------------------------------------------------------------
     1 · WhatsApp: convierte todos los [data-wa] en enlaces wa.me
     ------------------------------------------------------------------ */
  const waURL = (num, msg) => `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
  safe(() => {
    $$('[data-wa]').forEach((el) => {
      const num = WHATSAPP[el.dataset.waTo || 'principal'];
      if (!num) { el.hidden = true; return; }
      el.href = waURL(num, el.dataset.wa);
      el.target = '_blank';
      el.rel = 'noopener';
    });
    if (!WHATSAPP.principal) {
      const send = $('#f-send'), micro = $('#f-micro'), fb = $('#f-fallback');
      if (send) send.hidden = true;
      if (micro) micro.hidden = true;
      if (fb) fb.hidden = false;
    }
  }, 'whatsapp');

  /* ------------------------------------------------------------------
     2 · Cargador (≤ 2.2 s; el CSS lo mata a los 2.5 s si todo falla)
     ------------------------------------------------------------------ */
  const loader = $('#loader');
  const ldN = $('#ld-n');
  const t0 = performance.now();
  const LD_DUR = reduce ? 500 : 1700;

  function finishLoader() {
    if (loaderDone) return;
    loaderDone = true;
    if (loader) loader.classList.add('is-done');
    document.body.classList.add('loaded');
    doc.classList.remove('is-loading');
    ready = true;
    revealCheck();
    update();
    safe(() => {
      const wa = $('#wa-float'), bub = $('#wa-bubble');
      if (wa && !wa.hidden && bub) {
        setTimeout(() => { bub.classList.add('show'); setTimeout(() => bub.classList.remove('show'), 5000); }, 6000);
      }
    }, 'burbuja');
  }

  function tickLoader(now) {
    const p = clamp((now - t0) / LD_DUR);
    if (ldN) ldN.textContent = String(Math.round(ease(p) * 100)).padStart(3, '0');
    if (p < 1 && !loaderDone) requestAnimationFrame(tickLoader);
  }
  if (loader) {
    requestAnimationFrame(tickLoader);
    const minT = new Promise((r) => setTimeout(r, reduce ? 500 : 1800));
    const winL = new Promise((r) => (document.readyState === 'complete' ? r() : addEventListener('load', r, { once: true })));
    Promise.race([Promise.all([minT, winL]), new Promise((r) => setTimeout(r, 2200))]).then(finishLoader);
  } else { finishLoader(); }

  /* ------------------------------------------------------------------
     3 · Utilidades de texto: partir títulos y palabras
     ------------------------------------------------------------------ */
  function splitNode(node, st) {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
          const i = document.createElement('span'); i.className = 'w__i'; i.textContent = part;
          i.style.setProperty('--wi', st.n++);
          w.appendChild(i); frag.appendChild(w);
        });
        node.replaceChild(frag, child);
      } else if (child.nodeType === 1) splitNode(child, st);
    });
  }
  safe(() => $$('[data-split]').forEach((el) => { el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim()); splitNode(el, { n: 0 }); }), 'split');

  let manWords = [];
  safe(() => {
    const el = $('[data-words]'); if (!el) return;
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    const walk = (node) => Array.from(node.childNodes).forEach((c) => {
      if (c.nodeType === 3) {
        const frag = document.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const s = document.createElement('span'); s.className = 'mw'; s.textContent = part; s.setAttribute('aria-hidden', 'true');
          frag.appendChild(s); manWords.push(s);
        });
        node.replaceChild(frag, c);
      } else if (c.nodeType === 1) walk(c);
    });
    walk(el);
  }, 'words');

  /* ------------------------------------------------------------------
     4 · Revelado al scroll (IntersectionObserver + respaldo por geometría)
     ------------------------------------------------------------------ */
  const revealEls = $$('[data-reveal], [data-split]');
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting && ready) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
      }, { threshold: .15, rootMargin: '0px 0px -8% 0px' })
    : null;
  if (io) revealEls.forEach((el) => io.observe(el));

  function revealCheck() {
    if (!ready) return;
    const vh = innerHeight;
    revealEls.forEach((el) => {
      if (el.classList.contains('is-in')) return;
      const r = el.getBoundingClientRect();
      /* También lo que ya quedó por encima (salto rápido de scroll / ancla) */
      if (r.top < vh * .92) { el.classList.add('is-in'); if (io) io.unobserve(el); }
    });
  }
  setTimeout(() => { if (!ready) finishLoader(); revealCheck(); }, 2000);
  setTimeout(() => {
    revealEls.forEach((el) => { if (!el.classList.contains('is-in') && el.getBoundingClientRect().top < innerHeight * 1.5) el.classList.add('is-in'); });
  }, 4000);
  /* Red de seguridad: si algo sigue oculto 8 s después (capturas de página completa,
     scroll programático, pestañas en segundo plano), se muestra todo. */
  setTimeout(() => { revealEls.forEach((el) => el.classList.add('is-in')); $$('.mw').forEach((w) => w.classList.add('on')); }, 8000);
  addEventListener('load', () => setTimeout(revealCheck, 2500));
  let scrEnd;
  addEventListener('scroll', () => { clearTimeout(scrEnd); scrEnd = setTimeout(revealCheck, 200); }, { passive: true });

  /* ------------------------------------------------------------------
     5 · Marquesinas: rellena hasta cubrir la pantalla
     ------------------------------------------------------------------ */
  const marquees = $$('.marquee').map((m) => {
    const groups = $$('.marquee__group', m);
    return { groups, base: groups[0] ? groups[0].innerHTML : '' };
  });
  function fillMarquees() {
    marquees.forEach(({ groups, base }) => {
      if (!groups.length) return;
      const first = groups[0];
      first.innerHTML = base;
      let guard = 0;
      while (first.scrollWidth < innerWidth && guard++ < 8) first.innerHTML += base;
      groups.slice(1).forEach((g) => { g.innerHTML = first.innerHTML; });
    });
  }
  safe(fillMarquees, 'marquesinas');
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => safe(fillMarquees, 'marquesinas'));

  /* ------------------------------------------------------------------
     6 · Encabezado, menú, scroll-spy, progreso de lectura
     ------------------------------------------------------------------ */
  const hdr = $('#hdr');
  const burger = $('.burger');
  const menu = $('#menu');
  let menuOpen = false;
  function toggleMenu(force) {
    menuOpen = typeof force === 'boolean' ? force : !menuOpen;
    if (menu) { menu.classList.toggle('is-open', menuOpen); menu.setAttribute('aria-hidden', String(!menuOpen)); }
    if (burger) { burger.setAttribute('aria-expanded', String(menuOpen)); burger.setAttribute('aria-label', menuOpen ? 'Cerrar menú' : 'Abrir menú'); }
    doc.style.overflow = menuOpen ? 'hidden' : '';
    if (menuOpen && hdr) hdr.classList.remove('is-hidden');
  }
  if (burger) burger.addEventListener('click', () => toggleMenu());
  $$('#menu a').forEach((a) => a.addEventListener('click', () => toggleMenu(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) toggleMenu(false); });

  const navLinks = $$('.nav a');
  const navInd = $('.nav__ind');
  const spyIds = ['servicios', 'sectores', 'metodo', 'nosotros', 'unete', 'contacto'];
  const spySecs = spyIds.map((id) => document.getElementById(id));
  let spyCur = -2;
  function placeInd(i) {
    if (!navInd) return;
    const a = navLinks[i];
    if (!a) { navInd.style.setProperty('--o', '0'); return; }
    navInd.style.setProperty('--x', a.offsetLeft + 'px');
    navInd.style.setProperty('--w', a.offsetWidth + 'px');
    navInd.style.setProperty('--o', '1');
  }
  function spy() {
    const line = innerHeight * .4;
    let idx = -1;
    spySecs.forEach((s, i) => { if (!s) return; const r = s.getBoundingClientRect(); if (r.top <= line && r.bottom > line) idx = i; });
    if (idx !== spyCur) {
      spyCur = idx;
      navLinks.forEach((a, i) => a.classList.toggle('is-active', i === idx));
      placeInd(idx);
    }
  }

  let lastY = scrollY;
  function headerUpdate() {
    const y = scrollY;
    const dy = y - lastY;
    if (Math.abs(dy) > 6) {
      if (hdr) hdr.classList.toggle('is-hidden', dy > 0 && y > 240 && !menuOpen);
      lastY = y;
    }
    const max = Math.max(1, doc.scrollHeight - innerHeight);
    const read = clamp(y / max);
    if (hdr) hdr.style.setProperty('--read', read.toFixed(4));
    const ring = $('#totop-ring');
    if (ring) ring.style.strokeDashoffset = String(100 - read * 100);
  }
  const totop = $('#totop');
  if (totop) totop.addEventListener('click', () => scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));

  /* ------------------------------------------------------------------
     7 · Progreso de scroll (--p) y efectos anclados
     ------------------------------------------------------------------ */
  const scrubs = $$('[data-scrub]').map((el) => ({ el, type: el.dataset.scrub || 'pass' }));
  function computeP(type, el) {
    const r = el.getBoundingClientRect();
    const vh = innerHeight;
    switch (type) {
      case 'exit': return clamp(-r.top / Math.max(1, r.height));
      case 'sticky': return clamp(-r.top / Math.max(1, r.height - vh));
      case 'words': return clamp((vh * .85 - r.top) / (vh * .6));
      case 'steps': return clamp((vh * .6 - r.top) / Math.max(1, r.height));
      case 'enter': return clamp((vh - r.top) / (vh * .95));
      default: return clamp((vh - r.top) / (vh + r.height));
    }
  }

  /* --- Servicios --- */
  const svc = $('#servicios');
  const svcPin = $('#svc-pin');
  const svcTrack = $('#svc-track');
  const cards = $$('[data-card]');
  const svcCur = $('#svc-cur');
  let svcLive = false;
  function setSvcLive() {
    const live = isDesktop() && !reduce;
    if (live !== svcLive) {
      svcLive = live;
      if (svc) svc.classList.toggle('is-live', live);
      if (!live && svcTrack) svcTrack.style.removeProperty('--tx-svc');
      cards.forEach((c) => { c.style.removeProperty('--depth'); });
    }
  }
  function svcUpdate(p) {
    if (!cards.length) return;
    if (reduce) { cards.forEach((c) => c.classList.add('is-active')); return; }
    if (svcLive) {
      const maxT = Math.max(0, svcTrack.scrollWidth - innerWidth);
      svcTrack.style.setProperty('--tx-svc', (-p * maxT).toFixed(1) + 'px');
      svcTrack.parentElement.style.setProperty('--bar', p.toFixed(4));
      const target = innerWidth * .55;
      let best = 0, bd = Infinity;
      cards.forEach((c, i) => { const r = c.getBoundingClientRect(); const d = Math.abs(r.left + r.width / 2 - target); if (d < bd) { bd = d; best = i; } });
      cards.forEach((c, i) => c.classList.toggle('is-active', i === best));
      if (svcCur) svcCur.textContent = '0' + (best + 1);
    } else {
      const vh = innerHeight;
      let act = -1;
      cards.forEach((c, i) => {
        const r = c.getBoundingClientRect();
        if (r.top < vh * .62 && r.bottom > vh * .2) act = i;
        const next = cards[i + 1];
        if (next) {
          const nr = next.getBoundingClientRect();
          const thisTop = 84 + i * 14;
          c.style.setProperty('--depth', clamp(1 - (nr.top - (thisTop + 14)) / (r.height * .8)).toFixed(3));
        }
      });
      cards.forEach((c, i) => c.classList.toggle('is-active', i === act));
    }
  }

  /* --- Método: cinta ondulada que se dibuja --- */
  const metSteps = $('#met-steps');
  const metSvg = $('#met-svg');
  const metRail = $('#met-rail');
  const metDraw = $('#met-draw');
  const metDrop = $('#met-drop');
  const stepEls = $$('[data-step]');
  const metRoll = $('#met-roll');
  const metCur = $('#met-cur');
  const metTitles = $$('.met__titles span');
  let metLen = 0;
  function buildRibbon() {
    if (!metSteps || !metSvg || !metRail || !metDraw) return;
    const h = metSteps.offsetHeight;
    const amp = innerWidth >= 900 ? 9 : 0;
    let d = 'M22 0';
    for (let y = 8; y <= h; y += 8) d += ` L${(22 + amp * Math.sin(y / 58)).toFixed(2)} ${y}`;
    metSvg.setAttribute('viewBox', `0 0 44 ${h}`);
    metRail.setAttribute('d', d);
    metDraw.setAttribute('d', d);
    metLen = metDraw.getTotalLength();
    metDraw.style.strokeDasharray = String(metLen);
    metDraw.style.strokeDashoffset = String(metLen);
    if (metDrop) metDrop.style.opacity = '0';
  }
  function metUpdate(p) {
    if (!metSteps || !metLen) return;
    const top = metSteps.getBoundingClientRect().top;
    const h = metSteps.offsetHeight;
    const lineY = p * h;
    let idx = 0;
    stepEls.forEach((s, i) => {
      const n = $('.step__node', s);
      const r = n.getBoundingClientRect();
      const y = r.top + r.height / 2 - top;
      const on = y <= lineY;
      s.classList.toggle('is-on', on);
      if (on) idx = i;
    });
    metDraw.style.strokeDashoffset = String(metLen * (1 - p));
    const pt = metDraw.getPointAtLength(metLen * p);
    if (metDrop) { metDrop.setAttribute('cx', pt.x.toFixed(1)); metDrop.setAttribute('cy', pt.y.toFixed(1)); metDrop.style.opacity = p > .01 && p < .995 ? '1' : '0'; }
    if (metRoll) metRoll.style.setProperty('--k', idx);
    if (metCur) metCur.textContent = String(idx + 1);
    metTitles.forEach((t, i) => t.classList.toggle('is-on', i === idx));
  }

  /* --- Nosotros: la imagen se abre en grande --- */
  const about = $('#nosotros');
  if (about && !reduce) about.classList.add('is-live');
  function aboutUpdate(p) {
    if (!about || reduce) return;
    const e = ease(clamp(p / .7));
    about.style.setProperty('--e', e.toFixed(4));
    about.style.setProperty('--sc', (2.4 - 1.4 * e).toFixed(4));
    about.style.setProperty('--c', p > .6 ? '1' : '0');
  }

  /* --- Cobertura: el arco se dibuja --- */
  const arcDraw = $('#arc-draw');

  /* --- Bucle de actualización por scroll --- */
  let ticking = false;
  function update() {
    ticking = false;
    const vh = innerHeight;
    scrubs.forEach(({ el, type }) => {
      const r = el.getBoundingClientRect();
      // Evita trabajo lejos de la pantalla (salvo los que escriben estado global)
      if (r.bottom < -vh * 1.5 || r.top > vh * 2.5) {
        if (el.id !== 'inicio' && el.tagName !== 'FOOTER' && type !== 'sticky') return;
      }
      const p = computeP(type, el);
      el.style.setProperty('--p', p.toFixed(4));
      if (el.id === 'svc-pin') svcUpdate(p);
      else if (el.id === 'nosotros') aboutUpdate(p);
      else if (type === 'words' && manWords.length) {
        const n = Math.round(p * (manWords.length + 3));
        manWords.forEach((w, i) => w.classList.toggle('on', i < n));
      } else if (type === 'steps') metUpdate(p);
      else if (el.id === 'cobertura' && arcDraw) arcDraw.style.strokeDashoffset = String(1 - clamp((p - .12) / .3));
    });
    if (!svcLive) svcUpdate(0);
    headerUpdate();
    spy();
    revealCheck();
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  addEventListener('scroll', onScroll, { passive: true });

  let rzT;
  addEventListener('resize', () => {
    clearTimeout(rzT);
    rzT = setTimeout(() => {
      setSvcLive(); buildRibbon(); positionTab(); fillMarquees(); placeInd(spyCur);
      if (innerWidth >= 1024 && menuOpen) toggleMenu(false);
      update();
    }, 120);
    onScroll();
  });

  /* ------------------------------------------------------------------
     8 · Hero: «Purificación» (canvas) + escenario 3D + haz de luz
     ------------------------------------------------------------------ */
  const hero = $('#inicio');
  const cv = $('#purificacion');
  let heroVisible = true;
  let ptr = null;                 // puntero en coordenadas del lienzo
  let nx = 0, ny = 0, hasPtr = false, lastMove = 0;
  let cx = 0, cy = 0;
  const tilt = $('.stage__tilt');

  const purify = (() => {
    if (!cv || !cv.getContext) return null;
    const ctx = cv.getContext('2d');
    if (!ctx) return null;
    const TH = 18 * Math.PI / 180, COS = Math.cos(TH), SIN = Math.sin(TH);
    const rnd = (a, b) => a + Math.random() * (b - a);
    let W = 1, H = 1, dpr = 1, bandT = 0;
    const parts = [], bubs = [];
    const mobile = innerWidth < 700;
    const N = mobile ? 48 : 150, NB = 12;

    function mk() { return { x: rnd(0, W), y: rnd(0, H), r: rnd(.6, 2.2), vx: rnd(-6, 6), vy: rnd(-9, -1), a: rnd(.15, .5), ph: rnd(0, 6.28), st: 0, t: 0, glow: 0 }; }
    function size() {
      dpr = Math.min(devicePixelRatio || 1, 1.5);
      const r = cv.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!parts.length) {
        for (let i = 0; i < N; i++) parts.push(mk());
        for (let i = 0; i < NB; i++) bubs.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(6, 22), vy: rnd(14, 34), ph: rnd(0, 6.28), sw: rnd(10, 26) });
      }
    }
    function star(x, y, s) {
      ctx.beginPath();
      ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y);
      ctx.quadraticCurveTo(x, y, x, y + s); ctx.quadraticCurveTo(x, y, x - s, y);
      ctx.quadraticCurveTo(x, y, x, y - s); ctx.fill();
    }
    function frame(now, dt) {
      const bandW = W * .22;
      const umax = W * COS + H * SIN;
      bandT = (bandT + dt) % 7;
      const uc = -bandW / 2 + (bandT / 7) * (umax + bandW);
      ctx.clearRect(0, 0, W, H);

      // Banda de barrido inclinada 18°
      ctx.save();
      ctx.rotate(TH);
      const g = ctx.createLinearGradient(uc - bandW / 2, 0, uc + bandW / 2, 0);
      g.addColorStop(0, 'rgba(34,201,214,0)'); g.addColorStop(.5, 'rgba(34,201,214,.18)'); g.addColorStop(1, 'rgba(34,201,214,0)');
      ctx.fillStyle = g;
      ctx.fillRect(uc - bandW / 2, -(W + H), bandW, (W + H) * 3);
      ctx.restore();

      // Burbujas
      ctx.lineWidth = 1.2;
      bubs.forEach((b) => {
        b.y -= b.vy * dt;
        if (b.y < -b.r * 2) { b.y = H + b.r; b.x = rnd(0, W); }
        const x = b.x + Math.sin(now / 1000 * .8 + b.ph) * b.sw;
        ctx.beginPath(); ctx.arc(x, b.y, b.r, 0, 6.2832);
        ctx.fillStyle = 'rgba(111,230,236,.04)'; ctx.fill();
        ctx.strokeStyle = 'rgba(111,230,236,.35)'; ctx.stroke();
        ctx.beginPath(); ctx.arc(x, b.y, b.r * .72, 3.6, 4.5);
        ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.stroke();
      });

      // Polvo, destellos y chispas
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (p.st === 0) {
          p.x += (p.vx + Math.sin(now / 1500 + p.ph) * 4) * dt;
          p.y += p.vy * dt;
          if (p.y < -5) p.y = H + 5;
          if (p.x < -5) p.x = W + 5; else if (p.x > W + 5) p.x = -5;
          if (ptr) {
            const dx = p.x - ptr.x, dy = p.y - ptr.y, d2 = dx * dx + dy * dy;
            if (d2 < 8100) { const d = Math.sqrt(d2) || 1, f = 1 - d / 90; p.x += dx / d * f * 140 * dt; p.y += dy / d * f * 140 * dt; p.glow = .45; }
          }
          if (p.glow > 0) p.glow = Math.max(0, p.glow - dt);
          const u = p.x * COS + p.y * SIN;
          if (Math.abs(u - uc) < bandW / 2 && dt > 0) { p.st = 1; p.t = 0; }
          ctx.fillStyle = `rgba(190,225,240,${Math.min(1, p.a + p.glow)})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (p.glow > 0 ? 1.6 : 1), 0, 6.2832); ctx.fill();
        } else {
          p.t += dt;
          if (p.st === 1) {
            ctx.fillStyle = 'rgba(111,230,236,.22)';
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4.5, 0, 6.2832); ctx.fill();
            ctx.fillStyle = 'rgba(225,255,255,.95)';
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.5, 0, 6.2832); ctx.fill();
            if (p.t > .35) { p.st = 2; p.t = 0; }
          } else {
            ctx.fillStyle = `rgba(200,255,255,${1 - p.t / .5})`;
            star(p.x, p.y, 3 + p.r * 4);
            if (p.t > .5) {
              p.st = 0; p.t = 0;
              let ok = false;
              for (let k = 0; k < 6 && !ok; k++) {
                const x = rnd(0, W), y = rnd(0, H);
                if (x * COS + y * SIN < uc - bandW / 2 - 20) { p.x = x; p.y = y; ok = true; }
              }
              if (!ok) { p.x = -4; p.y = rnd(0, H); }
              p.r = rnd(.6, 2.2); p.a = rnd(.15, .5);
            }
          }
        }
      }
    }
    size();
    return { size, frame, still() { bandT = 3.2; frame(0, 0); } };
  })();

  if (purify) {
    if (reduce) purify.still();
    addEventListener('resize', () => { safe(() => { purify.size(); if (reduce) purify.still(); }, 'canvas'); });
  }

  if (hero) {
    if ('IntersectionObserver' in window) new IntersectionObserver((en) => { heroVisible = en[0].isIntersecting; }, { threshold: 0 }).observe(hero);
    hero.addEventListener('pointermove', (e) => {
      if (cv) { const r = cv.getBoundingClientRect(); ptr = { x: e.clientX - r.left, y: e.clientY - r.top }; }
      if (e.pointerType === 'mouse') {
        nx = (e.clientX / innerWidth - .5) * 2; ny = (e.clientY / innerHeight - .5) * 2;
        hasPtr = true; lastMove = performance.now();
      }
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { ptr = null; });
  }

  /* ------------------------------------------------------------------
     9 · Bucle principal: tilt 3D, cursor, canvas
     ------------------------------------------------------------------ */
  const glow = $('.cursor-glow');
  let gx = innerWidth / 2, gy = innerHeight / 2, gtx = gx, gty = gy;
  if (glow && fine) {
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      gtx = e.clientX; gty = e.clientY;
      const over = e.target && e.target.closest && e.target.closest('.sec--light, .wave, .met, .glass, .faq, .prin');
      glow.classList.toggle('on', !over);
    }, { passive: true });
  }

  let lastT = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    if (document.hidden) { lastT = now; return; }
    const dt = Math.min(.05, (now - lastT) / 1000);
    lastT = now;
    const t = now / 1000;

    if (tilt && heroVisible && !reduce) {
      let tx, ty;
      if (hasPtr && now - lastMove < 2500) { tx = nx * 14; ty = -ny * 10; }
      else { tx = Math.sin(t * .6) * 14; ty = Math.cos(t * .45) * 8; }
      cx = lerp(cx, tx, .06); cy = lerp(cy, ty, .06);
      tilt.style.setProperty('--ry', cx.toFixed(2) + 'deg');
      tilt.style.setProperty('--rx', cy.toFixed(2) + 'deg');
    }
    if (purify && heroVisible && !reduce) purify.frame(now, dt);
    if (glow && fine && glow.classList.contains('on')) {
      gx = lerp(gx, gtx, .12); gy = lerp(gy, gty, .12);
      glow.style.transform = `translate(${gx.toFixed(1)}px, ${gy.toFixed(1)}px)`;
    }
  }
  requestAnimationFrame(loop);

  /* ------------------------------------------------------------------
     10 · Botones magnéticos
     ------------------------------------------------------------------ */
  if (fine && !reduce) {
    $$('.magnet').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        b.style.setProperty('--tx', clamp(dx * .22, -8, 8).toFixed(1) + 'px');
        b.style.setProperty('--ty', clamp(dy * .28, -8, 8).toFixed(1) + 'px');
      });
      b.addEventListener('pointerleave', () => { b.style.setProperty('--tx', '0px'); b.style.setProperty('--ty', '0px'); });
    });
  }

  /* ------------------------------------------------------------------
     11 · Cristal: niebla que se limpia con el dedo
     ------------------------------------------------------------------ */
  safe(() => {
    const frame = $('#gframe');
    if (!frame) return;
    const badgeCta = $('#g-badge');
    const ringEl = $('#g-ring');
    const btnClean = $('#g-clean');
    const c = document.createElement('canvas');
    c.setAttribute('aria-hidden', 'true');
    frame.insertBefore(c, badgeCta);
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const GX = 36, GY = 50;
    let W = 0, H = 0, dpr = 1, lw = 54;
    let grid = new Uint8Array(GX * GY), count = 0;
    let complete = false, userActive = false, hintRun = 0, hintDone = false, resetT = 0;
    let drawing = false, last = null;

    function paintFog() {
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0;
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, 'rgba(231,243,248,.96)'); g.addColorStop(1, 'rgba(190,215,228,.96)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 80; i++) {
        const x = Math.random() * W, y = Math.random() * H * (Math.random() < .6 ? .6 : 1), r = 1.5 + Math.random() * 7;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832);
        ctx.fillStyle = 'rgba(255,255,255,.32)'; ctx.fill();
        ctx.strokeStyle = 'rgba(110,150,175,.22)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath(); ctx.arc(x - r * .25, y - r * .25, r * .3, 0, 6.2832);
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fill();
      }
    }
    function resetGrid() { grid = new Uint8Array(GX * GY); count = 0; if (ringEl) ringEl.style.strokeDashoffset = '100'; }
    function size() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = frame.clientWidth; H = frame.clientHeight;
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lw = (innerWidth < 640 ? 28 : 34) * 1.6;
      paintFog(); resetGrid(); complete = false;
      frame.classList.remove('is-clean');
    }
    function mark(x, y, r) {
      const cw = W / GX, ch = H / GY;
      const x0 = Math.max(0, Math.floor((x - r) / cw)), x1 = Math.min(GX - 1, Math.floor((x + r) / cw));
      const y0 = Math.max(0, Math.floor((y - r) / ch)), y1 = Math.min(GY - 1, Math.floor((y + r) / ch));
      for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
        const dx = (gx + .5) * cw - x, dy = (gy + .5) * ch - y;
        if (dx * dx + dy * dy < r * r) { const k = gy * GX + gx; if (!grid[k]) { grid[k] = 1; count++; } }
      }
    }
    function progress() {
      const pct = count / (GX * GY);
      if (ringEl) ringEl.style.strokeDashoffset = String(100 - clamp(pct / .6) * 100);
      if (pct >= .6 && !complete) finish(last);
    }
    function erase(x0, y0, x1, y1, width) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.lineWidth = width || lw; ctx.strokeStyle = '#000'; ctx.shadowColor = '#000'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over';
      const dist = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(1, Math.ceil(dist / ((width || lw) / 3)));
      for (let i = 0; i <= steps; i++) mark(lerp(x0, x1, i / steps), lerp(y0, y1, i / steps), (width || lw) / 2);
    }
    function finish(from) {
      if (complete) return;
      complete = true;
      const ox = from ? from.x : W / 2, oy = from ? from.y : H / 2;
      const R = Math.hypot(W, H), t1 = performance.now();
      (function wave(now) {
        const p = clamp((now - t1) / 700);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath(); ctx.arc(ox, oy, R * ease(p), 0, 6.2832); ctx.fillStyle = '#000'; ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        if (p < 1) requestAnimationFrame(wave);
      })(t1);
      if (ringEl) ringEl.style.strokeDashoffset = '0';
      frame.classList.add('is-clean');
      clearTimeout(resetT);
      resetT = setTimeout(refog, 12000);
    }
    function refog() {
      c.style.transition = 'none'; c.style.opacity = '0';
      paintFog(); resetGrid(); complete = false; userActive = false; hintDone = false;
      frame.classList.remove('is-clean');
      void c.offsetWidth;
      c.style.transition = 'opacity 3s ease'; c.style.opacity = '1';
      setTimeout(() => { if (!userActive) playHint(); }, 3200);
    }
    function playHint() {
      if (hintDone || complete || userActive || reduce) return;
      hintDone = true;
      const id = ++hintRun;
      const pts = [[.12, .26], [.88, .26], [.88, .5], [.12, .5], [.12, .74], [.88, .74]].map(([a, b]) => ({ x: a * W, y: b * H }));
      let total = 0; const segs = [];
      for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); segs.push(l); total += l; }
      const t1 = performance.now(), D = 3200; let prev = pts[0];
      (function step(now) {
        if (id !== hintRun || userActive || complete) return;
        const d = clamp((now - t1) / D) * total;
        let acc = 0, pos = pts[pts.length - 1];
        for (let i = 0; i < segs.length; i++) {
          if (d <= acc + segs[i]) { const k = (d - acc) / segs[i]; pos = { x: lerp(pts[i].x, pts[i + 1].x, k), y: lerp(pts[i].y, pts[i + 1].y, k) }; break; }
          acc += segs[i];
        }
        erase(prev.x, prev.y, pos.x, pos.y, 40);
        prev = pos;
        if (d < total) requestAnimationFrame(step); else progress();
      })(t1);
    }

    const pt = (e) => { const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; };
    c.addEventListener('pointerdown', (e) => {
      drawing = true; userActive = true; hintRun++;
      last = pt(e); erase(last.x, last.y, last.x, last.y); progress();
      try { c.setPointerCapture(e.pointerId); } catch (_) { /* sin captura */ }
    });
    c.addEventListener('pointermove', (e) => {
      if (!(drawing || e.pointerType === 'mouse')) return;
      userActive = true; hintRun++;
      const p = pt(e);
      if (!last) last = p;
      erase(last.x, last.y, p.x, p.y);
      last = p; progress();
    });
    const stop = () => { drawing = false; last = null; };
    c.addEventListener('pointerup', stop); c.addEventListener('pointercancel', stop); c.addEventListener('pointerleave', () => { last = null; });
    if (btnClean) btnClean.addEventListener('click', () => { userActive = true; hintRun++; finish(); });

    size();
    let lastW = frame.clientWidth;
    addEventListener('resize', () => { if (Math.abs(frame.clientWidth - lastW) > 30) { lastW = frame.clientWidth; size(); } });
    if ('IntersectionObserver' in window) {
      const o = new IntersectionObserver((en) => {
        if (en[0].isIntersecting && !hintDone && !userActive) { setTimeout(playHint, 500); }
      }, { threshold: .5 });
      o.observe(frame);
    }
  }, 'cristal');

  /* ------------------------------------------------------------------
     12 · Sectores: acordeón con rotación automática
     ------------------------------------------------------------------ */
  safe(() => {
    const acc = $('#acc');
    if (!acc) return;
    const pns = $$('.pn', acc);
    let cur = 0, paused = false, visible = false, resumeT;
    function activate(i) {
      cur = i;
      pns.forEach((p, k) => {
        p.classList.toggle('is-active', k === i);
        const h = $('.pn__head', p); if (h) h.setAttribute('aria-expanded', String(k === i));
      });
    }
    pns.forEach((p, i) => {
      const h = $('.pn__head', p);
      if (h) h.addEventListener('click', () => { activate(i); paused = true; clearTimeout(resumeT); resumeT = setTimeout(() => { paused = false; }, 9000); });
      if (fine) p.addEventListener('mouseenter', () => { if (matchMedia('(min-width: 900px)').matches) { activate(i); paused = true; } });
    });
    acc.addEventListener('mouseleave', () => { paused = false; });
    acc.addEventListener('focusin', () => { paused = true; });
    acc.addEventListener('focusout', () => { paused = false; });
    acc.addEventListener('touchstart', () => { paused = true; clearTimeout(resumeT); resumeT = setTimeout(() => { paused = false; }, 8000); }, { passive: true });
    if ('IntersectionObserver' in window) new IntersectionObserver((en) => { visible = en[0].isIntersecting; }, { threshold: .3 }).observe(acc); else visible = true;
    if (!reduce) setInterval(() => { if (!paused && visible && !document.hidden) activate((cur + 1) % pns.length); }, 4000);
  }, 'sectores');

  /* ------------------------------------------------------------------
     13 · Principios: foco de luz e inclinación 3D
     ------------------------------------------------------------------ */
  safe(() => {
    $$('.pc').forEach((card) => {
      if (!fine) return;
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        card.style.setProperty('--mx', x + 'px'); card.style.setProperty('--my', y + 'px');
        if (!reduce && isDesktop()) {
          card.style.setProperty('--ry', ((x / r.width - .5) * 12).toFixed(2) + 'deg');
          card.style.setProperty('--rx', ((y / r.height - .5) * -12).toFixed(2) + 'deg');
        }
      });
      card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
    });
  }, 'principios');

  /* ------------------------------------------------------------------
     14 · Únete: pestañas
     ------------------------------------------------------------------ */
  const tabEls = $$('[role="tab"]');
  const tabPanels = tabEls.map((t) => document.getElementById(t.getAttribute('aria-controls')));
  const tabInd = $('.tabs__ind');
  let tabCur = 0;
  function positionTab() {
    const t = tabEls[tabCur];
    if (!t || !tabInd) return;
    tabInd.style.setProperty('--x', t.offsetLeft + 'px');
    tabInd.style.setProperty('--w', t.offsetWidth + 'px');
  }
  function selectTab(i, focus) {
    tabCur = i;
    tabEls.forEach((t, k) => {
      t.setAttribute('aria-selected', String(k === i));
      t.tabIndex = k === i ? 0 : -1;
      if (tabPanels[k]) tabPanels[k].hidden = k !== i;
    });
    if (tabPanels[i]) $$('li', tabPanels[i]).forEach((li, k) => li.style.setProperty('--k', k));
    positionTab();
    if (focus) tabEls[i].focus();
  }
  safe(() => {
    if (!tabEls.length) return;
    tabEls.forEach((t, i) => {
      t.addEventListener('click', () => selectTab(i));
      t.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); selectTab((i + 1) % tabEls.length, true); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); selectTab((i - 1 + tabEls.length) % tabEls.length, true); }
      });
    });
    selectTab(0);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(positionTab);
  }, 'pestañas');

  /* ------------------------------------------------------------------
     15 · FAQ: <details> con altura animada
     ------------------------------------------------------------------ */
  safe(() => {
    $$('.qa').forEach((d) => {
      const sum = $('summary', d);
      const panel = $('.qa__panel', d);
      if (!sum || !panel) return;
      sum.addEventListener('click', (e) => {
        e.preventDefault();
        if (d.open && d.classList.contains('is-open')) {
          d.classList.remove('is-open');
          let done = false;
          const close = () => { if (done) return; done = true; d.open = false; };
          panel.addEventListener('transitionend', close, { once: true });
          setTimeout(close, 650);
        } else {
          d.open = true;
          requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('is-open')));
        }
      });
    });
  }, 'faq');

  /* ------------------------------------------------------------------
     16 · Formulario → WhatsApp (con explosión de chispas)
     ------------------------------------------------------------------ */
  safe(() => {
    const form = $('#form');
    if (!form) return;
    const burst = $('#burst');
    const send = $('#f-send');
    const fb = $('#f-fallback');
    const nameI = $('#f-nombre');

    function sparks() {
      if (!burst || reduce) return;
      const b = burst.getContext('2d');
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const fr = burst.getBoundingClientRect();
      burst.width = fr.width * dpr; burst.height = fr.height * dpr;
      b.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sr = send.getBoundingClientRect();
      const ox = sr.left + sr.width / 2 - fr.left, oy = sr.top + sr.height / 2 - fr.top;
      const ps = Array.from({ length: 32 }, () => { const a = Math.random() * 6.2832, v = 80 + Math.random() * 220; return { a, v, s: 3 + Math.random() * 6 }; });
      const t1 = performance.now();
      (function go(now) {
        const p = clamp((now - t1) / 500);
        b.clearRect(0, 0, fr.width, fr.height);
        ps.forEach((q) => {
          const d = q.v * ease(p) * .6, x = ox + Math.cos(q.a) * d, y = oy + Math.sin(q.a) * d, s = q.s * (1 - p);
          b.fillStyle = `rgba(111,230,236,${1 - p})`;
          b.beginPath(); b.moveTo(x, y - s); b.quadraticCurveTo(x, y, x + s, y); b.quadraticCurveTo(x, y, x, y + s); b.quadraticCurveTo(x, y, x - s, y); b.quadraticCurveTo(x, y, x, y - s); b.fill();
        });
        if (p < 1) requestAnimationFrame(go); else b.clearRect(0, 0, fr.width, fr.height);
      })(t1);
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fld = nameI.closest('.fld');
      const err = $('.fld__err', fld);
      const nombre = nameI.value.trim();
      if (!nombre) {
        fld.classList.add('has-err'); if (err) err.textContent = 'Escribe tu nombre para continuar.';
        nameI.setAttribute('aria-invalid', 'true'); nameI.focus(); return;
      }
      fld.classList.remove('has-err'); if (err) err.textContent = ''; nameI.removeAttribute('aria-invalid');

      const empresa = $('#f-empresa').value.trim();
      const tipo = $('#f-tipo').value;
      const zona = $('#f-zona').value;
      const msg = $('#f-msg').value.trim();
      let text = `Hola ABRAJ, soy ${nombre}${empresa ? ' de ' + empresa : ''}.`;
      text += tipo ? ` Necesito cotizar limpieza para: ${tipo}.` : ' Necesito cotizar limpieza.';
      if (zona) text += ` Zona: ${zona}.`;
      if (msg) text += ` ${msg}`;

      const num = (zona === 'Estado de México' ? WHATSAPP.edomex : WHATSAPP.principal) || WHATSAPP.principal;
      if (!num) { if (fb) fb.hidden = false; return; }
      sparks();
      setTimeout(() => {
        const w = window.open(waURL(num, text), '_blank');
        if (w) { try { w.opener = null; } catch (_) { /* nada */ } } else { location.href = waURL(num, text); }
      }, 500);
    });
    nameI.addEventListener('input', () => {
      const fld = nameI.closest('.fld');
      if (nameI.value.trim()) { fld.classList.remove('has-err'); const er = $('.fld__err', fld); if (er) er.textContent = ''; }
    });
  }, 'formulario');

  /* ------------------------------------------------------------------
     17 · Arranque
     ------------------------------------------------------------------ */
  setSvcLive();
  safe(buildRibbon, 'cinta');
  if (metDraw && metLen) { metDraw.style.strokeDashoffset = String(metLen); }
  window.addEventListener('load', () => { safe(buildRibbon, 'cinta'); safe(positionTab, 'tabs'); safe(fillMarquees, 'marquesinas'); update(); });
  update();
})();
