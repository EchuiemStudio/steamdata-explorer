---
title: Adopt the global project rules
status: review
state: review
worker: claude
review-gate: KC
priority: B
complexity: CP1
estimate: 0.25
due: 2026-09-27
phase: P0 Structure
attempt: 1
---
`board/` and `concepts/` were already scaffolded here and `board.canvas` parses as valid JSON, so
the work was the root and the `CLAUDE.md`.

**Nature slot: the repo root itself.** Rule 1 suggests `Site/` for a website, and it is wrong here
for the same reason it was wrong for skill-map: this is a no-build static site whose pages *are*
the deliverable. `index.html`, `browse.html`, `feed.html`, `news.html`, `opportunity.html` and
`steam-game-data.html` sit at the root with `styles/`, `partials/` and `data/` beside them, loaded
directly by the browser. Moving them under `Site/` would break every relative path in the site for
no gain — there is no build step to re-point. Declared and reasoned in `CLAUDE.md` so the next
session does not re-open it.

**`TODO_GAME_RANDOMIZER.md` moved to `planning/`.** The root holds three files
(`README.md  CLAUDE.md  DECISIONS.md`); this is a plan for folding the standalone Jam Roller
project in as a new section, which is what `planning/` is for. Nothing referenced it by path, so
nothing broke — checked across `.md`, `.html` and `.js` before moving.

**That plan points at a project that is not there.** It names
`d:\ClaudeProject\GameJamGenerator` as the Tauri experiment being folded in. `D:\ClaudeProject`
holds nine projects and GameJamGenerator is not among them. Either it was already deleted, moved,
or it lives somewhere else — the plan reads as current either way, which is the problem.

- [x] Point `CLAUDE.md` at the two global rule files
- [x] Name the nature slot, with the reason it is not `Site/`
- [x] Move `TODO_GAME_RANDOMIZER.md` into `planning/`; confirm nothing referenced it
- [ ] KC: the Jam Roller plan names `d:\ClaudeProject\GameJamGenerator`, which does not exist. Find where it went, or mark the plan dead — it currently reads as live work against a missing folder
- [ ] KC: `board/`, `concepts/`, `planning/` and `scripts/test-gemini.js` are untracked here. They were untracked before this card too; nothing was committed
