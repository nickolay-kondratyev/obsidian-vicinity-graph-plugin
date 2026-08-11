---
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_uyj3is3eyv9o3ctkv2meqcin7_e
title: "obsidianmd/hardcoded-config-path: use app.vault.configDir in PluginDataStore"
status: in_progress
deps: []
links: [nid_qjuqgqfwentq2l59o5ya17vra_e, nid_tbqtxmq5gyjr9ehrpk87bcje6_e, nid_6q26wh2r8ivgbeedpf17t31ry_e, nid_h2hs9s7uvugweohv076dvddpm_e, nid_l17hhil9b22jas1lwvyfgxp5w_e, nid_zs2aog8b2i9e3wutsorjm88ft_e, nid_icr9gp534nm6kgkbc8rgcpu68_e, nid_nioldkusdrwc7fqzr4bmq2bow_e]
created_iso: 2026-08-11T21:26:40Z
status_updated_iso: 2026-08-11T23:57:39Z
type: chore
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [lint, release]
---

`obsidianmd/hardcoded-config-path` at src/persistence/PluginDataStore.ts:42 — code hardcodes the `.obsidian` config dir. Obsidian users can rename their config dir; use `this.app.vault.configDir` instead of a literal. Verify: `npx eslint src/persistence/PluginDataStore.ts`. Check nothing else in src/persistence hardcodes `.obsidian`. Ensure persistence tests still pass (`npm test`). Do NOT touch e2e.

