// Generic hub content feed page — one HTML file instead of 4, per hub-sections-plan.md.
// Section identity (title/description) is looked up from ?section=<name> in the URL;
// item rendering/query logic is copied from news.js's initNews() (news.html is section
// 'news' rendered as its own dedicated page, this covers the other 4 sections).

const FEED_SECTIONS = {
  gamedev: {
    title: 'Game Dev & Design',
    description: 'Design and craft content from around the web — not narrative/worldbuilding specifically. Refreshed on a schedule, not curated.',
  },
  engines: {
    title: 'Engine Research',
    description: 'Official Unreal Engine and Godot feeds. Refreshed on a schedule, not curated.',
  },
  ai: {
    title: 'AI / Claude',
    description: 'Anthropic news via an unofficial community-maintained feed. Refreshed on a schedule, not curated.',
  },
  art: {
    title: 'Art & Design',
    description: 'Concept art and illustration blogs. A thinner feed than the others — art discovery skews visual, not RSS-friendly. Refreshed on a schedule, not curated.',
  },
};

function feedItemHTML(item) {
  const dateStr = item.pubDate ? new Date(item.pubDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
  return `
    <a class="news-item" href="${escapeHTML(item.link)}" target="_blank" rel="noopener noreferrer">
      <div class="news-item__title">${escapeHTML(item.title)}</div>
      <div class="news-item__meta">${escapeHTML(item.source)}${dateStr ? ` &middot; ${dateStr}` : ''}</div>
    </a>
  `;
}

async function initFeedPage() {
  const container = document.querySelector('.news-list');
  const titleEl = document.querySelector('[data-feed-title]');
  const descEl = document.querySelector('[data-feed-description]');
  if (!container) return;

  const section = new URLSearchParams(window.location.search).get('section');
  const meta = FEED_SECTIONS[section];

  if (!meta) {
    if (titleEl) titleEl.textContent = 'Unknown feed';
    if (descEl) descEl.textContent = `No such section "${escapeHTML(section || '')}". Valid sections: ${Object.keys(FEED_SECTIONS).join(', ')}.`;
    container.innerHTML = '<p class="empty-state">Nothing to show.</p>';
    return;
  }

  document.title = `SteamData Explorer — ${meta.title}`;
  if (titleEl) titleEl.textContent = meta.title;
  if (descEl) descEl.textContent = meta.description;

  try {
    const { data, error } = await supabaseClient
      .from('content_items')
      .select('title, url, source, published_at')
      .eq('section', section)
      .order('published_at', { ascending: false });
    if (error) throw error;

    const items = data.map((row) => ({ title: row.title, link: row.url, source: row.source, pubDate: row.published_at }));
    container.innerHTML = items.length
      ? items.map(feedItemHTML).join('')
      : '<p class="empty-state">No items available right now.</p>';
  } catch (err) {
    container.innerHTML = '<p class="empty-state">Could not load this feed.</p>';
  }
}

initFeedPage();
