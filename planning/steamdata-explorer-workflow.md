---
type: project-workflow
status: raw
linked-projects: []
---

# SteamData Explorer — Workflow

> [!abstract] Start Here
> A small, cheap, static website that turns public Steam game data (genres, tags, reviews, price) into browsable data-graphs. Contrast project to [[Projects/true-self-platform/true-self-platform-workflow-v2|true-self-platform]]: no accounts, no database, no backend, no ongoing cost. The point right now is the **build itself** — practicing layout, UI/UX, and navigation design — not the data content, which starts small (~50 games) on purpose.
>
> **Code repo lives at `D:\ClaudeProject\steamdata-explorer`** (outside this vault — this note is planning/docs only).

> [!warning] Pivot in progress — Phase 1 done (2026-07-10), Phase 2 planned
> The site is being repurposed into a personal multi-section "information hub" (Steam data becomes just one section) — this now contradicts the "no database, no backend" line above on purpose. **Phase 1 (Supabase data layer) is built and verified**: games/aggregates/news moved from static JSON to a real Supabase project, RLS-protected, dual-writing with JSON as fallback, GitHub Actions automation confirmed working end-to-end. **Phase 2 (new content sections — game dev, engines, AI/Claude, art)** is planned in detail in [[Projects/steamdata-explorer/hub-sections-plan]], not yet built. Read the "Pivot discussion" section at the bottom for the original decision history, then jump to that linked note for current/active planning.

> [!note] No Roles/Pipelines loop
> Unlike `true-self-platform`, this project does not run the [[Pipelines/universal-loop|universal loop]] or use the [[Roles/_roles-index|Role library]] roles. It's a two-tool solo build — see the task split below — not a multi-agent pipeline.

---

## Tooling split

> [!warning] Gemini unavailable for now (readiness check, 2026-07-06)
> Antigravity is installed but its usage allowance for this cycle is exhausted — not back until roughly a month out (~2026-08). **Claude is doing the first data-fetch pass instead of waiting.** Once Gemini's quota resets, it can take over later data-fetch reruns (e.g. the Phase 5 scale-up) — the script itself doesn't care which tool runs it.

| Task | Tool | Notes |
|---|---|---|
| Data-fetch automation (Node script: pull SteamSpy bulk data, filter, sample, enrich, write JSON) | **Claude Code (for now)** — Gemini (Antigravity) once quota resets | User's original call was Gemini for this half; readiness check found Antigravity's usage allowance is used up until ~2026-08, so Claude builds/runs the fetch script for the prototype pass. Gemini's standing vault scope (per [[Projects/multi-agent-coordination/vault-rulebook]]) is read-only vault-wide + read/write in `Knowledge/` and its own `.agents/` — it does **not** have standing write access to `Projects/`; this remains a one-off exception when Gemini does pick this back up, not a scope change. |
| Website build (HTML/CSS/JS, charts, visual design) | **Claude Code** | Primary build tool for everything under the site itself. |

---

## Data acquisition (Gemini's task)

Steam's APIs don't send browser-permission (CORS) headers, so the live site can never call Steam directly from client JS — this is a browser rule, not a Steam-specific block, and there's no free way around it without running a server (which this project avoids). So data flows in two steps: a Node script fetches everything once and writes static JSON; the website only ever reads its own local JSON files, never talks to Steam.

**Prototype scale (build this first): ~50 games.**

