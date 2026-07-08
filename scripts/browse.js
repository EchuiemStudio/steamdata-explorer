async function initBrowsePage() {
  let games;
  try {
    games = await loadGames();
  } catch (err) {
    showLoadError(document.querySelector('.data-cards-view'));
    return;
  }

  let nameQuery = '';

  function recompute() {
    const selected = filterPanel.getSelected();
    const filtered = games.filter((g) =>
      matchesFilters(g, selected) && (!nameQuery || g.name.toLowerCase().includes(nameQuery))
    );
    renderGameGrid(document.querySelector('.data-cards-view'), filtered);
  }

  const filterPanel = createFilterPanel({
    container: document.querySelector('.global-filter-panel'),
    labelCounts: computeLabelCounts(games),
    heading: 'Filter games',
    caption: 'Matches any selected genre or tag.',
    onChange: recompute,
  });

  document.querySelector('.name-search-input').addEventListener('input', (event) => {
    nameQuery = event.target.value.trim().toLowerCase();
    recompute();
  });

  recompute();
}

initBrowsePage();
