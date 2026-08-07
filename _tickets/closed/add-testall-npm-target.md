---
closed_iso: 2026-08-05T18:57:21Z
id: nid_w9oqmicsp07fh5vgo8ff1nsd9_e
title: Add test:all npm target
status: closed
deps: []
links: []
created_iso: '2026-08-05T18:54:03Z'
status_updated_iso: 2026-08-05T18:57:21Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2
---
Add test:all npm target that will run through all the tests. Including Unit, Integration, E2E tests. It can be a shell script that gets called from this target to handle running all the tests.

## Resolution

Added `npm run test:all` → `bash scripts/run-all-tests.sh`.

Stages, fail-fast, cheapest gate first (a type error must not cost a full
Obsidian download + Playwright run):

1. `npm run check` — `tsc -noEmit` for `src/` + `e2e/`
2. `npm test` — vitest (unit + integration + source-scan guards)
3. `npm run test:e2e` — Playwright against a real Obsidian

`--with-floor` (off by default) appends `npm run test:e2e:floor`; it is the SAME
suite on an older binary plus a second download, so it belongs to release checks
rather than every dev run. An unknown flag exits 2 rather than being ignored.
Extra args are deliberately NOT passed through to a stage — narrowing a run is
what the individual npm scripts are for.

Docs updated: `CLAUDE.md` commands block, README scripts table,
`docs-internal/RELEASE_CHECKLIST.md` green-gates section.

Verified: `npm run test:all` EXIT 0 — check green, vitest 1647/1647 in 119 files,
e2e 139 passed. Unknown-flag path verified (exit 2).
