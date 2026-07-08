function createOpportunitySection({ container, games }) {
  container.innerHTML = `
    <div class="opportunity-picker"></div>
    <p class="chart-section__caption opportunity-empty-hint"></p>
    <div class="chart-legend">
      <button type="button" class="tier-badge tier-badge--hit tier-badge--toggle" data-tier="hit">hit</button>
      <button type="button" class="tier-badge tier-badge--mid tier-badge--toggle" data-tier="mid">mid</button>
      <button type="button" class="tier-badge tier-badge--niche tier-badge--toggle" data-tier="niche">niche</button>
    </div>
    <div class="chart-card chart-card--tall">
      <canvas class="opportunity-canvas" role="img" aria-label="Scatter plot of games by release month and popularity"></canvas>
    </div>
    <h3 class="chart-section__title">Matching games</h3>
    <div class="opportunity-cards-view game-grid"></div>
  `;

  const pickerContainer = container.querySelector('.opportunity-picker');
  const hint = container.querySelector('.opportunity-empty-hint');
  const legend = container.querySelector('.chart-legend');
  let selectedTiers = new Set(['hit', 'mid', 'niche']);

  // Axis bounds fixed from the FULL dataset (not whatever the current genre/tag/tier
  // filter narrows to) so filtering only moves the plotted points, never the axis range.
  const datedGames = games.filter((g) => g.release_year_month != null);
  const xMin = Math.min(...datedGames.map((g) => g.release_year_month));
  const xMax = Math.max(...datedGames.map((g) => g.release_year_month));
  const reviewTotals = games.map((g) => g.review_total);
  const yMin = Math.min(...reviewTotals);
  const yMax = Math.max(...reviewTotals);

  const scatter = createScatterChart({
    container: container.querySelector('.opportunity-canvas'),
    titleText: 'Release date vs. popularity',
    xLabel: 'Release date',
    yLabel: 'Total reviews (log scale)',
    xKey: 'release_year_month',
    xType: 'linear',
    xBeginAtZero: false,
    xTicksCallback: (v) => Math.round(v),
    xMin,
    xMax,
    tooltipX: (x) => formatReleaseYearMonth(x),
    yKey: 'review_total',
    yType: 'logarithmic',
    yMin,
    yMax,
    tooltipY: (y) => `${y.toLocaleString()} reviews`,
  });
  const cardsContainer = container.querySelector('.opportunity-cards-view');

  function recompute() {
    const selected = picker.getSelected();
    const labelFiltered = games.filter((g) => matchesFilters(g, selected, { mode: 'all' }));
    const filtered = labelFiltered.filter((g) => selectedTiers.has(g.performance_tier));
    hint.hidden = selected.size !== 0;
    hint.textContent = `Showing all ${games.length} games.`;
    scatter.update(filtered);
    renderGameGrid(cardsContainer, filtered);
  }

  legend.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tier]');
    if (!button) return;
    const tier = button.dataset.tier;
    // Each tier toggles independently — hit/mid/niche can be combined in any combination
    // (e.g. hit + niche, no mid), not locked to "all three" or "exactly one."
    if (selectedTiers.has(tier)) {
      selectedTiers.delete(tier);
    } else {
      selectedTiers.add(tier);
    }
    legend.querySelectorAll('[data-tier]').forEach((el) => {
      const isActive = selectedTiers.has(el.dataset.tier);
      el.classList.toggle('tier-badge--inactive', !isActive);
      el.classList.toggle('tier-badge--selected', isActive);
    });
    recompute();
  });

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
