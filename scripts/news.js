function formatNewsDate(pubDate) {
  if (!pubDate) return '';
  const date = new Date(pubDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function newsItemHTML(item) {
  const dateStr = formatNewsDate(item.pubDate);
  return `
    <a class="news-item" href="${escapeHTML(item.link)}" target="_blank" rel="noopener noreferrer">
      <div class="news-item__title">${escapeHTML(item.title)}</div>
      <div class="news-item__meta">${escapeHTML(item.source)}${dateStr ? ` &middot; ${dateStr}` : ''}</div>
    </a>
  `;
}

async function initNewsSection() {
  const container = document.querySelector('.news-list');
  if (!container) return;
  try {
    const res = await fetch(`${sitePathPrefix()}data/news.json`);
    const items = await res.json();
    if (!Array.isArray(items) || items.length === 0) {
      container.innerHTML = '<p class="empty-state">No news available right now.</p>';
      return;
    }
    container.innerHTML = items.map(newsItemHTML).join('');
  } catch (err) {
    container.innerHTML = '<p class="empty-state">Could not load news.</p>';
  }
}

initNewsSection();
