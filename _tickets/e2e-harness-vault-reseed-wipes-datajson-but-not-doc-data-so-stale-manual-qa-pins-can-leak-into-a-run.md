---
id: nid_6mack3e3ql9qtaxf1edezjpfs_e
title: "e2e: harness vault reseed wipes data.json but not doc-data/, so stale manual-QA pins can leak into a run"
status: open
deps: []
links: [nid_d9j4o9ecp93g5zhury5m1fb43_e]
created_iso: 2026-07-27T15:18:57Z
status_updated_iso: 2026-07-27T15:18:57Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
---

`ObsidianHarness.prepareVaultCopy` in `e2e/obsidianHarness.ts` explicitly deletes `.obsidian/plugins/vicinity-graph/data.json` from the throwaway vault copy so stale GLOBAL plugin settings never leak into a fresh launch — but it does NOT delete the per-doc persistence directory `.obsidian/plugins/vicinity-graph/doc-data/`, which is where PINS live.

Consequence: if a human pins a central during manual QA in `.dev-vault`, that pin is copied into every subsequent e2e vault copy. The new absence assertion in `e2e/settingsUxVisual.e2e.ts` ("WHEN nothing is pinned THEN the Pinned centrals disclosure is absent") would then fail spuriously.

This is LOUD (a red test), never a silent false green, hence low priority. Raised as an optional note in the review of ticket nid_d9j4o9ecp93g5zhury5m1fb43_e.

## Acceptance Criteria

`prepareVaultCopy` removes the per-doc persistence dir alongside `data.json` (same WHY comment extended), so a fresh e2e launch always starts with zero pins regardless of what a human did in `.dev-vault`. Verify by pinning a central in `.dev-vault` manually, then running `npm run test:e2e -- settingsUxVisual.e2e.ts` and seeing it stay green.

