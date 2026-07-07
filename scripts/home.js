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

  const priceBucketChart = createPriceBucketChart({ container: document.querySelector('.chart-price-bucket') });
  const tagFrequencyChart = createTagFrequencyChart({ container: document.querySelector('.chart-tag-frequency') });
  const priceScoreScatter = createPriceScoreScatter({ container: document.querySelector('.chart-price-score') });
  const countScoreScatter = createReviewCountScoreScatter({ container: document.querySelector('.chart-count-score') });

  let highestChart = null;
  let lowestChart = null;
  let mostReviewedChart = null;
  let highestData = [];
  let lowestData = [];
  let mostReviewedData = [];

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
    const byScoreDesc = [...scoredGames].sort((a, b) => b.review_score_percent - a.review_score_percent);
    highestData = byScoreDesc.slice(0, 8);
    lowestData = byScoreDesc.slice(-8).reverse();
    mostReviewedData = [...filteredGames].sort((a, b) => b.review_total - a.review_total).slice(0, 8);

    highestChart = extremesBarChart(highestChart, document.querySelector('.chart-highest'), highestData, 'Highest rated', 'review_score_percent', (v) => `${v}%`);
    lowestChart = extremesBarChart(lowestChart, document.querySelector('.chart-lowest'), lowestData, 'Lowest rated', 'review_score_percent', (v) => `${v}%`);
    mostReviewedChart = extremesBarChart(mostReviewedChart, document.querySelector('.chart-most-reviewed'), mostReviewedData, 'Most reviewed', 'review_total', (v) => v.toLocaleString());
  }

  function applyFilters(selected) {
    const filtered = games.filter((g) => matchesFilters(g, selected));
    renderStats(filtered);
    renderExtremes(filtered);
    priceBucketChart.update(filtered);
    tagFrequencyChart.update(filtered);
    priceScoreScatter.update(filtered);
    countScoreScatter.update(filtered);
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
      openChartModal('Highest rated', () => buildExtremesChartConfig(highestData, 'Highest rated', 'review_score_percent', (v) => `${v}%`));
    } else if (target === 'lowest') {
      openChartModal('Lowest rated', () => buildExtremesChartConfig(lowestData, 'Lowest rated', 'review_score_percent', (v) => `${v}%`));
    } else if (target === 'most-reviewed') {
      openChartModal('Most reviewed', () => buildExtremesChartConfig(mostReviewedData, 'Most reviewed', 'review_total', (v) => v.toLocaleString()));
    }
  });

  applyFilters(globalFilter.getSelected());
}

initHomePage();
