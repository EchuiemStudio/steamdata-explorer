const OPPORTUNITY_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// release_year_month is a fractional value (e.g. 2019.083 for Feb 2019) so games
// spread out within a year instead of stacking at one X position per year.
function formatReleaseYearMonth(value) {
  const year = Math.floor(value);
  const month = Math.min(11, Math.max(0, Math.round((value - year) * 12)));
  return `${OPPORTUNITY_MONTH_NAMES[month]} ${year}`;
}

function createOpportunitySection({ container, games }) {
  container.innerHTML = `
    <div class="opportunity-picker"></div>
    <p class="chart-section__caption opportunity-empty-hint"></p>
    <p class="chart-section__caption chart-legend">
      Tier (a second filter, applied after the genres/tags above &mdash; click a tier to isolate it, click again to restore all):
      <button type="button" class="tier-badge tier-badge--hit tier-badge--toggle" data-tier="hit">hit</button>
      <button type="button" class="tier-badge tier-badge--mid tier-badge--toggle" data-tier="mid">mid</button>
      <button type="button" class="tier-badge tier-badge--niche tier-badge--toggle" data-tier="niche">niche</button>
    </p>
    <div class="chart-card chart-card--tall">
      <canvas class="opportunity-canvas" role="img" aria-label="Scatter plot of games by release month and popularity"></canvas>
    </div>
    <h3 class="chart-section__title">Matching games</h3>
    <div class="opportunity-table-view"></div>
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
  const table = createGameTable({ container: container.querySelector('.opportunity-table-view') });

  function recompute() {
    const selected = picker.getSelected();
    const labelFiltered = games.filter((g) => matchesFilters(g, selected, { mode: 'all' }));
    const filtered = labelFiltered.filter((g) => selectedTiers.has(g.performance_tier));
    hint.hidden = selected.size !== 0;
    hint.textContent = `Showing all ${games.length} games — pick genres/tags above to narrow (a game must match ALL selected).`;
    scatter.update(filtered);
    table.update(filtered);
  }

  legend.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tier]');
    if (!button) return;
    const tier = button.dataset.tier;
    // Click a tier to isolate it (show only that one); click the already-isolated tier again to restore all three.
    selectedTiers = (selectedTiers.size === 1 && selectedTiers.has(tier))
      ? new Set(['hit', 'mid', 'niche'])
      : new Set([tier]);
    legend.querySelectorAll('[data-tier]').forEach((el) => {
      el.classList.toggle('tier-badge--inactive', !selectedTiers.has(el.dataset.tier));
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
