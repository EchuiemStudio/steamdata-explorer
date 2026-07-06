function extremesBarChart(existing, canvas, data, title, valueKey, formatValue) {
  const values = data.map((g) => g[valueKey]);
  if (existing) {
    existing.data.labels = data.map((g) => g.name);
    existing.data.datasets[0].data = values;
    existing.update();
    return existing;
  }
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.map((g) => g.name),
      datasets: [{ data: values, backgroundColor: VIZ_PRIMARY, borderRadius: 4, barThickness: 20 }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
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
  });
}

async function initHomePage() {
  let games, aggregates;
  try {
    [games, aggregates] = await Promise.all([loadGames(), loadAggregates()]);
  } catch (err) {
    showLoadError(document.querySelector('.data-table-view'));
    return;
  }

  const tagCounts = {};
  games.forEach((g) => g.tags.forEach((t) => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));

  const opportunitySection = createOpportunitySection({
    container: document.querySelector('.opportunity-section'),
    aggregates,
  });
  const priceBucketChart = createPriceBucketChart({ container: document.querySelector('.chart-price-bucket') });
  const tagFrequencyChart = createTagFrequencyChart({ container: document.querySelector('.chart-tag-frequency') });
  const priceScoreScatter = createPriceScoreScatter({ container: document.querySelector('.chart-price-score') });
  const countScoreScatter = createReviewCountScoreScatter({ container: document.querySelector('.chart-count-score') });
  const gameTable = createGameTable({ container: document.querySelector('.data-table-view') });

  let highestChart = null;
  let lowestChart = null;
  let mostReviewedChart = null;
  let dataView = 'table';

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
    const highest = byScoreDesc.slice(0, 8);
    const lowest = byScoreDesc.slice(-8).reverse();
    const mostReviewed = [...filteredGames].sort((a, b) => b.review_total - a.review_total).slice(0, 8);

    highestChart = extremesBarChart(highestChart, document.querySelector('.chart-highest'), highest, 'Highest rated', 'review_score_percent', (v) => `${v}%`);
    lowestChart = extremesBarChart(lowestChart, document.querySelector('.chart-lowest'), lowest, 'Lowest rated', 'review_score_percent', (v) => `${v}%`);
    mostReviewedChart = extremesBarChart(mostReviewedChart, document.querySelector('.chart-most-reviewed'), mostReviewed, 'Most reviewed', 'review_total', (v) => v.toLocaleString());
  }

  function renderDataSection(filteredGames) {
    if (dataView === 'table') {
      gameTable.update(filteredGames);
    } else {
      renderGameGrid(document.querySelector('.data-cards-view'), filteredGames);
    }
  }

  function applyFilters(selectedKeys) {
    const filtered = games.filter((g) => matchesFilters(g, selectedKeys));
    renderStats(filtered);
    renderExtremes(filtered);
    priceBucketChart.update(filtered);
    tagFrequencyChart.update(filtered);
    opportunitySection.update(filtered);
    priceScoreScatter.update(filtered);
    countScoreScatter.update(filtered);
    renderDataSection(filtered);
  }

  const globalFilter = createFilterPanel({
    container: document.querySelector('.global-filter-panel'),
    genreCounts: aggregates.genre_counts,
    tagCounts,
    heading: 'Filter games',
    caption: 'Matches any selected genre AND any selected tag. Everything below reacts to this filter.',
    onChange: applyFilters,
  });

  document.querySelector('.data-view-toggle').addEventListener('click', (event) => {
    const button = event.target.closest('[data-view]');
    if (!button) return;
    dataView = button.dataset.view;
    document.querySelectorAll('.data-view-toggle .chip').forEach((c) => c.classList.toggle('chip--active', c === button));
    document.querySelector('.data-table-view').hidden = dataView !== 'table';
    document.querySelector('.data-cards-view').hidden = dataView !== 'cards';
    renderDataSection(games.filter((g) => matchesFilters(g, globalFilter.getSelected())));
  });

  applyFilters(globalFilter.getSelected());
}

initHomePage();
