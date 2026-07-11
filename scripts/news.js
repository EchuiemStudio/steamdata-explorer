const HOME_NEWS_STRIP_LIMIT = 12;

function formatNewsDate(pubDate) {
  if (!pubDate) return '';
  const date = new Date(pubDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// compact skips the excerpt: the home page's .news-strip cards are a fixed 260px wide,
// too narrow for a 200-char excerpt to fit without breaking the compact layout - only
// the full-width news.html list shows it.
function newsItemHTML(item, { compact = false } = {}) {
  const dateStr = formatNewsDate(item.pubDate);
  return `
    <a class="news-item" href="${escapeHTML(item.link)}" target="_blank" rel="noopener noreferrer">
      <div class="news-item__title">${escapeHTML(item.title)}</div>
      ${!compact && item.description ? `<div class="news-item__excerpt">${escapeHTML(item.description)}</div>` : ''}
      <div class="news-item__meta">${escapeHTML(item.source)}${dateStr ? ` &middot; ${dateStr}` : ''}</div>
    </a>
  `;
}

function renderNewsList(container, items, { compact = false } = {}) {
  if (items.length === 0) {
    container.innerHTML = '<p class="empty-state">No news available right now.</p>';
    return;
  }
  container.innerHTML = items.map((item) => newsItemHTML(item, { compact })).join('');
}

// Home shows a compact horizontal preview (.news-strip); the dedicated news.html page
// shows the full list (.news-list). Either or both containers may exist on a given page.
async function initNews() {
  const stripContainer = document.querySelector('.news-strip');
  const fullContainer = document.querySelector('.news-list');
  if (!stripContainer && !fullContainer) return;

  let items;
  try {
    const { data, error } = await supabaseClient
      .from('content_items')
      .select('title, url, source, description, published_at')
      .eq('section', 'news')
      .order('published_at', { ascending: false, nullsFirst: false });
    if (error) throw error;
    items = data.map((row) => ({
      title: row.title, link: row.url, source: row.source, description: row.description, pubDate: row.published_at,
    }));
  } catch (err) {
    const errorHTML = '<p class="empty-state">Could not load news.</p>';
    if (stripContainer) stripContainer.innerHTML = errorHTML;
    if (fullContainer) fullContainer.innerHTML = errorHTML;
    return;
  }

  if (stripContainer) {
    renderNewsList(stripContainer, items.slice(0, HOME_NEWS_STRIP_LIMIT), { compact: true });
    enhanceScrollStrip(stripContainer);
  }
  if (fullContainer) renderNewsList(fullContainer, items);
}

initNews();
