# TODO — fold in "Jam Roller" as a new Hub section

> **Correction, KC 2026-09-21.** This plan says Jam Roller is *"currently
> `d:\ClaudeProject\GameJamGenerator`"*. It is not, and it never was part of steamdata-explorer.
> KC: *"gamejamgenerator is not steamdata project. but yes i will make the gamejamgenerator project
> eventually but for ur question, it never in steamdata."*
>
> So this is **a plan for a project that does not exist yet**, not a fold-in of an existing one.
> Nothing below is blocked on recovering a missing folder — there is no missing folder. Treat the
> path references (including `GameJamGenerator/frontend/data.js` further down) as describing a
> future codebase, not a current one.


## Intent
KC wants to fuse the standalone **Jam Roller** project (currently
`d:\ClaudeProject\GameJamGenerator`, a native-desktop-via-Tauri experiment)
into this site instead, as a new category/page — a "game randomize" section
sitting alongside the existing Steam Game Data / Hub pages. Reasoning: the
Tauri wrapper added ~3.8GB of Rust build cache for what's really a 48KB
static page with no framework — this site already hosts multiple static
no-build pages, so it's a better home than a separate desktop app shell.

## What Jam Roller does
A pure-random game jam idea generator. Rolls independent categories
(perspective, main genre, sub genre, mood/theme, constraint, mechanic rule,
anchor object, etc.) and mashes one pick from each into a jam prompt —
deliberately weird/unachievable on purpose, brainstorming fuel not a spec.

## Source to port (read-only reference, don't edit that repo from here)
- `GameJamGenerator/frontend/data.js` — the entire content model. Each
  category is `{ label, hint, slots: [[...words]] }`; roll = one random pick
  per slot, joined. This is the only file meant to grow with more content —
  copy the data structure, not just the current word lists.
- `GameJamGenerator/frontend/app.js` — roll logic: `pick()`, `rollCategory()`,
  `rollAll()`, `rollOne()` (per-category reroll), `toggleLock()` (lock a
  category so reroll skips it), `render()`, `buildBrief()`/`copyBrief()`
  (assembles + clipboard-copies the final prompt).
- `GameJamGenerator/frontend/style.css` / `index.html` — layout reference
  only. **Frontend UI does not need to match** — KC said this explicitly;
  redesign to fit this site's existing design system (`styles/tokens.css`,
  the `--viz-*` custom properties, GSAP/ScrollTrigger reveal conventions in
  `scripts/motion.js`) rather than porting the old CSS.

## Suggested integration shape (for whoever picks this up)
- New standalone page, e.g. `game-randomizer.html`, following the existing
  per-page pattern: shared `partials/nav.html` injection via `scripts/nav.js`,
  `data-page="game-randomizer"` on `<body>`, its own `scripts/game-randomizer.js`
  with an `initGameRandomizerPage()` entry point (matches `initHomePage`/
  `initBrowsePage` naming already used here).
- Add a nav entry — likely under the "Hub" dropdown group in
  `partials/nav.html` alongside gamedev/engines/ai/art, since this is
  generated content/tooling rather than Steam data. Confirm with KC before
  deciding the group placement.
- No backend/data-layer involvement needed — this is pure client-side
  random selection, no `fetch()` of `data/*.json` required. Simplest section
  in the site by far.
- Once ported and confirmed working here, the `GameJamGenerator` Tauri
  project can likely be retired (or kept only if a native/offline use case
  still matters) — that's KC's call, not assumed here.

## Status
Not started. This file is the handoff note; no code has been touched in
either repo yet.
