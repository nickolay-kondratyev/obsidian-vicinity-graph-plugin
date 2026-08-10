---
closed_iso: 2026-08-10T20:06:46Z
id: nid_813lccr2s8xfvsc978eatygdx_e
title: migrate to stable ids for obsidian
status: closed
deps: []
links: []
created_iso: '2026-08-10T20:00:33Z'
status_updated_iso: 2026-08-10T20:06:46Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2
---
the following is now deprecated (name was changed)
```json file=[$(git.repo_root)/package.json] Lines=[28-29]
		"obsidian-id-lib": "^0.1.0",
```

In its place we should use https://www.npmjs.com/package/stable-ids-for-obsidian

The code is the same from this repo just the name of library has changed.
This ticket is to migrate to updated name.

## Resolution (2026-08-10)

Migrated the dependency `obsidian-id-lib@^0.1.0` → `stable-ids-for-obsidian@^0.1.3`
(latest published; same code, renamed package). Same export surface
(`DocIdServices`, `DocIdService`), so the swap was a pure rename.

Changed:
- `package.json` — dependency entry renamed + bumped to `^0.1.3`; `npm install`
  regenerated `package-lock.json` (old package removed, new one added). `main.js`
  (gitignored build artifact) now bundles `stable-ids-for-obsidian`.
- `src/main.ts` — the two real `import ... from "stable-ids-for-obsidian"` lines.
- `src/engine/importGuard.test.ts` — the `FORBIDDEN_MODULE_PREFIXES` entry and its
  fixtures/descriptions (the engine-purity guard now forbids the new name; note the
  `"obsidian"` prefix does NOT cover `stable-ids-for-obsidian`, so the explicit
  entry matters).
- Comment/doc references updated across `src/adapters/`, `src/engine/`,
  `src/persistence/`, `src/shared/`, `esbuild.config.mjs`, the three `e2e/*.e2e.ts`
  scenario headers, `CLAUDE.md`, `README.md` (incl. version string + npm URL),
  `docs-internal/architecture-map.md`, `docs-internal/plan/node-sizing-rethink.md`.

Historical records left as-is (they describe the past `submodules/obsidian-id-lib`
wiring): `.ai_out/**`, `_change_log/**`, `_tickets/closed/**`, and the
`docs-internal/plan/steps/*` step snapshots + `docs-internal/tickets/ticket-eslint-adoption.md`.

Verified: `npm run check` (strict tsc, src + e2e) ✓, `npm test` 1827/1827 ✓
(incl. `importGuard`), `npm run build` production bundle ✓. `test:e2e` not run —
pure dependency rename with no view/settings/DOM surface change (stays on the
`npm test` gate per CLAUDE.md).
