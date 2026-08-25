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
/* ==========================================================================
   Marquee factory — powers any auto-scrolling card strip.
   Cards load from imgBase + n + '.png' (drop files in with sequential names).
   Items (title/description/link) are passed in via config below.

   The track auto-scrolls forever: cards are duplicated enough times to cover
   2x the viewport, then the offset wraps modulo one set width, so the loop
   never ends. Dragging adds velocity (flick = momentum that decays back to
   the base speed). Honours prefers-reduced-motion (no autoscroll).
   ========================================================================== */

function initMarquee(config) {
  'use strict';

  var marquee = document.getElementById(config.marqueeId);
  var track = document.getElementById(config.trackId);
  if (!marquee || !track) return;

  var COUNT = config.items.length;
  var IMG_BASE = config.imgBase;
  var IMG_START = config.imgStart || 1;         // first image number to load
  var SHOW_TEXT = config.showText !== false;    // title/description below image
  var AXIS = config.axis === 'y' ? 'y' : 'x';   // scroll/drag direction
  var REVERSE = !!config.reverse;               // flip autoscroll direction

  /* One entry per image. Edit titles, descriptions & links here.
     `link` is where the card navigates when clicked (opens in a new tab). */
  var PROOF_ITEMS = config.items;

  var BASE_SPEED = 40;      // px per second, autoscroll direction: leftwards
  var FRICTION = 0.94;      // momentum decay per frame (at 60fps)
  var MAX_COPIES = 12;      // hard cap on duplications

  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---- Build one full set of cards --------------------------------------- */
  function buildSet() {
    for (var i = 0; i < COUNT; i++) {
      var item = PROOF_ITEMS[i] || { title: '', desc: '' };

      var card = document.createElement('figure');
      card.className = 'proof-card';
      card.setAttribute('aria-hidden', 'true'); // duplicates are decorative; set is announced once

      // Whole card is a link. In popup mode (_item + config.onCardActivate)
      // clicking opens the case-study popup instead of navigating.
      var link = document.createElement('a');
      link.className = 'proof-link';
      link.href = item.link || '#';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      // Index into config.items — data attributes survive cloneNode(true),
      // JS expando properties don't (duplicated cards are clones).
      link.setAttribute('data-item-index', String(i));

      var img = document.createElement('img');
      img.className = 'proof-media';
      // Items may pin an exact image; otherwise number sequentially from IMG_START
      img.src = item.img || (IMG_BASE + (IMG_START + i) + '.png');
      img.alt = '';
      img.draggable = false;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('error', function () {
        this.classList.add('is-missing'); // placeholder look until user drops real images in
      });

      link.appendChild(img);
      if (SHOW_TEXT) {
        var title = document.createElement('figcaption');
        var strong = document.createElement('span');
        strong.className = 'proof-title';
        strong.textContent = item.title;
        var desc = document.createElement('span');
        desc.className = 'proof-desc';
        desc.textContent = item.desc;
        title.appendChild(strong);
        title.appendChild(desc);
        link.appendChild(title);
      }
      card.appendChild(link);
      track.appendChild(card);

      if (i === 0 && marquee.querySelector('[data-marquee-original]') === null) {
        // Keep the first set accessible to screen readers
        card.removeAttribute('aria-hidden');
        card.setAttribute('data-marquee-original', '');
        card.setAttribute('role', 'group');
        card.setAttribute('aria-label', 'Item 1');
      }
    }
  }

  buildSet();

  /* ---- Duplicate until we can loop seamlessly ---------------------------- */
  function setWidth() {
    // The exact repeat period is the distance between a card and the same
    // card one full set later — measured from the DOM, so gaps, margins and
    // hidden (display:none) split-mode cards can never skew it.
    // (offsetTop/offsetLeft are relative to whatever offsetParent, but the
    // difference between two siblings cancels that out.)
    var kids = track.children;
    var a = null, aIdx = -1, i;
    for (i = 0; i < kids.length && i < COUNT; i++) {
      if (kids[i].offsetWidth > 0 || kids[i].offsetHeight > 0) { a = kids[i]; aIdx = i; break; }
    }
    if (!a || aIdx + COUNT >= kids.length) return 0;
    var b = kids[aIdx + COUNT];
    var w = AXIS === 'y' ? (b.offsetTop - a.offsetTop) : (b.offsetLeft - a.offsetLeft);
    return w > 0 ? w : 0;
  }

  function wrapOffset() {
    var w = setWidth();
    if (!w || !isFinite(w)) return;
    while (offset <= -w) offset += w;
    while (offset > 0) offset -= w;
  }

  var copies = 1;
  function ensureCopies() {
    var span = AXIS === 'y' ? marquee.clientHeight : marquee.clientWidth;
    var needed = Math.ceil((span * 2) / Math.max(1, AXIS === 'y' ? track.scrollHeight : track.scrollWidth)) + 1;
    var target = Math.min(Math.max(needed, 2), MAX_COPIES);
    while (copies < target) {
      for (var i = 0; i < COUNT * copies; i++) {
        track.appendChild(track.children[i].cloneNode(true));
      }
      copies *= 2;
    }
  }

  ensureCopies();
  window.addEventListener('resize', ensureCopies);
  window.addEventListener('load', ensureCopies); // re-measure after images/fonts settle
  setTimeout(ensureCopies, 400); // safety net for late layout shifts

  /* ---- Animation --------------------------------------------------------- */
  var offset = 0;       // current translateX (negative = moved left)
  var velocity = 0;     // extra px/s from dragging/flicking
  var speedFactor = 1;  // eased 0..1 multiplier — eases to 0 while a card is hovered
  var hovering = false;
  var lastTime = null;
  var rafId = null;

  marquee.addEventListener('pointerover', function (e) {
    var media = e.target.closest && e.target.closest('.proof-media');
    if (media) {
      hovering = true;
      var card = media.closest('.proof-card');
      if (card) card.classList.add('is-hover');
      wake();
    }
  });
  marquee.addEventListener('pointerout', function (e) {
    var media = e.target.closest && e.target.closest('.proof-media');
    if (media) {
      hovering = false;
      var card = media.closest('.proof-card');
      if (card) card.classList.remove('is-hover');
      wake();
    }
  });

  /* ---- Cursor tooltip ("Click me!") --------------------------------------- */
  var tip = document.createElement('div');
  tip.className = 'proof-tooltip';
  tip.textContent = config.tooltip || 'Click me!';
  document.body.appendChild(tip);

  function moveTip(x, y) {
    var px = x + 14; // offset from the cursor
    var py = y + 18;
    var r = tip.getBoundingClientRect();
    if (px + r.width > window.innerWidth - 8) px = x - r.width - 14;
    if (py + r.height > window.innerHeight - 8) py = y - r.height - 18;
    tip.style.left = px + 'px';
    tip.style.top = py + 'px';
  }
  function showTip() { tip.classList.add('is-visible'); }
  function hideTip() { tip.classList.remove('is-visible'); }

  // Position is tracked on the window so the tip keeps following the cursor
  // even while fading out or between cards. Visibility is just a class toggle,
  // so re-entering an image mid-fade resumes from the current opacity instead
  // of restarting the animation.
  window.addEventListener('pointermove', function (e) {
    moveTip(e.clientX, e.clientY);
    var hit = !dragging && e.pointerType === 'mouse' &&
      e.target.closest && e.target.closest('.proof-media');
    if (hit) showTip(); else hideTip();
  });
  document.addEventListener('pointerleave', hideTip);
  window.addEventListener('blur', hideTip);

  function frame(now) {
    if (lastTime == null) lastTime = now;
    var dt = Math.min((now - lastTime) / 1000, 0.05); // clamp tab-switch jumps
    lastTime = now;

    if (!dragging) {
      // Ease the base speed toward 0 while hovering a card (smooth stop),
      // and back to 1 after leaving.
      var targetFactor = hovering ? 0 : 1;
      speedFactor += (targetFactor - speedFactor) * Math.min(1, dt * 6);
      if (!hovering && speedFactor > 0.999) speedFactor = 1;
      if (hovering && speedFactor < 0.001) speedFactor = 0;

      // drag velocity is negative in the autoscroll direction, so SUBTRACT it:
      // a fling along the scroll direction speeds the autoscroll up instead of reversing
      var baseSpeed = REVERSE ? -BASE_SPEED : BASE_SPEED;
      var speed = baseSpeed * speedFactor - velocity;
      offset -= speed * dt;
      velocity *= Math.pow(FRICTION, dt * 60);
      if (Math.abs(velocity) < 1) velocity = 0;
      if (!motion.matches || velocity !== 0) {
        // reduced motion: only move while there is flick momentum left
        wrapOffset();
        if (AXIS === 'y') {
          track.style.transform = 'translate3d(0,' + offset.toFixed(2) + 'px,0)';
        } else {
          track.style.transform = 'translate3d(' + offset.toFixed(2) + 'px,0,0)';
        }
      }
      if (motion.matches && velocity === 0) {
        rafId = null;
        lastTime = null;
        return;
      }
    }

    rafId = window.requestAnimationFrame(frame);
  }

  function wake() {
    if (rafId == null) {
      lastTime = null;
      rafId = window.requestAnimationFrame(frame);
    }
  }

  /* ---- Drag / flick interaction ------------------------------------------ */
  /* Uses INCREMENTAL deltas (offset += dx since last move) instead of an
     absolute drag origin, so modulo wrapping can never desync the gesture. */
  var dragging = false;
  var pointerId = null;
  var lastPos = 0;
  var lastT = 0;
  var dragDist = 0; // total px moved this gesture — used to cancel link clicks
  var downLink = null; // link under the pointer when the gesture started

  // A drag shouldn't navigate: cancel clicks that follow a real drag movement
  track.addEventListener('click', function (e) {
    if (dragDist > 8) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  function endDrag(keepVelocity) {
    if (!dragging) return;
    dragging = false;
    pointerId = null;
    marquee.classList.remove('is-dragging');

    // Stalled pointer (held still before release) -> no flick momentum
    if (!keepVelocity || performance.now() - lastT > 80) {
      velocity = 0;
    } else {
      velocity = Math.max(-4000, Math.min(4000, velocity));
    }
  }

  marquee.addEventListener('pointerdown', function (e) {
    dragging = true;
    pointerId = e.pointerId;
    lastPos = AXIS === 'y' ? e.clientY : e.clientX;
    lastT = performance.now();
    velocity = 0;
    dragDist = 0;
    downLink = e.target.closest && e.target.closest('a.proof-link');
    hideTip();
    marquee.classList.add('is-dragging');
    try { marquee.setPointerCapture(pointerId); } catch (err) { /* noop */ }
    e.preventDefault();
    wake();
  });

  marquee.addEventListener('pointermove', function (e) {
    if (!dragging || e.pointerId !== pointerId) return;
    var pos = AXIS === 'y' ? e.clientY : e.clientX;
    var d = pos - lastPos;
    lastPos = pos;
    dragDist += Math.abs(d);

    var now = performance.now();
    var dtMs = now - lastT;
    lastT = now;

    offset += d;
    if (dtMs > 0) {
      // px/s of the most recent movement — becomes flick momentum on release
      var instantV = (d / dtMs) * 1000;
      velocity = velocity * 0.6 + instantV * 0.4;
    }

    wrapOffset();
    if (AXIS === 'y') {
      track.style.transform = 'translate3d(0,' + offset.toFixed(2) + 'px,0)';
    } else {
      track.style.transform = 'translate3d(' + offset.toFixed(2) + 'px,0,0)';
    }
  });

  marquee.addEventListener('pointerup', function (e) {
    if (e.pointerId !== pointerId) return;
    endDrag(true);
    // Pointer capture retargets the native click to the marquee, so the
    // anchor never sees it — navigate manually for a clean click.
    if (dragDist <= 8 && downLink) {
      var itemIdx = parseInt(downLink.getAttribute('data-item-index'), 10);
      var linkedItem = config.items[itemIdx];
      if (config.onCardActivate && linkedItem) {
        // Popup mode: open the card's popup, using the image as the animation origin
        var media = downLink.querySelector('.proof-media');
        config.onCardActivate(linkedItem, media || downLink);
      } else {
        // Pointer capture retargets the native click to the marquee, so the
        // anchor never sees it — navigate manually for a clean click.
        var href = downLink.getAttribute('href');
        if (href && href !== '#') {
          window.open(href, '_blank', 'noopener');
        }
      }
    }
    downLink = null;
    wake();
  });
  marquee.addEventListener('pointercancel', function () {
    endDrag(false);
    downLink = null;
    wake();
  });
  // Safety net: if the up/cancel event never arrives (released outside the
  // window, capture lost, etc.) don't stay stuck in dragging mode.
  marquee.addEventListener('lostpointercapture', function () {
    endDrag(false);
    wake();
  });
  window.addEventListener('blur', function () {
    endDrag(false);
    wake();
  });

  // Don't let native drag/select fight the gesture
  track.addEventListener('dragstart', function (e) { e.preventDefault(); });
  track.addEventListener('selectstart', function (e) { e.preventDefault(); });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (rafId != null) { window.cancelAnimationFrame(rafId); rafId = null; }
      lastTime = null;
    } else {
      wake();
    }
  });

  /* ---- Boot ---------------------------------------------------------------- */
  wake(); // start auto-scrolling immediately
}

