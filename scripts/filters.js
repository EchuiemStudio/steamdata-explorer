function matchesFilters(game, selected, { mode = 'any' } = {}) {
  if (selected.size === 0) return true;
  const labels = new Set([...game.genres, ...game.tags]);
  const arr = [...selected];
  return mode === 'all' ? arr.every((l) => labels.has(l)) : arr.some((l) => labels.has(l));
}

// A game's genres largely duplicate into its own tags (Steam's official genre taxonomy
// vs. SteamSpy's community tags overlap ~86% per-game), so both are treated as one
// unified label facet rather than two separate filter groups.
function computeLabelCounts(games) {
  const counts = {};
  for (const game of games) {
    for (const label of new Set([...game.genres, ...game.tags])) {
      counts[label] = (counts[label] || 0) + 1;
    }
  }
  return counts;
}

// Compact search-box + popover picker. Search input always visible; the full label
// list only renders in an absolutely-positioned popover while focused, so it never
// pushes page layout around. Selected labels show as removable pills below.
function createFilterPanel({ container, labelCounts, heading, caption, onChange, defaultSelected = [] }) {
  const selected = new Set(defaultSelected);
  let searchQuery = '';
  let popoverOpen = false;

  function matchesSearch(value) {
    return !searchQuery || value.toLowerCase().includes(searchQuery.toLowerCase());
  }

  function chipHTML(value, count) {
    const active = selected.has(value);
    return `
      <button type="button" class="chip ${active ? 'chip--active' : ''}" data-filter-key="${escapeHTML(value)}">
        ${escapeHTML(value)} <span class="chip__count">${count}</span>
      </button>
    `;
  }

  function render() {
    const activeElement = document.activeElement;
    const searchWasFocused = activeElement && activeElement.classList.contains('filter-panel__search');
    const cursorPos = searchWasFocused ? activeElement.selectionStart : null;

    const labels = Object.entries(labelCounts)
      .map(([value, count]) => ({ value, count }))
      .filter((e) => matchesSearch(e.value))
      .sort((a, b) => b.count - a.count);

    const activePills = [...selected].map((value) => `
      <button type="button" class="chip chip--active chip--removable" data-filter-key="${escapeHTML(value)}">
        ${escapeHTML(value)} <span class="chip__remove">&times;</span>
      </button>
    `).join('');

    container.innerHTML = `
      <div class="filter-panel">
        <div class="filter-panel__header">
          <h2 class="filter-panel__heading">${escapeHTML(heading)}</h2>
          <p class="filter-panel__caption">${escapeHTML(caption)}</p>
        </div>
        <div class="filter-combobox">
          <input type="search" class="filter-panel__search" placeholder="Search genres and tags&hellip;">
          <div class="filter-popover chip-row chip-row--scrollable" ${popoverOpen ? '' : 'hidden'}>
            ${labels.length ? labels.map((e) => chipHTML(e.value, e.count)).join('') : '<p class="empty-state">No matches</p>'}
          </div>
        </div>
        ${selected.size ? `<div class="active-filters">${activePills}</div>` : ''}
      </div>
    `;

    if (searchWasFocused) {
      const searchInput = container.querySelector('.filter-panel__search');
      searchInput.value = searchQuery;
      searchInput.focus();
      searchInput.setSelectionRange(cursorPos, cursorPos);
    }
  }

  container.addEventListener('focusin', (event) => {
    if (!event.target.classList.contains('filter-panel__search')) return;
    if (popoverOpen) return;
    popoverOpen = true;
    render();
  });

  container.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && popoverOpen) {
      popoverOpen = false;
      render();
    }
  });

  document.addEventListener('click', (event) => {
    if (!popoverOpen || container.contains(event.target)) return;
    popoverOpen = false;
    render();
  });

  container.addEventListener('input', (event) => {
    if (!event.target.classList.contains('filter-panel__search')) return;
    searchQuery = event.target.value;
    render();
  });

  container.addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter-key]');
    if (!button) return;
    const key = button.dataset.filterKey;
    if (selected.has(key)) selected.delete(key); else selected.add(key);
    render();
    onChange(selected);
  });

  render();
  return { getSelected: () => selected };
}
