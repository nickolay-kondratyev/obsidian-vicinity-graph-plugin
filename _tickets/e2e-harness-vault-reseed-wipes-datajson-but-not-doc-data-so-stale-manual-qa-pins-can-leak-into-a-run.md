---
closed_iso: 2026-07-27T16:33:38Z
id: nid_6mack3e3ql9qtaxf1edezjpfs_e
title: "e2e: harness vault reseed wipes data.json but not doc-data/, so stale manual-QA pins can leak into a run"
status: closed
deps: []
links: [nid_d9j4o9ecp93g5zhury5m1fb43_e, nid_0jzq3ev878kjd0zhn3zxyje8q_e]
created_iso: 2026-07-27T15:18:57Z
status_updated_iso: 2026-07-27T16:33:38Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
---

`ObsidianHarness.prepareVaultCopy` in `e2e/obsidianHarness.ts` explicitly deletes `.obsidian/plugins/vicinity-graph/data.json` from the throwaway vault copy so stale GLOBAL plugin settings never leak into a fresh launch — but it does NOT delete the per-doc persistence directory `.obsidian/plugins/vicinity-graph/doc-data/`, which is where PINS live.

Consequence: if a human pins a central during manual QA in `.dev-vault`, that pin is copied into every subsequent e2e vault copy. The new absence assertion in `e2e/settingsUxVisual.e2e.ts` ("WHEN nothing is pinned THEN the Pinned centrals disclosure is absent") would then fail spuriously.

This is LOUD (a red test), never a silent false green, hence low priority. Raised as an optional note in the review of ticket nid_d9j4o9ecp93g5zhury5m1fb43_e.

## Acceptance Criteria

`prepareVaultCopy` removes the per-doc persistence dir alongside `data.json` (same WHY comment extended), so a fresh e2e launch always starts with zero pins regardless of what a human did in `.dev-vault`. Verify by pinning a central in `.dev-vault` manually, then running `npm run test:e2e -- settingsUxVisual.e2e.ts` and seeing it stay green.


## Notes

**2026-07-27T16:33:38Z**

RESOLVED on branch e2e-vault-reseed-doc-data (commits f475d68, 033e864). change_log: kibtyj6wavh6yzkr9osockqqr.

- prepareVaultCopy now rmSyncs .obsidian/plugins/vicinity-graph/doc-data/ (recursive) alongside data.json, destination literally rooted at VAULT_COPY_DIR so the e2e/vaultTarget.test.ts destructive-call scan stays un-weakened. WHY comments extended; ObsidianHarness class doc updated.
- Added e2e/vaultCopyReseed.test.ts: cross-checks the 'doc-data' literal in src/main.ts docDataDirPath() against the harness wipe, so a rename cannot silently break the reseed. Verified to fail on drift in both directions.
- npm test 1011 pass; npm run check pass; npm run test:e2e -- settingsUxVisual.e2e.ts 17/17 green (real Obsidian 1.12.7).
- Acceptance-criteria caveat, stated honestly: .dev-vault's doc-data/ was empty, so that e2e run proves no regression rather than proving the repair. The repair was proven separately with a scratch-copy negative control (planted pin survives without the fix, is gone with it) - the AC's suggested manual-pin repro was not reproducible at the e2e layer because the spec's main note has no stable id: to key a planted pin to.
- Follow-ups filed: nid_7fq9y51mbucmduzf9z31hmwmq_e (duplicated 'doc-data' literal across 5 sites; that refactor should delete the new drift guard), nid_0jzq3ev878kjd0zhn3zxyje8q_e (.obsidian/workspace.json leaks human-QA state the same way).
