const EXTREMES_MODAL_ROW_HEIGHT = 26; // px per bar in the scrollable "top 100" modal view

function buildExtremesChartConfig(data, title, valueKey, formatValue) {
  const values = data.map((g) => g[valueKey]);
  return {
    type: 'bar',
    data: {
      labels: data.map((g) => g.name),
      datasets: [{ data: values, backgroundColor: VIZ_PRIMARY, borderRadius: 4, barThickness: 20 }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      onClick: gameClickHandler((idx) => data[idx]),
      plugins: {
        legend: { display: false },
        title: { display: true, text: title, color: VIZ_TEXT, font: { size: 13, weight: '600' }, padding: { bottom: 10 } },
        tooltip: { callbacks: { label: (item) => formatValue(item.parsed.x) } },
      },
      scales: {
        x: { beginAtZero: true, grid: { color: VIZ_GRID }, ticks: { color: VIZ_MUTED, callback: formatValue } },
        y: { grid: { display: false }, ticks: { color: VIZ_TEXT, font: { size: 11 } } },
      },
    },
  };
}

function extremesBarChart(existing, canvas, data, title, valueKey, formatValue) {
  if (existing) {
    existing.data.labels = data.map((g) => g.name);
    existing.data.datasets[0].data = data.map((g) => g[valueKey]);
    existing.options.onClick = gameClickHandler((idx) => data[idx]); // re-bind so clicks resolve against the current filtered data, not the array from first render
    existing.update();
    return existing;
  }
  return new Chart(canvas, buildExtremesChartConfig(data, title, valueKey, formatValue));
}

async function initHomePage() {
  let games;
  try {
    games = await loadGames();
  } catch (err) {
    showLoadError(document.querySelector('#charts'));
    return;
  }

  let selectedTiers = new Set(['hit', 'mid', 'niche']);
  let lastFilteredGames = games;

  const priceBucketChart = createPriceBucketChart({
    container: document.querySelector('.chart-price-bucket'),
    onBucketClick: (label, gamesInBucket) => {
      const detail = document.querySelector('.price-bucket-detail');
      detail.innerHTML = `
        <h3 class="chart-section__title">${escapeHTML(label)} &mdash; ${gamesInBucket.length} game${gamesInBucket.length === 1 ? '' : 's'}</h3>
        <div class="game-grid price-bucket-games"></div>
      `;
      renderGameGrid(detail.querySelector('.price-bucket-games'), gamesInBucket);
    },
  });
  const tagFrequencyChart = createTagFrequencyChart({ container: document.querySelector('.chart-tag-frequency') });
  const priceScoreScatter = createPriceScoreScatter({ container: document.querySelector('.chart-price-score') });
  const countScoreScatter = createReviewCountScoreScatter({ container: document.querySelector('.chart-count-score') });

  let highestChart = null;
  let lowestChart = null;
  let mostReviewedChart = null;
  let highestSorted = [];
  let lowestSorted = [];
  let mostReviewedSorted = [];

  function renderStats(filteredGames) {
    const scoredGames = filteredGames.filter((g) => g.review_score_percent != null);
    const totalReviews = filteredGames.reduce((sum, g) => sum + g.review_total, 0);
    const avgScore = scoredGames.length
      ? (scoredGames.reduce((sum, g) => sum + g.review_score_percent, 0) / scoredGames.length).toFixed(1)
      : '—';

    document.getElementById('stat-tiles').innerHTML = `
      <div class="stat-tile">
        <div class="stat-tile__value">${filteredGames.length}</div>
        <div class="stat-tile__label">Games matching filter</div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile__value">${totalReviews.toLocaleString()}</div>
        <div class="stat-tile__label">Total reviews</div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile__value">${avgScore}%</div>
        <div class="stat-tile__label">Avg. review score</div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile__value">${new Set(filteredGames.flatMap((g) => g.genres)).size}</div>
        <div class="stat-tile__label">Genres represented</div>
      </div>
    `;

    const tierBreakdown = ['hit', 'mid', 'niche'].map((tier) => {
      const tierGames = filteredGames.filter((g) => g.performance_tier === tier);
      const tierScored = tierGames.filter((g) => g.review_score_percent != null);
      const tierPriced = tierGames.filter((g) => g.price_usd != null);
      const avgTierScore = tierScored.length
        ? (tierScored.reduce((s, g) => s + g.review_score_percent, 0) / tierScored.length).toFixed(1)
        : '—';
      const avgTierPrice = tierPriced.length
        ? (tierPriced.reduce((s, g) => s + g.price_usd, 0) / tierPriced.length).toFixed(2)
        : '—';
      return `
        <div class="tier-row">
          <span class="tier-badge tier-badge--${tier}">${tier}</span>
          <span class="tier-row__count">${tierGames.length} games</span>
          <span class="tier-row__stat">${avgTierScore}% avg score &middot; $${avgTierPrice} avg price</span>
        </div>
      `;
    }).join('');
    document.getElementById('tier-breakdown').innerHTML = tierBreakdown;
  }

  function renderExtremes(filteredGames) {
    const scoredGames = filteredGames.filter((g) => g.review_score_percent != null);
    highestSorted = [...scoredGames].sort((a, b) => b.review_score_percent - a.review_score_percent);
    lowestSorted = [...scoredGames].sort((a, b) => a.review_score_percent - b.review_score_percent);
    mostReviewedSorted = [...filteredGames].sort((a, b) => b.review_total - a.review_total);

    const highestData = highestSorted.slice(0, 10);
    const lowestData = lowestSorted.slice(0, 10);
    const mostReviewedData = mostReviewedSorted.slice(0, 10);

    highestChart = extremesBarChart(highestChart, document.querySelector('.chart-highest'), highestData, 'Highest rated', 'review_score_percent', (v) => `${v}%`);
    lowestChart = extremesBarChart(lowestChart, document.querySelector('.chart-lowest'), lowestData, 'Lowest rated', 'review_score_percent', (v) => `${v}%`);
    mostReviewedChart = extremesBarChart(mostReviewedChart, document.querySelector('.chart-most-reviewed'), mostReviewedData, 'Most reviewed', 'review_total', (v) => v.toLocaleString());
  }

  function renderScatters() {
    const tierFiltered = lastFilteredGames.filter((g) => selectedTiers.has(g.performance_tier));
    priceScoreScatter.update(tierFiltered);
    countScoreScatter.update(tierFiltered);
  }

  function applyFilters(selected) {
    const filtered = games.filter((g) => matchesFilters(g, selected));
    lastFilteredGames = filtered;
    renderStats(filtered);
    renderExtremes(filtered);
    priceBucketChart.update(filtered);
    tagFrequencyChart.update(filtered);
    renderScatters();
    document.querySelector('.price-bucket-detail').innerHTML = ''; // clear any bucket detail from before this filter change — it no longer reflects the current filter
  }

  const globalFilter = createFilterPanel({
    container: document.querySelector('.global-filter-panel'),
    labelCounts: computeLabelCounts(games),
    heading: 'Filter games',
    caption: 'Matches any selected genre or tag. Everything below reacts to this filter.',
    onChange: applyFilters,
  });

  document.querySelector('#charts').addEventListener('click', (event) => {
    const button = event.target.closest('[data-expand-target]');
    if (!button) return;
    const target = button.dataset.expandTarget;
    if (target === 'highest') {
      const top100 = highestSorted.slice(0, 100);
      openChartModal('Highest rated (top 100)', () => buildExtremesChartConfig(top100, 'Highest rated (top 100)', 'review_score_percent', (v) => `${v}%`), { scrollHeight: top100.length * EXTREMES_MODAL_ROW_HEIGHT });
    } else if (target === 'lowest') {
      const top100 = lowestSorted.slice(0, 100);
      openChartModal('Lowest rated (top 100)', () => buildExtremesChartConfig(top100, 'Lowest rated (top 100)', 'review_score_percent', (v) => `${v}%`), { scrollHeight: top100.length * EXTREMES_MODAL_ROW_HEIGHT });
    } else if (target === 'most-reviewed') {
      const top100 = mostReviewedSorted.slice(0, 100);
      openChartModal('Most reviewed (top 100)', () => buildExtremesChartConfig(top100, 'Most reviewed (top 100)', 'review_total', (v) => v.toLocaleString()), { scrollHeight: top100.length * EXTREMES_MODAL_ROW_HEIGHT });
    }
  });

  document.querySelector('.chart-legend').addEventListener('click', (event) => {
    const button = event.target.closest('[data-tier]');
    if (!button) return;
    const tier = button.dataset.tier;
    // Click a tier to isolate it (show only that one); click the already-isolated tier again to restore all three.
    selectedTiers = (selectedTiers.size === 1 && selectedTiers.has(tier))
      ? new Set(['hit', 'mid', 'niche'])
      : new Set([tier]);
    document.querySelectorAll('.chart-legend [data-tier]').forEach((el) => {
      el.classList.toggle('tier-badge--inactive', !selectedTiers.has(el.dataset.tier));
    });
    renderScatters();
  });

  applyFilters(globalFilter.getSelected());
}

initHomePage();
