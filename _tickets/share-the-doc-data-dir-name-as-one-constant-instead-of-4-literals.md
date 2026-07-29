---
id: nid_7fq9y51mbucmduzf9z31hmwmq_e
tags: [settings]
title: Share the `doc-data` dir name as one constant instead of 4+ literals
status: in_progress
deps: []
links: []
created_iso: '2026-07-27T16:20:57Z'
status_updated_iso: '2026-07-29T22:03:23Z'
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
The per-doc persistence dir name `doc-data` is currently spelled as a bare string literal in at least 5 places:

- `src/main.ts` `docDataDirPath()` (private) — the AUTHORITATIVE producer.
- `e2e/obsidianHarness.ts` `prepareVaultCopy()` — the stale-state wipe (added by ticket nid_6mack3e3ql9qtaxf1edezjpfs_e).
- `src/persistence/PersistenceServices.test.ts`, `src/persistence/DocDataStore.test.ts`, `src/persistence/OrphanSweeper.test.ts` — hardcoded locally.

Knowledge duplication: if the dir is ever renamed, the e2e wipe silently stops wiping and stale pins leak back into e2e runs (exactly the bug that ticket fixed) with NO test failing.

WHY it was not done inline: `e2e/` currently imports from `src/` TYPE-ONLY (see the WHY comment at the top of `e2e/obsidianHarness.ts`) — a runtime import from `src/` into the node-side harness process is a new precedent that needs its own verification against the e2e toolchain (tsx/tsc `check:e2e` + Playwright), and `src/persistence/` has no barrel to import from. That was out of scope for a Pareto-sized wipe fix.

## Acceptance Criteria

One exported constant (e.g. `DOC_DATA_DIR_NAME` in `src/persistence/`) is the single source of the literal, consumed by `src/main.ts`, the persistence tests, and `e2e/obsidianHarness.ts`; `npm test`, `npm run check` (incl. `check:e2e`), the engine/shared import guards, and the esbuild bundle all stay green, and the runtime-import-from-src precedent is verified to actually run in the node-side e2e process (not just typecheck).


## Notes

**2026-07-27T16:28:51Z**

Interim guard added while this refactor is deferred: `e2e/vaultCopyReseed.test.ts` cross-checks the `doc-data` literal in `src/main.ts` `docDataDirPath()` against the wipe in `e2e/obsidianHarness.ts` by source scan, so a plugin-side rename that the harness does not follow fails `npm test`. DELETE that file as part of this ticket — the shared constant makes it redundant (its doc comment says so and names this ticket id).
