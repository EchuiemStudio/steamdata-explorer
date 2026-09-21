---
type: project-plan
status: draft
linked-projects: ["Projects/steamdata-explorer/steamdata-explorer-workflow"]
---

# Hub Sections Plan — Game Dev, Engines, AI/Claude, Art & Design

> [!abstract] Start here
> Phase 1 of the hub pivot (moving the data layer from static JSON to Supabase) is **done and verified** — see [[Projects/steamdata-explorer/steamdata-explorer-workflow|the main workflow note]] for that history. This note plans **Phase 2: new content sections**, brainstormed 2026-07-10.

---

## The "why" (carried over from the brainstorm)

This hub is explicitly **not** Mastermind. Mastermind's Knowledge Vault already has domains for most of what got proposed here — `AI`, `Game-Design`, `Psychology`, `Unreal-Engine`, `Other-Engines` — via the [[Projects/knowledge-vault-loop|Knowledge Vault Curation Loop]] (`skill-vault-gather` → `summarize` → `review`). So why build overlapping sections in the hub too?

User's own answer: **different layer, same topics, on purpose.**
> "what inside my vault is quality, i grab it into it. and for hub is all random things. if i found useful i will drag to vault. thats a way to use it. thats why it overlap."

- **Vault** = slow, curated, AI-assisted summarization — the ~20% worth keeping forever.
- **Hub** = fast, high-volume, unfiltered raw feed — skim-and-move-on, manually promoted to Vault if something's actually good.
- **Cost constraint, stated explicitly:** hub ingestion must stay cheap — plain RSS/API pulls like the existing `fetch-news.js`, not AI-driven search/summarization per item. Claude's own deep-research-style tools cost real tokens per query; a scripted RSS pull is close to free and can run daily without a second thought.

---

## Architecture — reuses what Phase 1 already built

