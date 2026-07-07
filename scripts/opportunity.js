function createOpportunitySection({ container, games }) {
  container.innerHTML = `
    <div class="opportunity-picker"></div>
    <p class="chart-section__caption opportunity-empty-hint"></p>
    <div class="chart-card chart-card--tall">
      <canvas class="opportunity-canvas" role="img" aria-label="Scatter plot of games by release year and popularity"></canvas>
    </div>
    <h3 class="chart-section__title">Matching games</h3>
    <div class="opportunity-table-view"></div>
  `;

  const pickerContainer = container.querySelector('.opportunity-picker');
  const hint = container.querySelector('.opportunity-empty-hint');

  const scatter = createScatterChart({
    container: container.querySelector('.opportunity-canvas'),
    titleText: 'Release year vs. popularity',
    xLabel: 'Release year',
    yLabel: 'Total reviews (log scale)',
    xKey: 'release_year',
    xType: 'linear',
    xBeginAtZero: false,
    tooltipX: (x) => `${x}`,
    yKey: 'review_total',
    yType: 'logarithmic',
    tooltipY: (y) => `${y.toLocaleString()} reviews`,
  });
  const table = createGameTable({ container: container.querySelector('.opportunity-table-view') });

  function recompute() {
    const selected = picker.getSelected();
    const filtered = games.filter((g) => matchesFilters(g, selected, { mode: 'all' }));
    hint.hidden = selected.size !== 0;
    hint.textContent = `Showing all ${games.length} games — pick genres/tags above to narrow (a game must match ALL selected).`;
    scatter.update(filtered);
    table.update(filtered);
  }

  const picker = createFilterPanel({
    container: pickerContainer,
    labelCounts: computeLabelCounts(games),
    heading: 'Filter the opportunity map',
    caption: 'Selecting multiple genres/tags narrows to games matching ALL of them (the overlap), not any one. This filter is independent from the Home page filter.',
    onChange: recompute,
  });

  recompute();
}

async function initOpportunityPage() {
  let games;
  try {
    games = await loadGames();
  } catch (err) {
    showLoadError(document.querySelector('.opportunity-section'));
    return;
  }
  createOpportunitySection({ container: document.querySelector('.opportunity-section'), games });
}

initOpportunityPage();
