---
closed_iso: 2026-08-15T01:26:00Z
session_ids: [{"a": "claude", "type": "execution", "id": "9490ddd6-599b-4e25-abe1-5f696936fe72"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_buurw8hp0yg2v1bwdhdyu7yrs_e
title: "Deleting a duplicate-docid twin destroys the surviving note's pins and overrides"
status: closed
deps: []
links: []
created_iso: 2026-08-15T00:41:49Z
status_updated_iso: 2026-08-15T01:26:00Z
type: bug
priority: 1
assignee: CC_WITH-nickolaykondratyev
parent: nid_1gpbw8a2a3p09ny3kjl0u0az5_e
tags: [persistence]
---

ROOT CAUSE: src/main.ts:280-294 handleVaultDelete infers "the doc with docid X is gone" from "the deleted path was mapped to X" via src/persistence/PathDocIdMap.ts handleDelete — unsound when two live files carry the same docid. Docids live in user-visible frontmatter (id:), and Obsidian's "Make a copy" / templates / sync restores duplicate frontmatter verbatim; the bundled id library honours existing ids as-is. PathDocIdMap.set enforces 1:1 last-writer-wins (src/persistence/PathDocIdMap.ts:12-19), so once the COPY is visited/swept, the docid points at the copy; deleting the copy then returns the docid as cleanup key and main.ts forgets it in BOTH tiers (PluginDataStore.forgetDocs + PerDocStore.forgetDocs) — the ORIGINAL note permanently loses its global pin, local pins and node overrides. Nothing resurrects them (the sweep only deletes). Contrast: OrphanSweeper re-verifies at drop time and skips on incomplete evidence; the live handler does the destructive act with none.

FAILING TEST (committed as it.skip — UNSKIP as acceptance): src/persistence/PathDocIdMap.test.ts, "WHEN a docid was seen at TWO live paths THEN deleting one twin yields no cleanup key".

FIX SHAPES (pick one): (a) defer ambiguous deletes to the orphan sweep — handleVaultDelete withholds cleanup when the map saw the docid at more than one live path this session (map remembers multi-path sightings); the sweep's full-scan re-derivation then correctly sees the surviving twin. (b) re-verify in handleVaultDelete that no other live file still resolves to the docid before forgetting. If the fix lands in main.ts rather than the map, MOVE the committed failing test accordingly.

## Acceptance Criteria

The committed it.skip test (or its relocated equivalent) is unskipped and passes; deleting a copied note never erases the surviving original's pins/overrides.

## Resolution (2026-08-15)

Implemented **fix shape (a)** — the map defers ambiguous deletes to the orphan sweep. The fix lives entirely in `src/persistence/PathDocIdMap.ts`:

- `set(path, docid)` now records the docid in a private `docidsSeenAtMultiplePaths` set whenever the docid was already mapped at a DIFFERENT path (a frontmatter-duplicate twin sighting). The flag is session-sticky.
- `handleDelete(path)` still unmaps the path, but WITHHOLDS the cleanup key (returns `undefined`) for a flagged docid — so `main.ts handleVaultDelete` never calls `forgetDocs` on either tier for it. The `OrphanSweeper`'s full-scan re-derivation (`warmAll` → `SweepPlanner` → drop-time `isConfirmedOrphan` re-check) then sees the surviving twin in `liveDocids` and keeps its state; if BOTH twins are truly gone, the sweep drops the state correctly.
- `handleRename` unmaps the old path BEFORE calling `set`, so a legitimate rename (one live file) never trips the flag.

Deliberate tradeoff, captured in tests: a MISSED rename (`set` at a new path without `handleRename`) is indistinguishable from a twin at map level, so its later delete also defers to the sweep — cost is a delayed cleanup, never data loss. Why session-sticky (never un-flagged): after one twin is deleted the map holds no history of which paths were involved, so un-flagging would re-open the destructive window; the sweep makes the conservative choice free.

Acceptance test unskipped and passing in `src/persistence/PathDocIdMap.test.ts` (fix landed in the map, so the test stayed put), plus three new tests: deleting the OTHER twin, rename-does-not-poison, and the missed-rename deferral. Verified: `npm test` (2088 passed) + `npm run check` green; pure persistence change, so no e2e per repo convention.

