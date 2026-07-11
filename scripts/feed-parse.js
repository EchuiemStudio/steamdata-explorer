// Shared RSS/Atom parsing used by fetch-news.js and the hub content-section scripts
// (fetch-gamedev.js, fetch-engines.js, fetch-ai.js, fetch-art.js). Handles both formats
// because some verified sources are Atom, not RSS (YouTube channel feeds, Unreal Engine's
// official feed) despite several of them being named "rss.xml".

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

function parseFeedItems(xml, sourceName, limit) {
  const items = [];
  const entryRegex = /<(item|entry)[^>]*>([\s\S]*?)<\/\1>/g;
  let match;
  while ((match = entryRegex.exec(xml)) && items.length < limit) {
    const block = match[2];
    const title = extractTag(block, 'title');
    const link = extractLink(block);
    const pubDate = extractDate(block);
    if (title && link) items.push({ title, link, pubDate: pubDate || null, source: sourceName });
  }
  return items;
}

module.exports = { parseFeedItems, decodeEntities, extractTag };
