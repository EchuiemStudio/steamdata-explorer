// Mirrors the --viz-*/--color-* tokens in styles/tokens.css — Chart.js can't read CSS
// custom properties directly, so these stay in sync manually. Keep both in sync if
// the dark-theme palette ever changes.
const VIZ_PRIMARY = '#d9a441';
const VIZ_PRIMARY_100 = '#3d2f14'; // dark brass — bar border, gives each bar a defined edge
const VIZ_PRIMARY_400 = '#e8c77a'; // bright brass — hover state
const VIZ_DIVERGING_NEGATIVE = '#c9754a'; // copper pole, pairs with VIZ_PRIMARY as the brass pole
const VIZ_GRID = '#332b22';
const VIZ_MUTED = '#a69c8e';
const VIZ_TEXT = '#f5f0e8';
const VIZ_SURFACE = '#221d18';

const OPPORTUNITY_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// release_year_month is a fractional value (e.g. 2019.083 for Feb 2019) so games
// spread out within a year instead of stacking at one X position per year.
function formatReleaseYearMonth(value) {
  const year = Math.floor(value);
  const month = Math.min(11, Math.max(0, Math.round((value - year) * 12)));
  return `${OPPORTUNITY_MONTH_NAMES[month]} ${year}`;
}

// A live Supabase query round-trips in ~600ms regardless of payload size (mostly network
// latency, not transfer time) versus the ~0ms a same-origin static file used to cost before
// the Hub Pivot moved data off static JSON. Game/aggregate data only changes when the daily
// fetch scripts run, so a short client-side cache absorbs that cost for repeat page loads
// within the same browser without reintroducing staleness beyond the TTL window.
const DATA_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function readDataCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, savedAt } = JSON.parse(raw);
    if (Date.now() - savedAt > DATA_CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null; // corrupt entry, private-browsing localStorage restrictions, etc — just refetch
  }
}

function writeDataCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    // localStorage full/unavailable — caching is an optimization, not a requirement
  }
}

async function loadGames() {
  const cached = readDataCache('cache:games');
  if (cached) return cached;
  const { data, error } = await supabaseClient.from('games').select('*');
  if (error) throw error;
  writeDataCache('cache:games', data);
  return data;
}

async function loadAggregates() {
  const cached = readDataCache('cache:aggregates');
  if (cached) return cached;
  const { data, error } = await supabaseClient.from('aggregates').select('data').eq('id', 1).single();
  if (error) throw error;
  writeDataCache('cache:aggregates', data.data);
  return data.data;
}

// Delays fn until `wait` ms after the last call — used for the Browse page's name-search
// input so every keystroke doesn't trigger a full filter + grid re-render.
function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

function showLoadError(container) {
  if (container) {
    container.innerHTML = '<p class="empty-state">Could not load game data. Try refreshing the page.</p>';
  }
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML.replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function steamStoreURL(appid) {
  return `https://store.steampowered.com/app/${appid}/`;
}

function formatPrice(price) {
  if (price == null) return '—';
  return price === 0 ? 'Free' : `$${price.toFixed(2)}`;
}

// Standard English function words (articles/pronouns/prepositions/auxiliary verbs) — not
// sentiment words like "good"/"worst", which are exactly the useful signal review-keyword
// analysis is meant to surface, not noise to filter out.
const REVIEW_STOPWORDS = new Set([
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their',
  'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are',
  'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an',
  'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about',
  'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up',
  'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
  'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'not',
  'only', 'own', 'same', 'than', 'too', 'very', 'can', 'will', 'just', 'now', 'also', 'game', 'games', 'play',
  'playing', 'played', 'really', 'actually', 'much', 'many', 'get', 'got', 'one', 'would', 'could', 'even',
  'still', 'yet', 'use', 'used', 'using', 'like', 'dont', 'didn', 'doesn', 'isn', 'wasn', 'youre',
]);
const REVIEW_WORD_MIN_LENGTH = 4;

function extractReviewWords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= REVIEW_WORD_MIN_LENGTH && !REVIEW_STOPWORDS.has(w));
}

// Per-game version of the same word analysis — a single game only has up to 5 sample
// reviews, too few to compute a meaningful positive-rate-vs-negative-rate skew the way
// the aggregate chart does, so this just returns the most-repeated words within
// whichever reviews matched votedUp, tolerant of games with few or zero of either.
function topReviewWords(sampleReviews, votedUp, limit = 2) {
  if (!Array.isArray(sampleReviews)) return []; // tolerate a null/missing field rather than throwing mid-render
  const counts = {};
  for (const review of sampleReviews) {
    if (review.voted_up !== votedUp) continue;
    for (const w of new Set(extractReviewWords(review.text))) counts[w] = (counts[w] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([w]) => w);
}
