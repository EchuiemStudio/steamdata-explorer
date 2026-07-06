const HEATMAP_SEQUENTIAL_SCALE = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#2a78d6', '#1c5cab', '#0d366b'];

function labelMatches(game, label) {
  return label.type === 'genre' ? game.genres.includes(label.value) : game.tags.includes(label.value);
}

function buildPairs(games, labels) {
  const pairs = [];
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i];
      const b = labels[j];
      let eitherCount = 0;
      let bothCount = 0;
      for (const game of games) {
        const isA = labelMatches(game, a);
        const isB = labelMatches(game, b);
        if (isA || isB) eitherCount++;
        if (isA && isB) bothCount++;
      }
      if (eitherCount) pairs.push({ a, b, x: eitherCount, y: bothCount, r: 9 });
    }
  }
  return pairs;
}

function pairGames(games, a, b) {
  return games.filter((g) => labelMatches(g, a) && labelMatches(g, b));
}

function sameLabel(a, b) {
  return a.type === b.type && a.value === b.value;
}

function createOpportunitySection({ container, aggregates }) {
  container.innerHTML = `
    <div class="opportunity-picker"></div>
    <div class="toggle-group opportunity-view-toggle">
      <button type="button" class="chip chip--active" data-view="bubble">Bubble view</button>
      <button type="button" class="chip" data-view="heatmap">Heatmap view</button>
    </div>
    <div class="chart-card chart-card--tall">
      <canvas class="opportunity-canvas" role="img" aria-label="Chart comparing selected genre/tag pairs"></canvas>
      <div class="heatmap-grid" hidden></div>
    </div>
    <h3 class="chart-section__title">Click a point to see matching games</h3>
    <div class="game-grid opportunity-detail-grid"></div>
  `;

  const pickerContainer = container.querySelector('.opportunity-picker');
  const viewToggle = container.querySelector('.opportunity-view-toggle');
  const canvas = container.querySelector('.opportunity-canvas');
  const heatmapEl = container.querySelector('.heatmap-grid');
  const detailHeading = container.querySelector('.chart-section__title');
  const detailGrid = container.querySelector('.opportunity-detail-grid');

  let games = [];
  let chart = null;
  let currentPairs = [];
  let currentLabelSet = [];
  let view = 'bubble';

  function currentLabels() {
    return [...picker.getSelected()].map((key) => {
      const { type, value } = parseFilterKey(key);
      return { type, value };
    });
  }

  function showDetail(a, b) {
    const matches = pairGames(games, a, b);
    detailHeading.textContent = `${a.value} + ${b.value} — ${matches.length} game${matches.length === 1 ? '' : 's'}`;
    renderGameGrid(detailGrid, matches);
  }

  function renderBubble() {
    canvas.hidden = false;
    heatmapEl.hidden = true;

    if (chart) {
      chart.data.datasets[0].data = currentPairs;
      chart.update();
      return;
    }

    chart = new Chart(canvas, {
      type: 'bubble',
      data: {
        datasets: [{
          data: currentPairs,
          backgroundColor: 'rgba(42, 120, 214, 0.55)',
          borderColor: VIZ_SURFACE,
          borderWidth: 2,
          hoverBackgroundColor: 'rgba(42, 120, 214, 0.8)',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => {
                const p = item.raw;
                return [`${p.a.value} + ${p.b.value}`, `${p.x} in either · ${p.y} in both`];
              },
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: 'Games in either', color: VIZ_MUTED },
            grid: { color: VIZ_GRID },
            ticks: { color: VIZ_MUTED },
            beginAtZero: true,
          },
          y: {
            title: { display: true, text: 'Games in both (overlap)', color: VIZ_MUTED },
            grid: { color: VIZ_GRID },
            ticks: { color: VIZ_MUTED, precision: 0 },
            beginAtZero: true,
          },
        },
        onClick: (event, elements) => {
          if (!elements.length) return;
          const point = currentPairs[elements[0].index];
          showDetail(point.a, point.b);
        },
      },
    });
  }

  function heatmapStep(count, maxCount) {
    if (count === 0) return 0;
    return Math.min(HEATMAP_SEQUENTIAL_SCALE.length - 1, Math.round((count / maxCount) * (HEATMAP_SEQUENTIAL_SCALE.length - 1)));
  }

  function renderHeatmap() {
    canvas.hidden = true;
    heatmapEl.hidden = false;

    const labels = currentLabelSet;
    if (labels.length < 2) {
      heatmapEl.innerHTML = '<p class="empty-state">Select at least 2 labels above to compare.</p>';
      heatmapEl.style.removeProperty('--heatmap-cols');
      return;
    }

    const matrix = labels.map((a) => labels.map((b) => {
      if (sameLabel(a, b)) return null;
      const found = currentPairs.find((p) => (sameLabel(p.a, a) && sameLabel(p.b, b)) || (sameLabel(p.a, b) && sameLabel(p.b, a)));
      return found ? found.y : 0;
    }));
    const maxCount = Math.max(1, ...matrix.flat().filter((v) => v != null));

    let html = '<div class="heatmap-row heatmap-row--header"><div class="heatmap-cell heatmap-cell--corner"></div>';
    for (const label of labels) {
      html += `<div class="heatmap-cell heatmap-cell--header" title="${escapeHTML(label.value)}">${escapeHTML(label.value)}</div>`;
    }
    html += '</div>';

    for (let i = 0; i < labels.length; i++) {
      html += `<div class="heatmap-row"><div class="heatmap-cell heatmap-cell--header">${escapeHTML(labels[i].value)}</div>`;
      for (let j = 0; j < labels.length; j++) {
        const count = matrix[i][j];
        if (count == null) {
          html += '<div class="heatmap-cell heatmap-cell--diagonal"></div>';
        } else {
          const step = heatmapStep(count, maxCount);
          const bg = HEATMAP_SEQUENTIAL_SCALE[step];
          const fg = step >= 4 ? '#ffffff' : '#17171a';
          const pairLabel = `${labels[i].value} + ${labels[j].value}: ${count} game${count === 1 ? '' : 's'} in both`;
          html += `<button type="button" class="heatmap-cell heatmap-cell--value" style="background:${bg};color:${fg}" data-i="${i}" data-j="${j}" aria-label="${escapeHTML(pairLabel)}">${count}</button>`;
        }
      }
      html += '</div>';
    }

    heatmapEl.innerHTML = html;
    // CSS template already reserves 1 fixed column for the row-header; each row
    // emits exactly `labels.length` value cells after that, so --heatmap-cols
    // must be labels.length, not labels.length + 1 (that extra column was
    // silently shifting every row's cells one column right of their header).
    heatmapEl.style.setProperty('--heatmap-cols', labels.length);

    heatmapEl.querySelectorAll('.heatmap-cell--value').forEach((cell) => {
      cell.addEventListener('click', () => {
        const i = Number(cell.dataset.i);
        const j = Number(cell.dataset.j);
        showDetail(labels[i], labels[j]);
      });
    });
  }

  function renderView() {
    if (view === 'bubble') renderBubble();
    else renderHeatmap();
  }

  function recompute() {
    currentLabelSet = currentLabels();
    currentPairs = buildPairs(games, currentLabelSet);
    renderView();
  }

  viewToggle.addEventListener('click', (event) => {
    const button = event.target.closest('[data-view]');
    if (!button) return;
    view = button.dataset.view;
    viewToggle.querySelectorAll('.chip').forEach((c) => c.classList.toggle('chip--active', c === button));
    renderView();
  });

  const topGenres = Object.entries(aggregates.genre_counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([g]) => g);
  const seedTags = [...new Set(
    (aggregates.tag_cooccurrence || []).flatMap((p) => [p.tag_a, p.tag_b]),
  )].filter((t) => !topGenres.includes(t)).slice(0, 2);
  const defaultSelected = [
    ...topGenres.map((g) => filterKey('genre', g)),
    ...seedTags.map((t) => filterKey('tag', t)),
  ];

  const picker = createFilterPanel({
    container: pickerContainer,
    genreCounts: aggregates.genre_counts,
    tagCounts: {},
    heading: 'Compare labels',
    caption: 'Pick genres/tags to cross-compare — every pair within your selection gets plotted. Separate from the game filter above; this only controls which dimensions are compared, over whatever games that filter currently allows.',
    defaultSelected,
    onChange: recompute,
  });

  return {
    update(newGames) {
      games = newGames;
      const genreCounts = {};
      const tagCounts = {};
      for (const g of games) {
        for (const genre of g.genres) genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        for (const tag of g.tags) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
      picker.setCounts(genreCounts, tagCounts);
      recompute();
    },
  };
}
