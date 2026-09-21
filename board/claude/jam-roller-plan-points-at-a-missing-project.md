---
title: Jam Roller plan points at a missing project
status: backlog
state: not-started
worker: claude
review-gate: KC
priority: C
complexity: CP1
estimate: 0.25
due: 2026-09-30
phase: P0 Structure
---
Found by a path audit across all nine projects on 2026-09-21.

`planning/TODO_GAME_RANDOMIZER.md` is a plan to fold the standalone **Jam Roller** project into
this site as a new section. It names its source as `d:\ClaudeProject\GameJamGenerator` — *"a
native-desktop-via-Tauri experiment"*.

**`D:\ClaudeProject` holds nine projects and GameJamGenerator is not one of them.** Line 19 of the
same plan points at `GameJamGenerator/frontend/data.js`, which is also not there; the only
`data.js` in this repo is `scripts/data.js`, and whether that is the same file or an unrelated one
is not something the plan says.

The plan reads as live work either way, which is the problem. Its stated reasoning — *"the Tauri
wrapper added ~3.8GB of Rust build cache for what's really a 48KB static page"* — is a real
argument, so it is worth knowing whether the source still exists before treating the plan as
actionable or as a record of something already done.

Three possibilities and they want different responses: the folder was deleted after the fold-in
happened (then the plan is done, and should say so); it was deleted before (the plan is dead, or
needs the source recovered); or it moved somewhere outside the harness (the path needs correcting).

- [ ] KC: where is `GameJamGenerator`? Deleted, moved, or already folded in
- [ ] Depending on the answer: correct the path, mark the plan done, or mark it dead
- [ ] If it is to be built, resolve whether `scripts/data.js` here is the `frontend/data.js` the plan means
