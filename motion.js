/* motion.js — interactive layer for the portfolio.
   The page is fully readable without it.

   index.html loads it with:
     <script src="motion.js" defer onerror="...remove('js')"></script>
   and adds the `js` class to <html> in <head> to avoid a flash.
*/
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');

  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasIO = 'IntersectionObserver' in window;
  var NAV_COLLAPSE = 960;                 // keep equal to the CSS breakpoint
  var isCollapsed = function () { return window.innerWidth <= NAV_COLLAPSE; };

  /* ---------- Split headings into masked words ---------- */
  document.querySelectorAll('[data-split]').forEach(function (el) {
    if (el.children.length) return;                       // leave mixed markup alone
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

  /* ---------- Stagger groups: children reveal in sequence ---------- */
  document.querySelectorAll('[data-stagger]').forEach(function (box) {
    Array.prototype.forEach.call(box.children, function (child, i) {
      child.setAttribute('data-reveal', '');
      child.style.setProperty('--i', Math.min(i, 5));
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
        io.unobserve(entry.target);                       // reveal once, never replay
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Navbar stuck state, progress line, back-to-top ---------- */
  var nav = document.querySelector('.navbar');
  var toTop = document.querySelector('.back-to-top');
  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY;
      var max = root.scrollHeight - window.innerHeight;
      if (nav) {
        nav.classList.toggle('is-stuck', y > 12);
        nav.style.setProperty('--progress', max > 0 ? Math.min(y / max, 1).toFixed(4) : 0);
      }
      if (toTop) toTop.classList.toggle('is-on', y > window.innerHeight * 0.6);
      ticking = false;
    });
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  if (toTop) {
    toTop.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
    });
  }

  /* ---------- Gliding nav pill + scroll-spy ---------- */
  var navList = document.querySelector('.nav-links');
  var navItems = navList ? Array.prototype.slice.call(navList.querySelectorAll('a')) : [];
  var current = null;

  if (navList && navItems.length) {
    var pill = document.createElement('span');
    pill.className = 'nav-indicator';
    pill.setAttribute('aria-hidden', 'true');
    navList.appendChild(pill);

    var moveTo = function (link) {
      if (!link || isCollapsed()) { pill.classList.remove('is-on'); return; }
      var r = link.getBoundingClientRect();
      var p = navList.getBoundingClientRect();
      pill.style.setProperty('--x', (r.left - p.left) + 'px');
      pill.style.setProperty('--w', r.width + 'px');
      pill.style.setProperty('--h', r.height + 'px');
      pill.classList.add('is-on');
    };

    var setCurrent = function (link) {
      if (link === current) return;
      navItems.forEach(function (a) { a.removeAttribute('aria-current'); });
      current = link;
      if (link) link.setAttribute('aria-current', 'true');
      moveTo(current);
    };

    window.addEventListener('resize', function () { moveTo(current); });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { moveTo(current); });
    }

    if (fine) {
      navItems.forEach(function (link) {
        link.addEventListener('pointerenter', function () { moveTo(link); });
        link.addEventListener('focus', function () { moveTo(link); });
      });
      navList.addEventListener('pointerleave', function () { moveTo(current); });
    }

    /* Scroll-spy: the pill follows the section being read; at the top it hides. */
    if (hasIO) {
      var targets = [];
      navItems.forEach(function (a) {
        var el = document.getElementById((a.getAttribute('href') || '').replace(/^#/, ''));
        if (el) targets.push({ el: el, link: a });
      });
      var hero = document.getElementById('hero');
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var hit = targets.filter(function (t) { return t.el === entry.target; })[0];
          setCurrent(hit ? hit.link : null);
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      targets.forEach(function (t) { spy.observe(t.el); });
      if (hero) spy.observe(hero);
    }
  }

  /* ---------- Mobile menu ---------- */
  var toggle = document.querySelector('.nav-toggle');
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
    window.addEventListener('resize', function () { if (!isCollapsed()) setMenu(false); });
  }

  /* ---------- Stat count-up ---------- */
  function countUp(el) {
    var raw = el.dataset.count;
    var end = parseFloat(raw);
    var suffix = el.dataset.suffix || '';
    var decimals = (raw.split('.')[1] || '').length;
    if (calm) { el.textContent = end.toFixed(decimals) + suffix; return; }
    var t0 = performance.now();
    (function step(now) {
      var p = Math.min((now - t0) / 1000, 1);
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
    counters.forEach(function (el) { el.textContent = '0' + (el.dataset.suffix || ''); co.observe(el); });
  }

  /* ---------- Carousel ---------- */
  var car = document.querySelector('[data-carousel]');
  if (car) {
    var track = car.querySelector('.carousel-track');
    var slides = Array.prototype.slice.call(track.children);
    var prev = car.querySelector('.prev-btn');
    var next = car.querySelector('.next-btn');
    var status = car.querySelector('.carousel-status');
    var dotBox = car.querySelector('.carousel-dots');
    var viewport = car.querySelector('.carousel-viewport');
    var n = slides.length;
    var idx = 0;
    var dots = [];

    if (dotBox) {
      slides.forEach(function (_, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'dot';
        b.setAttribute('aria-label', 'Show image ' + (i + 1) + ' of ' + n);
        b.addEventListener('click', function () { go(i); });
        dotBox.appendChild(b);
        dots.push(b);
      });
    }

    function go(i) {
      idx = (i + n) % n;                                  // wraps both directions
      track.style.transform = 'translateX(-' + idx * 100 + '%)';
      slides.forEach(function (s, k) {
        var on = k === idx;
        s.setAttribute('aria-hidden', on ? 'false' : 'true');
        if ('inert' in s) s.inert = !on;
        Array.prototype.forEach.call(s.querySelectorAll('a'), function (a) { a.tabIndex = on ? 0 : -1; });
      });
      dots.forEach(function (d, k) {
        if (k === idx) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      });
      if (status) status.textContent = (idx + 1) + ' / ' + n;
    }

    if (next) next.addEventListener('click', function () { go(idx + 1); });
    if (prev) prev.addEventListener('click', function () { go(idx - 1); });
    car.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { go(idx + 1); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { go(idx - 1); e.preventDefault(); }
    });

    /* Swipe on touch screens; a swipe never opens the lightbox. */
    var sx = null, sy = 0, swiped = false;
    viewport.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; swiped = false; });
    viewport.addEventListener('pointerup', function (e) {
      if (sx === null) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { swiped = true; go(idx + (dx < 0 ? 1 : -1)); }
    });
    viewport.addEventListener('pointercancel', function () { sx = null; });
    viewport.addEventListener('click', function (e) {
      if (swiped) { e.preventDefault(); e.stopPropagation(); swiped = false; }
    }, true);

    go(0);
  }

  /* ---------- Lightbox (native <dialog>, with fallback) ---------- */
  var lb = document.getElementById('lightbox');
  if (lb) {
    var lbImg = document.getElementById('lightbox-img');
    var lbCap = document.getElementById('lightbox-caption');
    var lbClose = lb.querySelector('.lightbox-close');
    var native = typeof lb.showModal === 'function';
    var opener = null;

    var unlock = function () { root.classList.remove('is-locked'); };

    var openLightbox = function (trigger) {
      var img = trigger.querySelector('img');
      var slide = trigger.closest('.carousel-slide');
      var cap = slide ? slide.querySelector('.carousel-caption') : null;
      if (!img) return;
      opener = trigger;
      lbImg.src = img.currentSrc || img.src;
      lbImg.alt = img.alt;
      lbCap.textContent = cap ? cap.textContent : '';
      root.classList.add('is-locked');
      if (native) lb.showModal(); else lb.setAttribute('open', '');
      if (lbClose) lbClose.focus();
    };

    var closeLightbox = function () {
      if (native) { lb.close(); return; }
      lb.removeAttribute('open');
      unlock();
      if (opener) opener.focus();
    };

    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-lightbox]');
      if (!t) return;
      e.preventDefault();
      openLightbox(t);
    });
    if (lbClose) lbClose.addEventListener('click', closeLightbox);
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });  // backdrop
    lb.addEventListener('close', unlock);                                                   // Esc, button, backdrop
    document.addEventListener('keydown', function (e) {
      if (!native && e.key === 'Escape' && lb.hasAttribute('open')) closeLightbox();
    });
  }
})();
