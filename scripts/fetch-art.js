// Hub Phase 2 section: Art & Design. Weakest-fit section going in — art discovery tends to
// be visual/algorithmic (Pinterest, ArtStation, Instagram), not RSS-friendly. The two
// sources below are real and legitimate but low-volume; expect this section to feel
// thinner than the other three until more sources are added by hand (see
// hub-sections-plan.md). Writes into `content_items` (section: 'art'). Run with:
//   node scripts/fetch-art.js
// Needs Node 18+ (built-in fetch).

const { parseFeedItems } = require('./feed-parse');

const FEEDS = [
  { name: 'Concept Art World', url: 'https://www.conceptartworld.com/feed/' },
  { name: 'Lines and Colors', url: 'https://www.linesandcolors.com/feed/' },
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
    throw new Error('No art items fetched from any feed — leaving existing data/art.json untouched.');
  }

  const fs = await import('node:fs/promises');
  await fs.writeFile('data/art.json', JSON.stringify(trimmed, null, 2));
  console.log(`Done. Wrote ${trimmed.length} art items (from ${allItems.length} fetched) to data/art.json.`);

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

  const { error: deleteError } = await supabase.from('content_items').delete().eq('section', 'art');
  if (deleteError) throw deleteError;

  const rows = items.map((item) => ({
    section: 'art',
    title: item.title,
    url: item.link,
    source: item.source,
    description: item.description,
    published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
  }));
  const { error: insertError } = await supabase.from('content_items').insert(rows);
  if (insertError) throw insertError;
  console.log(`Wrote ${rows.length} art items to Supabase.`);
}

main().catch((err) => {
  console.error('Art fetch failed:', err);
  process.exit(1);
});
