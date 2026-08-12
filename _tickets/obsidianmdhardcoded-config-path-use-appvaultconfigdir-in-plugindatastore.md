---
closed_iso: 2026-08-12T00:02:11Z
session_ids: [{"a": "claude", "type": "execution", "id": "e330c79b-64af-4f2e-8c02-a7a9ecc21e51"}, {"a": "claude", "type": "review", "id": "1abe60b7-0b5b-496c-b616-ec1eb4626468"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_uyj3is3eyv9o3ctkv2meqcin7_e
title: "obsidianmd/hardcoded-config-path: use app.vault.configDir in PluginDataStore"
status: closed
deps: []
links: [nid_qjuqgqfwentq2l59o5ya17vra_e, nid_tbqtxmq5gyjr9ehrpk87bcje6_e, nid_6q26wh2r8ivgbeedpf17t31ry_e, nid_h2hs9s7uvugweohv076dvddpm_e, nid_l17hhil9b22jas1lwvyfgxp5w_e, nid_zs2aog8b2i9e3wutsorjm88ft_e, nid_icr9gp534nm6kgkbc8rgcpu68_e, nid_nioldkusdrwc7fqzr4bmq2bow_e]
created_iso: 2026-08-11T21:26:40Z
status_updated_iso: 2026-08-12T00:02:11Z
type: chore
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [lint, release]
---

`obsidianmd/hardcoded-config-path` at src/persistence/PluginDataStore.ts:42 — code hardcodes the `.obsidian` config dir. Obsidian users can rename their config dir; use `this.app.vault.configDir` instead of a literal. Verify: `npx eslint src/persistence/PluginDataStore.ts`. Check nothing else in src/persistence hardcodes `.obsidian`. Ensure persistence tests still pass (`npm test`). Do NOT touch e2e.

## Resolution

The only production hit was the `INIT_LOAD_FAILED_NOTICE` recovery message, which
embedded the literal `“.obsidian/plugins/vicinity-graph/data.json”` as the path the
user is told to delete/rename. `main.ts` already computes the REAL `data.json` path
from `this.app.vault.configDir` (with the `manifest.dir` fast path), so the fix threads
that same path into the notice instead of hardcoding it:

- **`src/persistence/PluginDataStore.ts`** — `INIT_LOAD_FAILED_NOTICE` (const) became
  `initLoadFailedNotice(dataJsonPath)` (function). Added a 4th constructor param
  `dataJsonPath: string` (defaulted to a non-`.obsidian` `FALLBACK_DATA_JSON_DISPLAY_PATH`
  so the existing single/triple-arg test call sites keep compiling). `protectAsTransient()`
  now shows `initLoadFailedNotice(this.dataJsonPath)`.
- **`src/main.ts`** — hoisted the `${manifest.dir ?? configDir + "/plugins/" + id}/data.json`
  expression into a `dataJsonPath` local, passed to BOTH the `PluginDataAdapter` (unchanged
  role) and, as the new 4th arg, to `PluginDataStore` so the notice names the real file.
- **`src/persistence/PluginDataAdapter.test.ts`** — the opaque fixture path (line 7) also
  tripped the rule; changed `.obsidian/...` → `my-config/...`, which doubles as proof the
  adapter never assumes the default config folder.
- **`src/persistence/PluginDataStore.test.ts`** — added a BDD test asserting the
  exhausted-reads notice CONTAINS the injected `dataJsonPath` (no hardcoded config dir).

Verification: `npx eslint src/persistence/PluginDataStore.ts` clean; a repo-wide
`obsidianmd/hardcoded-config-path` scan over `src/**/*.ts` returns zero matches;
`npm run check` (tsc strict) passes; `npm test` = 1871 passed. Pre-existing `no-console`
lint errors in this file are unrelated and out of scope. No e2e touched (persistence +
wiring only, fully covered by `npm test`).

