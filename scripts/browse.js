const BROWSE_GRID_PAGE_SIZE = 60; // caps the default unfiltered render at 60 of 716 cards

async function initBrowsePage() {
  let games;
  try {
    games = await loadGames();
  } catch (err) {
    showLoadError(document.querySelector('.data-cards-view'));
    return;
  }

  let nameQuery = '';
  let visibleCount = BROWSE_GRID_PAGE_SIZE;
  const gridContainer = document.querySelector('.data-cards-view');
  const loadMoreBtn = document.querySelector('.grid-load-more');

  function recompute({ resetPage = true } = {}) {
    const selected = filterPanel.getSelected();
    const filtered = games.filter((g) =>
      matchesFilters(g, selected) && (!nameQuery || g.name.toLowerCase().includes(nameQuery))
    );
    if (resetPage) visibleCount = BROWSE_GRID_PAGE_SIZE;
    renderGameGrid(gridContainer, filtered.slice(0, visibleCount));
    const remaining = filtered.length - visibleCount;
    loadMoreBtn.hidden = remaining <= 0;
    loadMoreBtn.textContent = `Show ${Math.min(remaining, BROWSE_GRID_PAGE_SIZE)} more (${filtered.length} total)`;
  }

  loadMoreBtn.addEventListener('click', () => {
    visibleCount += BROWSE_GRID_PAGE_SIZE;
    recompute({ resetPage: false });
  });

  const filterPanel = createFilterPanel({
    container: document.querySelector('.global-filter-panel'),
    labelCounts: computeLabelCounts(games),
    heading: 'Filter games',
    caption: 'Matches any selected genre or tag.',
    onChange: recompute,
  });

  document.querySelector('.name-search-input').addEventListener('input', debounce((event) => {
    nameQuery = event.target.value.trim().toLowerCase();
    recompute();
  }, 200));

  recompute();
}

initBrowsePage();
