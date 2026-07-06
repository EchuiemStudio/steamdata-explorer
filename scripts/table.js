const TABLE_COLUMNS = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'genres', label: 'Genres', sortable: false },
  { key: 'tags', label: 'Tags', sortable: false },
  { key: 'performance_tier', label: 'Tier', sortable: true },
  { key: 'price_usd', label: 'Price', sortable: true },
  { key: 'review_score_percent', label: 'Score %', sortable: true },
  { key: 'review_total', label: 'Reviews', sortable: true },
  { key: 'release_year', label: 'Year', sortable: true },
];

function tableCellHTML(game, key) {
  switch (key) {
    case 'name':
      return `<a href="${steamStoreURL(game.appid)}" target="_blank" rel="noopener noreferrer">${escapeHTML(game.name)}</a>`;
    case 'genres':
      return escapeHTML(game.genres.join(', '));
    case 'tags': {
      const shown = game.tags.slice(0, 3).join(', ');
      const suffix = game.tags.length > 3 ? '…' : '';
      return `<span title="${escapeHTML(game.tags.join(', '))}">${escapeHTML(shown)}${suffix}</span>`;
    }
    case 'performance_tier':
      return `<span class="tier-badge tier-badge--${game.performance_tier}">${game.performance_tier}</span>`;
    case 'price_usd':
      return formatPrice(game.price_usd);
    case 'review_score_percent':
      return game.review_score_percent != null ? `${game.review_score_percent}%` : '—';
    case 'review_total':
      return game.review_total.toLocaleString();
    case 'release_year':
      return game.release_year || '—';
    default:
      return '';
  }
}

function tableSortValue(game, key) {
  if (key === 'release_year') return game.release_year ?? 0;
  return game[key];
}

function createGameTable({ container }) {
  let games = [];
  let sortKey = 'review_total';
  let sortDir = 'desc';

  function render() {
    if (games.length === 0) {
      container.innerHTML = '<p class="empty-state">No games match this filter.</p>';
      return;
    }

    const sorted = [...games].sort((a, b) => {
      const av = tableSortValue(a, sortKey);
      const bv = tableSortValue(b, sortKey);
      // Unknown values (null price, null score) always sort last, regardless of direction —
      // "unknown" isn't the same as "lowest", so it shouldn't flip to the top on a desc sort.
      const aUnknown = av == null;
      const bUnknown = bv == null;
      if (aUnknown && bUnknown) return 0;
      if (aUnknown) return 1;
      if (bUnknown) return -1;
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
      return sortDir === 'asc' ? cmp : -cmp;
    });

    const headerHTML = TABLE_COLUMNS.map((col) => {
      const active = col.key === sortKey;
      const arrow = active ? (sortDir === 'asc' ? ' &#9650;' : ' &#9660;') : '';
      if (!col.sortable) return `<th>${col.label}</th>`;
      const ariaSort = active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
      return `<th class="game-table__sortable" data-sort-key="${col.key}" tabindex="0" role="button" aria-sort="${ariaSort}">${col.label}${arrow}</th>`;
    }).join('');

    const rowsHTML = sorted.map((game) => `
      <tr>${TABLE_COLUMNS.map((col) => `<td>${tableCellHTML(game, col.key)}</td>`).join('')}</tr>
    `).join('');

    container.innerHTML = `
      <div class="game-table-wrap">
        <table class="game-table">
          <thead><tr>${headerHTML}</tr></thead>
          <tbody>${rowsHTML}</tbody>
        </table>
      </div>
      <p class="game-table__count">${sorted.length} game${sorted.length === 1 ? '' : 's'}</p>
    `;
  }

  function sortBy(key) {
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDir = 'desc';
    }
    render();
  }

  container.addEventListener('click', (event) => {
    const th = event.target.closest('[data-sort-key]');
    if (!th) return;
    sortBy(th.dataset.sortKey);
  });

  container.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const th = event.target.closest('[data-sort-key]');
    if (!th) return;
    event.preventDefault(); // stop the page from scrolling on Space
    sortBy(th.dataset.sortKey);
  });

  return {
    update(newGames) {
      games = newGames;
      render();
    },
  };
}
