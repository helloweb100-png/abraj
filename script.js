/* ==========================================================================
   ABRAJ · script.js
   Librerías locales (assets/vendor): GSAP + ScrollTrigger + SplitText (animación) y Lenis (scroll suave).
   Regla de oro: las funciones útiles (WhatsApp, formulario, pestañas, acordeones, video) NO dependen de
   GSAP. Si las librerías no cargan, la página queda completa y legible, solo sin coreografía.
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
  const rand = (a, b) => a + Math.random() * (b - a);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const safe = (fn, name) => { try { return fn(); } catch (err) { console.warn('[ABRAJ]', name, err); } };

  let lenis = null;       // scroll suave (si hay animaciones)
  let fxOn = false;       // GSAP disponible

  /* ======================================================================
     A · FUNCIONES QUE NO NECESITAN GSAP
     ====================================================================== */

  /* A1 · WhatsApp: convierte todos los [data-wa] en enlaces wa.me */
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

  /* A2 · Menú móvil */
  const menuApi = safe(() => {
    const burger = $('.burger'), menu = $('#menu');
    if (!burger || !menu) return { close() {} };
    const set = (open) => {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      if (lenis) { open ? lenis.stop() : lenis.start(); } else { doc.style.overflow = open ? 'hidden' : ''; }
    };
    burger.addEventListener('click', () => set(burger.getAttribute('aria-expanded') !== 'true'));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
    matchMedia('(min-width: 901px)').addEventListener('change', (m) => { if (m.matches) set(false); });
    return { close: () => set(false) };
  }, 'menu') || { close() {} };

  /* A3 · Anclas internas con scroll suave (Lenis si existe, nativo si no) */
  safe(() => {
    $$('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        if (a.dataset.wa && a.target === '_blank') return; // CTA que abre WhatsApp
        const id = a.getAttribute('href');
        if (!id || id.length < 2) return;
        const target = $(id);
        if (!target) return;
        e.preventDefault();
        menuApi.close();
        if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.7, easing: (t) => 1 - Math.pow(1 - t, 4) });
        else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      });
    });
    $$('[data-top]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      if (lenis) lenis.scrollTo(0, { duration: 2 }); else window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    }));
    if (reduce || !window.Lenis) doc.classList.add('native-smooth');
  }, 'anclas');

  /* A4 · Acordeón de sectores y de preguntas frecuentes (altura animada por CSS) */
  safe(() => {
    const wire = (items, getBtn, single) => {
      items.forEach((item) => {
        const btn = getBtn(item);
        if (!btn) return;
        btn.addEventListener('click', () => {
          const open = item.classList.contains('is-open');
          if (single) items.forEach((o) => { o.classList.remove('is-open'); const b = getBtn(o); if (b) b.setAttribute('aria-expanded', 'false'); });
          item.classList.toggle('is-open', !open);
          btn.setAttribute('aria-expanded', String(!open));
          // El alto de la página cambia: se recalculan las animaciones ligadas al scroll
          setTimeout(() => { if (fxOn) ScrollTrigger.refresh(); }, 900);
        });
      });
    };
    wire($$('.row'), (r) => $('.row__head', r), true);
    wire($$('.qa'), (q) => $('button', q), false);
  }, 'acordeones');

  /* A5 · Pestañas de "Únete" (con teclado) */
  safe(() => {
    const tabs = $$('[role="tab"]');
    if (!tabs.length) return;
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        const p = document.getElementById(t.getAttribute('aria-controls'));
        if (p) p.hidden = !on;
      });
      if (focus) tab.focus();
      if (fxOn) ScrollTrigger.refresh();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', (e) => {
        const k = e.key;
        if (k === 'ArrowRight' || k === 'ArrowLeft') { e.preventDefault(); select(tabs[(i + (k === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], true); }
        if (k === 'Home') { e.preventDefault(); select(tabs[0], true); }
        if (k === 'End') { e.preventDefault(); select(tabs[tabs.length - 1], true); }
      });
    });
  }, 'pestanas');

  /* A6 · Formulario: arma el mensaje y abre WhatsApp en la sede de la zona elegida */
  safe(() => {
    const form = $('#form');
    if (!form) return;
    const nameI = $('#f-nombre');
    const fb = $('#f-fallback');
    const fld = nameI.closest('.fld');
    const err = $('.fld__err', fld);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nombre = nameI.value.trim();
      if (!nombre) {
        fld.classList.add('has-err');
        if (err) err.textContent = 'Escribe tu nombre para continuar.';
        nameI.setAttribute('aria-invalid', 'true');
        nameI.focus();
        return;
      }
      fld.classList.remove('has-err');
      if (err) err.textContent = '';
      nameI.removeAttribute('aria-invalid');
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
      const w = window.open(waURL(num, text), '_blank', 'noopener');
      if (!w) location.href = waURL(num, text);
    });
    nameI.addEventListener('input', () => {
      if (nameI.value.trim()) { fld.classList.remove('has-err'); if (err) err.textContent = ''; nameI.removeAttribute('aria-invalid'); }
    });
  }, 'formulario');

  /* A7 · Reproductor de video (el archivo solo se descarga al pulsar play) */
  safe(() => {
    const v = $('#vid'), player = $('#player');
    if (!v || !player) return;
    const playBtn = $('#v-play'), toggle = $('#v-toggle'), mute = $('#v-mute'), prog = $('#v-prog'), track = $('.player__track', player);
    const icon = (btn, id) => { const u = $('use', btn); if (u) u.setAttribute('href', id); };
    const play = () => { player.classList.add('is-started'); v.play().catch(() => {}); };
    playBtn.addEventListener('click', () => { v.muted = false; icon(mute, '#i-vol'); play(); });
    toggle.addEventListener('click', () => { v.paused ? v.play() : v.pause(); });
    v.addEventListener('click', () => { if (player.classList.contains('is-started')) (v.paused ? v.play() : v.pause()); });
    mute.addEventListener('click', () => { v.muted = !v.muted; icon(mute, v.muted ? '#i-mute' : '#i-vol'); mute.setAttribute('aria-pressed', String(v.muted)); });
    v.addEventListener('play', () => { player.classList.add('is-playing'); toggle.setAttribute('aria-label', 'Pausar video'); icon(toggle, '#i-pause'); });
    v.addEventListener('pause', () => { player.classList.remove('is-playing'); toggle.setAttribute('aria-label', 'Reanudar video'); icon(toggle, '#i-play'); });
    v.addEventListener('timeupdate', () => { prog.style.transform = `scaleX(${v.duration ? v.currentTime / v.duration : 0})`; });
    v.addEventListener('ended', () => { player.classList.remove('is-playing', 'is-started'); v.currentTime = 0; prog.style.transform = 'scaleX(0)'; });
    track.addEventListener('click', (e) => { const r = track.getBoundingClientRect(); if (v.duration) v.currentTime = clamp((e.clientX - r.left) / r.width) * v.duration; });
    // Si el video sale de pantalla, se pausa solo
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting && !v.paused) v.pause(); }), { threshold: 0.15 }).observe(player);
    }
  }, 'video');

  /* A8 · Brillo que sigue al cursor en tarjetas */
  safe(() => {
    if (!fine) return;
    $$('.spot').forEach((el) => el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true }));
  }, 'brillo');

  /* A9 · Cristal interactivo: se limpia con el dedo o el cursor */
  const glass = safe(() => {
    const frame = $('#gframe'), canvas = $('#g-canvas'), img = $('#g-img'), ring = $('#g-ring'), btn = $('#g-clean');
    if (!frame || !canvas || !img) return null;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const small = document.createElement('canvas'); small.width = 32; small.height = 44;
    const sctx = small.getContext('2d', { willReadFrequently: true });
    let W = 0, H = 0, dpr = 1, clean = false, drawing = false, last = null, lastCheck = 0, auto = null;

    const setRing = (p) => { if (ring) ring.style.strokeDashoffset = String(100 - clamp(p) * 100); };

    function paintDirt() {
      if (!W || !H) return;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, W, H);
      try { ctx.filter = 'blur(24px) saturate(.45) brightness(1.18)'; ctx.drawImage(img, -40, -40, W + 80, H + 80); ctx.filter = 'none'; } catch (e) { /* sin filtro: solo velo */ }
      ctx.fillStyle = 'rgba(206,221,233,.72)'; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = .1; ctx.strokeStyle = '#fff';
      for (let i = 0; i < 26; i++) { ctx.lineWidth = rand(2, 10) * dpr; ctx.beginPath(); const x = rand(0, W); ctx.moveTo(x, -20); ctx.lineTo(x + rand(-90, 90), H + 20); ctx.stroke(); }
      ctx.globalAlpha = .38; ctx.fillStyle = '#fff';
      for (let i = 0; i < 170; i++) { ctx.beginPath(); ctx.arc(rand(0, W), rand(0, H), rand(.5, 2.4) * dpr, 0, 6.2832); ctx.fill(); }
      ctx.globalAlpha = 1;
    }

    function size() {
      const r = frame.getBoundingClientRect();
      if (!r.width) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const nw = Math.round(r.width * dpr), nh = Math.round(r.height * dpr);
      if (nw === W && nh === H) return;
      W = canvas.width = nw; H = canvas.height = nh;
      if (!clean) paintDirt();
    }

    function stamp(x, y) {
      const r = 50 * dpr;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.55, 'rgba(0,0,0,.92)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    }
    function wipe(x0, y0, x1, y1) {
      const d = Math.hypot(x1 - x0, y1 - y0), step = 9 * dpr, n = Math.max(1, Math.ceil(d / step));
      for (let i = 0; i <= n; i++) stamp(x0 + (x1 - x0) * (i / n), y0 + (y1 - y0) * (i / n));
    }

    function coverage() {
      sctx.clearRect(0, 0, 32, 44); sctx.drawImage(canvas, 0, 0, 32, 44);
      const d = sctx.getImageData(0, 0, 32, 44).data; let c = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] < 70) c++;
      return c / (32 * 44);
    }
    function check(force) {
      const now = performance.now();
      if (!force && now - lastCheck < 110) return;
      lastCheck = now;
      const c = coverage();
      setRing(c / .62);
      if (c >= .62) finish();
    }
    function finish() {
      if (clean) return;
      clean = true;
      setRing(1);
      frame.classList.add('is-clean');
      if (btn) btn.querySelector('span').textContent = 'Volver a empezar';
      if (window.gsap) gsap.to(canvas, { opacity: 0, duration: 1, ease: 'power2.out', onComplete: () => { canvas.style.display = 'none'; } });
      else canvas.style.display = 'none';
    }
    function reset() {
      if (auto) { auto.kill(); auto = null; }
      clean = false; last = null;
      canvas.style.display = ''; canvas.style.opacity = '1';
      if (window.gsap) gsap.set(canvas, { opacity: 1 });
      frame.classList.remove('is-clean');
      if (btn) btn.querySelector('span').textContent = 'Limpiar el cristal';
      setRing(0);
      paintDirt();
    }
    function autoClean() {
      if (clean) { reset(); return; }
      if (!window.gsap || reduce) { wipe(0, H * .5, W, H * .5); finish(); return; }
      const rows = 7, o = { t: 0 };
      const pt = (t) => { const k = t * rows, row = Math.min(rows - 1, Math.floor(k)), f = k - row; const x = (row % 2 === 0 ? f : 1 - f) * W; return [x, (row + .5) / rows * H]; };
      let prev = pt(0);
      auto = gsap.to(o, { t: .9999, duration: 1.9, ease: 'power1.inOut', onUpdate() { const p = pt(o.t); wipe(prev[0], prev[1], p[0], p[1]); prev = p; check(true); }, onComplete() { wipe(0, H, W, H); finish(); } });
    }

    const pos = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)]; };
    canvas.addEventListener('pointerdown', (e) => { if (clean) return; if (auto) { auto.kill(); auto = null; } drawing = true; canvas.setPointerCapture(e.pointerId); last = pos(e); wipe(last[0], last[1], last[0], last[1]); check(); });
    canvas.addEventListener('pointermove', (e) => {
      if (clean) return;
      if (e.pointerType === 'mouse' || drawing) { const p = pos(e); if (!last) last = p; wipe(last[0], last[1], p[0], p[1]); last = p; check(); }
    });
    const up = () => { drawing = false; if (!matchMedia('(hover: hover)').matches) last = null; };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('pointerleave', () => { last = null; });
    if (btn) btn.addEventListener('click', autoClean);

    const start = () => { size(); if ('ResizeObserver' in window) new ResizeObserver(size).observe(frame); else window.addEventListener('resize', size); };
    if (img.complete && img.naturalWidth) start(); else img.addEventListener('load', start, { once: true });
    return { size };
  }, 'cristal');

  /* ======================================================================
     B · COREOGRAFÍA (GSAP + ScrollTrigger + SplitText + Lenis)
     ====================================================================== */

  const loader = $('#loader');
  function endLoading() {
    if (loader) loader.style.display = 'none';
    document.body.classList.remove('is-loading');
    if (lenis) lenis.start();
  }

  function fallback() {
    doc.classList.add('no-fx');
    endLoading();
    window.__abrajOK = true;
  }

  if (!window.gsap || !window.ScrollTrigger || !window.SplitText) { fallback(); return; }

  gsap.registerPlugin(ScrollTrigger, SplitText);
  ScrollTrigger.config({ ignoreMobileResize: true });
  // Nota: GSAP redondea a píxeles enteros por defecto; en los trazos SVG (stroke-dashoffset de 1 a 0) hay que pasar
  // autoRound:false en cada tween, si no la línea salta de oculta a dibujada de golpe.
  fxOn = true;
  window.__abrajOK = true;

  /* B0 · Scroll suave */
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), touchMultiplier: 1.3 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
    doc.classList.add('lenis', 'lenis-smooth');
  }

  const motion = !reduce;
  const mm = gsap.matchMedia();
  let introTL = null;

  /* Textos grandes: máscaras por línea con margen para que no se corten las colas (p, g, y) */
  const padMasks = (split) => split.masks && gsap.set(split.masks, { paddingTop: '.14em', paddingBottom: '.14em', marginTop: '-.14em', marginBottom: '-.14em' });

  /* "Una sola vez al entrar en pantalla". Usa IntersectionObserver (y no un ScrollTrigger con once) porque se
     dispara igual si el visitante llega con un salto largo: barra de scroll, tecla Fin o ancla. */
  const inView = (el, cb, rootMargin = '0px 0px -9% 0px') => {
    if (!('IntersectionObserver' in window)) { cb(); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); cb(); } }, { rootMargin, threshold: 0 });
    io.observe(el);
  };

  /* Todo lo que divide textos o mide el diseño corre DESPUÉS de que cargue la tipografía,
     si no, las líneas se calculan con la fuente de respaldo y se descuadran. */
  const build = () => {

  /* B1 · Hero: texto por líneas, logo, partículas y movimiento con el cursor */
  safe(() => {
    const hero = $('#inicio');
    if (!hero) return;
    let split = null;
    if (motion) {
      split = SplitText.create('.hero__title', { type: 'lines', mask: 'lines', linesClass: 'ln' });
      padMasks(split);
      introTL = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
      introTL.from(split.lines, { yPercent: 112, duration: 1.5, stagger: .13 }, 0)
        .from('[data-hero]', { y: 34, opacity: 0, duration: 1.2, stagger: .1 }, .35)
        .from('.hero__mark', { scale: .8, opacity: 0, y: 40, duration: 2 }, .05)
        .from('.hdr', { yPercent: -100, opacity: 0, duration: 1.1 }, .4);
    }

    // Movimiento 3D del logo con el cursor
    if (motion && fine) {
      const tilt = $('.mark__tilt');
      const rx = gsap.quickTo(tilt, 'rotationX', { duration: 1.2, ease: 'power3' });
      const ry = gsap.quickTo(tilt, 'rotationY', { duration: 1.2, ease: 'power3' });
      const tx = gsap.quickTo(tilt, 'x', { duration: 1.4, ease: 'power3' });
      const ty = gsap.quickTo(tilt, 'y', { duration: 1.4, ease: 'power3' });
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
        ry(px * 16); rx(-py * 12); tx(px * 22); ty(py * 14);
      }, { passive: true });
      hero.addEventListener('pointerleave', () => { rx(0); ry(0); tx(0); ty(0); });
    }

    // Partículas de polvo que se apartan del cursor
    const c = $('#dust');
    if (c && motion) {
      const ctx = c.getContext('2d');
      let w = 0, h = 0, dpr = 1, parts = [], run = false, t = 0;
      const mouse = { x: -999, y: -999 };
      const make = () => ({ x: rand(0, w), y: rand(0, h), r: Math.random() < .14 ? rand(3, 6) : rand(.5, 1.9), vx: rand(-.1, .1), vy: rand(-.34, -.06), a: rand(.18, .7), ph: rand(0, 6.28) });
      const resize = () => {
        w = c.clientWidth; h = c.clientHeight; dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        parts = Array.from({ length: clamp(Math.round(w * h / 21000), 28, 84) }, make);
      };
      const frame = () => {
        if (!run) return;
        t += .016; ctx.clearRect(0, 0, w, h);
        for (const p of parts) {
          p.x += p.vx + Math.sin(t + p.ph) * .12; p.y += p.vy;
          const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < 16900) { const d = Math.sqrt(d2) || 1, f = (130 - d) / 130; p.x += dx / d * f * 3.2; p.y += dy / d * f * 3.2; }
          if (p.y < -10) { p.y = h + 10; p.x = rand(0, w); }
          if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832);
          if (p.r > 2.5) { ctx.strokeStyle = `rgba(111,230,236,${p.a * .35})`; ctx.lineWidth = 1; ctx.stroke(); }
          else { ctx.fillStyle = `rgba(200,236,244,${p.a})`; ctx.fill(); }
        }
        requestAnimationFrame(frame);
      };
      const setRun = (on) => { if (on && !run) { run = true; requestAnimationFrame(frame); } else if (!on) run = false; };
      resize();
      window.addEventListener('resize', resize);
      hero.addEventListener('pointermove', (e) => { const r = c.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; }, { passive: true });
      hero.addEventListener('pointerleave', () => { mouse.x = mouse.y = -999; });
      new IntersectionObserver((es) => setRun(es[0].isIntersecting && !document.hidden), { threshold: 0 }).observe(hero);
      document.addEventListener('visibilitychange', () => { if (document.hidden) setRun(false); else if (hero.getBoundingClientRect().bottom > 0) setRun(true); });
    }

    // En escritorio el hero se queda fijo y la siguiente sección lo cubre; el texto se desvanece con profundidad
    mm.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', () => {
      ScrollTrigger.create({ trigger: hero, start: 'top top', end: '+=100%', pin: true, pinSpacing: false });
      // Cada efecto de scroll va sobre un elemento distinto al de la animación de entrada (así no se pisan)
      gsap.fromTo('.hero__grid', { yPercent: 0, opacity: 1 }, { yPercent: -10, opacity: .12, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: '+=85%', scrub: true } });
      gsap.fromTo('.mark__tilt', { scale: 1, yPercent: 0 }, { scale: 1.14, yPercent: 8, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: '+=95%', scrub: true } });
      gsap.fromTo('.hero .ticker', { opacity: 1 }, { opacity: 0, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: '+=40%', scrub: true } });
    });
  }, 'hero');

  /* B2 · Manifiesto: las palabras se encienden al avanzar el scroll */
  safe(() => {
    const p = $('[data-words]');
    if (!p || !motion) return;
    const split = SplitText.create(p, { type: 'words', wordsClass: 'w' });
    gsap.fromTo(split.words, { opacity: .14 }, {
      opacity: 1, ease: 'none', stagger: .08, duration: .5,
      scrollTrigger: { trigger: p, start: 'top 80%', end: 'bottom 55%', scrub: true }
    });
  }, 'manifiesto');

  /* B3 · Títulos de sección: revelado por líneas con máscara */
  safe(() => {
    if (!motion) return;
    $$('[data-split]').forEach((el) => {
      SplitText.create(el, {
        type: 'lines', mask: 'lines', linesClass: 'ln', autoSplit: true,
        onSplit(self) {
          padMasks(self);
          if (el.dataset.done) return;           // ya se reveló: tras un resize las líneas nuevas quedan visibles
          gsap.set(self.lines, { yPercent: 112 });
          const tw = gsap.to(self.lines, { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: .09, paused: true });
          el.__tw = tw;
          if (el.__seen) tw.play();
          return tw;
        }
      });
      inView(el, () => { el.__seen = true; el.dataset.done = '1'; if (el.__tw) el.__tw.play(); }, '0px 0px -13% 0px');
    });
  }, 'titulos');

  /* B4 · Bloques que suben y aparecen (en lote, escalonados) */
  safe(() => {
    if (!motion) return;
    const items = $$('[data-rv]');
    gsap.set(items, { opacity: 0, y: 44 });
    let queue = [], pending = false;
    const flush = () => {
      pending = false;
      const batch = queue; queue = [];
      gsap.to(batch, { opacity: 1, y: 0, duration: 1.3, ease: 'expo.out', stagger: .09, clearProps: 'transform,opacity' });
    };
    items.forEach((el) => inView(el, () => { queue.push(el); if (!pending) { pending = true; requestAnimationFrame(flush); } }, '0px 0px -9% 0px'));
  }, 'bloques');

  /* B5 · Imágenes: se abren con máscara y tienen profundidad (parallax) */
  safe(() => {
    if (!motion) return;
    $$('[data-reveal-img]').forEach((fig) => {
      const clip = $('.img-clip', fig), img = $('img', fig);
      gsap.set(clip, { clipPath: 'inset(100% 0% 0% 0% round 28px)' });
      gsap.set(img, { scale: 1.22 });
      const open = gsap.timeline({ paused: true })
        .to(clip, { clipPath: 'inset(0% 0% 0% 0% round 28px)', duration: 1.7, ease: 'expo.out', clearProps: 'clipPath' }, 0)
        .to(img, { scale: 1, duration: 2.2, ease: 'expo.out' }, 0);
      inView(fig, () => open.play(), '0px 0px -14% 0px');
      gsap.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }, 'imagenes');

  /* B6 · Cifras */
  safe(() => {
    if (!motion) return;
    $$('[data-count]').forEach((el) => {
      const end = Number(el.dataset.count), o = { v: 0 };
      el.textContent = '0';
      inView(el, () => gsap.to(o, { v: end, duration: 2.2, ease: 'power3.out', onUpdate: () => { el.textContent = String(Math.round(o.v)); } }), '0px 0px -8% 0px');
    });
  }, 'cifras');

  /* B7 · Servicios: carril horizontal fijado (escritorio) o pila vertical (móvil) */
  safe(() => {
    const pin = $('#svc-pin'), track = $('#svc-track'), bar = $('#svc-bar');
    if (!pin || !track) return;
    const drawables = (card) => $$('.draw path, .draw rect', card);

    mm.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', () => {
      const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
      const tween = gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: {
          trigger: pin, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: .9, invalidateOnRefresh: true, anticipatePin: 1,
          onUpdate: (s) => { if (bar) bar.style.transform = `scaleX(${s.progress})`; }
        }
      });
      $$('.card', track).forEach((card) => {
        const paths = drawables(card);
        gsap.set(paths, { strokeDashoffset: 1 });
        gsap.to(paths, { strokeDashoffset: 0, ease: 'none', autoRound: false, scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left 84%', end: 'left 40%', scrub: true } });
        gsap.fromTo($('.card__n', card), { xPercent: 26 }, { xPercent: -14, ease: 'none', scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left 100%', end: 'right 0%', scrub: true } });
      });
    });

    mm.add('(max-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
      $$('.card').forEach((card) => {
        const paths = drawables(card);
        gsap.set(paths, { strokeDashoffset: 1 });
        const enter = gsap.timeline({ paused: true })
          .from(card, { y: 50, opacity: 0, duration: 1.2, ease: 'expo.out', clearProps: 'transform,opacity' }, 0)
          .to(paths, { strokeDashoffset: 0, duration: 1.8, ease: 'power2.out', autoRound: false }, .1);
        inView(card, () => enter.play(), '0px 0px -10% 0px');
      });
    });
  }, 'servicios');

  /* B8 · Video: el marco se endereza y crece al entrar */
  safe(() => {
    mm.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo('.player__frame', { rotationX: 16, scale: .84, y: 70 }, { rotationX: 0, scale: 1, y: 0, ease: 'none', scrollTrigger: { trigger: '.vid', start: 'top 85%', end: 'center 55%', scrub: true } });
    });
  }, 'video-fx');

  /* B9 · Método: la línea se llena y cada paso se enciende */
  safe(() => {
    const wrap = $('#steps'), fill = $('#steps-fill'), steps = $$('.step');
    if (!wrap || !fill || !motion) return;
    mm.add('(min-width: 901px)', () => {
      gsap.set(fill, { scaleX: 0, scaleY: 1 });
      gsap.to(fill, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: wrap, start: 'top 72%', end: 'bottom 62%', scrub: true,
        onUpdate: (s) => steps.forEach((st, i) => st.classList.toggle('is-on', s.progress >= i / steps.length + .02)) } });
    });
    mm.add('(max-width: 900px)', () => {
      gsap.set(fill, { scaleX: 1, scaleY: 0 });
      gsap.to(fill, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: wrap, start: 'top 70%', end: 'bottom 60%', scrub: true,
        onUpdate: (s) => steps.forEach((st, i) => st.classList.toggle('is-on', s.progress >= i / steps.length + .02)) } });
    });
  }, 'metodo');

  /* B10 · Nosotros: la imagen se abre hasta ocupar toda la pantalla */
  safe(() => {
    mm.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', () => {
      const sec = $('#nosotros'), media = $('#about-media'), card = $('#about-card');
      if (!sec || !media || !card) return;
      gsap.set(card, { opacity: 0, y: 70 });
      gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom bottom', scrub: .8 } })
        .to(media, { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none', duration: 1 }, 0)
        .to($('img', media), { scale: 1, ease: 'none', duration: 1.7 }, 0)
        .to(card, { opacity: 1, y: 0, ease: 'power2.out', duration: .55 }, .82);
    });
  }, 'nosotros');

  /* B11 · Cobertura: la ruta se dibuja y los puntos aparecen */
  safe(() => {
    const draw = $('#arc-draw');
    if (!draw || !motion) return;
    gsap.set(draw, { strokeDashoffset: 1 });
    gsap.to(draw, { strokeDashoffset: 0, ease: 'none', autoRound: false, scrollTrigger: { trigger: '#route', start: 'top 82%', end: 'bottom 45%', scrub: true } });
    const pop = gsap.timeline({ paused: true })
      .from('.route__node circle:not(.pulse)', { scale: 0, transformOrigin: '50% 50%', duration: 1, ease: 'back.out(2.2)', stagger: .35 }, 0)
      .from('.route text', { opacity: 0, y: 12, duration: 1, stagger: .3, ease: 'expo.out' }, .2);
    inView($('#route'), () => pop.play(), '0px 0px -20% 0px');
  }, 'cobertura');

  /* B12 · Pie: la palabra gigante se llena de color */
  safe(() => {
    if (!motion) return;
    gsap.to('#foot-fill', { clipPath: 'inset(0% 0 0 0)', ease: 'none', scrollTrigger: { trigger: '.foot__word', start: 'top 96%', end: 'bottom 72%', scrub: true } });
  }, 'pie');

  /* B13 · Botones magnéticos */
  safe(() => {
    if (!motion || !fine) return;
    $$('.magnet').forEach((b) => {
      const x = gsap.quickTo(b, 'x', { duration: .7, ease: 'power3' }), y = gsap.quickTo(b, 'y', { duration: .7, ease: 'power3' });
      b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); x((e.clientX - r.left - r.width / 2) * .22); y((e.clientY - r.top - r.height / 2) * .32); });
      b.addEventListener('pointerleave', () => { x(0); y(0); });
    });
  }, 'magneticos');

  /* B14 · Barra de progreso, tema del encabezado y enlace activo (todo en una sola pasada por scroll) */
  safe(() => {
    const bar = $('#progress'), hdr = $('#hdr');
    const themed = $$('main [data-theme], footer[data-theme]');
    const nav = new Map($$('.nav a[href^="#"]').map((a) => [a.getAttribute('href').slice(1), a]));
    const secs = $$('main > section[id]');
    let theme = '', activeId = '';
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: (s) => {
        if (bar) bar.style.transform = `scaleX(${s.progress})`;
        let t = 'dark';
        for (const el of themed) { if (el.getBoundingClientRect().top <= 40) t = el.dataset.theme; else break; }
        if (t !== theme) { theme = t; hdr.dataset.theme = t; }
        let id = '';
        for (const el of secs) { if (el.getBoundingClientRect().top <= window.innerHeight * .45) id = el.id; else break; }
        if (id !== activeId) { activeId = id; nav.forEach((a, k) => a.classList.toggle('is-active', k === id)); }
      }
    });
  }, 'scroll-estado');

  };  // fin de build()

  /* B15 · Cargador y arranque: el contador corre mientras carga la tipografía; la cortina se abre
     solo cuando todo está construido, para que nunca se vea el texto sin dividir. */
  const fontsReady = (document.fonts && document.fonts.ready)
    ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2200))])
    : Promise.resolve();
  const built = fontsReady.then(() => { try { build(); } catch (err) { console.warn('[ABRAJ] build', err); } ScrollTrigger.refresh(); });

  const curtain = () => {
    gsap.timeline()
      .to('.loader__core', { opacity: 0, y: -24, duration: .5, ease: 'power2.in' })
      .to('.loader__panel--t', { yPercent: -101, duration: 1.05, ease: 'expo.inOut' }, '>-.05')
      .to('.loader__panel--b', { yPercent: 101, duration: 1.05, ease: 'expo.inOut' }, '<')
      .add(() => { document.body.classList.remove('is-loading'); if (lenis) lenis.start(); if (introTL) introTL.play(); }, '<+.3')
      .add(() => { if (loader) loader.style.display = 'none'; ScrollTrigger.refresh(); });
  };

  const n = $('#ld-n'), fillLogo = $('.loader__fill'), line = $('.loader__line i');
  const o = { v: 0 };
  gsap.to(o, {
    v: 100, duration: motion ? 1.5 : .3, ease: 'power2.inOut',
    onUpdate: () => {
      if (n) n.textContent = String(Math.round(o.v));
      if (line) line.style.transform = `scaleX(${o.v / 100})`;
      if (fillLogo) fillLogo.style.clipPath = `inset(${100 - o.v}% 0 0 0)`;
    },
    onComplete: () => { built.then(curtain); }
  });

  window.addEventListener('load', () => { ScrollTrigger.refresh(); if (glass) glass.size(); });
})();
