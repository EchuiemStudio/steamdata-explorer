async function initBrowsePage() {
  let games;
  try {
    games = await loadGames();
  } catch (err) {
    showLoadError(document.querySelector('.data-table-view'));
    return;
  }

  const gameTable = createGameTable({ container: document.querySelector('.data-table-view') });
  let dataView = 'table';

  function renderDataSection(filteredGames) {
    if (dataView === 'table') {
      gameTable.update(filteredGames);
    } else {
      renderGameGrid(document.querySelector('.data-cards-view'), filteredGames);
    }
  }

  function applyFilters(selected) {
    renderDataSection(games.filter((g) => matchesFilters(g, selected)));
  }

  const filterPanel = createFilterPanel({
    container: document.querySelector('.global-filter-panel'),
    labelCounts: computeLabelCounts(games),
    heading: 'Filter games',
    caption: 'Matches any selected genre or tag.',
    onChange: applyFilters,
  });

  document.querySelector('.data-view-toggle').addEventListener('click', (event) => {
    const button = event.target.closest('[data-view]');
    if (!button) return;
    dataView = button.dataset.view;
    document.querySelectorAll('.data-view-toggle .chip').forEach((c) => c.classList.toggle('chip--active', c === button));
    document.querySelector('.data-table-view').hidden = dataView !== 'table';
    document.querySelector('.data-cards-view').hidden = dataView !== 'cards';
    renderDataSection(games.filter((g) => matchesFilters(g, filterPanel.getSelected())));
  });

  applyFilters(filterPanel.getSelected());
}

initBrowsePage();
