---
closed_iso: 2026-08-12T18:21:04Z
session_ids: [{"a": "claude", "type": "execution", "id": "53cd9cb4-48e2-43ea-816f-fae4c973bc96"}, {"a": "claude", "type": "review", "id": "b41465ba-dc7f-4d9e-b397-1386fad08cc5"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_o5juhhozx219kvqjy5plz0weh_e
title: "Adjust defaults to have links in be 0"
status: closed
deps: []
links: []
created_iso: 2026-08-12T17:36:24Z
status_updated_iso: 2026-08-12T18:21:04Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
---

Adjust default settings so that links in for central notes are 0 instead of 1.

For both the main notes and the pinned notes.

## Resolution

Changed the shipped `linkDepthIn` and `pinnedLinkDepthIn` defaults from `1` to
`0` (incoming/backlink expansion is now opt-in). Bounds are unchanged (0..5).

### What changed

- **`src/engine/SettingsSpec.ts`** — the single source of truth for defaults.
  `globalDepths.linkDepthIn.default` and `globalDepths.pinnedLinkDepthIn.default`
  are now `0`. Comments updated: outgoing still mirrors Obsidian's local graph
  (1 hop); incoming ships at 0 as an opt-in reach. The pinned-equals-active
  invariant still holds (both incoming defaults are `0`), so pinning a note draws
  the same default graph a main note draws.
- **`src/engine/settingsProductDefaults.test.ts`** — the hand-pinned literal
  tripwire baseline. Updated the two incoming defaults to `0` (this is the
  conscious "changing shipped behavior" edit that file exists to force).

Everything else derives from the spec (EngineDefaults, reset plans, accessors),
so no other product code needed touching. `npm test` = 1881 passed; the
structural settings suites (bounds, round-trip, reset-to-default) and the
`VicinityTraversal` "channel split at the shipped defaults" tripwire all stay
green — the incoming change does not disturb the outgoing one-hop equality.

### e2e (submodule `e2e/`)

Three specs relied on incoming reach at the OLD default and were adjusted (the
full suite was run against real Obsidian: 148 passed with only these three red,
then all three re-verified green — 31 passed):

- **`controlsRestart.e2e.ts`** — §1 raised "Links in" from the default to reach
  the depth-2 `rt_in2` chain; now needs TWO bumps (0→2) instead of one.
- **`vicinityGraph.e2e.ts`** and **`pinnedCentralScenario.e2e.ts`** — their
  fixtures deliberately populate the central note's vicinity via INCOMING links
  (folder groups, truncation/orphan badges, thumbnails in vicinityGraph; the
  hub staying visible as a pinned note's backlink in pinnedCentralScenario).
  That coverage is about RENDERING mechanics, independent of the depth value, so
  each `beforeAll` now explicitly raises Links-in (and pinned-Links-in) to `1`
  via `saveGlobalDepths`, restoring the exact prior graph. The default value
  itself is covered by the unit tripwire above and by `settingsResetReview`'s
  reset-to-`EngineDefaults` assertion. All other e2e specs pass unchanged (they
  use only outgoing links or set depths explicitly).

NOTE for the committer: the e2e changes live in the `e2e/` submodule — commit
there BEFORE committing this repo (per CLAUDE.md).

### Not-yet-published note

Per the repo's "clean breaks on stored data" rule, no migration: a user who had
the old default stored keeps their stored value; a fresh install gets incoming 0.
## Notes

**2026-08-12T18:23:13Z**

__READY_AS_IS__: Focused default flip (linkDepthIn/pinnedLinkDepthIn 1→0) derived from single spec source; check + 1881 unit tests pass, e2e adapted/committed in submodule, no doc drift.
