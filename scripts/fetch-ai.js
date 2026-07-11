// Hub Phase 2 section: AI / Claude. Only source is an unofficial, community-maintained
// scrape of Anthropic's newsroom (Anthropic has no official RSS feed) — could go stale or
// disappear without warning, unlike the official engine/game-dev feeds. "Claude tips and
// tricks" has no clean feed source at all (see hub-sections-plan.md) and is intentionally
// not included here. Writes into `content_items` (section: 'ai'). Run with:
//   node scripts/fetch-ai.js
// Needs Node 18+ (built-in fetch).

const { parseFeedItems } = require('./feed-parse');

const FEEDS = [
  { name: 'Anthropic News', url: 'https://raw.githubusercontent.com/taobojlen/anthropic-rss-feed/main/anthropic_news_rss.xml' },
];
const ITEMS_PER_FEED = 15;
const TOTAL_ITEMS = 40;

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
      const items = parseFeedItems(xml, feed.name, ITEMS_PER_FEED);
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

  if (trimmed.length === 0) {
    throw new Error('No ai items fetched from any feed — leaving existing data/ai.json untouched.');
  }

  const fs = await import('node:fs/promises');
  await fs.writeFile('data/ai.json', JSON.stringify(trimmed, null, 2));
  console.log(`Done. Wrote ${trimmed.length} ai items (from ${allItems.length} fetched) to data/ai.json.`);

  await writeToSupabase(trimmed);
}

async function writeToSupabase(items) {
  const { loadEnv } = require('./load-env');
  loadEnv();
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('Skipped Supabase write: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set.');
    return;
  }

  const { getSupabaseAdmin } = require('./supabase-admin');
  const supabase = getSupabaseAdmin();

  const { error: deleteError } = await supabase.from('content_items').delete().eq('section', 'ai');
  if (deleteError) throw deleteError;

  const rows = items.map((item) => ({
    section: 'ai',
    title: item.title,
    url: item.link,
    source: item.source,
    description: item.description,
    published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
  }));
  const { error: insertError } = await supabase.from('content_items').insert(rows);
  if (insertError) throw insertError;
  console.log(`Wrote ${rows.length} ai items to Supabase.`);
}

main().catch((err) => {
  console.error('AI fetch failed:', err);
  process.exit(1);
});
