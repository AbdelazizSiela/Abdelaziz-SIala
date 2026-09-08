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
    '3d': '3D',
    'endless-runner': 'Endless Runner',
    'turn-based': 'Turn-Based',
    'co-op': 'Co-op',
    'top-down': 'Top-Down',
    'fps': 'FPS',
    'adventure': 'Adventure',
    'arcade': 'Arcade',
    'combat': 'Combat',
    'hypercasual': 'Hypercasual',
    'mobile': 'Mobile',
    'multiplayer': 'Multiplayer',
    'narrative': 'Narrative',
    'party': 'Party',
    'pc': 'PC',
    'platformer': 'Platformer',
    'puzzle': 'Puzzle',
    'roguelike': 'Roguelike',
    'roguelite': 'Roguelite',
    'shooter': 'Shooter',
    'simulation': 'Simulation',
    'strategy': 'Strategy',
    'telegram': 'Telegram',
    'web': 'Web',
    'console': 'Console',
    'vr': 'VR'
  };

  /* Tokens are grouped by kind — genres vs. platforms (Mobile, Web, PC,
     Telegram...) vs. style (2D / 3D / top-down). Display order comes from
     each kind's priority list; unknown tokens default to the Genre group. */
  var KINDS = [
    { key: 'genre', label: 'Genres', priority: [
        'endless-runner', 'platformer', 'shooter', 'fps', 'combat', 'arcade', 'puzzle',
        'strategy', 'turn-based', 'co-op', 'multiplayer', 'party', 'roguelike', 'roguelite',
        'simulation', 'narrative', 'adventure', 'hypercasual' ] },
    { key: 'platform', label: 'Platforms', priority: ['pc', 'mobile', 'web', 'telegram', 'console', 'vr'] },
    { key: 'style', label: 'Style', priority: ['2d', '3d', 'top-down'] }
  ];

  var KIND_OF = {
    '2d': 'style', '3d': 'style', 'top-down': 'style',
    'pc': 'platform', 'mobile': 'platform', 'web': 'platform',
    'telegram': 'platform', 'console': 'platform', 'vr': 'platform'
  };

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

  /* Collect every token used on the cards, ordered by kind priority. */
  (function buildGenreList() {
    var used = {};
    cards.forEach(function (card) {
      genresOf(card).forEach(function (g) { used[g] = true; });
    });
    KINDS.forEach(function (kind) {
      kind.priority.forEach(function (g) {
        if (used[g]) genreList.push({ key: g, label: LABELS[g] || prettify(g), kind: kind.key });
      });
      Object.keys(used).filter(function (g) {
        return (KIND_OF[g] || 'genre') === kind.key;
      }).filter(function (g) {
        return kind.priority.indexOf(g) === -1;
      }).sort().forEach(function (g) {
        genreList.push({ key: g, label: LABELS[g] || prettify(g), kind: kind.key });
      });
    });
  })();

  /* ---- State -------------------------------------------------------------- */
  var selectedGenres = [];
  var groupBy = 'collections';

  function matches(card) {
    if (!selectedGenres.length) return true;
    var tags = genresOf(card);
    return selectedGenres.some(function (g) { return tags.indexOf(g) !== -1; });
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
      toggleGenre(b.getAttribute('data-genre'));
    });
    chipButtons.push(b);
    return b;
  }

  /* One chip group per kind: label + chips. "All" resets the whole filter
     and sits at the start of the first group. */
  var chipGroups = {};
  KINDS.forEach(function (kind) {
    var group = document.createElement('div');
    group.className = 'genre-kind';
    var label = document.createElement('span');
    label.className = 'genre-kind-label';
    label.textContent = kind.label;
    var row = document.createElement('div');
    row.className = 'genre-chips';
    group.appendChild(label);
    group.appendChild(row);
    chipsWrap.appendChild(group);
    chipGroups[kind.key] = row;
  });

  makeChip('', 'All', true);
  chipGroups[KINDS[0].key].appendChild(chipButtons[0]);
  genreList.forEach(function (g) {
    chipGroups[g.kind].appendChild(makeChip(g.key, g.label, false));
  });

  /* ---- Card tags ----------------------------------------------------------
     Show each project's own filters (genres / platforms / style) as small
     chips on its card, using the same labels as the filter chips above. */
  cards.forEach(function (card) {
    var tags = genresOf(card);
    if (!tags.length) return;
    var body = card.querySelector('.pcard-body');
    if (!body) return;
    var wrap = document.createElement('div');
    wrap.className = 'pcard-tags';
    tags.forEach(function (t) {
      var s = document.createElement('span');
      s.className = 'pcard-filter-tag';
      s.textContent = LABELS[t] || prettify(t);
      wrap.appendChild(s);
    });
    var linkTag = card.querySelector('.pcard-link-tag');
    if (linkTag) body.insertBefore(wrap, linkTag);
    else body.appendChild(wrap);
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
      if (marquee) marquee.classList.toggle('is-filtered-out', selectedGenres.length > 0);
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
      return !selectedGenres.length || selectedGenres.indexOf(g.key) !== -1;
    });

    function addGroup(title, cards) {
      if (!cards.length) return 0;
      var section = document.createElement('section');
      section.className = 'category genre-group';

      var head = document.createElement('div');
      head.className = 'category-head';
      var h = document.createElement('h2');
      h.textContent = title;
      var note = document.createElement('p');
      note.className = 'category-note';
      note.textContent = cards.length + (cards.length === 1 ? ' project' : ' projects');
      head.appendChild(h);
      head.appendChild(note);

      var grid = document.createElement('div');
      grid.className = 'project-grid';
      cards.forEach(function (c) {
        var clone = c.cloneNode(true);
        /* Originals may carry `is-filtered-out` from a previous Collections
           filter — don't let clones inherit it or the group renders hidden. */
        clone.classList.remove('is-filtered-out');
        grid.appendChild(clone);
      });

      section.appendChild(head);
      section.appendChild(grid);
      genreView.appendChild(section);
      return cards.length;
    }

    var shown = 0;
    activeGenres.forEach(function (g) {
      var groupCards = cards.filter(function (c) {
        return genresOf(c).indexOf(g.key) !== -1;
      });
      shown += addGroup(g.label, groupCards);
    });

    genreView.classList.add('is-active');
    showStatus(shown);
  }

  function showStatus(shown) {
    var total = cards.length;
    if (statusEl) {
      statusEl.textContent = selectedGenres.length
        ? shown + ' of ' + total + ' project' + (total === 1 ? '' : 's')
        : total + ' project' + (total === 1 ? '' : 's');
    }
    if (noResults) noResults.classList.toggle('is-visible', shown === 0);
  }

  function render() {
    paintChips();
    if (groupBy === 'genre') renderGenre();
    else renderCollections();
  }

  function toggleGenre(key) {
    if (key === '') {
      selectedGenres = [];
    } else {
      var i = selectedGenres.indexOf(key);
      if (i === -1) selectedGenres.push(key);
      else selectedGenres.splice(i, 1);
    }
    render();
  }

  /* Keep the chip buttons' active state in sync with the selection:
     "All" is active only when nothing is selected; every selected genre
     chip is highlighted (multi-select). */
  function paintChips() {
    chipButtons.forEach(function (b) {
      var g = b.getAttribute('data-genre');
      var active = g === '' ? !selectedGenres.length : selectedGenres.indexOf(g) !== -1;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
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