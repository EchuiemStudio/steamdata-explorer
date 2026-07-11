// Shared RSS/Atom parsing used by fetch-news.js and the hub content-section scripts
// (fetch-gamedev.js, fetch-engines.js, fetch-ai.js, fetch-art.js). Handles both formats
// because some verified sources are Atom, not RSS (YouTube channel feeds, Unreal Engine's
// official feed) despite several of them being named "rss.xml".

// &amp; is decoded LAST: decoding it first would turn a genuinely double-encoded
// "&amp;lt;" into "&lt;", which the &lt;/&gt;/etc. replacements below it would then
// decode a second time into "<" — over-decoding input that was correctly escaped twice.
function decodeEntities(str) {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lsquo;/g, '‘')
    .replace(/&rsquo;/g, '’')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '…')
    // Generic numeric character references (decimal &#8217; or hex &#x2019;) — covers
    // curly quotes, dashes, and anything else a feed escapes numerically, rather than
    // hardcoding a lookup table for a handful of codes (a prior version did that and
    // missed &#8211;/&#8212; entirely, leaving them as literal visible entity text).
    // Falls back to the original matched text (not a throw) for a code point outside
    // Unicode's valid range, e.g. a malformed &#99999999; — String.fromCodePoint throws
    // on those, which would otherwise take out an entire feed's worth of items for one
    // bad entity in one item.
    .replace(/&#(\d+);/g, (match, code) => {
      const num = Number(code);
      return num >= 0 && num <= 0x10ffff ? String.fromCodePoint(num) : match;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
      const num = parseInt(hex, 16);
      return num >= 0 && num <= 0x10ffff ? String.fromCodePoint(num) : match;
    })
    .replace(/&amp;/g, '&');
}

