/* ==========================================================================
   Hero headline: rotating pain phrases, always one line each.
   - Auto-fit: the largest font size where the WIDEST phrase fits the
     container on a single line, applied to every phrase.
   - Hold 2.2s per phrase -> 0.4s slide-up + fade -> loop forever.
   - Respects prefers-reduced-motion (static first phrase).
   ========================================================================== */

(function () {
  'use strict';

  var container = document.querySelector('.rotating-phrases');
  if (!container) return;

  var phrases = Array.prototype.slice.call(container.querySelectorAll('.rotating-phrase'));
  if (phrases.length < 2) return;

  var HOLD_MS = 2200;
  var FADE_MS = 400;
  var MIN_PX = 16;
  var MAX_PX = 80;

  /* ---- Always-one-line fit ---------------------------------------------------
     A hidden probe (same styles as a phrase, inherits the h1 font) is measured
     at candidate font sizes; binary-search the largest size where every
     phrase fits the container width on a single line. */
  var probe = phrases[0].cloneNode(true);
  probe.classList.remove('is-active', 'is-leaving');
  probe.style.position = 'absolute';
  probe.style.left = '-99999px';
  probe.style.visibility = 'hidden';
  probe.style.whiteSpace = 'nowrap';
  container.appendChild(probe);

  function widestPhraseWidth(fontSize) {
    probe.style.fontSize = fontSize + 'px';
    var widest = 0;
    for (var i = 0; i < phrases.length; i++) {
      probe.textContent = phrases[i].textContent;
      widest = Math.max(widest, probe.getBoundingClientRect().width);
    }
    return widest;
  }

  function fitPhrases() {
    // 2% safety margin guards against sub-pixel rounding overflow.
    var maxWidth = container.clientWidth * 0.98;
    if (!maxWidth) return;

    var low = MIN_PX;
    var high = MAX_PX;
    var best = MIN_PX;

    while (low <= high) {
      var mid = (low + high) >> 1;
      if (widestPhraseWidth(mid) <= maxWidth) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    probe.style.fontSize = best + 'px';
    for (var j = 0; j < phrases.length; j++) {
      phrases[j].style.fontSize = best + 'px';
    }
  }

  var rafId = null;
  function scheduleFit() {
    if (rafId) return;
    rafId = window.requestAnimationFrame(function () {
      rafId = null;
      fitPhrases();
    });
  }

  /* ---- Rotation ---------------------------------------------------------------- */
  var index = 0;
  var timer = null;

  function next() {
    var current = phrases[index];
    var nextIndex = (index + 1) % phrases.length;
    var incoming = phrases[nextIndex];

    current.classList.remove('is-active');
    current.classList.add('is-leaving');

    incoming.classList.add('is-active');
    index = nextIndex;

    window.setTimeout(function () {
      current.classList.remove('is-leaving');
    }, FADE_MS);
  }

  function start() {
    stop();
    timer = window.setInterval(next, HOLD_MS);
  }

  function stop() {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  fitPhrases();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(fitPhrases);
  }
  window.addEventListener('resize', scheduleFit);

  if (motion.matches) {
    phrases[0].classList.add('is-active');
    return;
  }

  start();
})();

/* ==========================================================================
   Hero image carousel + lightbox.
   Slides are picked up automatically from the images/hero/ folder by probing
   hero_1.png, hero_2.png, hero_3.png ... until a file is missing. Just drop
   hero_N.png into the folder (sequential names) and reload.
   Fade between slides; prev/next arrows + dot indicators (built per slide).
   Autoplay pauses on hover/focus and when the tab is hidden; honours reduced
   motion.

   Click any image to open the lightbox. Inside it you can switch photos with
   the arrow buttons or the left/right arrow keys; Esc / backdrop / ✕ closes.
   ========================================================================== */

(function () {
  'use strict';

  var gallery = document.getElementById('hero-gallery');
  var lightbox = document.getElementById('hero-lightbox');
  if (!gallery || !lightbox) return;

  var slidesWrap = gallery.querySelector('.gallery-slides');
  var dotsWrap = gallery.querySelector('.gallery-dots');
  var prevBtn = gallery.querySelector('.gallery-prev');
  var nextBtn = gallery.querySelector('.gallery-next');

  var lightboxImg = lightbox.querySelector('.lightbox-img');
  var lightboxClose = lightbox.querySelector('.lightbox-close');
  var lightboxPrev = lightbox.querySelector('.lightbox-prev');
  var lightboxNext = lightbox.querySelector('.lightbox-next');

  var PROBE_BASE = 'images/hero/hero_';
  var AUTO_MS = 5000;
  var MAX_SLIDES = 50;

  /* Caption for each hero image (by slide number). Add/edit here. */
var CAPTIONS = {
  1: 'Stop feeling lost wondering what to learn, where to start, or what to do next',
  2: 'Turn ambitious ideas into games you can actually finish',
  3: 'Learn to solve problems instead of waiting for answers',
  4: 'Stop starting over and actually ship your game',
  5: 'Learn to build games independently'
  };

  var slides = [];
  var dots = [];
  var captions = [];
  var index = 0;
  var timer = null;
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var autoplayEnabled = !motion.matches;

  var heroCaption = document.getElementById('hero-caption');
  var lightboxCaption = lightbox.querySelector('.lightbox-caption');

  function captionFor(n) {
    return CAPTIONS[n] || '';
  }

  function addSlide(src, num) {
    var slide = document.createElement('div');
    slide.className = 'gallery-slide';

    var img = document.createElement('img');
    img.src = src;
    img.alt = 'Hero image ' + (slides.length + 1);
    img.loading = 'lazy';
    slide.appendChild(img);

    var dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'gallery-dot';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', 'Image ' + (slides.length + 1));

    slidesWrap.appendChild(slide);
    dotsWrap.appendChild(dot);
    slides.push(slide);
    dots.push(dot);
    captions.push(captionFor(num));

    (function (d, i) {
      d.addEventListener('click', function () { show(i); startAuto(); });
    })(dot, slides.length - 1);
  }

  function updateCaption(el, text) {
    if (!el) return;
    el.style.opacity = '0';
    window.setTimeout(function () {
      el.textContent = text;
      el.style.opacity = '1';
    }, 180);
  }

  function show(i) {
    if (slides.length === 0) return;
    index = (i + slides.length) % slides.length;
    for (var s = 0; s < slides.length; s++) {
      slides[s].classList.toggle('is-active', s === index);
      dots[s].classList.toggle('is-active', s === index);
      dots[s].setAttribute('aria-selected', s === index ? 'true' : 'false');
    }
    updateCaption(heroCaption, captions[index] || '');
  }

  function nextSlide() { show(index + 1); }
  function prevSlide() { show(index - 1); }

  function startAuto() {
    if (!autoplayEnabled) return;
    stopAuto();
    timer = window.setInterval(nextSlide, AUTO_MS);
  }

  function stopAuto() {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  /* ---- Lightbox ---- */

  function slideIndexOf(img) {
    for (var i = 0; i < slides.length; i++) {
      if (slides[i].querySelector('img') === img) return i;
    }
    return -1;
  }

  function renderLightbox() {
    if (slides.length === 0) return;
    var img = slides[index].querySelector('img');
    lightboxImg.src = img.currentSrc || img.src;
    lightboxImg.alt = img.alt || '';
    updateCaption(lightboxCaption, captions[index] || '');
  }

  function openLightbox(i) {
    show(i);
    renderLightbox();
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    stopAuto();
  }

  function closeLightbox() {
    lightbox.hidden = true;
    document.body.style.overflow = '';
    startAuto();
  }

  function lightboxStep(step) {
    if (slides.length === 0) return;
    index = (index + step + slides.length) % slides.length;
    show(index);
    renderLightbox();
  }

  document.addEventListener('click', function (e) {
    if (e.target && e.target.tagName === 'IMG') {
      var i = slideIndexOf(e.target);
      if (i >= 0) openLightbox(i);
    }
  });

  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightboxPrev) lightboxPrev.addEventListener('click', function () { lightboxStep(-1); });
  if (lightboxNext) lightboxNext.addEventListener('click', function () { lightboxStep(1); });

  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', function (e) {
    if (lightbox.hidden) return;
    if (e.key === 'Escape') {
      closeLightbox();
    } else if (e.key === 'ArrowRight') {
      lightboxStep(1);
    } else if (e.key === 'ArrowLeft') {
      lightboxStep(-1);
    }
  });

  /* ---- Boot ---- */

  function finish() {
    if (slides.length === 0) return;
    show(0);

    if (slides.length < 2) return;

    if (prevBtn) prevBtn.addEventListener('click', function () { prevSlide(); startAuto(); });
    if (nextBtn) nextBtn.addEventListener('click', function () { nextSlide(); startAuto(); });

    gallery.addEventListener('mouseenter', stopAuto);
    gallery.addEventListener('mouseleave', startAuto);
    gallery.addEventListener('focusin', stopAuto);
    gallery.addEventListener('focusout', startAuto);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { stopAuto(); } else { startAuto(); }
    });

    startAuto();
  }

  function probe(n) {
    if (n > MAX_SLIDES) {
      finish();
      return;
    }
    var img = new Image();
    img.onload = function () {
      addSlide(PROBE_BASE + n + '.png', n);
      probe(n + 1);
    };
    img.onerror = function () {
      finish();
    };
    img.src = PROBE_BASE + n + '.png';
  }

  probe(1);
})();