/* ---- Social proof: "I've Actually Done This" ------------------------------ */
initMarquee({
  marqueeId: 'social-marquee',
  trackId: 'social-marquee-track',
  imgBase: 'images/social proof/proof_',
  tooltip: 'Click me!',
  items: [
    { title: '25+ Games Built', desc: 'Across a wide range of genres and platforms', link: 'https://sites.google.com/view/abdelazizsiala' },
    { title: '2 Games Shipped on Steam', desc: 'Put two finished games in front of millions of players on Steam', link: 'https://store.steampowered.com/developer/suronix/' },
    { title: 'Game Dev Club Leader', desc: 'Led and taught aspiring game developers through Nexus IT Club at my university', link: 'https://www.instagram.com/p/DWpIU0KCGb3/' },
    { title: 'Competed In Many Game Jams', desc: 'Placed 1st and 2nd in two of them', link: 'https://www.facebook.com/photo?fbid=122127498578256971&set=pcb.122127499154256971' },
    { title: '130K+ Views Teaching Game Dev', desc: 'One Unity tutorial reached 43K+ views', link: 'https://www.youtube.com/@canwithcode/videos' }
  ]
});

/* ---- Testimonial case-study popup ---------------------------------------- */
/* Clicking a testimonial image opens this popup. It scales up out of the
   clicked image (FLIP animation), blurs the page behind it, and shows a
   detail image + a video (or showcase image) + "View Original Review". */
