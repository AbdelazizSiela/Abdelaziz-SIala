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
   Hero image carousel.
   Fade between slides; prev/next arrows + dot indicators. Autoplay pauses
   on hover/focus and when the tab is hidden; honours reduced motion.
   To add a photo: paste another .gallery-slide + one matching .gallery-dot
   in index.html — everything here works automatically.
   ========================================================================== */

(function () {
  'use strict';

  var gallery = document.getElementById('hero-gallery');
  if (!gallery) return;

  var slides = Array.prototype.slice.call(gallery.querySelectorAll('.gallery-slide'));
  var dots = Array.prototype.slice.call(gallery.querySelectorAll('.gallery-dot'));
  if (slides.length < 2) return;

  var AUTO_MS = 5000;

  var index = 0;
  var timer = null;
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var autoplayEnabled = !motion.matches;

  function show(i) {
    index = (i + slides.length) % slides.length;
    for (var s = 0; s < slides.length; s++) {
      slides[s].classList.toggle('is-active', s === index);
    }
    for (var d = 0; d < dots.length; d++) {
      dots[d].classList.toggle('is-active', d === index);
      dots[d].setAttribute('aria-selected', d === index ? 'true' : 'false');
    }
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

  var prevBtn = gallery.querySelector('.gallery-prev');
  var nextBtn = gallery.querySelector('.gallery-next');

  if (prevBtn) prevBtn.addEventListener('click', function () { prevSlide(); startAuto(); });
  if (nextBtn) nextBtn.addEventListener('click', function () { nextSlide(); startAuto(); });

  for (var x = 0; x < dots.length; x++) {
    (function (d, i) {
      d.addEventListener('click', function () { show(i); startAuto(); });
    })(dots[x], x);
  }

  gallery.addEventListener('mouseenter', stopAuto);
  gallery.addEventListener('mouseleave', startAuto);
  gallery.addEventListener('focusin', stopAuto);
  gallery.addEventListener('focusout', startAuto);

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { stopAuto(); } else { startAuto(); }
  });

  startAuto();
})();

/* ==========================================================================
   Lightbox — click any gallery image to inspect it full size.
   ========================================================================== */

(function () {
  'use strict';

  var lightbox = document.getElementById('hero-lightbox');
  if (!lightbox) return;

  var lightboxImg = lightbox.querySelector('.lightbox-img');
  var lightboxClose = lightbox.querySelector('.lightbox-close');

  function openLightbox(img) {
    lightboxImg.src = img.currentSrc || img.src;
    lightboxImg.alt = img.alt || '';
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.hidden = true;
    document.body.style.overflow = '';
  }

  document.addEventListener('click', function (e) {
    if (e.target && e.target.tagName === 'IMG') {
      openLightbox(e.target);
    }
  });

  if (lightboxClose) {
    lightboxClose.addEventListener('click', closeLightbox);
  }

  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !lightbox.hidden) closeLightbox();
  });
})();