const VIZ_PRIMARY = '#2a78d6';
const VIZ_GRID = '#e1e0d9';
const VIZ_MUTED = '#898781';
const VIZ_TEXT = '#17171a';
const VIZ_SURFACE = '#ffffff';

async function loadGames() {
  const res = await fetch(`${sitePathPrefix()}data/games.json`);
  return res.json();
}

async function loadAggregates() {
  const res = await fetch(`${sitePathPrefix()}data/aggregates.json`);
  return res.json();
}

function showLoadError(container) {
  if (container) {
    container.innerHTML = '<p class="empty-state">Could not load game data. Try refreshing the page.</p>';
  }
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML.replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