1. Pull SteamSpy's bulk `request=all` pages → compute `review_total = positive + negative` per candidate.
2. Drop anything below **≥10 total reviews** (excludes zero-signal noise — not a stand-in for a real sales number; Steam has no free API for actual sales/download counts, so the site never shows a fabricated "estimated owners/sold" figure, only real review count + review score).
3. Sample ~50 games total, roughly 15-20 each from hit / mid / niche review-count tiers, loosely varied by genre. No full per-genre stratification yet — that's a later-scale step, not needed while the design direction is still unsettled.
4. Enrich the sampled set only (throttled ~1 req/1.5s): Store `appdetails` (genre/type/price, filters out non-games/DLC), Steam's own review summary, SteamSpy per-app tags.
5. Output: `data/games.json` (flat per-game array) + `data/aggregates.json` (precomputed genre counts, tag co-occurrence, tier stats — so the site's chart code only plots numbers, never computes them).

No scheduled refresh — re-running the script by hand is the only way data updates. Scaling to the fuller ~150-250 game stratified sample discussed originally is a later, optional step (same schema, bigger pull) once the design is worth feeding more content.

---

## Site build (Claude's task)

- **Pages**: `index.html` (overview/stat tiles/entry points), `genre.html`, `tags.html`, plus `charts/` views — genre distribution, review-score vs. price scatter, tag co-occurrence, hit/mid/niche tier comparison.
- **Shared nav**: single `partials/nav.html` injected via `scripts/nav.js` on every page. Local testing needs a trivial static server (VS Code "Live Server" or `npx serve`) — `file://` pages hit CORS on local partial fetches too.
- **Styling**: hand-written CSS (`styles/tokens.css` + `styles/main.css`) — deliberately not Tailwind/Bootstrap, since pre-decided utility styles would undercut the actual design-practice point of this project.
- **Charts**: Chart.js (not D3) — declarative, beginner-appropriate, avoids fighting an imperative API instead of doing the actual design work. Tag co-occurrence uses `chartjs-chart-matrix` or a hand-rolled CSS-grid heatmap.
- Invoke the `dataviz` skill before any chart/color work.

**Hosting**: GitHub Pages (free, no build step, matches existing git workflow).

---

## Reference: chart inspiration (2026-07-06)

User found [["I Scraped the Entire Steam Catalog, Here's the Data"|Knowledge/99_Dump/Summarized/I Scraped the Entire Steam Catalog, Here's the Data]] (YouTube, NewbieIndieGameDev, 2024-12-08) — not a catalog-recreation goal (Steam already has a catalog), but the specific chart types and interactions are the direct model for Phase 3:

- **Genre/theme opportunity bubble scatter** — x axis: games in either of a genre pair, y axis: games in both (co-occurrence) — hover shows the game, click drills into the intersection. The standout feature for the user (a game dev): spotting underexplored genre combos for forecasting.
- **Toggle between genre↔genre and genre↔theme** comparisons.
- **Per-genre drill-down statistics.**
- **Trend-over-time line charts** (e.g., "% of games tagged X per year") — video shows roguelike-deckbuilder rise, female-protagonist proportion, 2D vs 3D shift over years.
- **Best/worst bar charts** (top "Overwhelmingly Positive" by review count, bottom "Overwhelmingly Negative").
- **Rating-vs-popularity log-scale scatter** with labeled standout points (video's "top 20 roguelike deckbuilders" chart).

> [!decision] Scope decision (2026-07-06, logged in Decisions/2026-07-06.md)
> Build the interactive chart UI/UX now on the existing 51-game prototype dataset — accept that data-hungry charts (opportunity matrix, trend lines) will look sparse until the dataset scales. Don't pull the Phase 5 scale-up forward first. This matches the project's original design-practice framing above.

---

## Phases

| Phase | Work | Who |
|---|---|---|
| 0 | Human setup: GitHub repo, folder skeleton (`charts/`, `styles/`, `scripts/`, `data/`, `partials/`) | User |
| 1 | Data pipeline: fetch → filter → ~50-game sample → enrich → JSON, spot-check a few entries | Claude (Gemini unavailable until ~2026-08) |
| 2 | Site skeleton: shared nav, base template, Overview + Browse pages, plain-JS filtering — every page reachable, no dead links | Claude |
| 3 | Chart views (`dataviz` skill) + visual-design pass: typography, color tokens, spacing, hover/focus states | Claude |
| 4 | Polish/UX review: click-through as first-time visitor, mobile check, accessibility pass, short design retro | Claude + User |
| 5 (later) | Scale data to full stratified sample; consider what "market-ready" needs (about page, favicon, meta tags) | Gemini + Claude |

**Done with a phase? → trigger the next one, or hand off to whichever tool owns it.**

---

## Phase 5+ direction, clarified (2026-07-07)

User's actual end goal: eventually pull the **whole Steam catalog**, then switch to **maintenance mode** — no re-sampling. Confirmed the current site architecture doesn't lock in the 51-game number: the site's HTML/CSS/JS reads whatever's in `data/games.json` / `data/aggregates.json` generically; `51` only exists as `SAMPLE_PER_TIER` in the fetch script. Scaling up is additive engineering, not a rewrite. Real work still needed when that day comes:

1. **Full app list**: use Steam's official `ISteamApps/GetAppList` endpoint (returns every appid in one call) instead of SteamSpy's `request=all` pagination, which has a practical depth ceiling.
2. **First full pass takes real wall-clock time**: ~3.6s/game enrichment × ~140k games ≈ the video creator's own ~150 hours — a chunked background job across many runs, not one sitting.
3. **"Maintenance" is two separate jobs, not a daily full re-pull**: (a) check the app list occasionally for new appids and enrich just those, (b) refresh existing games' stats on a rotation (e.g. 1/30th of the catalog/day) rather than hammering everything daily.
4. **Client-side payload stops being fine at full scale**: shipping a 140k-entry flat JSON array to every visitor's browser needs splitting into chunks or a lightweight index — not the current flat-array approach.

Also clarified: a naive "run the fetch script daily" does **not** give "the same games, freshened" — `stratifySample()` re-rolls a fresh random 51 every run via `shuffle()`. A real daily-refresh feature needs the script split into two modes: sampling (rare/deliberate) vs. refreshing stats for the *current fixed* sample (cheap, safe to automate). Not built yet — flagged for user decision, not built autonomously, since it touches CI/CD (a GitHub Actions cron workflow starts running the moment it's pushed, no separate "enable" step).

---

## Pivot discussion: personal information hub (2026-07-09, paused mid-thread — continue here)

> [!info] Status: discussion only, nothing built. User went into work mid-conversation and asked to markdown it for later. Also logged in `Decisions/2026-07-09.md`.

**The idea:** stop treating this site as just a Steam-game dashboard. Repurpose it into KC's personal, browsable **information hub** — game research, gaming news (already exists via `news.html`/`fetch-news.js`), worldbuilding research, and general "what's trending" info, all in one site he can scroll through. Homepage becomes a **summary + portal to sections**, not the dashboard itself. The existing Steam data/charts/filters stay as one section long-term, not the whole site.

**Explicit distinction from [[Projects/steamdata-explorer/steamdata-explorer-workflow|Mastermind]] itself (user's own words):**
> "mastermind is more towards what i do, is more data that relate to what and how to do things, and this hub is grabbing information randomly across the net and try to make it a research hub, not teaching me what or how, but show me whats trending whats info i need to know. mastermind is knowledge, this hub is information. mastermind can link to the hub, but the hub shouldn't go into mastermind, it will ruin decision making if float with random info."

So: Mastermind = curated knowledge (how/what to do). This hub = raw information (radar of what's out there). Link direction is one-way — Mastermind notes may link out to hub content, but hub content must never get absorbed into Mastermind, since unfiltered info floating into the knowledge vault would corrupt decision-making there.

**Decisions already made (both marked Recommended, both accepted):**
- **Ingestion:** automated scheduled pulls, same pattern as the existing `fetch-news.js` + GitHub Actions cron — not manual curation. He wants to browse what's trending, not spend time curating.
- **Data layer:** move off static `data/*.json` files onto **Supabase** (already connected as an MCP tool in his Claude Code setup) — a fixed-schema games table doesn't extend to heterogeneous, growing, cross-section content the way a real DB does.
- **Steam dashboard's fate:** stays as-is, becomes one section among several once the hub structure exists. Not being ripped out.

**Open flag raised, not yet resolved:** automated cron-style pulls make sense for feed-shaped content (gaming news, general trending info) but not obviously for "worldbuilding research" — that's usually something you go looking for on purpose, not something that shows up in a feed. That section likely needs a different ingestion path (on-demand fetch/summarize when he drops in a link or query) rather than a scheduled pull like news has. Needs a decision before building that section.

**Not yet discussed / next steps when this resumes:**
- Concrete section list beyond the four named (game research, news, worldbuilding, general trending) — is that the full v1 list or a starting sketch?
- Supabase schema for a generic content-entry model (type, tags, source, body, fetched_at, etc.) vs. per-section tables.
- Whether to migrate the existing Steam data into Supabase first (narrowest slice: prove the new data layer on data that already exists) before adding any new section.
- Homepage/portal layout — how "summary of things" actually renders (latest-per-section feed? stat tiles? something else).
- Whether the Brass & Graphite visual theme ([[project_visual-identity]] in Claude's own memory, not in this vault) carries forward as-is to the new homepage/section-portal structure.
