async function loadGames() {
  const res = await fetch(`${sitePathPrefix()}data/games.json`);
  return res.json();
}

async function loadAggregates() {
  const res = await fetch(`${sitePathPrefix()}data/aggregates.json`);
  return res.json();
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
