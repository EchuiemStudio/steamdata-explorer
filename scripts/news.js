const HOME_NEWS_STRIP_LIMIT = 12;

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

function renderNewsList(container, items) {
  if (items.length === 0) {
    container.innerHTML = '<p class="empty-state">No news available right now.</p>';
    return;
  }
  container.innerHTML = items.map(newsItemHTML).join('');
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
      .select('title, url, source, published_at')
      .eq('section', 'news')
      .order('published_at', { ascending: false });
    if (error) throw error;
    items = data.map((row) => ({ title: row.title, link: row.url, source: row.source, pubDate: row.published_at }));
  } catch (err) {
    const errorHTML = '<p class="empty-state">Could not load news.</p>';
    if (stripContainer) stripContainer.innerHTML = errorHTML;
    if (fullContainer) fullContainer.innerHTML = errorHTML;
    return;
  }

  if (stripContainer) {
    renderNewsList(stripContainer, items.slice(0, HOME_NEWS_STRIP_LIMIT));
    enhanceScrollStrip(stripContainer);
  }
  if (fullContainer) renderNewsList(fullContainer, items);
}

initNews();
