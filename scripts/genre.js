function mostCommonTag(games) {
  const counts = {};
  games.forEach((g) => g.tags.forEach((t) => {
    counts[t] = (counts[t] || 0) + 1;
  }));
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.length ? sorted[0][0] : '—';
}

function genreStatsHTML(label, subset) {
  const scoredSubset = subset.filter((g) => g.review_score_percent != null);
  const avgScore = scoredSubset.length
    ? (scoredSubset.reduce((sum, g) => sum + g.review_score_percent, 0) / scoredSubset.length).toFixed(1)
    : '—';
  const avgPrice = subset.length
    ? (subset.reduce((sum, g) => sum + g.price_usd, 0) / subset.length).toFixed(2)
    : '—';

  return `
    <div class="stat-tile">
      <div class="stat-tile__value">${subset.length}</div>
      <div class="stat-tile__label">${escapeHTML(label)} games</div>
    </div>
    <div class="stat-tile">
      <div class="stat-tile__value">${avgScore}%</div>
      <div class="stat-tile__label">Avg. review score</div>
    </div>
    <div class="stat-tile">
      <div class="stat-tile__value">$${avgPrice}</div>
      <div class="stat-tile__label">Avg. price</div>
    </div>
    <div class="stat-tile">
      <div class="stat-tile__value">${escapeHTML(mostCommonTag(subset))}</div>
      <div class="stat-tile__label">Most common tag</div>
    </div>
  `;
}

async function initGenrePage() {
  let games, aggregates;
  try {
    [games, aggregates] = await Promise.all([loadGames(), loadAggregates()]);
  } catch (err) {
    showLoadError(document.getElementById('game-grid'));
    return;
  }
  const genres = Object.keys(aggregates.genre_counts).sort();

  const chipRow = document.getElementById('chip-row');
  const statsPanel = document.getElementById('genre-stats');
  const grid = document.getElementById('game-grid');

  function render(activeGenre) {
    chipRow.innerHTML = genres.map((genre) => `
      <button class="chip ${genre === activeGenre ? 'chip--active' : ''}" data-genre="${escapeHTML(genre)}">
        ${escapeHTML(genre)} <span class="chip__count">${aggregates.genre_counts[genre]}</span>
      </button>
    `).join('');

    const filtered = activeGenre ? games.filter((g) => g.genres.includes(activeGenre)) : games;
    statsPanel.innerHTML = genreStatsHTML(activeGenre || 'All', filtered);
    renderGameGrid(grid, filtered);
  }

  chipRow.addEventListener('click', (event) => {
    const button = event.target.closest('[data-genre]');
    if (!button) return;
    const alreadyActive = button.classList.contains('chip--active');
    render(alreadyActive ? null : button.dataset.genre);
  });

  render(null);
}

initGenrePage();