var testimonialLightbox = (function () {
  'use strict';

  var root = null, panel = null, body = null, cta = null;
  var sourceEl = null; // thumbnail the popup grows out of / shrinks back into

  function ensureDom() {
    if (root) return;

    root = document.createElement('div');
    root.className = 't-lightbox';
    root.hidden = true;

    var backdrop = document.createElement('div');
    backdrop.className = 't-lightbox-backdrop';

    panel = document.createElement('figure');
    panel.className = 't-lightbox-panel';

    var closeBtn = document.createElement('button');
    closeBtn.className = 't-lightbox-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', function () { close(); });

    body = document.createElement('div');
    body.className = 't-lightbox-scroll';

    cta = document.createElement('a');
    cta.className = 'btn t-lightbox-cta';
    cta.target = '_blank';
    cta.rel = 'noopener noreferrer';

    panel.appendChild(closeBtn);
    panel.appendChild(body);
    panel.appendChild(cta);
    root.appendChild(backdrop);
    root.appendChild(panel);
    document.body.appendChild(root);

    backdrop.addEventListener('pointerdown', function (e) {
      if (e.target === backdrop) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !root.hidden) close();
    });
  }

  function appendImage(src) {
    var img = document.createElement('img');
    img.className = 't-lightbox-media';
    img.src = src;
    img.alt = '';
    img.draggable = false;
    body.appendChild(img);
  }

  function fill(item) {
    body.innerHTML = '';

    // Review screenshot (separate from the marquee thumbnail)
    if (item.detail) appendImage(item.detail);

    // Project proof: video if provided, otherwise a showcase image
    if (item.video) {
      var vid = document.createElement('video');
      vid.className = 't-lightbox-video';
      vid.src = item.video;
      vid.controls = true;
      vid.playsInline = true;
      vid.preload = 'metadata';
      body.appendChild(vid);
    } else if (item.showcase) {
      appendImage(item.showcase);
    }

    if (item.desc) {
      var cap = document.createElement('p');
      cap.className = 't-lightbox-caption';
      cap.textContent = item.desc;
      body.appendChild(cap);
    }

    var hasLink = item.link && item.link !== '#';
    cta.classList.toggle('is-hidden', !hasLink);
    if (hasLink) {
      cta.href = item.link;
      cta.textContent = 'View Original Review';
    }
  }

  function open(item, srcEl) {
    ensureDom();
    fill(item);
    sourceEl = srcEl || null;

    root.hidden = false;

    // FLIP: measure the popup at its final size, then start it transformed
    // to match the clicked thumbnail and let the transition settle it back.
    panel.style.transform = 'none';
    var pr = panel.getBoundingClientRect();
    var from = sourceEl ? sourceEl.getBoundingClientRect() : null;
    if (from && pr.width > 0) {
      var sx = from.width / pr.width;
      var sy = from.height / pr.height;
      var dx = (from.left + from.width / 2) - (pr.left + pr.width / 2);
      var dy = (from.top + from.height / 2) - (pr.top + pr.height / 2);
      panel.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ')';
    } else {
      panel.style.transform = 'scale(.85)';
    }
    void panel.offsetWidth; // flush styles so the transition actually runs

    requestAnimationFrame(function () {
      root.classList.add('is-open');     // fades/blurs the backdrop in
      panel.style.transform = '';        // springs to final position
    });
  }

  function close() {
    if (!root || root.hidden) return;

    var vid = body.querySelector('video');
    if (vid) vid.pause();

    root.classList.remove('is-open');

    // Shrink back toward wherever the thumbnail is now (the marquee kept scrolling)
    var to = sourceEl && document.body.contains(sourceEl) ? sourceEl.getBoundingClientRect() : null;
    if (to) {
      var pr = panel.getBoundingClientRect();
      var sx = Math.max(to.width / pr.width, 0.02);
      var sy = Math.max(to.height / pr.height, 0.02);
      var dx = (to.left + to.width / 2) - (pr.left + pr.width / 2);
      var dy = (to.top + to.height / 2) - (pr.top + pr.height / 2);
      panel.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ')';
    } else {
      panel.style.transform = 'scale(.85)';
    }

    var finished = false;
    function done() {
      if (finished) return;
      finished = true;
      root.hidden = true;
      panel.style.transform = '';
      body.innerHTML = '';
      sourceEl = null;
    }
    var timer = setTimeout(done, 480); // fallback if transitionend never fires
    panel.addEventListener('transitionend', function handler(e) {
      if (e.target !== panel) return;
      clearTimeout(timer);
      panel.removeEventListener('transitionend', handler);
      done();
    });
  }

  return { open: open, close: close };
})();

