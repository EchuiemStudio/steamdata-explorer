// One-time data migration, run after the initial fetch-steam-data.js pass:
//   1. Drops games below the (raised) review floor, since the original sampling
//      pass used the old floor of 10.
//   2. Adds release_year_month (a fractional year+month value, e.g. 2019.083 for
//      Feb 2019) so the Opportunity Map's scatter can spread games within a year
//      instead of stacking every game released in the same year at one X position.
// Needs Node 18+ (built-in fetch). Run with: node scripts/backfill-release-month.js

const { buildAggregates } = require('./fetch-steam-data.js');

const REVIEW_FLOOR = 15; // taste-testing signal cutoff — below this, review counts are too thin to be meaningful
const REQUEST_DELAY_MS = 1200; // stay polite to Steam's undocumented per-app endpoint

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url, { retries = 3 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (attempt === retries) throw new Error(`${url} failed: HTTP ${res.status}`);
    const retryAfterMs = Number(res.headers.get('retry-after')) * 1000;
    const backoffMs = retryAfterMs || 2000 * 2 ** attempt;
    await sleep(backoffMs);
  }
}

async function fetchReleaseDateString(appid) {
  // l=english: without it, Steam occasionally returns localized text (observed on
  // genre descriptions for a few games) — belt-and-suspenders here too, since a
  // non-English date format could otherwise silently misparse in new Date(dateStr).
  const data = await fetchJson(`https://store.steampowered.com/api/appdetails?appids=${appid}&cc=us&l=english`);
  const entry = data?.[appid];
  if (!entry?.success) return null;
  return entry.data?.release_date?.date || null;
}

function parseReleaseYearMonth(dateStr, fallbackYear) {
  if (dateStr) {
    const parsed = new Date(dateStr);
    if (!Number.isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = parsed.getMonth(); // 0-11
      return Math.round((year + month / 12) * 1000) / 1000;
    }
  }
  return fallbackYear != null ? fallbackYear : null;
}

async function main() {
  const fs = await import('node:fs/promises');
  const raw = await fs.readFile('data/games.json', 'utf8');
  const allGames = JSON.parse(raw);

  const kept = allGames.filter((g) => g.review_total >= REVIEW_FLOOR);
  console.log(`Dropping ${allGames.length - kept.length} games below the ${REVIEW_FLOOR}-review floor (${kept.length} remain).`);

  let failures = 0;
  for (const [index, game] of kept.entries()) {
    console.log(`(${index + 1}/${kept.length}) ${game.name}`);
    try {
      const dateStr = await fetchReleaseDateString(game.appid);
      game.release_year_month = parseReleaseYearMonth(dateStr, game.release_year);
    } catch (err) {
      failures++;
      console.log(`  release date lookup failed (${err.message}), falling back to year-only`);
      game.release_year_month = game.release_year;
    }
    await sleep(REQUEST_DELAY_MS);
  }

  await fs.writeFile('data/games.json', JSON.stringify(kept, null, 2));
  await fs.writeFile('data/aggregates.json', JSON.stringify(buildAggregates(kept), null, 2));

  console.log(`Done. Wrote ${kept.length} games to data/games.json (${failures} release-date lookups failed and fell back to year-only).`);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
