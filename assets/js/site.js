/* =========================================================
   TRACKIE — interactions & motion
   GSAP + ScrollTrigger + MotionPath + Lenis
   ========================================================= */
(() => {
  'use strict';

  const CFG = window.TRACKIE_CONFIG || {};
  const P = CFG.product || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const html = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGsap = typeof window.gsap !== 'undefined';
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { sessionStorage.removeItem(k); } catch (e) {} },
  };

  const money = (n) => {
    try { return new Intl.NumberFormat(CFG.locale || 'de-DE', { style: 'currency', currency: CFG.currency || 'EUR' }).format(n); }
    catch (e) { return (Math.round(n * 100) / 100).toFixed(2) + ' ' + (CFG.currency || ''); }
  };
  const colorByName = (n) => (P.colors || []).find((c) => c.name === n) || (P.colors || [])[0] || { name: 'Black', hex: '#0B0D12' };
  const luminance = (hex) => {
    const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const paintCase = (svg, hex) => { if (!svg) return; svg.style.setProperty('--cover', hex); svg.classList.toggle('is-light', luminance(hex) > 0.3); };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Mini suitcase for cart line items
  const miniCase = (hex) => `<svg class="case" viewBox="60 0 280 580" aria-hidden="true"><defs><linearGradient id="mcg" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".15"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient></defs><rect x="164" y="20" width="12" height="90" rx="3" fill="#1A1E26"/><rect x="224" y="20" width="12" height="90" rx="3" fill="#1A1E26"/><rect x="148" y="6" width="104" height="28" rx="13" fill="#0D1016"/><circle cx="120" cy="532" r="18" fill="#0A0C10"/><circle cx="280" cy="532" r="18" fill="#0A0C10"/><rect x="74" y="96" width="252" height="412" rx="44" fill="${hex}"/><rect x="74" y="96" width="252" height="412" rx="44" fill="url(#mcg)"/><rect x="150" y="98" width="100" height="18" rx="9" fill="#05070B"/><image href="assets/img/trackie-logo-${luminance(hex) > 0.3 ? 'dark' : 'light'}.png" x="206" y="124" width="104" height="84"/></svg>`;

  /* ---------------------------------------------------------
     CART
     --------------------------------------------------------- */
  const Cart = {
    key: 'trackie-cart-v1',
    items: store.get('trackie-cart-v1', []),
    listeners: [],
    save() { store.set(this.key, this.items); this.listeners.forEach((f) => f(this)); },
    on(f) { this.listeners.push(f); },
    count() { return this.items.reduce((a, i) => a + i.qty, 0); },
    subtotal() { return this.items.reduce((a, i) => a + i.qty * (P.price || 0), 0); },
    add(color, size, qty = 1) {
      const id = `${color}/${size}`;
      const ex = this.items.find((i) => i.id === id);
      if (ex) ex.qty = Math.min(99, ex.qty + qty); else this.items.push({ id, color, size, qty });
      this.save();
    },
    setQty(id, qty) {
      const it = this.items.find((i) => i.id === id); if (!it) return;
      if (qty <= 0) this.items = this.items.filter((i) => i.id !== id); else it.qty = Math.min(99, qty);
      this.save();
    },
    clear() { this.items = []; this.save(); },
  };
  window.TrackieCart = Cart;

  const Drawer = {
    el: null,
    init() {
      this.el = $('[data-cart]'); if (!this.el) return;
      $$('[data-cart-open]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); this.open(); }));
      $$('[data-cart-close]', this.el).forEach((b) => b.addEventListener('click', () => this.close()));
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });
      const co = $('[data-checkout]', this.el);
      if (co) co.addEventListener('click', () => {
        if (!Cart.count()) return;
        Transition.go('checkout.html');
      });
      $('[data-cart-items]', this.el).addEventListener('click', (e) => {
        const b = e.target.closest('button[data-act]'); if (!b) return;
        const id = b.closest('[data-line]').dataset.line; const it = Cart.items.find((i) => i.id === id); if (!it) return;
        if (b.dataset.act === 'plus') Cart.setQty(id, it.qty + 1);
        if (b.dataset.act === 'minus') Cart.setQty(id, it.qty - 1);
        if (b.dataset.act === 'rm') Cart.setQty(id, 0);
      });
      Cart.on(() => this.render());
      this.render();
    },
    render() {
      const n = Cart.count();
      $$('[data-cart-count]').forEach((c) => { c.textContent = n; c.classList.toggle('has-items', n > 0); });
      if (!this.el) return;
      this.el.classList.toggle('is-empty', n === 0);
      $('[data-cart-items]', this.el).innerHTML = Cart.items.map((i) => {
        const c = colorByName(i.color);
        return `<div class="line-item" data-line="${esc(i.id)}">
          <div class="line-item__img">${miniCase(c.hex)}</div>
          <div><div class="line-item__t">${esc(P.name)}</div>
            <div class="line-item__v"><i style="--c:${c.hex}"></i>${esc(i.color)} · ${esc(i.size)}</div>
            <div class="qty"><button type="button" data-act="minus" aria-label="Decrease">${ICON.minus}</button><input value="${i.qty}" readonly aria-label="Quantity"><button type="button" data-act="plus" aria-label="Increase">${ICON.plus}</button></div></div>
          <div class="line-item__r"><span>${money(i.qty * P.price)}</span><button type="button" class="line-item__rm" data-act="rm">Remove</button></div>
        </div>`;
      }).join('');
      $('[data-cart-total]', this.el).textContent = money(Cart.subtotal());
      const ship = CFG.shipping || {}; const shipEl = $('[data-cart-ship]', this.el);
      if (ship.freeOver > 0 && shipEl) {
        shipEl.hidden = false;
        const left = ship.freeOver - Cart.subtotal();
        $('[data-cart-ship-text]', shipEl).innerHTML = left > 0 ? `You’re <b>${money(left)}</b> away from free shipping` : '✈️ You’ve unlocked <b>free shipping</b>';
        $('[data-cart-ship-bar]', shipEl).style.width = Math.min(100, (Cart.subtotal() / ship.freeOver) * 100) + '%';
      }
    },
    open() {
      if (!this.el) return;
      this.el.classList.add('is-open'); this.el.setAttribute('aria-hidden', 'false');
      Smooth.stop(); setTimeout(() => $('.drawer__x', this.el)?.focus(), 300);
    },
    close() {
      if (!this.el || !this.el.classList.contains('is-open')) return;
      this.el.classList.remove('is-open'); this.el.setAttribute('aria-hidden', 'true'); Smooth.start();
    },
  };

  const ICON = {
    minus: '<svg class="icon" viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
    plus: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    check: '<svg class="icon" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  };

  const toast = (msg) => {
    const t = $('[data-toast]'); if (!t) return;
    t.innerHTML = ICON.check + '<span>' + esc(msg) + '</span>';
    t.classList.add('is-show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('is-show'), 2600);
  };

  /* ---------------------------------------------------------
     SMOOTH SCROLL (Lenis)
     --------------------------------------------------------- */
  const Smooth = {
    lenis: null,
    init() {
      if (reduced || typeof window.Lenis === 'undefined') return;
      this.lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
      if (hasGsap && window.ScrollTrigger) {
        this.lenis.on('scroll', window.ScrollTrigger.update);
        gsap.ticker.add((t) => this.lenis.raf(t * 1000));
        gsap.ticker.lagSmoothing(0);
      } else {
        const raf = (t) => { this.lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf);
      }
    },
    stop() { this.lenis && this.lenis.stop(); },
    start() { this.lenis && this.lenis.start(); },
    to(target, opts = {}) {
      const off = -(parseInt(getComputedStyle(html).getPropertyValue('--hdr-h')) || 76) + 1;
      if (this.lenis) this.lenis.scrollTo(target, { offset: off, duration: 1.4, ...opts });
      else {
        const el = typeof target === 'number' ? null : (typeof target === 'string' ? $(target) : target);
        const y = el ? el.getBoundingClientRect().top + window.scrollY + off : target;
        window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
      }
    },
  };

  /* ---------------------------------------------------------
     PAGE TRANSITIONS
     --------------------------------------------------------- */
  const Transition = {
    busy: false,
    panels: [],
    init() {
      this.panels = $$('.pt__panel');
      const incoming = html.classList.contains('pt-incoming');
      ss.del('trackie-pt');
      if (incoming && hasGsap && !reduced) {
        gsap.set(this.panels, { yPercent: 0 });
        html.classList.remove('pt-incoming');
        gsap.to(this.panels.slice().reverse(), { yPercent: -100, duration: 0.9, ease: 'expo.inOut', stagger: 0.08, delay: 0.1, onComplete: () => gsap.set(this.panels, { yPercent: 100 }) });
      } else { html.classList.remove('pt-incoming'); }

      document.addEventListener('click', (e) => {
        const a = e.target.closest('a[href]'); if (!a) return;
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank' || a.hasAttribute('download')) return;
        const href = a.getAttribute('href'); if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
        let url; try { url = new URL(a.href, location.href); } catch (err) { return; }
        if (url.origin !== location.origin) return;
        const samePage = url.pathname === location.pathname || (/\/(index\.html)?$/.test(url.pathname) && /\/(index\.html)?$/.test(location.pathname));
        if (samePage && url.hash) {
          const t = document.getElementById(url.hash.slice(1));
          if (t) { e.preventDefault(); Menu.close(); Drawer.close(); Smooth.to(t); history.replaceState(null, '', url.hash); }
          return;
        }
        if (samePage && !url.hash) { e.preventDefault(); Smooth.to(0); return; }
        e.preventDefault(); this.go(url.href);
      });
      window.addEventListener('pageshow', (e) => { if (e.persisted && hasGsap) { gsap.set(this.panels, { yPercent: 100 }); this.busy = false; } });
    },
    go(href) {
      if (this.busy) return; this.busy = true;
      Menu.close();
      if (!hasGsap || reduced) { location.href = href; return; }
      ss.set('trackie-pt', '1');
      gsap.fromTo(this.panels, { yPercent: 100 }, { yPercent: 0, duration: 0.75, ease: 'expo.inOut', stagger: 0.08, onComplete: () => { location.href = href; } });
    },
  };

  /* ---------------------------------------------------------
     HEADER + MENU
     --------------------------------------------------------- */
  const Header = {
    init() {
      const h = $('[data-header]'); if (!h) return;
      let last = 0;
      const onScroll = () => {
        const y = window.scrollY;
        h.classList.toggle('is-scrolled', y > 40);
        const menuOpen = html.classList.contains('menu-open');
        h.classList.toggle('is-hidden', !menuOpen && y > last && y > 400);
        last = y;
      };
      window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    },
  };
  const Menu = {
    el: null, btn: null,
    init() {
      this.el = $('[data-menu]'); this.btn = $('[data-menu-toggle]'); if (!this.el || !this.btn) return;
      this.btn.addEventListener('click', () => (this.el.classList.contains('is-open') ? this.close() : this.open()));
    },
    open() { this.el.classList.add('is-open'); this.el.setAttribute('aria-hidden', 'false'); html.classList.add('menu-open'); this.btn.setAttribute('aria-expanded', 'true'); Smooth.stop(); },
    close() { if (!this.el || !this.el.classList.contains('is-open')) return; this.el.classList.remove('is-open'); this.el.setAttribute('aria-hidden', 'true'); html.classList.remove('menu-open'); this.btn.setAttribute('aria-expanded', 'false'); Smooth.start(); },
  };

  /* ---------------------------------------------------------
     CURSOR + MAGNETIC
     --------------------------------------------------------- */
  const Cursor = {
    init() {
      if (!finePointer || reduced || !hasGsap) return;
      const c = $('.cursor'); if (!c) return;
      html.classList.add('has-cursor');
      const dot = $('.cursor__dot', c), ring = $('.cursor__ring', c);
      const xd = gsap.quickTo(dot, 'x', { duration: 0.08 }), yd = gsap.quickTo(dot, 'y', { duration: 0.08 });
      const xr = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' }), yr = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
      window.addEventListener('pointermove', (e) => { c.classList.add('is-on'); xd(e.clientX); yd(e.clientY); xr(e.clientX); yr(e.clientY); }, { passive: true });
      document.addEventListener('pointerover', (e) => c.classList.toggle('is-hover', !!e.target.closest('a, button, summary, [role="radio"], label, input, select')));
      $$('[data-magnetic]').forEach((el) => {
        const xt = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, .4)' }), yt = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, .4)' });
        el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); xt((e.clientX - r.left - r.width / 2) * 0.25); yt((e.clientY - r.top - r.height / 2) * 0.35); });
        el.addEventListener('pointerleave', () => { xt(0); yt(0); });
      });
    },
  };

  /* ---------------------------------------------------------
     INTRO (suitcase cover drops, tracker pings, plane orbits, logo reveals)
     --------------------------------------------------------- */
  const Intro = {
    run(onDone) {
      const el = $('[data-intro]');
      const force = /[?&]intro=1/.test(location.search);
      if (!el || !hasGsap || reduced || (ss.get('trackie-intro') && !force) || html.classList.contains('pt-incoming-done')) {
        if (el) el.remove();
        html.classList.add('no-intro');
        onDone(0); return;
      }
      ss.set('trackie-intro', '1');
      Smooth.stop();
      const svg = $('.case', el);
      const q = (s) => $(s, svg);
      const shell = q('.case__shell'), cover = q('.case__cover'), handle = q('.case__handle'), wheels = $$('.case__wheel', svg);
      const logoG = q('.case__logo'), orbit = q('.case__orbit-path'), plane = q('.case__plane');
      const chars = $$('.intro__char', el), reg = $('.intro__reg', el), tag = $('.intro__tag', el), count = $('[data-intro-count]', el), status = $('[data-intro-status]', el);
      const shadow = q('.case__shadow');
      const len = orbit.getTotalLength();
      const counter = { v: 0 };
      const statuses = ['Packing your experience…', 'Fitting the cover…', 'Pairing tracker…', 'Cleared for takeoff'];

      gsap.set(cover, { y: -620, scaleY: 1.25, opacity: 0, transformOrigin: '50% 100%' });
      gsap.set([handle], { y: 70 });
      gsap.set(wheels, { opacity: 0, y: 20 });
      gsap.set(shell, { opacity: 0, scale: 0.9, transformOrigin: '50% 100%' });
      gsap.set(orbit, { strokeDasharray: len, strokeDashoffset: len });
      gsap.set(plane, { opacity: 0 });
      gsap.set(chars, { yPercent: 115 });
      gsap.set([reg, tag], { opacity: 0, y: 10 });
      gsap.set(shadow, { opacity: 0, scaleX: 0.4, transformOrigin: '50% 50%' });

      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      tl.to(counter, { v: 100, duration: 3.6, ease: 'power1.inOut', onUpdate: () => { count.textContent = String(Math.round(counter.v)).padStart(3, '0'); status.textContent = statuses[Math.min(3, Math.floor(counter.v / 26))]; } }, 0)
        .to(shell, { opacity: 1, scale: 1, duration: 0.8 }, 0.1)
        .to(shadow, { opacity: 0.6, scaleX: 1, duration: 0.8 }, 0.1)
        .to(wheels, { opacity: 1, y: 0, stagger: 0.06, duration: 0.6 }, 0.25)
        .to(handle, { y: 0, duration: 0.9, ease: 'back.out(1.8)' }, 0.45)
        .set(cover, { opacity: 1 }, 0.95)
        .to(cover, { y: 0, scaleY: 1, duration: 0.62, ease: 'power3.in' }, 0.95)
        .to(cover, { scaleY: 0.93, scaleX: 1.04, duration: 0.12, ease: 'power2.out', transformOrigin: '50% 100%' }, '>')
        .to(cover, { scaleY: 1, scaleX: 1, duration: 0.9, ease: 'elastic.out(1, .35)' }, '>')
        .set(shell, { opacity: 0 }, 1.6)
        .fromTo(svg, { rotate: 0 }, { rotate: -2.5, duration: 0.15, yoyo: true, repeat: 1, ease: 'sine.inOut', transformOrigin: '50% 100%' }, 1.57)
        .fromTo(logoG, { scale: 0.4, opacity: 0, transformOrigin: '50% 50%' }, { scale: 1, opacity: 1, duration: 0.9, ease: 'back.out(2)' }, 1.85)
        .to(orbit, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut' }, 2.15)
        .to(plane, { opacity: 1, duration: 0.2 }, 2.15)
        .to(plane, { duration: 1.2, ease: 'power2.inOut', motionPath: { path: orbit, align: orbit, alignOrigin: [0.5, 0.5], autoRotate: 90 } }, 2.15)
        .to(chars, { yPercent: 0, stagger: 0.05, duration: 1 }, 2.35)
        .to([reg, tag], { opacity: 1, y: 0, stagger: 0.1, duration: 0.8 }, 2.8)
        .addLabel('exit', 3.75)
        .to('.intro__stage', { scale: 0.92, opacity: 0, y: -30, duration: 0.7, ease: 'power3.in' }, 'exit')
        .to('.intro__meta, .intro__skip', { opacity: 0, duration: 0.3 }, 'exit')
        .to(el, { clipPath: 'inset(50% 0% 50% 0%)', duration: 0.9, ease: 'expo.inOut' }, 'exit+=0.45')
        .add(() => onDone(0.1), 'exit+=0.75')
        .add(() => { el.remove(); Smooth.start(); window.ScrollTrigger && ScrollTrigger.refresh(); });
      gsap.set(el, { clipPath: 'inset(0% 0% 0% 0%)' });

      const skip = $('[data-intro-skip]', el);
      skip && skip.addEventListener('click', () => { if (tl.time() < tl.labels.exit) tl.seek('exit'); });
    },
  };

  /* ---------------------------------------------------------
     HERO
     --------------------------------------------------------- */
  const Hero = {
    play(delay = 0) {
      const h = $('[data-hero]'); if (!h || !hasGsap || reduced) return;
      const tl = gsap.timeline({ delay, defaults: { ease: 'expo.out' } });
      tl.from('[data-hero-line]', { yPercent: 115, rotate: 2, duration: 1.3, stagger: 0.1 })
        .from('[data-hero-in]', { y: 30, opacity: 0, duration: 1, stagger: 0.08 }, 0.35)
        .from('[data-hero-frame]', { clipPath: 'inset(100% 0% 0% 0% round 40px)', duration: 1.4, ease: 'expo.inOut' }, 0.1)
        .from('[data-hero-img]', { scale: 1.35, duration: 1.8 }, 0.1)
        .from('[data-hero-chip]', { scale: 0.6, opacity: 0, y: 20, duration: 0.9, stagger: 0.12, ease: 'back.out(1.8)' }, 0.9)
        .from('.hdr__inner', { y: -30, opacity: 0, duration: 0.9 }, 0.2)
        .from('.hero__scroll', { opacity: 0, duration: 0.8 }, 1);
    },
    scroll() {
      const h = $('[data-hero]'); if (!h || !hasGsap || reduced) return;
      gsap.to('[data-hero-img]', { yPercent: 12, ease: 'none', scrollTrigger: { trigger: h, start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to('[data-hero-frame]', { rotateY: 0, rotateX: 0, scale: 0.92, ease: 'none', scrollTrigger: { trigger: h, start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to('.hero__copy', { yPercent: -18, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: h, start: 'top top', end: 'bottom top', scrub: true } });
      $$('[data-hero-chip]').forEach((c, i) => gsap.to(c, { y: -60 - i * 40, ease: 'none', scrollTrigger: { trigger: h, start: 'top top', end: 'bottom top', scrub: true } }));
      const route = $('[data-hero-route]');
      if (route) gsap.to(route, { strokeDashoffset: -400, duration: 12, repeat: -1, ease: 'none' });
      // pointer tilt on the frame
      if (finePointer) {
        const f = $('[data-hero-frame]'); const rx = gsap.quickTo(f, 'rotationX', { duration: 0.8 }), ry = gsap.quickTo(f, 'rotationY', { duration: 0.8 });
        h.addEventListener('pointermove', (e) => { if (window.scrollY > 50) return; const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5; ry(-6 + nx * 10); rx(2 - ny * 8); });
      }
    },
  };

  // Scrambled text cycling (hero tracking chip)
  const Scramble = {
    chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    to(el, text, dur = 700) {
      const from = el.textContent; const len = Math.max(from.length, text.length); const start = performance.now();
      const step = (t) => {
        const p = Math.min(1, (t - start) / dur); let out = '';
        for (let i = 0; i < len; i++) {
          const settle = i / len;
          if (p > settle + 0.25 || text[i] === ' ' || text[i] === '·') out += text[i] || '';
          else out += p > settle ? this.chars[(Math.random() * this.chars.length) | 0] : (from[i] || '');
        }
        el.textContent = out; if (p < 1) requestAnimationFrame(step); else el.textContent = text;
      };
      requestAnimationFrame(step);
    },
    init() {
      $$('[data-cycle]').forEach((el) => {
        const list = el.dataset.cycle.split('|'); let i = 0;
        if (reduced) return;
        setInterval(() => { i = (i + 1) % list.length; this.to(el, list[i]); }, 3200);
      });
    },
  };

  /* ---------------------------------------------------------
     MARQUEE (scroll-velocity reactive)
     --------------------------------------------------------- */
  const Marquee = {
    init() {
      $$('[data-marquee]').forEach((row) => {
        const track = $('.marquee__track', row); if (!track) return;
        const dir = parseFloat(row.dataset.marquee) || 1;
        // duplicate content to fill
        const w = track.offsetWidth; const copies = Math.max(2, Math.ceil((innerWidth * 2) / w) + 1);
        for (let i = 1; i < copies; i++) { const c = track.cloneNode(true); c.setAttribute('aria-hidden', 'true'); row.appendChild(c); }
        if (!hasGsap || reduced) return;
        const tracks = $$('.marquee__track', row);
        const tween = gsap.to(tracks, { xPercent: -100, repeat: -1, duration: 22, ease: 'none' });
        if (dir < 0) { tween.progress(1); tween.timeScale(-1); }
        if (window.ScrollTrigger) {
          ScrollTrigger.create({
            trigger: row, start: 'top bottom', end: 'bottom top',
            onUpdate: (self) => {
              const v = self.getVelocity() / 300; const ts = dir * (self.direction) * Math.max(1, Math.min(6, Math.abs(v)));
              gsap.to(tween, { timeScale: ts, duration: 0.2, overwrite: true });
              gsap.to(tween, { timeScale: dir * self.direction, duration: 1.2, delay: 0.2, ease: 'power2.out' });
            },
          });
        }
      });
    },
  };

  /* ---------------------------------------------------------
     ANATOMY (pinned walk-through of 5 features)
     --------------------------------------------------------- */
  const Anatomy = {
    init() {
      const sec = $('[data-anatomy]'); if (!sec) return;
      const steps = $$('[data-step]', sec); const svg = $('.anatomy__case .case', sec);
      const callout = $('[data-callout]', sec), ctext = $('[data-callout-txt]', sec), num = $('[data-anat-num]', sec), bar = $('[data-anat-bar]', sec);
      const q = (s) => $(s, svg);
      const parts = {
        outline: q('.case__outline'), tag: q('.case__tag'), rings: $$('.case__ring', svg), zip: q('.case__zip'), tracker: q('.case__tracker'), side: q('.case__sidezip'), sideLine: q('.case__sidezip-line'),
        handle: q('.case__handle'), slot: q('.case__slot-glow'), cover: q('.case__cover'), glow: q('.case__tracker-glow'),
      };
      const SPOTS = {
        coverage: { x: 50, y: 6, t: 'Full coverage' },
        tracker: { x: 78, y: 57, t: 'Hidden tracker pocket' },
        pocket: { x: 88, y: 36, t: 'Zip side pocket' },
        handle: { x: 50, y: 0, t: 'Handle access' },
        stretch: { x: 82, y: 78, t: 'Stretch fit' },
      };
      let current = -1; let anim = null; let loop = null;
      const reset = () => {
        anim && anim.kill(); loop && loop.kill();
        if (!hasGsap) return;
        gsap.set(parts.outline, { opacity: 0, strokeDasharray: 'none' });
        gsap.set(parts.tag, { opacity: 0, y: 0 });
        gsap.set(parts.rings, { opacity: 0, scale: 1, transformOrigin: '50% 50%' });
        gsap.set(parts.zip, { y: 0 }); gsap.set([parts.tracker, parts.side], { opacity: 0 });
        gsap.set(parts.handle, { y: 0 });
        gsap.set(parts.cover, { scaleX: 1, scaleY: 1, transformOrigin: '50% 100%' });
        gsap.set(svg, { scale: 1, x: 0, y: 0, transformOrigin: '50% 50%' });
      };
      const z = (v) => (innerWidth < 860 ? 1 + (v - 1) * 0.35 : v);
      const zp = (v) => (innerWidth < 860 ? '0%' : v);
      const play = (key) => {
        if (!hasGsap) return; reset();
        const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
        if (key === 'coverage') {
          const L = parts.outline.getTotalLength ? parts.outline.getTotalLength() : 1400;
          tl.fromTo(parts.outline, { opacity: 1, strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' })
            .fromTo(svg, { scale: 0.96 }, { scale: 1, duration: 1 }, 0);
        } else if (key === 'tracker') {
          tl.to(svg, { scale: z(1.3), x: zp('-12%'), y: zp('-8%'), duration: 1.1 })
            .to(parts.tracker, { opacity: 1, duration: 0.5 }, 0.3)
            .fromTo(parts.tag, { opacity: 0, y: -70 }, { opacity: 1, y: 0, duration: 0.8, ease: 'back.out(1.6)' }, 0.5);
          loop = gsap.fromTo(parts.rings, { scale: 1, opacity: 0.9, transformOrigin: '50% 50%' }, { scale: 3, opacity: 0, duration: 1.4, stagger: 0.45, repeat: -1, ease: 'power2.out', delay: 1.1 });
        } else if (key === 'pocket') {
          const SL = parts.sideLine.getTotalLength ? parts.sideLine.getTotalLength() : 230;
          tl.to(svg, { scale: z(1.25), x: zp('-16%'), y: zp('2%'), duration: 1.1 })
            .to(parts.side, { opacity: 1, duration: 0.3 }, 0.3)
            .fromTo(parts.sideLine, { strokeDasharray: SL, strokeDashoffset: SL }, { strokeDashoffset: 0, duration: 1, ease: 'power3.inOut' }, 0.3)
            .fromTo(parts.zip, { y: 0 }, { y: 180, duration: 1, ease: 'power3.inOut' }, 0.4);
        } else if (key === 'handle') {
          tl.to(svg, { scale: z(1.2), y: zp('16%'), duration: 1.1 })
            .to(parts.handle, { y: -46, duration: 1, ease: 'back.out(1.4)' }, 0.3);
          loop = gsap.fromTo(parts.slot, { opacity: 0.3 }, { opacity: 1, duration: 0.7, yoyo: true, repeat: -1, ease: 'sine.inOut' });
        } else if (key === 'stretch') {
          loop = gsap.timeline({ repeat: -1, yoyo: true }).to(parts.cover, { scaleX: 1.05, scaleY: 0.975, duration: 0.9, ease: 'sine.inOut', transformOrigin: '50% 100%' });
          tl.fromTo(svg, { scale: 1.06 }, { scale: 1, duration: 1 });
        }
        anim = tl;
      };
      const setStep = (i) => {
        if (i === current) return; current = i;
        steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
        const key = steps[i].dataset.step; const sp = SPOTS[key];
        if (callout) { callout.style.left = sp.x + '%'; callout.style.top = sp.y + '%'; }
        if (ctext) { if (hasGsap && !reduced) Scramble.to(ctext, sp.t.toUpperCase(), 500); else ctext.textContent = sp.t; }
        if (num) num.textContent = String(i + 1).padStart(2, '0');
        if (bar) bar.style.width = ((i + 1) / steps.length) * 100 + '%';
        if (!reduced) play(key);
      };
      setStep(0);

      if (hasGsap && window.ScrollTrigger && !reduced) {
        const st = ScrollTrigger.create({
          trigger: sec, pin: $('.anatomy__pin', sec), start: 'top top', end: () => '+=' + innerHeight * steps.length * 0.85,
          onUpdate: (self) => setStep(Math.min(steps.length - 1, Math.floor(self.progress * steps.length * 0.999))),
        });
        steps.forEach((s, i) => s.addEventListener('click', () => Smooth.to(st.start + (st.end - st.start) * ((i + 0.5) / steps.length), { offset: 0 })));
        gsap.from($('.anatomy__case', sec), { y: 80, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: sec, start: 'top 70%' } });
      } else {
        steps.forEach((s, i) => s.addEventListener('click', () => setStep(i)));
      }
    },
  };

  /* ---------------------------------------------------------
     STATEMENT (word-by-word light up)
     --------------------------------------------------------- */
  const Words = {
    init() {
      $$('[data-words]').forEach((p) => {
        const wrap = (node) => {
          [...node.childNodes].forEach((n) => {
            if (n.nodeType === 3) {
              const frag = document.createDocumentFragment();
              n.textContent.split(/(\s+)/).forEach((w) => { if (!w) return; if (/^\s+$/.test(w)) frag.appendChild(document.createTextNode(w)); else { const s = document.createElement('span'); s.className = 'w'; s.textContent = w; frag.appendChild(s); } });
              n.replaceWith(frag);
            } else if (n.nodeType === 1) wrap(n);
          });
        };
        wrap(p);
        if (!hasGsap || reduced) return;
        gsap.to($$('.w', p), { opacity: 1, stagger: 0.05, ease: 'none', scrollTrigger: { trigger: p, start: 'top 82%', end: 'bottom 45%', scrub: true } });
      });
    },
  };

  /* ---------------------------------------------------------
     HORIZONTAL GALLERY
     --------------------------------------------------------- */
  const HGallery = {
    init() {
      const sec = $('[data-hgal]'); if (!sec || !hasGsap || reduced) return;
      const track = $('[data-hgal-track]', sec);
      const mm = gsap.matchMedia();
      mm.add('(min-width: 761px)', () => {
        const dist = () => track.scrollWidth - innerWidth;
        const tw = gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: sec, pin: $('.hgal__pin', sec), start: 'top top', end: () => '+=' + dist(), scrub: 1, invalidateOnRefresh: true } });
        $$('.tile', sec).forEach((t) => {
          gsap.from(t, { rotate: 6, y: 120, opacity: 0, ease: 'expo.out', scrollTrigger: { trigger: t, containerAnimation: tw, start: 'left 95%', end: 'left 60%', scrub: 1 } });
          gsap.fromTo($('img', t), { xPercent: -8 }, { xPercent: 8, ease: 'none', scrollTrigger: { trigger: t, containerAnimation: tw, start: 'left right', end: 'right left', scrub: true } });
        });
      });
    },
  };

  /* ---------------------------------------------------------
     COLORWAY (pinned color cycling)
     --------------------------------------------------------- */
  const Colorway = {
    init() {
      const sec = $('[data-colorway]'); if (!sec) return;
      const colors = P.colors || []; if (!colors.length) return;
      const sw = $('[data-cw-swatches]', sec), nameEl = $('[data-cw-name]', sec), idx = $('[data-cw-idx]', sec), total = $('[data-cw-total]', sec);
      const svg = $('[data-cw-case] .case', sec), shop = $('[data-cw-shop]', sec), shopName = $('[data-cw-shopname]', sec), pin = $('.colorway__pin', sec);
      total.textContent = String(colors.length).padStart(2, '0');
      sw.innerHTML = colors.map((c, i) => `<button type="button" class="cw-sw" role="option" aria-selected="${i === 0}" aria-label="${esc(c.name)}" style="--c:${c.hex}" data-i="${i}"></button>`).join('');
      let cur = -1; let st = null;
      const set = (i) => {
        if (i === cur) return; const prev = cur; cur = i; const c = colors[i];
        sec.style.setProperty('--cw', c.hex);
        const light = luminance(c.hex) > 0.36; pin.style.setProperty('--cw-ink', light ? '#0A1324' : '#FFFFFF');
        paintCase(svg, c.hex);
        $$('.cw-sw', sw).forEach((b, k) => b.setAttribute('aria-selected', String(k === i)));
        idx.textContent = String(i + 1).padStart(2, '0');
        shopName.textContent = c.name; shop.href = 'product.html?color=' + encodeURIComponent(c.name);
        if (hasGsap && !reduced && prev !== -1) {
          const dir = i > prev ? 1 : -1;
          gsap.timeline()
            .to(nameEl, { yPercent: -60 * dir, opacity: 0, duration: 0.25, ease: 'power2.in' })
            .add(() => { nameEl.textContent = c.name; })
            .fromTo(nameEl, { yPercent: 60 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6, ease: 'expo.out' });
          gsap.fromTo(svg, { rotate: -4 * dir, y: -14 }, { rotate: 0, y: 0, duration: 1, ease: 'elastic.out(1, .5)', transformOrigin: '50% 100%' });
        } else nameEl.textContent = c.name;
      };
      set(0);
      if (hasGsap && window.ScrollTrigger && !reduced) {
        st = ScrollTrigger.create({
          trigger: sec, pin, start: 'top top', end: () => '+=' + innerHeight * colors.length * 0.45,
          onUpdate: (self) => set(Math.min(colors.length - 1, Math.floor(self.progress * colors.length * 0.999))),
        });
        gsap.from($('[data-cw-case]', sec), { scale: 0.7, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: sec, start: 'top 60%' } });
      }
      sw.addEventListener('click', (e) => {
        const b = e.target.closest('.cw-sw'); if (!b) return; const i = +b.dataset.i;
        if (st) Smooth.to(st.start + (st.end - st.start) * ((i + 0.5) / colors.length), { offset: 0, duration: 1 }); else set(i);
      });
    },
  };

  /* ---------------------------------------------------------
     DEPARTURES BOARD (split-flap)
     --------------------------------------------------------- */
  const Board = {
    glyphs: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:',
    widths: [5, 9, 6, 7],
    init() {
      const b = $('[data-board]'); if (!b) return;
      const rows = $$('[data-row]', b);
      const clock = $('[data-board-clock]', b);
      const tick = () => { const d = new Date(); clock.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
      tick(); setInterval(tick, 15000);
      const cls = ['tm', 'ds', 'fl', 'st'];
      rows.forEach((r) => {
        const vals = r.dataset.row.split('|');
        r.innerHTML = vals.map((v, i) => `<span class="board__cell board__cell--${cls[i]}" data-v="${esc(v)}">${v.padEnd(this.widths[i], ' ').split('').map((ch) => `<span class="flap${ch === ' ' ? ' is-sp' : ''}" data-ch="${ch === ' ' ? ' ' : esc(ch)}">${ch === ' ' ? '' : (reduced ? esc(ch) : ' ')}</span>`).join('')}</span>`).join('');
      });
      if (reduced) return;
      const flipAll = (root, delayBase = 0) => {
        $$('.flap', root).forEach((f, i) => {
          const target = f.dataset.ch; if (target === ' ') return;
          let n = 6 + ((Math.random() * 10) | 0); const d = delayBase + i * 18;
          setTimeout(() => {
            const iv = setInterval(() => {
              f.textContent = n-- > 0 ? this.glyphs[(Math.random() * this.glyphs.length) | 0] : target;
              if (n < 0) clearInterval(iv);
            }, 55);
          }, d);
        });
      };
      const io = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { rows.forEach((r, k) => flipAll(r, k * 160)); io.disconnect(); } }), { threshold: 0.35 });
      io.observe(b);
      // occasional live status change
      const statuses = ['TRACKED', 'ON BELT', 'LANDED', 'BOARDING'];
      setInterval(() => {
        if (document.hidden) return;
        const r = rows[(Math.random() * rows.length) | 0]; const cell = $('.board__cell--st', r); if (!cell) return;
        const next = statuses[(statuses.indexOf(cell.dataset.v) + 1) % statuses.length];
        cell.dataset.v = next;
        const flaps = $$('.flap', cell); next.padEnd(this.widths[3], ' ').split('').forEach((ch, i) => { if (flaps[i]) { flaps[i].dataset.ch = ch; flaps[i].classList.toggle('is-sp', ch === ' '); if (ch === ' ') flaps[i].textContent = ''; } });
        flipAll(cell);
      }, 4200);
    },
  };

  /* ---------------------------------------------------------
     ROUTE + CTA plane + footer word + generic reveals
     --------------------------------------------------------- */
  const Scenes = {
    init() {
      if (!hasGsap || !window.ScrollTrigger || reduced) return;
      const route = $('.route');
      if (route) {
        const line = $('[data-route-line]', route), plane = $('[data-route-plane]', route); const L = line.getTotalLength();
        gsap.set(line, { strokeDasharray: L, strokeDashoffset: L });
        const tl = gsap.timeline({ scrollTrigger: { trigger: route, start: 'top 85%', end: 'bottom 35%', scrub: 1 } });
        tl.to(line, { strokeDashoffset: 0, ease: 'none' }, 0).to(plane, { ease: 'none', motionPath: { path: line, align: line, alignOrigin: [0.5, 0.5], autoRotate: true } }, 0);
      }
      const cta = $('[data-cta]');
      if (cta) {
        const trail = $('[data-cta-trail]', cta), plane = $('[data-cta-plane]', cta);
        gsap.to(plane, { ease: 'none', motionPath: { path: trail, align: trail, alignOrigin: [0.5, 0.5], autoRotate: true }, scrollTrigger: { trigger: cta, start: 'top bottom', end: 'bottom top', scrub: 1 } });
      }
      $$('[data-split]').forEach((h) => {
        const lines = h.innerHTML.split(/<br\s*\/?>/i);
        h.innerHTML = lines.map((l) => `<span class="line"><span class="line__in">${l}</span></span>`).join('');
        gsap.from($$('.line__in', h), { yPercent: 110, duration: 1.2, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: h, start: 'top 82%' } });
      });
      $$('.h2:not([data-split])').forEach((h) => gsap.from(h, { y: 60, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 88%' } }));
      $$('.faq__item, .track__list li, .ftr__col, .pdp__feats li').forEach((el) => gsap.from(el, { y: 30, opacity: 0, duration: 0.9, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 92%' } }));
      const board = $('[data-board]');
      if (board) gsap.from(board, { y: 80, rotateX: 18, opacity: 0, transformPerspective: 1200, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: board, start: 'top 85%' } });
      const trackImg = $('.track__photo img');
      if (trackImg) gsap.fromTo(trackImg, { yPercent: -10 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.track', start: 'top bottom', end: 'bottom top', scrub: true } });
      const giant = $('[data-giant]');
      if (giant) gsap.to(giant, { backgroundSize: '100% 100%', ease: 'none', scrollTrigger: { trigger: giant, start: 'top bottom', end: 'bottom bottom', scrub: true } });
      const buyStage = $('[data-buy-stage]');
      if (buyStage) gsap.from(buyStage, { clipPath: 'inset(20% 20% 20% 20% round 40px)', scale: 0.9, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: buyStage, start: 'top 80%' } });
      const hs = $('.hotspots__img');
      if (hs) gsap.from(hs, { clipPath: 'inset(100% 0 0 0 round 40px)', duration: 1.4, ease: 'expo.inOut', scrollTrigger: { trigger: hs, start: 'top 80%' } });
    },
  };

  /* ---------------------------------------------------------
     PRODUCT FORM (home buy box + product page)
     --------------------------------------------------------- */
  const ProductForm = {
    init() {
      $$('[data-product-form]').forEach((form) => this.mount(form));
    },
    mount(form) {
      const scope = form.closest('[data-product-scope]') || form.closest('section') || document;
      const colors = P.colors || [], sizes = P.sizes || [];
      const params = new URLSearchParams(location.search);
      const state = {
        color: colorByName(params.get('color') || store.get('trackie-last-color', colors[0]?.name)).name,
        size: sizes.find((s) => s.name === params.get('size')) ? params.get('size') : (P.defaultSize || sizes[0]?.name),
        qty: 1,
      };
      const cWrap = $('[data-color-options]', form), sWrap = $('[data-size-options]', form);
      cWrap.setAttribute('role', 'radiogroup'); cWrap.setAttribute('aria-label', 'Color');
      sWrap.setAttribute('role', 'radiogroup'); sWrap.setAttribute('aria-label', 'Size');
      cWrap.innerHTML = colors.map((c) => `<button type="button" class="swatch" role="radio" aria-checked="false" aria-label="${esc(c.name)}" title="${esc(c.name)}" data-color="${esc(c.name)}" style="--c:${c.hex}"></button>`).join('');
      sWrap.innerHTML = sizes.map((s) => `<button type="button" class="size" role="radio" aria-checked="false" data-size="${esc(s.name)}"><strong>${esc(s.name)}</strong><small>${esc(s.fits)}</small></button>`).join('');
      $$('[data-product-name]', scope).forEach((el) => (el.textContent = P.name));
      const priceEls = $$('[data-product-price]', document), cmpEls = $$('[data-product-compare]', document);
      const qtyIn = $('[data-qty-input]', form), addBtn = $('[data-add-btn]', form);

      const isSold = () => (P.soldOut || []).includes(`${state.color}/${state.size}`);
      const render = () => {
        const c = colorByName(state.color);
        $$('.swatch', cWrap).forEach((b) => { b.setAttribute('aria-checked', String(b.dataset.color === state.color)); b.toggleAttribute('data-soldout', (P.soldOut || []).includes(`${b.dataset.color}/${state.size}`)); });
        $$('.size', sWrap).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.size === state.size)));
        $$('[data-selected-color]', scope).forEach((e) => (e.textContent = state.color));
        $$('[data-selected-size]', scope).forEach((e) => { const s = sizes.find((x) => x.name === state.size); e.textContent = s ? `${s.name} · ${s.fits}` : ''; });
        $$('[data-buy-case] .case, [data-pdp-case] .case', document).forEach((svg) => paintCase(svg, c.hex));
        $$('[data-buy-stage], .gallery__slide--svg', document).forEach((st) => st.style.setProperty('--sel', c.hex));
        priceEls.forEach((e) => (e.textContent = money(P.price)));
        cmpEls.forEach((e) => (e.textContent = P.comparePrice ? money(P.comparePrice) : ''));
        const sold = isSold();
        $$('[data-add-btn]').forEach((b) => { b.disabled = sold; $('.btn__label', b).textContent = sold ? 'Sold out' : 'Add to bag'; });
        $$('[data-sticky-variant]').forEach((e) => (e.textContent = `${state.color} · ${state.size} · ${money(P.price)}`));
      };
      cWrap.addEventListener('click', (e) => {
        const b = e.target.closest('[data-color]'); if (!b) return; state.color = b.dataset.color; store.set('trackie-last-color', state.color); render();
        document.dispatchEvent(new CustomEvent('trackie:color', { detail: state.color }));
        if (hasGsap && !reduced) $$('[data-buy-case] .case, [data-pdp-case] .case').forEach((svg) => gsap.fromTo(svg, { rotate: -3, y: -10 }, { rotate: 0, y: 0, duration: 1, ease: 'elastic.out(1,.5)', transformOrigin: '50% 100%' }));
      });
      sWrap.addEventListener('click', (e) => { const b = e.target.closest('[data-size]'); if (!b) return; state.size = b.dataset.size; render(); });
      // keyboard arrows for radio groups
      [cWrap, sWrap].forEach((g) => g.addEventListener('keydown', (e) => {
        if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return; e.preventDefault();
        const items = [...g.children]; const i = items.indexOf(document.activeElement); const n = items[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]; n.focus(); n.click();
      }));
      const q = $('[data-qty]', form);
      if (q) {
        $('[data-qty-minus]', q).addEventListener('click', () => { qtyIn.value = Math.max(1, (+qtyIn.value || 1) - 1); });
        $('[data-qty-plus]', q).addEventListener('click', () => { qtyIn.value = Math.min(20, (+qtyIn.value || 1) + 1); });
      }
      const doAdd = (srcEl) => {
        if (isSold()) return;
        const qty = Math.max(1, Math.min(20, +qtyIn.value || 1));
        Cart.add(state.color, state.size, qty);
        flyToCart(srcEl, colorByName(state.color).hex);
        toast(`${state.color} · ${state.size} added to your bag`);
      };
      form.addEventListener('submit', (e) => { e.preventDefault(); doAdd(addBtn); });
      $$('[data-sticky-add]').forEach((b) => b.addEventListener('click', () => doAdd(b)));
      render();
    },
  };

  function flyToCart(from, hex) {
    const cart = $('.hdr__cart'); const done = () => { cart && (cart.classList.remove('is-bump'), void cart.offsetWidth, cart.classList.add('is-bump')); setTimeout(() => Drawer.open(), 250); };
    if (!hasGsap || reduced || !from || !cart) return done();
    const hdr = $('[data-header]'); hdr && hdr.classList.remove('is-hidden');
    const a = from.getBoundingClientRect(), b = cart.getBoundingClientRect();
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;left:${a.left + a.width / 2 - 26}px;top:${a.top + a.height / 2 - 39}px;width:52px;height:78px;z-index:500;pointer-events:none`;
    el.innerHTML = miniCase(hex); document.body.appendChild(el);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    gsap.timeline({ onComplete: () => { el.remove(); done(); } })
      .to(el, { x: dx * 0.5, y: Math.min(dy, 0) - 120, rotate: -20, scale: 1.2, duration: 0.45, ease: 'power2.out' })
      .to(el, { x: dx, y: dy, rotate: 10, scale: 0.25, opacity: 0.2, duration: 0.5, ease: 'power3.in' });
  }

  /* ---------------------------------------------------------
     PRODUCT PAGE: gallery, size guide, sticky ATC, hotspots
     --------------------------------------------------------- */
  const Gallery = {
    init() {
      const g = $('[data-gallery]'); if (!g) return;
      const slides = $$('.gallery__slide', g), thumbs = $$('.gallery__thumb', g); let i = 0;
      const go = (n) => { i = (n + slides.length) % slides.length; slides.forEach((s, k) => s.classList.toggle('is-active', k === i)); thumbs.forEach((t, k) => { t.classList.toggle('is-active', k === i); t.setAttribute('aria-current', String(k === i)); }); };
      thumbs.forEach((t, k) => t.addEventListener('click', () => go(k)));
      $('[data-gal-prev]', g)?.addEventListener('click', () => go(i - 1));
      $('[data-gal-next]', g)?.addEventListener('click', () => go(i + 1));
      document.addEventListener('trackie:color', () => go(0));
      let sx = null; const main = $('.gallery__main', g);
      main.addEventListener('touchstart', (e) => (sx = e.touches[0].clientX), { passive: true });
      main.addEventListener('touchend', (e) => { if (sx === null) return; const d = e.changedTouches[0].clientX - sx; if (Math.abs(d) > 40) go(i + (d < 0 ? 1 : -1)); sx = null; });
    },
  };
  const Modal = {
    init() {
      const m = $('[data-size-guide]');
      const body = $('[data-sg-body]');
      if (body) body.innerHTML = (P.sizes || []).map((s) => `<tr><td>${esc(s.name)}</td><td>${esc(s.fits)}</td><td>${esc(s.cm)}</td></tr>`).join('');
      const open = (e) => { if (!m) return; e && e.preventDefault(); m.classList.add('is-open'); m.setAttribute('aria-hidden', 'false'); Smooth.stop(); $('.modal__x', m)?.focus(); };
      const close = () => { if (!m) return; m.classList.remove('is-open'); m.setAttribute('aria-hidden', 'true'); Smooth.start(); };
      $$('[data-size-guide-open]').forEach((b) => b.addEventListener('click', (e) => { if (m) open(e); }));
      if (m) { $$('[data-modal-close]', m).forEach((b) => b.addEventListener('click', close)); document.addEventListener('keydown', (e) => e.key === 'Escape' && close()); if (location.hash === '#size-guide') setTimeout(open, 600); }
    },
  };
  const StickyATC = {
    init() {
      const bar = $('[data-sticky-atc]'), form = $('[data-product-form]'); if (!bar || !form) return;
      const io = new IntersectionObserver(([e]) => bar.classList.toggle('is-show', !e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
      io.observe($('[data-add-btn]', form));
    },
  };

  /* ---------------------------------------------------------
     CHECKOUT PAGE
     --------------------------------------------------------- */
  const Checkout = {
    init() {
      const root = $('[data-checkout-page]'); if (!root) return;
      const form = $('[data-co-form]', root), list = $('[data-co-items]', root);
      const ship = CFG.shipping || {}, pays = CFG.payments || {};
      if (!Cart.count()) { $('[data-co-main]', root).innerHTML = `<div class="co__done"><h1 class="h2">Your bag is empty</h1><p>Pick a color and size first.</p><p style="margin-top:28px"><a href="product.html" class="btn btn--glow btn--lg"><span class="btn__label">Shop the cover</span></a></p></div>`; return; }
      // countries
      const sel = $('[name="country"]', form);
      sel.innerHTML = (ship.countries || []).map((c) => `<option>${esc(c)}</option>`).join('');
      // payments
      $$('[data-pay]', form).forEach((opt) => {
        const k = opt.dataset.pay; const p = pays[k];
        if (!p || !p.enabled) { opt.hidden = true; $('input', opt).disabled = true; return; }
        $('[data-pay-label]', opt).textContent = p.label; $('[data-pay-note]', opt).textContent = p.note;
      });
      const first = $$('[data-pay]:not([hidden]) input', form)[0]; if (first) first.checked = true;
      const totals = () => {
        const sub = Cart.subtotal(); const method = ($('input[name="payment"]:checked', form) || {}).value;
        const shipping = ship.freeOver > 0 && sub >= ship.freeOver ? 0 : (ship.price || 0);
        const fee = method === 'cod' ? (ship.codFee || 0) : 0;
        return { sub, shipping, fee, total: sub + shipping + fee };
      };
      const render = () => {
        list.innerHTML = Cart.items.map((i) => { const c = colorByName(i.color); return `<div class="line-item"><div class="line-item__img">${miniCase(c.hex)}</div><div><div class="line-item__t">${esc(P.name)}</div><div class="line-item__v"><i style="--c:${c.hex}"></i>${esc(i.color)} · ${esc(i.size)} · × ${i.qty}</div></div><div class="line-item__r"><span>${money(i.qty * P.price)}</span></div></div>`; }).join('');
        const t = totals();
        $('[data-co-sub]', root).textContent = money(t.sub);
        $('[data-co-ship]', root).textContent = t.shipping ? money(t.shipping) : 'Free';
        const feeRow = $('[data-co-fee-row]', root); feeRow.hidden = !t.fee; $('[data-co-fee]', root).textContent = money(t.fee);
        $('[data-co-total]', root).textContent = money(t.total);
        $('[data-co-btn-total]', root).textContent = money(t.total);
      };
      form.addEventListener('change', render); render();

      const validate = () => {
        let ok = true;
        $$('[required]', form).forEach((inp) => {
          const f = inp.closest('.field'); let valid = inp.type === 'checkbox' ? inp.checked : inp.value.trim() !== '';
          if (valid && inp.type === 'email') valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(inp.value.trim());
          if (valid && inp.name === 'phone') valid = inp.value.replace(/\D/g, '').length >= 6;
          f && f.classList.toggle('is-invalid', !valid); if (!valid) ok = false;
        });
        return ok;
      };
      $$('input, select', form).forEach((i) => i.addEventListener('blur', () => { const f = i.closest('.field'); if (f && f.classList.contains('is-invalid')) validate(); }));

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = $('[data-co-msg]', root); msg.textContent = '';
        if (!validate()) { msg.textContent = 'Please check the highlighted fields.'; const bad = $('.is-invalid input, .is-invalid select', form); bad && bad.focus(); return; }
        const btn = $('[data-co-submit]', form); btn.classList.add('is-loading');
        const data = Object.fromEntries(new FormData(form).entries());
        const payload = { customer: data, items: Cart.items.map(({ color, size, qty }) => ({ color, size, qty })), payment: data.payment, clientTotal: totals().total };
        let res = null;
        try {
          if (CFG.previewMode) throw new Error('preview');
          const r = await fetch(CFG.orderEndpoint || 'order.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          res = await r.json();
          if (!r.ok || !res.ok) throw new Error(res && res.error ? res.error : 'Order failed');
        } catch (err) {
          if (CFG.previewMode) {
            res = { ok: true, order: 'TRK-PREVIEW', total: totals().total, payment: data.payment, preview: true };
          } else {
            btn.classList.remove('is-loading');
            msg.textContent = (err && err.message && err.message !== 'Failed to fetch' ? err.message + ' — ' : '') + `Something went wrong. Please try again or email us at ${CFG.contactEmail}.`;
            return;
          }
        }
        const pay = data.payment; const bank = CFG.bank || {};
        Cart.clear();
        window.scrollTo(0, 0);
        $('[data-co-main]', root).innerHTML = `<div class="co__done">
          <div class="co__check">${ICON.check}</div>
          <p class="eyebrow" style="justify-content:center;display:flex"><span class="eyebrow__dot"></span>Order ${esc(res.order)}</p>
          <h1 class="h2">Cleared for takeoff!</h1>
          <p>Thank you, ${esc(data.firstName)}. We’ve received your order${res.preview ? ' (preview mode — nothing was sent)' : ''} and sent a confirmation to <b>${esc(data.email)}</b>.</p>
          ${pay === 'bank' ? `<div class="co__bank"><div><span>Amount</span><b>${money(res.total)}</b></div><div><span>Recipient</span><b>${esc(bank.recipient)}</b></div><div><span>IBAN</span><b>${esc(bank.iban)}</b></div>${bank.bankName ? `<div><span>Bank</span><b>${esc(bank.bankName)}</b></div>` : ''}${bank.swift ? `<div><span>SWIFT</span><b>${esc(bank.swift)}</b></div>` : ''}<div><span>Reference</span><b>${esc(res.order)}</b></div></div><p>Your order ships as soon as the payment arrives.</p>` : ''}
          ${pay === 'cod' ? `<p style="margin-top:14px">You’ll pay <b>${money(res.total)}</b> to the courier on delivery.</p>` : ''}
          ${pay === 'card' && (CFG.payments.card || {}).url ? `<p style="margin-top:22px"><a class="btn btn--glow btn--lg" href="${esc(CFG.payments.card.url)}"><span class="btn__label">Pay by card</span></a></p>` : ''}
          <p style="margin-top:30px"><a href="index.html" class="btn btn--ghost"><span class="btn__label">Back to home</span></a></p>
        </div>`;
        if (hasGsap && !reduced) gsap.from('.co__done > *', { y: 30, opacity: 0, stagger: 0.08, duration: 1, ease: 'expo.out' });
      });
    },
  };

  /* ---------------------------------------------------------
     MISC: newsletter, social/policy links, year, details animation
     --------------------------------------------------------- */
  const Misc = {
    init() {
      $$('[data-year]').forEach((e) => (e.textContent = new Date().getFullYear()));
      $$('[data-social]').forEach((a) => { const u = (CFG.social || {})[a.dataset.social]; if (u) { a.href = u; a.target = '_blank'; a.rel = 'noopener'; } else a.hidden = true; });
      $$('[data-policy]').forEach((a) => { const u = (CFG.policies || {})[a.dataset.policy]; if (u) a.href = u; else a.closest('a').style.display = 'none'; });
      $$('[data-contact-email]').forEach((a) => { a.href = 'mailto:' + CFG.contactEmail; a.textContent = CFG.contactEmail ? 'Contact · ' + CFG.contactEmail : 'Contact'; });
      $$('[data-newsletter]').forEach((f) => f.addEventListener('submit', async (e) => {
        e.preventDefault(); const m = $('[data-newsletter-msg]', f); const email = f.email.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { m.textContent = 'Please enter a valid email.'; return; }
        try {
          if (CFG.previewMode) throw new Error('preview');
          const r = await fetch(CFG.newsletterEndpoint || 'subscribe.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
          if (!r.ok) throw new Error();
          m.textContent = 'You’re on the list. Welcome aboard ✈️'; f.reset();
        } catch (err) { m.textContent = CFG.previewMode ? 'You’re on the list (preview).' : 'Could not subscribe right now — please try again.'; }
      }));
      // smooth open/close for <details>
      if (hasGsap && !reduced) $$('details.faq__item, .acc details').forEach((d) => {
        const s = $('summary', d), body = s.nextElementSibling; if (!body) return;
        s.addEventListener('click', (e) => {
          e.preventDefault();
          if (d.open) { gsap.to(body, { height: 0, opacity: 0, duration: 0.45, ease: 'power3.inOut', onComplete: () => { d.open = false; gsap.set(body, { clearProps: 'all' }); window.ScrollTrigger && ScrollTrigger.refresh(); } }); }
          else { d.open = true; gsap.fromTo(body, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.6, ease: 'expo.out', onComplete: () => { gsap.set(body, { clearProps: 'all' }); window.ScrollTrigger && ScrollTrigger.refresh(); } }); }
        });
      });
    },
  };

  /* ---------------------------------------------------------
     BOOT
     --------------------------------------------------------- */
  const boot = () => {
    if (hasGsap) {
      const plugins = [window.ScrollTrigger, window.MotionPathPlugin].filter(Boolean);
      gsap.registerPlugin(...plugins);
    }
    Smooth.init();
    Transition.init();
    Header.init(); Menu.init(); Drawer.init(); Cursor.init();
    ProductForm.init(); Gallery.init(); Modal.init(); StickyATC.init(); Checkout.init();
    Scramble.init(); Marquee.init(); Words.init(); Board.init(); Misc.init();
    Anatomy.init(); HGallery.init(); Colorway.init(); Hero.scroll(); Scenes.init();

    const isHome = !!$('[data-hero]');
    if (isHome) Intro.run((d) => Hero.play(d)); else if ($('[data-intro]')) $('[data-intro]').remove();

    const afterLoad = () => {
      window.ScrollTrigger && ScrollTrigger.refresh();
      if (location.hash && location.hash.length > 1 && location.hash !== '#size-guide') {
        const t = document.getElementById(location.hash.slice(1)); if (t) setTimeout(() => Smooth.to(t, { immediate: true }), 50);
      }
    };
    if (document.readyState === 'complete') afterLoad(); else window.addEventListener('load', afterLoad);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => window.ScrollTrigger && ScrollTrigger.refresh());
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
