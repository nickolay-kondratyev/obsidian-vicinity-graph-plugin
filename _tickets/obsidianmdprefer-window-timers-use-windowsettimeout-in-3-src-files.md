---
id: nid_6q26wh2r8ivgbeedpf17t31ry_e
title: "obsidianmd/prefer-window-timers: use window.setTimeout in 3 src files"
status: open
deps: []
links: [nid_qjuqgqfwentq2l59o5ya17vra_e, nid_tbqtxmq5gyjr9ehrpk87bcje6_e, nid_uyj3is3eyv9o3ctkv2meqcin7_e, nid_h2hs9s7uvugweohv076dvddpm_e, nid_l17hhil9b22jas1lwvyfgxp5w_e, nid_zs2aog8b2i9e3wutsorjm88ft_e, nid_icr9gp534nm6kgkbc8rgcpu68_e, nid_nioldkusdrwc7fqzr4bmq2bow_e]
created_iso: 2026-08-11T21:26:40Z
status_updated_iso: 2026-08-11T21:26:40Z
type: chore
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [lint, release]
---

`obsidianmd/prefer-window-timers` (auto-fixable). Replace bare `setTimeout`/`setInterval` with `window.setTimeout`/`window.setInterval` at:
- src/persistence/ChunkedWork.ts:34
- src/persistence/PluginDataStore.ts:57
- src/view/VicinityGraphFlow.tsx:355

Run `npx eslint src --fix` for these, then eyeball the diff (confirm no behavior change; return-type is `number` under `window.*`). Verify clean: `npx eslint src | grep prefer-window-timers` (empty = done). Do NOT touch e2e.

