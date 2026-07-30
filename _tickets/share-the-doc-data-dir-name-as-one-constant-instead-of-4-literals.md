---
closed_iso: 2026-07-30T00:01:58Z
id: nid_7fq9y51mbucmduzf9z31hmwmq_e
tags: [settings]
title: Share the `doc-data` dir name as one constant instead of 4+ literals
status: closed
deps: []
links: [nid_m5hxe4eo9jgt7cfic7s2o3uvi_e, nid_ez38gf1mrdgh5kxedzrdicwzl_e]
created_iso: '2026-07-27T16:20:57Z'
status_updated_iso: 2026-07-30T00:01:58Z
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

## Resolution (2026-07-29, commit `c7669e0`)

DONE. `src/persistence/docDataDirName.ts` exports `DOC_DATA_DIR_NAME = "doc-data"` — a
leaf module with NO imports on purpose, so the node-side e2e process can load it at
runtime. Consumers: `src/main.ts` `docDataDirPath()`, `e2e/obsidianHarness.ts`
`prepareVaultCopy()` wipe, and the 5 tests that hardcoded the name
(`PersistenceServices`, `DocDataStore`, `OrphanSweeper`, plus `VicinityGraphBuilder.test.ts`
and `ControlsActions.test.ts` for consistency). `e2e/vaultCopyReseed.test.ts` deleted.

The runtime-import-from-`src/` precedent is now established in `e2e/obsidianHarness.ts`
(WHY comment next to the import states the no-imports requirement).

Verified: `npm test` (87 files / 1174 tests), `npm run check` incl. `check:e2e`,
`node esbuild.config.mjs production` (bundle still contains the literal once), and a
REAL Obsidian run — `npm run test:e2e -- pinnedCentralScenario.e2e.ts` (2 passed), which
executes `prepareVaultCopy()` and therefore proves the runtime import actually loads in
the node-side process, not just typechecks. The `vaultTarget.test.ts` destructive-call
source scan still passes: the wipe's destination still roots at the literal
`VAULT_COPY_DIR` constant.
**2026-07-29T22:11:26Z**

FOLLOW-UP CONTEXT: nid_ez38gf1mrdgh5kxedzrdicwzl_e (settings simplification) deletes the
`doc-data/` dir entirely — per-doc saved state is being removed in favor of global-only
settings. That ticket therefore also deletes `DOC_DATA_DIR_NAME` and its consumers; this
refactor landed first (see Resolution above), so the removal is a straight delete of one
constant instead of 5+ scattered literals.

**2026-07-30T00:01:58Z**

Obsolete: nid_ez38gf1mrdgh5kxedzrdicwzl_e deleted the doc-data subsystem, including src/persistence/docDataDirName.ts and its e2e counterpart. There is no dir name left to share.
