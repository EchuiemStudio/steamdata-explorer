// One-time/occasional data pull. Run with: node scripts/fetch-steam-data.js
// Needs Node 18+ (uses the built-in fetch, no npm install required).

const FLOOR_REVIEWS = 15;       // exclude zero-signal noise (test uploads, abandoned pages) — not a sales stand-in; raised from 10 after seeing how thin sub-15-review games looked in practice
const SAMPLE_PER_TIER = 250;    // ~750 games total across hit/mid/niche
const MAX_STEAMSPY_PAGES = 15;  // how deep into SteamSpy's catalog to look for a spread of games (higher = wider spread, slower)
const REQUEST_DELAY_MS = 1200;  // stay polite to Steam's undocumented per-app endpoints
const SAMPLE_REVIEWS_PER_GAME = 5; // review text snippets captured per game, for future keyword analysis
const SAMPLE_REVIEW_MAX_CHARS = 300; // truncate long reviews so the JSON file stays a reasonable size

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function fetchJson(url, { retries = 3 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (attempt === retries) throw new Error(`${url} failed: HTTP ${res.status}`);

    const retryAfterMs = Number(res.headers.get('retry-after')) * 1000;
    const backoffMs = retryAfterMs || 2000 * 2 ** attempt; // 2s, 4s, 8s if no Retry-After header
    await sleep(backoffMs);
  }
}

async function buildCandidatePool() {
  const pool = [];
  for (let page = 0; page < MAX_STEAMSPY_PAGES; page++) {
    console.log(`Fetching SteamSpy page ${page}...`);
    const data = await fetchJson(`https://steamspy.com/api.php?request=all&page=${page}`);
    const entries = Object.values(data ?? {});
    if (entries.length === 0) break;

    for (const e of entries) {
      const reviewTotal = (e.positive || 0) + (e.negative || 0);
      if (reviewTotal >= FLOOR_REVIEWS) {
        pool.push({ appid: e.appid, name: e.name, reviewTotal });
      }
    }
    await sleep(1000);
  }
  return pool;
}

function stratifySample(pool) {
  const sorted = [...pool].sort((a, b) => b.reviewTotal - a.reviewTotal);
  const n = sorted.length;
  const hitCut = Math.floor(n * 0.1);
  const midCut = Math.floor(n * 0.5);

  const tiers = {
    hit: sorted.slice(0, hitCut),
    mid: sorted.slice(hitCut, midCut),
    niche: sorted.slice(midCut),
  };

  const sample = [];
  for (const [tier, candidates] of Object.entries(tiers)) {
    const picked = shuffle(candidates).slice(0, SAMPLE_PER_TIER);
    for (const c of picked) sample.push({ ...c, performance_tier: tier });
  }
  return sample;
}

async function fetchAppDetails(appid) {
  // cc=us pins the response to USD pricing — without it, Steam's region auto-detection
  // can return price_overview in SAR/MYR/VND/etc, and price_usd would silently be wrong
  // (a raw non-USD "final" value divided by 100, with no currency check at all).
  // l=english pins genre/description text — without it, a handful of games came back
  // with genres in Spanish/Ukrainian/Portuguese/etc for no visible reason (observed on
  // Half-Life, Counter-Strike 2, Resident Evil 3), same class of silent-default bug.
  const data = await fetchJson(`https://store.steampowered.com/api/appdetails?appids=${appid}&cc=us&l=english`);
  const entry = data?.[appid];
  if (!entry?.success) return null;
  return entry.data;
}

async function fetchReviewSummary(appid) {
  const data = await fetchJson(`https://store.steampowered.com/appreviews/${appid}?json=1&num_per_page=${SAMPLE_REVIEWS_PER_GAME}&language=english&purchase_type=all&filter=all`);
  return { summary: data?.query_summary ?? null, reviews: data?.reviews ?? [] };
}

async function fetchSteamSpyTags(appid) {
  const data = await fetchJson(`https://steamspy.com/api.php?request=appdetails&appid=${appid}`);
  const tags = data?.tags;
  if (!tags || typeof tags !== 'object') return [];
  return Object.entries(tags)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tagName]) => tagName);
}