function extractTag(block, tag) {
  // The (?=[\s>]) lookahead stops `content` from matching the opening of `content:encoded`
  // (or `description` matching `description:foo`) — without it, `[^>]*` after the tag name
  // happily swallows a `:encoded` suffix, matching the wrong tag entirely.
  const m = block.match(new RegExp(`<${tag}(?=[\\s>])[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  if (!m) return null;
  let val = m[1].trim();
  const cdata = val.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  if (cdata) val = cdata[1].trim();
  return decodeEntities(val);
}

// RSS: <link>https://example.com/article</link> (plain text body).
// Atom: <link rel="alternate" href="https://example.com/article"/> (self-closing, no body) —
// prefer rel="alternate" when multiple <link> tags exist in one entry.
function extractLink(block) {
  const linkTags = [...block.matchAll(/<link\b([^>]*)\/?>/g)];
  for (const m of linkTags) {
    const hrefMatch = m[1].match(/href="([^"]*)"/);
    if (!hrefMatch) continue;
    const relMatch = m[1].match(/rel="([^"]*)"/);
    if (!relMatch || relMatch[1] === 'alternate') return decodeEntities(hrefMatch[1]);
  }
  return extractTag(block, 'link');
}

function extractDate(block) {
  return extractTag(block, 'pubDate') || extractTag(block, 'published') || extractTag(block, 'updated');
}

// Full description is stored (up to a generous safety cap, not the ~200 chars needed for
// the inline card) since the frontend now shows the complete text in a popup modal before
// the user decides whether to click through to the full article - the inline card view
// still visually truncates via CSS line-clamp, but on the stored data, not this cutoff.
const DESCRIPTION_MAX_LENGTH = 2000;

function stripHtml(str) {
  return str
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    // Replacing an inline <a>/<em>/etc. tag with a space leaves an orphaned space before
    // whatever punctuation followed it (e.g. "Godot 4.7 . In that time" instead of
    // "Godot 4.7. In that time") - close that gap back up.
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
}

// YouTube video descriptions (the only source using <media:description>, since it's a
// video description, not an article excerpt) commonly wrap a promo blurb in a repeated
// same-emoji delimiter ("🔴 Get my newsletter - https://... 🔴") or a distinct open/close
// emoji pair ("🅰️ Buy the game! - 🅱️"), drop a bare URL with no delimiter at all ("Sign
// up: https://..."), or trail off into a "=== Sources ===" / "=== Chapters ===" style
// section separator with timestamp/link boilerplate after it. None of that tells you
// anything about the actual content, so all of it gets stripped or cut.
function stripPromoNoise(str) {
  return str
    .split(/===/)[0]
    .replace(/(\p{Emoji_Presentation})[^\p{Emoji_Presentation}]*?\1/gu, ' ')
    .replace(/\u{1F170}️?[\s\S]*?\u{1F171}️?/gu, ' ') // 🅰️ ... 🅱️
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    // A promo sentence ending "Check out X -" (no delimiter, just a trailing dash into
    // where a stripped URL used to be) leaves a dangling connector once the URL is gone.
    .replace(/[\s\-:]+$/, '');
}

// Some feeds (Concept Art World's) prefix the description with the site name and/or the
// entry's own title before the real excerpt text ("Concept Art World Brian Huang Brian
// Huang is a cinematic concept artist..."), so an exact title/description equality check
// alone misses it — this strips a leading source-name and/or title echo, repeating until
// neither matches, since either can appear before or after the other.
function stripLeadingEcho(str, ...phrases) {
  let result = str;
  let changed = true;
  while (changed) {
    changed = false;
    for (const phrase of phrases) {
      if (!phrase) continue;
      if (result.toLowerCase().startsWith(phrase.toLowerCase())) {
        result = result.slice(phrase.length).replace(/^[\s:–—-]+/, '');
        changed = true;
      }
    }
  }
  return result.trim();
}

// Backs up to the last space before the cutoff so truncation doesn't slice a word in
// half (e.g. "embroide…" instead of "embroidery…") - still a hard cutoff, just a cleaner
// looking one.
function truncate(str, maxLength) {
  if (str.length <= maxLength) return str;
  const cut = str.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

// Excerpt-shaped tags vary by format: RSS uses <description>, Atom uses <summary> or
// <content>, and YouTube's Atom feed has neither - only <media:description>, which is
// really a video description (can carry promotional links/timestamps), not an article
// excerpt, but still more informative than a bare title. Tried in this priority order
// since a feed only ever needs one; whichever's raw HTML gets stripped to plain text and
// capped so a feed card's excerpt stays skimmable rather than dumping a full article in.
// title/sourceName are passed in so a feed that stuffs the same text into both <title>
// and <description> (Anthropic's news feed, exact match) or prefixes the site name and/or
// title before the real excerpt (Concept Art World, prefix match) doesn't render an echo
// of what the user already just read in the headline/byline.
function extractDescription(block, title, sourceName) {
  const raw = extractTag(block, 'description')
    || extractTag(block, 'summary')
    || extractTag(block, 'content')
    || extractTag(block, 'media:description');
  if (!raw) return null;
  const cleanTitle = title ? stripHtml(title) : null;
  let plain = stripPromoNoise(stripHtml(raw));
  plain = stripLeadingEcho(plain, sourceName, cleanTitle);
  // A description that's entirely a promo link (e.g. "Sign up: https://...") or entirely
  // an echoed title/source name strips down to a useless dangling fragment - below this
  // length it's not worth showing at all, same as if there'd been no description at all.
  if (!plain || plain.length < 20) return null;
  if (cleanTitle && plain.toLowerCase() === cleanTitle.toLowerCase()) return null;
  return truncate(plain, DESCRIPTION_MAX_LENGTH);
}

function parseFeedItems(xml, sourceName, limit) {
  const items = [];
  const entryRegex = /<(item|entry)[^>]*>([\s\S]*?)<\/\1>/g;
  let match;
  while ((match = entryRegex.exec(xml)) && items.length < limit) {
    const block = match[2];
    // stripHtml on title too: some Atom sources (Unreal Engine) wrap their title in a
    // literal <p> tag rather than plain text.
    const title = extractTag(block, 'title');
    const link = extractLink(block);
    const pubDate = extractDate(block);
    const description = extractDescription(block, title, sourceName);
    if (title && link) {
      items.push({ title: stripHtml(title), link, pubDate: pubDate || null, description, source: sourceName });
    }
  }
  return items;
}

module.exports = { parseFeedItems, decodeEntities, extractTag };
