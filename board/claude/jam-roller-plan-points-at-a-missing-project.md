---
title: Jam Roller plan points at a missing project
status: review
state: review
attempt: 1
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

- [x] KC answered 2026-09-21: it was **never in steamdata**. Not deleted, not moved — the project does not exist yet
- [x] Plan annotated at the top rather than marked dead: the reasoning in it is still wanted, it just describes a future project
- [ ] When GameJamGenerator is actually built, resolve whether `scripts/data.js` here is related to the `frontend/data.js` the plan names

## Answered 2026-09-21 — the premise was wrong, not the path

KC: *"gamejamgenerator is not steamdata project. but yes i will make the gamejamgenerator project
eventually but for ur question, it never in steamdata."*

So this card's framing was off. It read the plan's *"currently `d:\ClaudeProject\GameJamGenerator`"*
as a path that had broken. It never resolved, because the project has not been made yet — the plan
describes something KC intends to build, written as though it already existed.

That matters for what happens next: there is nothing to recover and nothing to mark dead. The plan
is a **future** project's brief that happens to live in this repo's `planning/`, which is also why
folding it into this site is not a settled thing. Annotated at the top of the plan rather than
rewritten, so the intent survives intact.

Open: whether a plan for a project that does not exist yet should live in *this* project's
`planning/` at all, or move out when GameJamGenerator gets its own folder.