async function enrichGame(candidate) {
  const details = await fetchAppDetails(candidate.appid);
  await sleep(REQUEST_DELAY_MS);
  if (!details || details.type !== 'game') return null; // drops DLC/soundtracks/demos/software

  const { summary, reviews } = await fetchReviewSummary(candidate.appid);
  await sleep(REQUEST_DELAY_MS);

  const tags = await fetchSteamSpyTags(candidate.appid);
  await sleep(REQUEST_DELAY_MS);

  const positive = summary?.total_positive ?? 0;
  const negative = summary?.total_negative ?? 0;
  const total = positive + negative;

  const sample_reviews = reviews.map((r) => ({
    text: (r.review || '').slice(0, SAMPLE_REVIEW_MAX_CHARS),
    voted_up: !!r.voted_up,
  })).filter((r) => r.text.length > 0);

  // Belt-and-suspenders: even with cc=us, only trust price_overview if it actually says USD.
  const priceIsUsd = details.is_free || !details.price_overview || details.price_overview.currency === 'USD';
  if (!priceIsUsd) {
    console.log(`  WARNING: ${details.name} returned non-USD currency (${details.price_overview.currency}) despite cc=us — price_usd set to null`);
  }

  return {
    appid: candidate.appid,
    name: details.name,
    genres: (details.genres || []).map((g) => g.description),
    tags,
    release_year: parseInt((details.release_date?.date || '').slice(-4), 10) || null,
    price_usd: details.is_free ? 0 : (priceIsUsd ? (details.price_overview?.final ?? 0) / 100 : null),
    review_score_desc: summary?.review_score_desc ?? 'Unknown',
    review_positive: positive,
    review_negative: negative,
    review_total: total,
    review_score_percent: total > 0 ? Math.round((positive / total) * 1000) / 10 : null,
    performance_tier: candidate.performance_tier,
    header_image: details.header_image,
    sample_reviews,
  };
}

function buildAggregates(games) {
  const genre_counts = {};
  const tier_counts = { hit: 0, mid: 0, niche: 0 };
  const tag_pair_counts = new Map();
  const tier_totals = {
    hit: { score: 0, scoreCount: 0, price: 0, priceCount: 0 },
    mid: { score: 0, scoreCount: 0, price: 0, priceCount: 0 },
    niche: { score: 0, scoreCount: 0, price: 0, priceCount: 0 },
  };

  for (const g of games) {
    for (const genre of g.genres) genre_counts[genre] = (genre_counts[genre] || 0) + 1;
    tier_counts[g.performance_tier]++;

    const t = tier_totals[g.performance_tier];
    if (g.review_score_percent != null) { t.score += g.review_score_percent; t.scoreCount++; }
    if (g.price_usd != null) { t.price += g.price_usd; t.priceCount++; }

    for (let i = 0; i < g.tags.length; i++) {
      for (let j = i + 1; j < g.tags.length; j++) {
        const key = [g.tags[i], g.tags[j]].sort().join('|');
        tag_pair_counts.set(key, (tag_pair_counts.get(key) || 0) + 1);
      }
    }
  }

  const tag_cooccurrence = [...tag_pair_counts.entries()]
    .map(([key, count]) => {
      const [tag_a, tag_b] = key.split('|');
      return { tag_a, tag_b, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  const tier_stats = {};
  for (const [tier, t] of Object.entries(tier_totals)) {
    tier_stats[tier] = {
      avg_review_score: t.scoreCount ? Math.round((t.score / t.scoreCount) * 10) / 10 : null,
      avg_price: t.priceCount ? Math.round((t.price / t.priceCount) * 100) / 100 : null,
    };
  }

  return { total_games: games.length, genre_counts, tier_counts, tag_cooccurrence, tier_stats };
}

async function main() {
  console.log('Building candidate pool from SteamSpy...');
  const pool = await buildCandidatePool();
  console.log(`Candidate pool: ${pool.length} games above the ${FLOOR_REVIEWS}-review floor.`);

  const sample = stratifySample(pool);
  console.log(`Sampled ${sample.length} games across hit/mid/niche tiers. Enriching...`);

  const games = [];
  for (const [index, candidate] of sample.entries()) {
    console.log(`(${index + 1}/${sample.length}) ${candidate.name} [${candidate.performance_tier}]`);
    try {
      const enriched = await enrichGame(candidate);
      if (enriched) games.push(enriched);
      else console.log(`  skipped (not a game, or no data)`);
    } catch (err) {
      console.log(`  skipped (${err.message})`);
    }
  }

  const fs = await import('node:fs/promises');
  await fs.writeFile('data/games.json', JSON.stringify(games, null, 2));
  await fs.writeFile('data/aggregates.json', JSON.stringify(buildAggregates(games), null, 2));

  console.log(`Done. Wrote ${games.length} games to data/games.json.`);
}

// Guarded so requiring this file for buildAggregates() (e.g. from a data-migration
// script) doesn't also kick off the full multi-minute SteamSpy sampling pass.
if (require.main === module) {
  main().catch((err) => {
    console.error('Fetch failed:', err);
    process.exit(1);
  });
}

module.exports = { buildAggregates };
