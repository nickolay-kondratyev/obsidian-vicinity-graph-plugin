---
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_l17hhil9b22jas1lwvyfgxp5w_e
title: "obsidianmd/no-global-this in src/view/libavoidLoader.ts"
status: in_progress
deps: []
links: [nid_qjuqgqfwentq2l59o5ya17vra_e, nid_tbqtxmq5gyjr9ehrpk87bcje6_e, nid_6q26wh2r8ivgbeedpf17t31ry_e, nid_uyj3is3eyv9o3ctkv2meqcin7_e, nid_h2hs9s7uvugweohv076dvddpm_e, nid_zs2aog8b2i9e3wutsorjm88ft_e, nid_icr9gp534nm6kgkbc8rgcpu68_e, nid_nioldkusdrwc7fqzr4bmq2bow_e]
created_iso: 2026-08-11T21:26:40Z
status_updated_iso: 2026-08-12T00:31:25Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [lint, release]
---

`obsidianmd/no-global-this` at src/view/libavoidLoader.ts:158 — the libavoid WASM loader references `globalThis`. Investigate whether this is required by the WASM glue (it may be, for module bootstrapping). If avoidable, scope to `window`/a local; if genuinely required, add a narrowly-scoped eslint-disable with a WHY comment citing the WASM loader constraint. Verify: `npx eslint src/view/libavoidLoader.ts`. Do NOT touch e2e.

