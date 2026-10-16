/* motion.js — interaction layer. The page remains fully readable without it.
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
  var nav = document.querySelector('.navbar');
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

  if (toTop) {
    toTop.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
    });
  }

  /* ---------- Gliding nav pill + scroll-spy ---------- */
  var navList = document.querySelector('.nav-links');
  var navItems = navList ? Array.prototype.slice.call(navList.querySelectorAll('a')) : [];
  var toggle = document.querySelector('.nav-toggle');

  function setCurrent(link) {
    navItems.forEach(function (a) { a.removeAttribute('aria-current'); });
    if (link) link.setAttribute('aria-current', 'page');
  }

  if (navList && navItems.length) {
    var pill = document.createElement('span');
    pill.className = 'nav-indicator';
    pill.setAttribute('aria-hidden', 'true');
    navList.appendChild(pill);
    var current = null;

    var moveTo = function (link) {
      if (!link || collapsed.matches) { pill.classList.remove('is-on'); return; }
      var r = link.getBoundingClientRect();
      var p = navList.getBoundingClientRect();
      pill.style.setProperty('--x', (r.left - p.left) + 'px');
      pill.style.setProperty('--w', r.width + 'px');
      pill.style.setProperty('--h', r.height + 'px');
      pill.classList.add('is-on');
    };

    window.addEventListener('resize', function () { moveTo(current); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { moveTo(current); });

    if (fine) {
      navItems.forEach(function (link) {
        link.addEventListener('pointerenter', function () { moveTo(link); });
        link.addEventListener('focus', function () { moveTo(link); });
      });
      navList.addEventListener('pointerleave', function () { moveTo(current); });
      navList.addEventListener('focusout', function () { moveTo(current); });
    }

    /* The pill follows the section being read; at the hero it hides. */
    var byId = {};
    navItems.forEach(function (a) { byId[(a.getAttribute('href') || '').replace(/^#/, '')] = a; });
    var watched = Object.keys(byId).map(function (id) { return document.getElementById(id); }).filter(Boolean);
    var hero = document.getElementById('hero');
    if (hero) watched.push(hero);

    if (hasIO && watched.length) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var match = byId[entry.target.id] || null;      // hero → null
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
    collapsed.addEventListener && collapsed.addEventListener('change', function () { setMenu(false); });
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
      var p = Math.min((now - t0) / 1200, 1);
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

  /* ---------- Carousel ---------- */
  var carousel = document.querySelector('[data-carousel]');
  var slides = [];
  var index = 0;
  var showSlide = function () {};

  if (carousel) {
    var track = carousel.querySelector('.carousel-track');
    slides = Array.prototype.slice.call(track.children);
    var dotsWrap = carousel.querySelector('.carousel-dots');
    var dots = slides.map(function (_, i) {
      var d = document.createElement('button');
      d.type = 'button';
      d.className = 'dot';
      d.setAttribute('aria-label', 'Show image ' + (i + 1) + ' of ' + slides.length);
      d.addEventListener('click', function () { showSlide(i); });
      dotsWrap.appendChild(d);
      return d;
    });

    showSlide = function (i) {
      index = (i + slides.length) % slides.length;           // wraps both ways
      track.style.transform = 'translateX(-' + (index * 100) + '%)';
      slides.forEach(function (s, n) {
        s.setAttribute('aria-label', (n + 1) + ' of ' + slides.length);
        var hidden = n !== index;
        s.setAttribute('aria-hidden', String(hidden));
        if ('inert' in s) s.inert = hidden;                  // keeps off-screen buttons out of tab order
        if (!hidden) { var im = s.querySelector('img'); if (im) im.loading = 'eager'; }
      });
      dots.forEach(function (d, n) { d.setAttribute('aria-current', String(n === index)); });
    };

    carousel.querySelector('.prev-btn').addEventListener('click', function () { showSlide(index - 1); });
    carousel.querySelector('.next-btn').addEventListener('click', function () { showSlide(index + 1); });
    carousel.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { showSlide(index - 1); e.preventDefault(); }
      if (e.key === 'ArrowRight') { showSlide(index + 1); e.preventDefault(); }
    });

    var x0 = null;                                           // touch swipe
    carousel.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    carousel.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 45) showSlide(index + (dx < 0 ? 1 : -1));
      x0 = null;
    }, { passive: true });

    showSlide(0);
  }

  /* ---------- Lightbox ---------- */
  var lb = document.getElementById('lightbox');
  if (lb && slides.length) {
    var lbImg = document.getElementById('lb-img');
    var lbCap = document.getElementById('lb-caption');
    var lbClose = lb.querySelector('.lb-close');
    var lbBtns = Array.prototype.slice.call(lb.querySelectorAll('.lb-btn'));
    var opener = null;

    var fill = function (i) {
      index = (i + slides.length) % slides.length;
      var img = slides[index].querySelector('img');
      var cap = slides[index].querySelector('.carousel-caption');
      lbImg.src = img.currentSrc || img.src;
      lbImg.alt = img.alt;
      lbCap.textContent = cap ? cap.textContent : '';
      showSlide(index);                                      // keep carousel in sync
    };
    var openLb = function (i, from) {
      opener = from;
      fill(i);
      lb.hidden = false;
      document.body.style.overflow = 'hidden';
      lbClose.focus();
    };
    var closeLb = function () {
      lb.hidden = true;
      lbImg.removeAttribute('src');
      document.body.style.overflow = '';
      if (opener) opener.focus();
    };

    slides.forEach(function (s, i) {
      var btn = s.querySelector('.image-wrapper');
      if (btn) btn.addEventListener('click', function () { openLb(i, btn); });
    });
    lbClose.addEventListener('click', closeLb);
    lb.querySelector('.lb-prev').addEventListener('click', function () { fill(index - 1); });
    lb.querySelector('.lb-next').addEventListener('click', function () { fill(index + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });

    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') { closeLb(); return; }
      if (e.key === 'ArrowLeft') fill(index - 1);
      if (e.key === 'ArrowRight') fill(index + 1);
      if (e.key === 'Tab') {                                 // focus trap
        var first = lbBtns[0], last = lbBtns[lbBtns.length - 1];
        if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
      }
    });
  }
})();
