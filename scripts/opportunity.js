const THEME_TAGS = [
  'Zombies', 'Horror', 'Sci-fi', 'Fantasy', 'Anime', 'Cyberpunk',
  'Post-apocalyptic', 'Mythology', 'War', 'Detective', 'Dinosaurs', 'Survival Horror',
];

const VIZ_MUTED = '#898781';
const VIZ_GRID = '#e1e0d9';
const VIZ_SURFACE = '#ffffff';

function hasGenre(game, genre) {
  return game.genres.includes(genre);
}

function hasTag(game, tag) {
  return game.tags.includes(tag);
}

function buildPairs(games, axisA, axisB, checkA, checkB, sameAxis) {
  const pairs = [];
  for (let i = 0; i < axisA.length; i++) {
    const startJ = sameAxis ? i + 1 : 0;
    for (let j = startJ; j < axisB.length; j++) {
      const a = axisA[i];
      const b = axisB[j];
      if (sameAxis && a === b) continue;

      let eitherCount = 0;
      let bothCount = 0;
      for (const game of games) {
        const isA = checkA(game, a);
        const isB = checkB(game, b);
        if (isA || isB) eitherCount++;
        if (isA && isB) bothCount++;
      }

      if (eitherCount === 0) continue;
      pairs.push({ a, b, x: eitherCount, y: bothCount, r: 9 });
    }
  }
  return pairs;
}

function pairGames(games, a, b, checkA, checkB) {
  return games.filter((g) => checkA(g, a) && checkB(g, b));
}

async function initOpportunityPage() {
  const [games, aggregates] = await Promise.all([loadGames(), loadAggregates()]);
  const genreList = Object.keys(aggregates.genre_counts).sort();
  const themeList = THEME_TAGS.filter((tag) => games.some((g) => g.tags.includes(tag)));

  const toggle = document.getElementById('mode-toggle');
  const detailHeading = document.getElementById('detail-heading');
  const detailGrid = document.getElementById('detail-grid');
  let chart = null;
  let mode = 'genre-genre';

  function renderToggle() {
    toggle.innerHTML = `
      <button class="chip ${mode === 'genre-genre' ? 'chip--active' : ''}" data-mode="genre-genre">Genre &times; Genre</button>
      <button class="chip ${mode === 'genre-theme' ? 'chip--active' : ''}" data-mode="genre-theme">Genre &times; Theme</button>
    `;
  }

  function renderChart() {
    const pairs = mode === 'genre-genre'
      ? buildPairs(games, genreList, genreList, hasGenre, hasGenre, true)
      : buildPairs(games, genreList, themeList, hasGenre, hasTag, false);

    if (chart) chart.destroy();

    const ctx = document.getElementById('chart-opportunity');
    chart = new Chart(ctx, {
      type: 'bubble',
      data: {
        datasets: [{
          data: pairs,
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
                return [`${p.a} + ${p.b}`, `${p.x} in either · ${p.y} in both`];
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
          const point = pairs[elements[0].index];
          const checkA = hasGenre;
          const checkB = mode === 'genre-genre' ? hasGenre : hasTag;
          const matches = pairGames(games, point.a, point.b, checkA, checkB);
          detailHeading.textContent = `${point.a} + ${point.b} — ${matches.length} game${matches.length === 1 ? '' : 's'}`;
          renderGameGrid(detailGrid, matches);
        },
      },
    });
  }

  toggle.addEventListener('click', (event) => {
    const button = event.target.closest('[data-mode]');
    if (!button) return;
    mode = button.dataset.mode;
    renderToggle();
    renderChart();
    detailHeading.textContent = 'Click a point to see matching games';
    detailGrid.innerHTML = '';
  });

  renderToggle();
  renderChart();
}

initOpportunityPage();