/* ---- Testimonials: "What People Say About Working With Me" ---------------- */
/* Two vertical columns side by side — left scrolls up, right scrolls down.
   BOTH columns receive the full item list; on wide screens CSS shows items
   1–4 in the left column and 5–8 in the right. On narrow screens the grid
   collapses to one column showing everything (see styles.css).

   Per item:
     img      — thumbnail in the marquee (testimonial_N.png)
     detail   — review screenshot shown in the popup (separate file)
     showcase — project image shown in the popup (used when there's no video)
     video    — optional; replaces the showcase image with an embedded player
     link     — where "View Original Review" goes                                */
var TESTIMONIAL_ITEMS = [
  { img: 'images/testimonials/testimonial_1.png',
    desc: 'Name — Role / Project',
    detail: 'images/testimonials/detail_1.png',
    showcase: 'images/testimonials/showcase_1.png',
     video: 'videos/review_1.mp4',
    link: '#' },
  { img: 'images/testimonials/testimonial_2.png',
    desc: 'Name — Role / Project',
    detail: 'images/testimonials/detail_2.png',
    showcase: 'images/testimonials/showcase_2.png',
    link: '#' },
  { img: 'images/testimonials/testimonial_3.png',
    desc: 'Name — Role / Project',
    detail: 'images/testimonials/detail_3.png',
    showcase: 'images/testimonials/showcase_3.png',
    link: '#' },
  { img: 'images/testimonials/testimonial_4.png',
    desc: 'Name — Role / Project',
    detail: 'images/testimonials/detail_4.png',
    showcase: 'images/testimonials/showcase_4.png',
    link: '#' },
  { img: 'images/testimonials/testimonial_5.png',
    desc: 'Name — Role / Project',
    detail: 'images/testimonials/detail_5.png',
    showcase: 'images/testimonials/showcase_5.png',
    link: '#' },
  { img: 'images/testimonials/testimonial_6.png',
    desc: 'Name — Role / Project',
    detail: 'images/testimonials/detail_6.png',
    showcase: 'images/testimonials/showcase_6.png',
    link: '#' },
  { img: 'images/testimonials/testimonial_7.png',
    desc: 'Name — Role / Project',
    detail: 'images/testimonials/detail_7.png',
    showcase: 'images/testimonials/showcase_7.png',
    link: '#' },
  { img: 'images/testimonials/testimonial_8.png',
    desc: 'Name — Role / Project',
    detail: 'images/testimonials/detail_8.png',
    showcase: 'images/testimonials/showcase_8.png',
    link: '#' }
];

initMarquee({
  marqueeId: 'testimonials-marquee-a',
  trackId: 'testimonials-marquee-track-a',
  imgBase: 'images/testimonials/testimonial_',
  tooltip: 'Click me!',
  axis: 'y',
  showText: false, // image-only cards
  onCardActivate: function (item, sourceEl) { testimonialLightbox.open(item, sourceEl); },
  items: TESTIMONIAL_ITEMS
});

initMarquee({
  marqueeId: 'testimonials-marquee-b',
  trackId: 'testimonials-marquee-track-b',
  imgBase: 'images/testimonials/testimonial_',
  tooltip: 'Click me!',
  axis: 'y',
  reverse: true,
  showText: false, // image-only cards
  onCardActivate: function (item, sourceEl) { testimonialLightbox.open(item, sourceEl); },
  items: TESTIMONIAL_ITEMS
});
