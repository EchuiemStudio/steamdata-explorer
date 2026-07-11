// Hub Phase 2 section: Game Dev & Design. Pulls design/craft content (not narrative/
// worldbuilding specifically — see hub-sections-plan.md) into the `content_items` table
// (section: 'gamedev'). Run with:
//   node scripts/fetch-gamedev.js
// Needs Node 18+ (built-in fetch).

const { parseFeedItems } = require('./feed-parse');

// GMTK's blog feed (gamemakerstoolkit.com/feed/) was tried and dropped: confirmed live
// but permanently empty — Mark Brown posts to YouTube, not the blog. The YouTube feed
// below already covers that content.
const FEEDS = [
  { name: 'Game Developer', url: 'https://www.gamedeveloper.com/rss.xml' },
  { name: 'GMTK (YouTube)', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCqJ-Xo29CKyLTjn6z2XwYAw' },
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
    throw new Error('No gamedev items fetched from any feed — leaving existing data/gamedev.json untouched.');
  }

  const fs = await import('node:fs/promises');
  await fs.writeFile('data/gamedev.json', JSON.stringify(trimmed, null, 2));
  console.log(`Done. Wrote ${trimmed.length} gamedev items (from ${allItems.length} fetched) to data/gamedev.json.`);

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

  const { error: deleteError } = await supabase.from('content_items').delete().eq('section', 'gamedev');
  if (deleteError) throw deleteError;

  const rows = items.map((item) => ({
    section: 'gamedev',
    title: item.title,
    url: item.link,
    source: item.source,
    published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
  }));
  const { error: insertError } = await supabase.from('content_items').insert(rows);
  if (insertError) throw insertError;
  console.log(`Wrote ${rows.length} gamedev items to Supabase.`);
}

main().catch((err) => {
  console.error('Game Dev fetch failed:', err);
  process.exit(1);
});
