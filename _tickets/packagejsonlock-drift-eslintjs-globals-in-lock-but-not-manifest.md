---
session_ids: [{a: claude, type: execution, id: da36b6f3-99aa-41cd-9db2-b4eaa6d20a47}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_p9omkaitzkvzvthv5f2vvou2y_e
title: "package.json/lock drift: @eslint/js + globals in lock but not manifest"
status: in_progress
deps: []
links: []
created_iso: 2026-08-10T23:03:56Z
status_updated_iso: 2026-08-10T23:07:24Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [lint, deps]
---

The prereq lint ticket nid_zyv1x5w08difwfdopm50bt2lu_e left package-lock.json listing devDependencies (`@eslint/js`, `globals`) that are NOT declared in package.json. A plain `npm install` removes them from the lock (observed while doing nid_1fzz9jrjbnaa3iky57nmmckfc_e, then reverted to keep that ticket scoped). Net effect: `npm ci` sees a drifted lock vs manifest.

Decide whether these two belong in package.json. The eslint flat config (eslint.config.mjs) spreads eslint-plugin-obsidianmd (which pulls typescript-eslint); @eslint/js and globals appear unused by the current config. Either add them to package.json or commit the `npm install` lock sync. Keep it a standalone dep-hygiene change.

