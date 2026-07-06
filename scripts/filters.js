function filterKey(type, value) {
  return `${type}:${value}`;
}

function parseFilterKey(key) {
  const sepIndex = key.indexOf(':');
  return { type: key.slice(0, sepIndex), value: key.slice(sepIndex + 1) };
}

function matchesFilters(game, selectedKeys) {
  if (selectedKeys.size === 0) return true;

  const genreValues = [];
  const tagValues = [];
  for (const key of selectedKeys) {
    const { type, value } = parseFilterKey(key);
    if (type === 'genre') genreValues.push(value);
    else tagValues.push(value);
  }

  const genreOK = genreValues.length === 0 || genreValues.some((g) => game.genres.includes(g));
  const tagOK = tagValues.length === 0 || tagValues.some((t) => game.tags.includes(t));
  return genreOK && tagOK;
}

// Reusable multi-select genre+tag panel. Two independent instances exist on Home:
// the global "which games count" filter, and the opportunity map's "which labels to compare" picker.
// Same widget/CSS, different purpose — kept as separate state per the plan's explicit distinction.
function createFilterPanel({ container, genreCounts, tagCounts, heading, caption, onChange, defaultSelected = [] }) {
  const selected = new Set(defaultSelected);
  let searchQuery = '';

  function setCounts(newGenreCounts, newTagCounts) {
    genreCounts = newGenreCounts;
    tagCounts = newTagCounts;
    // drop selections that no longer exist in the (possibly narrower) count set
    for (const key of [...selected]) {
      const { type, value } = parseFilterKey(key);
      const counts = type === 'genre' ? genreCounts : tagCounts;
      if (!(value in counts)) selected.delete(key);
    }
    render();
  }

  function matchesSearch(value) {
    return !searchQuery || value.toLowerCase().includes(searchQuery.toLowerCase());
  }

  function chipHTML(entry) {
    const key = filterKey(entry.type, entry.value);
    const active = selected.has(key);
    return `
      <button type="button" class="chip ${active ? 'chip--active' : ''}" data-filter-key="${escapeHTML(key)}">
        ${escapeHTML(entry.value)} <span class="chip__count">${entry.count}</span>
      </button>
    `;
  }

  function render() {
    const activeElement = document.activeElement;
    const searchWasFocused = activeElement && activeElement.classList.contains('filter-panel__search');
    const cursorPos = searchWasFocused ? activeElement.selectionStart : null;

    const genres = Object.entries(genreCounts)
      .map(([value, count]) => ({ type: 'genre', value, count }))
      .filter((e) => matchesSearch(e.value))
      .sort((a, b) => b.count - a.count);
    const tags = Object.entries(tagCounts)
      .map(([value, count]) => ({ type: 'tag', value, count }))
      .filter((e) => matchesSearch(e.value))
      .sort((a, b) => b.count - a.count);

    const activePills = [...selected].map((key) => {
      const { value } = parseFilterKey(key);
      return `
        <button type="button" class="chip chip--active chip--removable" data-filter-key="${escapeHTML(key)}">
          ${escapeHTML(value)} <span class="chip__remove">&times;</span>
        </button>
      `;
    }).join('');

    container.innerHTML = `
      <div class="filter-panel">
        <div class="filter-panel__header">
          <h2 class="filter-panel__heading">${escapeHTML(heading)}</h2>
          <p class="filter-panel__caption">${escapeHTML(caption)}</p>
        </div>
        <input type="search" class="filter-panel__search" placeholder="Search genres and tags&hellip;">
        ${selected.size ? `<div class="active-filters">${activePills}</div>` : ''}
        <div class="filter-panel__group">
          <h3 class="filter-panel__group-title">Genres</h3>
          <div class="chip-row">${genres.map(chipHTML).join('') || '<p class="empty-state">No matches</p>'}</div>
        </div>
        <div class="filter-panel__group">
          <h3 class="filter-panel__group-title">Tags (${tags.length})</h3>
          <div class="chip-row chip-row--scrollable">${tags.map(chipHTML).join('') || '<p class="empty-state">No matches</p>'}</div>
        </div>
      </div>
    `;

    if (searchWasFocused) {
      const searchInput = container.querySelector('.filter-panel__search');
      searchInput.value = searchQuery;
      searchInput.focus();
      searchInput.setSelectionRange(cursorPos, cursorPos);
    }
  }

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
  return { getSelected: () => selected, setCounts };
}
