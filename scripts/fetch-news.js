// One-time/occasional data pull for the Home page's "Latest Gaming News" panel.
// Pulls general gaming news (NOT scoped to games in data/games.json) from a small
// set of publicly available RSS feeds — no API key needed. Run with:
//   node scripts/fetch-news.js
// Needs Node 18+ (built-in fetch). No scheduled refresh — re-run by hand to update.

const FEEDS = [
  { name: 'PC Gamer', url: 'https://www.pcgamer.com/rss/' },
  { name: 'Rock Paper Shotgun', url: 'https://www.rockpapershotgun.com/feed' },
  { name: 'Eurogamer', url: 'https://www.eurogamer.net/feed' },
  { name: 'GameSpot', url: 'https://www.gamespot.com/feeds/mashup/' },
];
const ITEMS_PER_FEED = 15; // cap per-feed so one very active outlet can't crowd out the rest
const TOTAL_ITEMS = 40; // final list size after merging + sorting all feeds by date

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#82(1[6-9]|2[01]);/g, (_, code) => ({ '216': '‘', '217': '’', '220': '“', '221': '”' }[code] || ''));
}

function extractTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  if (!m) return null;
  let val = m[1].trim();
  const cdata = val.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  if (cdata) val = cdata[1].trim();
  return decodeEntities(val);
}

function parseRSSItems(xml, sourceName, limit) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) && items.length < limit) {
    const block = match[1];
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const pubDate = extractTag(block, 'pubDate');
    if (title && link) items.push({ title, link, pubDate: pubDate || null, source: sourceName });
  }
  return items;
}

async function main() {
  const allItems = [];
  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SteamDataExplorer/1.0)' } });
      if (!res.ok) {
        console.log(`  skipped ${feed.name}: HTTP ${res.status}`);
        continue;
      }
      const xml = await res.text();
      const items = parseRSSItems(xml, feed.name, ITEMS_PER_FEED);
      console.log(`${feed.name}: ${items.length} items`);
      allItems.push(...items);
    } catch (err) {
      console.log(`  skipped ${feed.name}: ${err.message}`);
    }
  }

  allItems.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  const trimmed = allItems.slice(0, TOTAL_ITEMS);

  // If every feed failed (e.g. a transient outage during a scheduled run), don't
  // overwrite existing good data with an empty file — leave it untouched and fail loudly.
  if (trimmed.length === 0) {
    throw new Error('No news items fetched from any feed — leaving existing data/news.json untouched.');
  }

  const fs = await import('node:fs/promises');
  await fs.writeFile('data/news.json', JSON.stringify(trimmed, null, 2));
  console.log(`Done. Wrote ${trimmed.length} news items (from ${allItems.length} fetched) to data/news.json.`);

  await writeToSupabase(trimmed);
}

// Dual-write during the hub-pivot migration: data/news.json stays the fallback source
// for one release cycle while the site's read path moves to Supabase. Skips quietly
// when no credentials are configured (e.g. local dev without .env) — but once
// SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are set (as in CI), a write failure throws
// and fails the run, same as a JSON-write failure would.
async function writeToSupabase(items) {
  const { loadEnv } = require('./load-env');
  loadEnv();
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('Skipped Supabase write: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set.');
    return;
  }

  const { getSupabaseAdmin } = require('./supabase-admin');
  const supabase = getSupabaseAdmin();

  const { error: deleteError } = await supabase.from('content_items').delete().eq('section', 'news');
  if (deleteError) throw deleteError;

  const rows = items.map((item) => ({
    section: 'news',
    title: item.title,
    url: item.link,
    source: item.source,
    published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
  }));
  const { error: insertError } = await supabase.from('content_items').insert(rows);
  if (insertError) throw insertError;
  console.log(`Wrote ${rows.length} news items to Supabase.`);
}

main().catch((err) => {
  console.error('News fetch failed:', err);
  process.exit(1);
});
