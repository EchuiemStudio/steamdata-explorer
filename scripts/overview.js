const VIZ_PRIMARY = '#2a78d6';
const VIZ_GRID = '#e1e0d9';
const VIZ_MUTED = '#898781';
const VIZ_TEXT = '#17171a';

function extremesBarChart(canvasId, games, title) {
  const ctx = document.getElementById(canvasId);
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: games.map((g) => g.name),
      datasets: [{
        data: games.map((g) => g.review_score_percent),
        backgroundColor: VIZ_PRIMARY,
        borderRadius: 4,
        barThickness: 20,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: true, text: title, color: VIZ_TEXT, font: { size: 13, weight: '600' }, padding: { bottom: 10 } },
        tooltip: {
          callbacks: {
            label: (item) => `${item.parsed.x}% positive`,
          },
        },
      },
      scales: {
        x: {
          min: 0,
          max: 100,
          grid: { color: VIZ_GRID },
          ticks: { color: VIZ_MUTED, callback: (v) => `${v}%` },
        },
        y: {
          grid: { display: false },
          ticks: { color: VIZ_TEXT, font: { size: 11 } },
        },
      },
    },
  });
}

async function initOverviewPage() {
  const [games, aggregates] = await Promise.all([loadGames(), loadAggregates()]);

  const totalReviews = games.reduce((sum, g) => sum + g.review_total, 0);
  const avgScore = (games.reduce((sum, g) => sum + g.review_score_percent, 0) / games.length).toFixed(1);

  document.getElementById('stat-tiles').innerHTML = `
    <div class="stat-tile">
      <div class="stat-tile__value">${aggregates.total_games}</div>
      <div class="stat-tile__label">Games sampled</div>
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
      <div class="stat-tile__value">${Object.keys(aggregates.genre_counts).length}</div>
      <div class="stat-tile__label">Genres represented</div>
    </div>
  `;

  document.getElementById('tier-breakdown').innerHTML = ['hit', 'mid', 'niche'].map((tier) => `
    <div class="tier-row">
      <span class="tier-badge tier-badge--${tier}">${tier}</span>
      <span class="tier-row__count">${aggregates.tier_counts[tier]} games</span>
      <span class="tier-row__stat">${aggregates.tier_stats[tier].avg_review_score}% avg score &middot; $${aggregates.tier_stats[tier].avg_price.toFixed(2)} avg price</span>
    </div>
  `).join('');

  const byScoreDesc = [...games].sort((a, b) => b.review_score_percent - a.review_score_percent);
  const highest = byScoreDesc.slice(0, 8);
  const lowest = byScoreDesc.slice(-8).reverse();

  extremesBarChart('chart-highest', highest, 'Highest rated');
  extremesBarChart('chart-lowest', lowest, 'Lowest rated');

  renderGameGrid(document.getElementById('game-grid'), games);
}

initOverviewPage();
