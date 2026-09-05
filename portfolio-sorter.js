/* ==========================================================================
   Portfolio sorter — filter projects by game genre & group the grid.
   - Filter chips are built from the data-genres tokens found on each .pcard
     (space-separated, derived from the project descriptions in /portfolio).
   - "Collections" keeps the default grouping (Big / Freelance / ...).
   - "Genre" re-groups every matching card under its genre(s); rich cards can
     appear in several genre groups at once.
   ========================================================================== */

(function () {
  'use strict';

  var projectsSection = document.getElementById('projects');
  if (!projectsSection) return;

  var chipsWrap = document.getElementById('genre-chips');
  var toggleWrap = document.getElementById('sort-toggle');
  var statusEl = document.getElementById('sort-status');
  var genreView = document.getElementById('genre-view');
  var noResults = document.getElementById('sort-no-results');
  if (!chipsWrap || !toggleWrap) return;

  var categories = Array.prototype.slice.call(projectsSection.querySelectorAll('.category'));
  var cards = Array.prototype.slice.call(projectsSection.querySelectorAll('.pcard'));

  /* Pretty labels for genre tokens. New tokens not listed here still get a
     chip, prettified automatically (hyphens -> spaces, first letter caps). */
  var LABELS = {
    '2d': '2D',
    'endless-runner': 'Endless Runner',
    'turn-based': 'Turn-Based',
    'co-op': 'Co-op',
    'top-down': 'Top-Down',
    'fps': 'FPS',
    'adventure': 'Adventure',
    'arcade': 'Arcade',
    'casual': 'Casual',
    'combat': 'Combat',
    'hypercasual': 'Hypercasual',
    'mobile': 'Mobile',
    'multiplayer': 'Multiplayer',
    'narrative': 'Narrative',
    'party': 'Party',
    'platformer': 'Platformer',
    'puzzle': 'Puzzle',
    'roguelike': 'Roguelike',
    'roguelite': 'Roguelite',
    'shooter': 'Shooter',
    'simulation': 'Simulation',
    'strategy': 'Strategy',
    'web': 'Web'
  };

  /* Display order for the chips / genre groups — most defining genres first. */
  var PRIORITY = [
    'endless-runner', 'platformer', 'shooter', 'fps', 'combat', 'arcade', 'puzzle',
    'strategy', 'turn-based', 'co-op', 'multiplayer', 'party', 'roguelike', 'roguelite',
    'simulation', 'narrative', 'adventure', '2d', 'top-down', 'mobile',
    'hypercasual', 'casual', 'web'
  ];

  var genreList = [];

  function genresOf(card) {
    var raw = (card.getAttribute('data-genres') || '').trim();
    return raw ? raw.split(/\s+/) : [];
  }

  function prettify(key) {
    return key.split('-').map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
  }

  /* Collect every genre token used on the cards, ordered by PRIORITY. */
  (function buildGenreList() {
    var used = {};
    cards.forEach(function (card) {
      genresOf(card).forEach(function (g) { used[g] = true; });
    });
    PRIORITY.forEach(function (g) {
      if (used[g]) genreList.push({ key: g, label: LABELS[g] || prettify(g) });
    });
    Object.keys(used).filter(function (g) {
      return PRIORITY.indexOf(g) === -1;
    }).sort().forEach(function (g) {
      genreList.push({ key: g, label: LABELS[g] || prettify(g) });
    });
  })();

  /* ---- State -------------------------------------------------------------- */
  var currentGenre = '';
  var groupBy = 'collections';

  function matches(card) {
    if (!currentGenre) return true;
    return genresOf(card).indexOf(currentGenre) !== -1;
  }

  /* ---- Filter chips ------------------------------------------------------- */
  var chipButtons = [];

  function makeChip(key, label, active) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'genre-chip' + (active ? ' is-active' : '');
    b.setAttribute('data-genre', key);
    b.setAttribute('aria-pressed', active ? 'true' : 'false');
    b.textContent = label;
    b.addEventListener('click', function () {
      setGenre(b.getAttribute('data-genre') === currentGenre ? '' : b.getAttribute('data-genre'));
    });
    chipButtons.push(b);
    return b;
  }

  makeChip('', 'All', true);
  chipsWrap.appendChild(chipButtons[0]);
  genreList.forEach(function (g) {
    chipsWrap.appendChild(makeChip(g.key, g.label, false));
  });

  /* ---- Group-by toggle ---------------------------------------------------- */
  var toggleButtons = Array.prototype.slice.call(toggleWrap.querySelectorAll('.sort-toggle-btn'));

  toggleButtons.forEach(function (b) {
    b.addEventListener('click', function () {
      setGroupBy(b.getAttribute('data-groupby'));
    });
  });

  /* ---- Rendering ---------------------------------------------------------- */
  function renderCollections() {
    genreView.classList.remove('is-active');
    noResults.classList.remove('is-visible');

    var shown = 0;
    categories.forEach(function (cat) {
      var catCards = cat.querySelectorAll('.pcard');
      var catShown = 0;
      Array.prototype.forEach.call(catCards, function (c) {
        var show = matches(c);
        c.classList.toggle('is-filtered-out', !show);
        if (show) catShown++;
      });
      shown += catShown;
      cat.classList.toggle('is-filtered-out', catShown === 0);
    });

    /* The client-review marquee isn't a project — hide it while a genre chip
       is active so it doesn't sit next to a filtered grid. */
    var freelance = document.getElementById('freelance');
    if (freelance) {
      var marquee = freelance.querySelector('.marquee');
      if (marquee) marquee.classList.toggle('is-filtered-out', currentGenre !== '');
    }

    showStatus(shown);
  }

  function renderGenre() {
    categories.forEach(function (cat) {
      cat.classList.add('is-filtered-out');
    });
    genreView.innerHTML = '';
    noResults.classList.remove('is-visible');

    var activeGenres = genreList.filter(function (g) {
      return !currentGenre || g.key === currentGenre;
    });

    var shown = 0;
    activeGenres.forEach(function (g) {
      var groupCards = cards.filter(function (c) {
        return genresOf(c).indexOf(g.key) !== -1;
      });
      if (!groupCards.length) return;
      shown += groupCards.length;

      var section = document.createElement('section');
      section.className = 'category genre-group';

      var head = document.createElement('div');
      head.className = 'category-head';
      var h = document.createElement('h2');
      h.textContent = g.label;
      var note = document.createElement('p');
      note.className = 'category-note';
      note.textContent = groupCards.length + (groupCards.length === 1 ? ' project' : ' projects');
      head.appendChild(h);
      head.appendChild(note);

      var grid = document.createElement('div');
      grid.className = 'project-grid';
      groupCards.forEach(function (c) {
        var clone = c.cloneNode(true);
        /* Originals may carry `is-filtered-out` from a previous Collections
           filter — don't let clones inherit it or the group renders hidden. */
        clone.classList.remove('is-filtered-out');
        grid.appendChild(clone);
      });

      section.appendChild(head);
      section.appendChild(grid);
      genreView.appendChild(section);
    });

    genreView.classList.add('is-active');
    showStatus(shown);
  }

  function showStatus(shown) {
    var total = cards.length;
    if (statusEl) {
      statusEl.textContent = currentGenre
        ? shown + ' of ' + total + ' project' + (total === 1 ? '' : 's')
        : total + ' project' + (total === 1 ? '' : 's');
    }
    if (noResults) noResults.classList.toggle('is-visible', shown === 0);
  }

  function render() {
    if (groupBy === 'genre') renderGenre();
    else renderCollections();
  }

  function setGenre(key) {
    currentGenre = key;
    chipButtons.forEach(function (b) {
      var active = b.getAttribute('data-genre') === key;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    render();
  }

  function setGroupBy(mode) {
    groupBy = (mode === 'genre' || mode === 'collections') ? mode : 'collections';
    toggleButtons.forEach(function (b) {
      var active = b.getAttribute('data-groupby') === groupBy;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    render();
  }

  /* ---- Boot --------------------------------------------------------------- */
  render();
})();