// Experimental variant of the Opportunity Map: lets the user swap what's on the X and Y
// axis instead of a fixed release-date-vs-popularity view. Metric list is deliberately
// short and numeric-only for now — genres/tags are categorical and would need a
// different chart type (grouped bars, box plot) rather than a scatter axis.
const TEST_AXIS_METRICS = {
  release_date: {
    label: 'Release date',
    key: 'release_year_month',
    type: 'linear',
    range: 'dataset',
    ticksCallback: (v) => Math.round(v),
    tooltip: (v) => formatReleaseYearMonth(v),
  },
  price: {
    label: 'Price (USD)',
    key: 'price_usd',
    type: 'linear',
    range: 'zeroFloor',
    tooltip: (v) => (v === 0 ? 'Free' : `$${v.toFixed(2)}`),
  },
  review_score: {
    label: 'Review score %',
    key: 'review_score_percent',
    type: 'linear',
    range: 'fixed',
    fixedMin: 0,
    fixedMax: 100,
    tooltip: (v) => `${v}% positive`,
  },
  total_reviews: {
    label: 'Total reviews (log scale)',
    key: 'review_total',
    type: 'logarithmic',
    range: 'dataset',
    tooltip: (v) => `${v.toLocaleString()} reviews`,
  },
  tag_count: {
    label: 'Tag count',
    key: '__tag_count',
    type: 'linear',
    range: 'zeroFloor',
    tooltip: (v) => `${v} tag${v === 1 ? '' : 's'}`,
  },
};

function computeMetricRange(metric, games) {
  if (metric.range === 'fixed') return { min: metric.fixedMin, max: metric.fixedMax };
  const values = games.map((g) => g[metric.key]).filter((v) => v != null);
  return metric.range === 'zeroFloor'
    ? { min: 0, max: Math.max(...values) }
    : { min: Math.min(...values), max: Math.max(...values) };
}

function axisOptionsHTML(defaultId) {
  return Object.entries(TEST_AXIS_METRICS)
    .map(([id, m]) => `<option value="${id}"${id === defaultId ? ' selected' : ''}>${escapeHTML(m.label)}</option>`)
    .join('');
}

function createTestOpportunitySection({ container, games }) {
  container.innerHTML = `
    <div class="axis-picker">
      <label class="axis-picker__field">
        <span>X axis</span>
        <select class="axis-select" data-axis="x">${axisOptionsHTML('release_date')}</select>
      </label>
      <label class="axis-picker__field">
        <span>Y axis</span>
        <select class="axis-select" data-axis="y">${axisOptionsHTML('total_reviews')}</select>
      </label>
    </div>
    <div class="opportunity-picker"></div>
    <p class="chart-section__caption opportunity-empty-hint"></p>
    <div class="chart-legend">
      <button type="button" class="tier-badge tier-badge--hit tier-badge--toggle" data-tier="hit">hit</button>
      <button type="button" class="tier-badge tier-badge--mid tier-badge--toggle" data-tier="mid">mid</button>
      <button type="button" class="tier-badge tier-badge--niche tier-badge--toggle" data-tier="niche">niche</button>
    </div>
    <div class="chart-card chart-card--tall">
      <canvas class="test-opportunity-canvas" role="img" aria-label="Scatter plot with selectable X and Y axis metrics"></canvas>
    </div>
    <h3 class="chart-section__title">Matching games</h3>
    <div class="opportunity-cards-view game-grid"></div>
  `;

  const pickerContainer = container.querySelector('.opportunity-picker');
  const hint = container.querySelector('.opportunity-empty-hint');
  const legend = container.querySelector('.chart-legend');
  const canvas = container.querySelector('.test-opportunity-canvas');
  const cardsContainer = container.querySelector('.opportunity-cards-view');
  const xSelect = container.querySelector('[data-axis="x"]');
  const ySelect = container.querySelector('[data-axis="y"]');

  let selectedTiers = new Set(['hit', 'mid', 'niche']);
  let scatter = null;

  // Swapping the axis metric changes what the chart even means, so it recreates the
  // chart outright — unlike a tier/genre filter change, there's no "same points, new
  // positions" continuity worth animating between two different metrics.
  function buildScatter() {
    if (scatter) scatter.destroy();
    const xMetric = TEST_AXIS_METRICS[xSelect.value];
    const yMetric = TEST_AXIS_METRICS[ySelect.value];
    const xRange = computeMetricRange(xMetric, games);
    const yRange = computeMetricRange(yMetric, games);
    scatter = createScatterChart({
      container: canvas,
      titleText: `${xMetric.label} vs. ${yMetric.label}`,
      xLabel: xMetric.label,
      yLabel: yMetric.label,
      xKey: xMetric.key,
      xType: xMetric.type,
      xBeginAtZero: xMetric.range === 'zeroFloor',
      xTicksCallback: xMetric.ticksCallback,
      xMin: xRange.min,
      xMax: xRange.max,
      tooltipX: xMetric.tooltip,
      yKey: yMetric.key,
      yType: yMetric.type,
      yTicksCallback: yMetric.ticksCallback,
      yMin: yRange.min,
      yMax: yRange.max,
      tooltipY: yMetric.tooltip,
    });
  }

  function recompute() {
    const selected = picker.getSelected();
    const labelFiltered = games.filter((g) => matchesFilters(g, selected, { mode: 'all' }));
    const filtered = labelFiltered.filter((g) => selectedTiers.has(g.performance_tier));
    hint.hidden = selected.size !== 0;
    hint.textContent = `Showing all ${games.length} games.`;
    scatter.update(filtered);
    renderGameGrid(cardsContainer, filtered);
  }

  [xSelect, ySelect].forEach((select) => {
    select.addEventListener('change', () => {
      buildScatter();
      recompute();
    });
  });

  legend.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tier]');
    if (!button) return;
    const tier = button.dataset.tier;
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
    caption: 'Selecting multiple genres/tags narrows to games matching ALL of them (the overlap), not any one.',
    onChange: recompute,
  });

  buildScatter();
  recompute();
}

async function initTestOpportunityPage() {
  let games;
  try {
    games = await loadGames();
  } catch (err) {
    showLoadError(document.querySelector('.test-opportunity-section'));
    return;
  }
  games.forEach((g) => { g.__tag_count = Array.isArray(g.tags) ? g.tags.length : 0; });
  createTestOpportunitySection({ container: document.querySelector('.test-opportunity-section'), games });
}

initTestOpportunityPage();
