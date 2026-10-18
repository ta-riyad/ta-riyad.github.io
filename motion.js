/* motion.js — interaction layer. The page stays fully readable without it.
   Load with a plain <script src="motion.js"></script> just before </body>.
   NAV_COLLAPSE must match the nav breakpoint in style.css. */
(function () {
  'use strict';

  var NAV_COLLAPSE = 1000;
  var root = document.documentElement;
  root.classList.add('js');

  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasIO = 'IntersectionObserver' in window;
  var collapsed = window.matchMedia('(max-width: ' + NAV_COLLAPSE + 'px)');
  var nav = document.querySelector('.navbar');

  /* Shared with the nav code further down:
     spyLocked  – while a nav click is scrolling, scroll-spy stays quiet so the pill
                  goes straight to the clicked link instead of hopping through every section.
     navSelect  – set once the nav exists; called by the anchor click handler. */
  var spyLocked = false;
  var navSelect = null;

  /* ---------- Eased anchor scrolling ---------- */
  var scrollRaf = 0;
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function cancelScroll() { if (scrollRaf) { cancelAnimationFrame(scrollRaf); scrollRaf = 0; } }
  function stopScroll() { cancelScroll(); spyLocked = false; }
  ['wheel', 'touchstart', 'keydown'].forEach(function (ev) {
    window.addEventListener(ev, stopScroll, { passive: true });   // the user always wins
  });

  function scrollToY(y, done) {
    cancelScroll();
    var max = root.scrollHeight - window.innerHeight;
    y = Math.max(0, Math.min(y, max));
    var y0 = window.scrollY, d = y - y0;
    if (calm || Math.abs(d) < 2) { window.scrollTo(0, y); if (done) done(); return; }
    var dur = Math.min(1100, Math.max(450, Math.abs(d) * 0.4));
    var t0 = performance.now();
    (function step(now) {
      var p = Math.min((now - t0) / dur, 1);
      window.scrollTo(0, y0 + d * easeInOut(p));
      if (p < 1) scrollRaf = requestAnimationFrame(step);
      else { scrollRaf = 0; if (done) done(); }
    })(t0);
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var id = a.getAttribute('href').slice(1);
    var target = id ? document.getElementById(id) : null;
    if (!target && id) return;
    e.preventDefault();
    if (navSelect) navSelect(id);                    // pill moves right away, scroll-spy waits
    var offset = nav ? nav.offsetHeight + 8 : 76;
    var y = id && id !== 'top' ? target.getBoundingClientRect().top + window.scrollY - offset : 0;
    scrollToY(y, function () {
      spyLocked = false;
      if (history.replaceState) history.replaceState(null, '', id && id !== 'top' ? '#' + id : window.location.pathname + window.location.search);
      if (target) { if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
    });
  });

  /* ---------- Split headings into masked words ---------- */
  document.querySelectorAll('[data-split]').forEach(function (el) {
    if (el.children.length) return;
    var words = el.textContent.trim().split(/\s+/);
    if (!words[0]) return;
    el.setAttribute('aria-label', words.join(' '));
    el.textContent = '';
    words.forEach(function (word, i) {
      var mask = document.createElement('span');
      mask.className = 'w';
      mask.setAttribute('aria-hidden', 'true');
      var inner = document.createElement('span');
      inner.style.setProperty('--wi', i);
      inner.textContent = word;
      mask.appendChild(inner);
      el.appendChild(mask);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
  });

  /* ---------- Reveal on scroll ---------- */
  var reveals = document.querySelectorAll('[data-reveal], [data-split]');
  if (calm || !hasIO) {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Navbar state, progress fallback, back-to-top ---------- */
  var toTop = document.querySelector('.back-to-top');
  var hasScrollTimeline = window.CSS && CSS.supports && CSS.supports('animation-timeline', 'scroll()');
  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY;
      if (nav) nav.classList.toggle('is-stuck', y > 12);
      if (toTop) toTop.classList.toggle('is-on', y > window.innerHeight * 0.6);
      if (nav && !hasScrollTimeline) {
        var max = root.scrollHeight - window.innerHeight;
        nav.style.setProperty('--progress', max > 0 ? (y / max).toFixed(4) : 0);
      }
      ticking = false;
    });
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Gliding nav pill + scroll-spy ---------- */
  var navList = document.querySelector('.nav-links');
  var navItems = navList ? Array.prototype.slice.call(navList.querySelectorAll('a')) : [];
  var toggle = document.querySelector('.nav-toggle');

  function setCurrent(link) {
    navItems.forEach(function (a) { a.removeAttribute('aria-current'); });
    if (link) link.setAttribute('aria-current', 'page');
  }
  function keyboardFocus(el) {
    try { return el.matches(':focus-visible'); } catch (err) { return true; }
  }

  if (navList && navItems.length) {
    var pill = document.createElement('span');
    pill.className = 'nav-indicator';
    pill.setAttribute('aria-hidden', 'true');
    navList.appendChild(pill);
    var current = null;

    /* Slides the pill under a link. The first time it appears (or re-appears after hiding)
       it fades in at the target instead of flying across from the left edge. */
    var moveTo = function (link) {
      if (!link || collapsed.matches) { pill.classList.remove('is-on'); return; }
      var r = link.getBoundingClientRect();
      var p = navList.getBoundingClientRect();
      var appearing = !pill.classList.contains('is-on');
      if (appearing) pill.style.transition = 'opacity 320ms ease';
      pill.style.setProperty('--x', Math.round(r.left - p.left) + 'px');
      pill.style.setProperty('--w', Math.round(r.width) + 'px');
      pill.style.setProperty('--h', Math.round(r.height) + 'px');
      pill.classList.add('is-on');
      if (appearing) {
        void pill.offsetWidth;                                   // commit the jump before motion returns
        requestAnimationFrame(function () { pill.style.transition = ''; });
      }
    };

    var byId = {};
    navItems.forEach(function (a) { byId[(a.getAttribute('href') || '').replace(/^#/, '')] = a; });

    /* Called by the anchor click handler. Nav targets (and the top of the page) win immediately;
       other anchors are left to scroll-spy. */
    navSelect = function (id) {
      if (id && id !== 'top' && !byId[id]) return;
      spyLocked = true;
      var link = byId[id] || null;
      if (link !== current) { current = link; setCurrent(link); moveTo(link); }
    };

    window.addEventListener('resize', function () { moveTo(current); });
    if (collapsed.addEventListener) collapsed.addEventListener('change', function () { moveTo(current); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { moveTo(current); });

    if (fine) {
      navItems.forEach(function (link) {
        link.addEventListener('pointerenter', function () { moveTo(link); });
      });
      navList.addEventListener('pointerleave', function () { moveTo(current); });
    }
    /* Keyboard users get the same glide as they tab through the links */
    navItems.forEach(function (link) {
      link.addEventListener('focus', function () { if (keyboardFocus(link)) moveTo(link); });
    });
    navList.addEventListener('focusout', function (e) {
      if (e.relatedTarget && navList.contains(e.relatedTarget)) return;
      moveTo(current);
    });

    var watched = Object.keys(byId).map(function (id) { return document.getElementById(id); }).filter(Boolean);
    var hero = document.getElementById('hero');
    if (hero) watched.push(hero);

    if (hasIO && watched.length) {
      var spy = new IntersectionObserver(function (entries) {
        if (spyLocked) return;
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var match = byId[entry.target.id] || null;      // hero → no highlight
          if (match === current) return;
          current = match;
          setCurrent(current);
          moveTo(current);
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      watched.forEach(function (s) { spy.observe(s); });
    }
  }

  /* ---------- Mobile menu ---------- */
  if (toggle && navList) {
    var setMenu = function (open) {
      navList.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', function () { setMenu(!navList.classList.contains('open')); });
    navList.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navList.classList.contains('open')) { setMenu(false); toggle.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (navList.classList.contains('open') && !e.target.closest('.navbar')) setMenu(false);
    });
    if (collapsed.addEventListener) collapsed.addEventListener('change', function () { setMenu(false); });
  }





   
     /* ---------- Pointer touches (fine pointers, motion allowed) ---------- */
  if (fine && !calm) {
    /* Soft light that follows the cursor across cards */
    document.querySelectorAll('.card').forEach(function (card) {
      var queued = false, ev = null;
      card.addEventListener('pointermove', function (e) {
        ev = e;
        if (queued) return;
        queued = true;
        requestAnimationFrame(function () {
          var r = card.getBoundingClientRect();
          card.style.setProperty('--mx', (ev.clientX - r.left).toFixed(0) + 'px');
          card.style.setProperty('--my', (ev.clientY - r.top).toFixed(0) + 'px');
          queued = false;
        });
      });
    });

    /* Buttons lean a few pixels toward the cursor */
    document.querySelectorAll('.btn').forEach(function (btn) {
      btn.addEventListener('pointermove', function (e) {
        var r = btn.getBoundingClientRect();
        btn.style.setProperty('--tx', (((e.clientX - r.left) / r.width - 0.5) * 8).toFixed(1) + 'px');
        btn.style.setProperty('--ty', (((e.clientY - r.top) / r.height - 0.5) * 6).toFixed(1) + 'px');
      });
      btn.addEventListener('pointerleave', function () {
        btn.style.setProperty('--tx', '0px');
        btn.style.setProperty('--ty', '0px');
      });
    });
  }

  /* ---------- Stat count-up ---------- */
  function countUp(el) {
    var raw = el.getAttribute('data-count');
    var end = parseFloat(raw);
    if (isNaN(end)) return;
    var suffix = el.getAttribute('data-suffix') || '';
    var decimals = (raw.split('.')[1] || '').length;
    if (calm) { el.textContent = end.toFixed(decimals) + suffix; return; }
    var t0 = performance.now();
    (function step(now) {
      var p = Math.min((now - t0) / 1300, 1);
      el.textContent = (end * (1 - Math.pow(1 - p, 4))).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  var counters = document.querySelectorAll('[data-count]');
  if (hasIO && !calm) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        countUp(entry.target);
        co.unobserve(entry.target);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { co.observe(el); });
  }

  /* ---------- Gallery + lightbox ---------- */
  var items = Array.prototype.slice.call(document.querySelectorAll('.gallery-item'));

  /* If a photo can't load, say so on the tile instead of leaving it blank. */
  items.forEach(function (item) {
    var img = item.querySelector('img'), wrap = item.querySelector('.image-wrapper');
    if (!img || !wrap) return;
    var broken = function () { wrap.classList.add('is-broken'); wrap.setAttribute('data-alt', img.alt || 'Image unavailable'); };
    img.addEventListener('error', broken);
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) broken();
  });

  var lb = document.getElementById('lightbox');
  if (lb && items.length) {
    var lbImg = document.getElementById('lb-img');
    var lbCap = document.getElementById('lb-caption');
    var lbClose = lb.querySelector('.lb-close');
    var lbBtns = Array.prototype.slice.call(lb.querySelectorAll('.lb-btn'));
    var index = 0, opener = null;

    var fill = function (i, swap) {
      index = (i + items.length) % items.length;
      var img = items[index].querySelector('img');
      var cap = items[index].querySelector('figcaption');
      var apply = function () {
        lbImg.src = img.currentSrc || img.src;
        lbImg.alt = img.alt;
        lbCap.textContent = cap ? cap.textContent : '';
        lbImg.classList.remove('is-swapping');
      };
      if (swap && !calm) { lbImg.classList.add('is-swapping'); setTimeout(apply, 160); } else apply();
    };
    var openLb = function (i, from) {
      opener = from;
      fill(i, false);
      lb.hidden = false;
      requestAnimationFrame(function () { lb.classList.add('is-open'); });
      document.body.style.overflow = 'hidden';
      lbClose.focus();
    };
    var closeLb = function () {
      lb.classList.remove('is-open');
      var finish = function () { lb.hidden = true; lbImg.removeAttribute('src'); };
      if (calm) finish(); else setTimeout(finish, 250);
      document.body.style.overflow = '';
      if (opener) opener.focus();
    };

    items.forEach(function (item, i) {
      var btn = item.querySelector('.image-wrapper');
      if (btn) btn.addEventListener('click', function () { if (!btn.classList.contains('is-broken')) openLb(i, btn); });
    });
    lbClose.addEventListener('click', closeLb);
    lb.querySelector('.lb-prev').addEventListener('click', function () { fill(index - 1, true); });
    lb.querySelector('.lb-next').addEventListener('click', function () { fill(index + 1, true); });
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });

    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') { closeLb(); return; }
      if (e.key === 'ArrowLeft') fill(index - 1, true);
      if (e.key === 'ArrowRight') fill(index + 1, true);
      if (e.key === 'Tab') {
        var first = lbBtns[0], last = lbBtns[lbBtns.length - 1];
        if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
      }
    });

    var x0 = null;                                          // swipe in the lightbox
    lb.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) fill(index + (dx < 0 ? 1 : -1), true);
      x0 = null;
    }, { passive: true });
  }
})();
