const TAG_CHIP_LIMIT = 24;

async function initTagsPage() {
  const games = await loadGames();

  const tagCounts = {};
  games.forEach((g) => g.tags.forEach((tag) => {
    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  }));

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TAG_CHIP_LIMIT)
    .map(([tag]) => tag);

  const chipRow = document.getElementById('chip-row');
  const grid = document.getElementById('game-grid');

  function render(activeTag) {
    chipRow.innerHTML = topTags.map((tag) => `
      <button class="chip ${tag === activeTag ? 'chip--active' : ''}" data-tag="${escapeHTML(tag)}">
        ${escapeHTML(tag)} <span class="chip__count">${tagCounts[tag]}</span>
      </button>
    `).join('');

    const filtered = activeTag ? games.filter((g) => g.tags.includes(activeTag)) : games;
    renderGameGrid(grid, filtered);
  }

  chipRow.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tag]');
    if (!button) return;
    const alreadyActive = button.classList.contains('chip--active');
    render(alreadyActive ? null : button.dataset.tag);
  });

  render(null);
}

initTagsPage();
