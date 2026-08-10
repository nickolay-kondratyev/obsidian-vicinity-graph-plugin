---
closed_iso: 2026-08-10T23:09:08Z
session_ids: [{a: claude, type: execution, id: da36b6f3-99aa-41cd-9db2-b4eaa6d20a47}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_p9omkaitzkvzvthv5f2vvou2y_e
title: "package.json/lock drift: @eslint/js + globals in lock but not manifest"
status: closed
deps: []
links: []
created_iso: 2026-08-10T23:03:56Z
status_updated_iso: 2026-08-10T23:09:08Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [lint, deps]
---

The prereq lint ticket nid_zyv1x5w08difwfdopm50bt2lu_e left package-lock.json listing devDependencies (`@eslint/js`, `globals`) that are NOT declared in package.json. A plain `npm install` removes them from the lock (observed while doing nid_1fzz9jrjbnaa3iky57nmmckfc_e, then reverted to keep that ticket scoped). Net effect: `npm ci` sees a drifted lock vs manifest.

Decide whether these two belong in package.json. The eslint flat config (eslint.config.mjs) spreads eslint-plugin-obsidianmd (which pulls typescript-eslint); @eslint/js and globals appear unused by the current config. Either add them to package.json or commit the `npm install` lock sync. Keep it a standalone dep-hygiene change.

## Resolution

Decision: sync the lock DOWN to the manifest — do NOT add the two packages to
package.json. They are genuinely unused: `eslint.config.mjs` imports only
`eslint-plugin-obsidianmd` and `typescript-eslint`, and nothing under src/ or
e2e/ imports `@eslint/js` or `globals`. Adding them would be declaring dead
deps, against dep hygiene.

What was done:
- Ran `npm install --package-lock-only`, which removed the two entries from the
  lock's root `packages[""].devDependencies` block (the drifted section).
- `node_modules/@eslint/js` and `node_modules/globals` REMAIN in the lock as
  legitimate transitive deps of eslint / eslint-plugin-obsidianmd — expected,
  not drift.
- Verified `eslint.config.mjs` still loads and `npm run lint` runs (it fails
  only on pre-existing type-checked-rule violations tracked by the other lint
  tickets — none about missing @eslint/js/globals), proving nothing depended on
  the direct declarations.

Net effect: `npm ci` now sees lock == manifest. Change is a single 2-line diff
to package-lock.json (commit f6cc8c5).

