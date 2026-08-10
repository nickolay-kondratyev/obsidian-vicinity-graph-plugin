---
closed_iso: 2026-08-10T17:41:28Z
id: nid_uz1wt9qlt5ot81mbkzw3z6nuy_e
title: Lets add unit test coverage
status: closed
deps: []
links: []
created_iso: '2026-08-10T17:38:36Z'
status_updated_iso: 2026-08-10T17:41:28Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
Add unit test coverage.

Make sure we have a way to run the unit test coverage with generated report that is easily consumed by other tooling (Eg. JSON output). As well as being able to run the unit test coverage.

## Resolution (2026-08-10)

Wired up Vitest's built-in v8 coverage — the suite already had substantial
coverage (85% statements / lines), so this was tooling, not new tests.

- Added dev dep `@vitest/coverage-v8@^4.1.10` (pinned to the installed
  `vitest` version).
- `vitest.config.ts` → `test.coverage`: provider `v8`, `all: true` (so
  untested modules show as 0% rather than vanishing from totals),
  `include: src/**/*.{ts,tsx}`, excluding `*.test.*`, `testFixtures/**`,
  `index.ts` barrels, `src/main.ts`, `*.d.ts`. Reporters:
  `text` (console), `json` + `json-summary` (machine-consumable),
  `html` + `lcov` (human / external tooling). Output → `coverage/`.
- `package.json` → `npm run test:coverage` (`vitest run --coverage`).
- `coverage/` git-ignored.
- Documented the command in `CLAUDE.md` Commands block.

Machine-consumable JSON artifacts:
- `coverage/coverage-summary.json` — per-file + `total` percentages.
- `coverage/coverage-final.json` — full istanbul detail.

Verified: `npm run test:coverage` passes and emits all reports;
`coverage/coverage-summary.json` `total` reads 85.2% statements.
