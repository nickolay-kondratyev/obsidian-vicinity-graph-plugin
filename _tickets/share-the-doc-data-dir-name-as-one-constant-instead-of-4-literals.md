---
id: nid_7fq9y51mbucmduzf9z31hmwmq_e
title: "Share the `doc-data` dir name as one constant instead of 4+ literals"
status: open
deps: []
links: []
created_iso: 2026-07-27T16:20:57Z
status_updated_iso: 2026-07-27T16:20:57Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
---

The per-doc persistence dir name `doc-data` is currently spelled as a bare string literal in at least 5 places:

- `src/main.ts` `docDataDirPath()` (private) — the AUTHORITATIVE producer.
- `e2e/obsidianHarness.ts` `prepareVaultCopy()` — the stale-state wipe (added by ticket nid_6mack3e3ql9qtaxf1edezjpfs_e).
- `src/persistence/PersistenceServices.test.ts`, `src/persistence/DocDataStore.test.ts`, `src/persistence/OrphanSweeper.test.ts` — hardcoded locally.

Knowledge duplication: if the dir is ever renamed, the e2e wipe silently stops wiping and stale pins leak back into e2e runs (exactly the bug that ticket fixed) with NO test failing.

WHY it was not done inline: `e2e/` currently imports from `src/` TYPE-ONLY (see the WHY comment at the top of `e2e/obsidianHarness.ts`) — a runtime import from `src/` into the node-side harness process is a new precedent that needs its own verification against the e2e toolchain (tsx/tsc `check:e2e` + Playwright), and `src/persistence/` has no barrel to import from. That was out of scope for a Pareto-sized wipe fix.

## Acceptance Criteria

One exported constant (e.g. `DOC_DATA_DIR_NAME` in `src/persistence/`) is the single source of the literal, consumed by `src/main.ts`, the persistence tests, and `e2e/obsidianHarness.ts`; `npm test`, `npm run check` (incl. `check:e2e`), the engine/shared import guards, and the esbuild bundle all stay green, and the runtime-import-from-src precedent is verified to actually run in the node-side e2e process (not just typecheck).