No new migration needed. The `content_items` table (from Phase 1's hybrid schema) was deliberately built generic — `section` + `title` + `url` + `source` + `published_at` — specifically so a new feed-shaped section doesn't need new tables. Adding a section is: one new fetch script + one row of config, following the exact shape of `scripts/fetch-news.js` → `refresh-news.yml`.

**Generic feed page, not 4 new HTML files.** Rather than `gamedev.html`, `engines.html`, `ai.html`, `art.html` as separate pages (4x duplicated markup/JS for what's structurally the same list-of-links view that `news.html` already renders), prototype phase should extend the existing news pattern into one generic `feed.html?section=<name>` page — `scripts/news.js`'s `initNews()` logic already does 90% of this, it just needs the `section` filter to come from the URL instead of being hardcoded to `'news'`. Nav/branding per section is a "complete phase" concern, not a prototype blocker.

---

## Sections

### 1. Game Dev & Design
*Worldbuilding, "how to make a good game," design breakdowns.*

**Verified sources (checked live 2026-07-10, all returned real RSS/Atom XML):**
- `https://www.gamedeveloper.com/rss.xml` — Game Developer (formerly Gamasutra), industry-wide
- `https://gamemakerstoolkit.com/feed/` — GMTK blog/digest (Mark Brown)
- `https://www.youtube.com/feeds/videos.xml?channel_id=UCqJ-Xo29CKyLTjn6z2XwYAw` — GMTK YouTube channel (native RSS, no scraping needed)

**Note:** the earlier 2026-07-09 pivot discussion flagged that "worldbuilding research" specifically felt more like something you go looking for on purpose than something that shows up in a feed. The sources above are real and feed-shaped, but they skew toward *design/craft* content, not narrative/worldbuilding specifically — if that distinction matters to you, it's worth a follow-up pass narrower than "Game Dev & Design" broadly.

### 2. Engine Research (UE + Godot)

**Verified sources:**
- `https://www.unrealengine.com/en-US/rss.xml` — official Epic feed (Atom)
- `https://godotengine.org/rss.xml` — official Godot Engine blog feed

Cleanest section of the four — both are first-party, official, and confirmed live.

### 3. AI / Claude
*Tech info generally, Claude news + tips/tricks specifically.*

**Verified source:**
- `https://raw.githubusercontent.com/taobojlen/anthropic-rss-feed/main/anthropic_news_rss.xml` — unofficial, community-maintained scrape of Anthropic's newsroom (confirmed live and valid, last updated late June 2026 per the repo)

**Caveat, stated plainly:** Anthropic has no official RSS feed. This source is a third-party GitHub project — it could go stale or disappear without warning, unlike the official engine/game-dev feeds above. "Claude tips and tricks" specifically has no clean feed at all (it lives scattered across Reddit threads, Twitter, YouTube) — prototype should ship with just the news feed and treat tips/tricks as an open problem, not fake a source for it.

### 4. Art & Design

**Verified sources:**
- `https://www.conceptartworld.com/feed/` — Concept Art World
- `https://www.linesandcolors.com/feed/` — Lines and Colors (painting/illustration/concept art)

**Caveat:** this was already flagged as the weakest fit going in — art discovery tends to be visual/algorithmic (Pinterest, ArtStation, Instagram), not RSS-friendly. The two sources above are real and legitimate, but this section will likely feel thinner than the other three until you (or a later pass) add more curated sources by hand — similar to how Mastermind's own `Knowledge/99_Dump/_sources.md` is a user-curated list, not something Claude invents on its own.

---

## Build plan — prototype all 4, then complete all 4

### Phase A — Prototype (per section, all 4 before moving to Phase B)
1. `scripts/fetch-<section>.js` — copy `fetch-news.js`'s structure exactly (RSS parse, cap per feed, sort/trim, write), swap in that section's verified feed URLs and `section: '<name>'` value.
2. Run once by hand, insert into `content_items` via the same `supabase-admin.js` client already built in Phase 1 — no new Supabase code needed, just a new script that reuses it.
3. Extend `feed.html`/`scripts/feed.js` (new, generic) to read `?section=` from the URL and list whatever's in `content_items` for it — reuses `news.js`'s render logic almost as-is.
4. Spot-check: does the content that shows up actually look useful, or does a source need swapping before investing further? (This is the point of prototyping cheaply first.)

### Phase B — Complete (per section, after all 4 prototypes are validated)
1. Scheduled GitHub Action per section (or one combined workflow, multiple steps) — same cron pattern as `refresh-news.yml`, **remember the Node 22 fix** from Phase 1 (supabase-js needs it).
2. Real nav entry + page identity (not just a shared generic template) — ties into the homepage portal restructure that was already deferred from Phase 1.
3. Expand each section's source list — decide then whether that's Claude proposing more candidates (verified the same way as this note did) or a user-maintained list like Mastermind's `_sources.md`.
4. Revisit the Game Dev/worldbuilding narrowness flag and the Claude tips/tricks gap once there's real usage data on whether they matter.

---

## On "eventually only Claude working, weekdays"

Worth naming directly: **the mechanism for this already exists and is proven** — `refresh-news.yml` runs daily, unattended, no reply needed from you, and Phase 1 just confirmed it works end-to-end (including finding and fixing a real Node-version bug without you in the loop). Extending the same GitHub Actions cron pattern to these 4 new sections *is* "Claude does the work while you're busy" — no new automation framework required for the ingestion side.

Where it gets more interesting is if you eventually want Claude to also autonomously pick up **build/decision work** (not just scripted data pulls) without you replying — that's a different shape (agentic, needs judgment calls) and would fit tools like `/schedule` (cron-triggered Claude Code runs) or the `skill-workflow-engineering` skill (defines roles/thresholds/abandonment conditions for a self-iterating loop). Not needed yet — flagging it as the natural next question once the 4 sections are live and you're deciding what "maintenance" looks like long-term.

---

## Open decisions — resolved 2026-07-11

- **Section list:** all 4 confirmed as v1, no cuts or additions. Game Dev/worldbuilding narrowness and Art & Design thinness stay as known flags to revisit later, not blockers now.
- **CI structure:** one combined workflow (`refresh-hub-content.yml`) running all 4 fetch scripts as steps, same cron, Node 22 runtime (per Phase 1's fix). Not 4 separate files.
- **Prototype validation:** eyeball the live `feed.html?section=<name>` page per section after its first manual run — no structured rubric, matches the hub's own "cheap and fast" spirit.

## Phase A — built and verified 2026-07-11

All 4 sections prototyped end-to-end: `scripts/fetch-{gamedev,engines,ai,art}.js` (built on a new shared `scripts/feed-parse.js` that handles both RSS `<item>` and Atom `<entry>` — needed because the YouTube and Unreal Engine feeds are Atom despite being named `rss.xml`; `fetch-news.js` was refactored to use the same shared parser, behavior-verified unchanged). Generic `feed.html` + `scripts/feed.js` render any section via `?section=<name>`, reusing `news.js`'s render/query pattern. Combined `refresh-hub-content.yml` workflow added (07:00 UTC daily, offset from news' 06:00, Node 22, same cron shape as `refresh-news.yml`).

All 4 fetch scripts run once by hand and verified writing to Supabase `content_items`; the exact anon-key query `feed.js` uses was independently checked against all 4 new sections plus `news` — data returns correctly shaped for every one. Validation was data-path-only (no browser tool in that session) — **still need to eyeball `feed.html?section=<name>` in an actual browser** before calling Phase A validated per the "eyeball the live feed page" bar decided on.

**Content-quality signal from the live pull (useful going into that eyeball pass):**
- **Engines** — clean as expected, official Godot/Unreal items, no issues.
- **Game Dev & Design** — GMTK's blog RSS (`gamemakerstoolkit.com/feed/`) came back with **zero items**, not a bug — the feed itself is empty (Mark Brown posts to YouTube, not the blog). The YouTube channel feed covers the actual content; the blog source may be worth dropping as dead weight later.
- **AI/Claude** — 11 items, feed genuinely live and current (most recent items were from within the same week).
- **Art & Design** — confirms the plan's own "weakest fit" flag: Concept Art World has a real ~2.5 month gap between two consecutive posts in the pulled window. Thin, as predicted.

**Not done yet (Phase B, deferred per the plan):** no nav links or per-section page identity yet — `feed.html` is unbranded/unlinked from the rest of the site, reachable only by direct URL. That's intentional per the original plan ("not a prototype blocker"), not an oversight.
