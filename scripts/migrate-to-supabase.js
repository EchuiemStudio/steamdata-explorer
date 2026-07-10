// One-time backfill: copies the existing data/games.json, data/aggregates.json, and
// data/news.json into the Supabase tables created for the hub pivot. Run once by hand:
//   node scripts/migrate-to-supabase.js
// Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (see .env.example). Safe to re-run —
// games/aggregates upsert by primary key, and the news insert clears+reinserts first.

const fs = require('fs');
const { getSupabaseAdmin } = require('./supabase-admin');

const GAMES_BATCH_SIZE = 200; // keep individual upsert payloads modest

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const supabase = getSupabaseAdmin();

  const games = JSON.parse(fs.readFileSync('data/games.json', 'utf8'));
  const aggregates = JSON.parse(fs.readFileSync('data/aggregates.json', 'utf8'));
  const news = JSON.parse(fs.readFileSync('data/news.json', 'utf8'));

  console.log(`Upserting ${games.length} games in batches of ${GAMES_BATCH_SIZE}...`);
  for (const batch of chunk(games, GAMES_BATCH_SIZE)) {
    const { error } = await supabase.from('games').upsert(batch, { onConflict: 'appid' });
    if (error) throw error;
  }

  console.log('Upserting aggregates...');
  const { error: aggError } = await supabase.from('aggregates').upsert({ id: 1, data: aggregates }, { onConflict: 'id' });
  if (aggError) throw aggError;

  console.log(`Replacing 'news' content_items with ${news.length} items...`);
  const { error: deleteError } = await supabase.from('content_items').delete().eq('section', 'news');
  if (deleteError) throw deleteError;

  const rows = news.map((item) => ({
    section: 'news',
    title: item.title,
    url: item.link,
    source: item.source,
    published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
  }));
  const { error: newsError } = await supabase.from('content_items').insert(rows);
  if (newsError) throw newsError;

  console.log('Done.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
