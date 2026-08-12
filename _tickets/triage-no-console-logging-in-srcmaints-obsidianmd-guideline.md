---
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_h2hs9s7uvugweohv076dvddpm_e
title: "Triage no-console logging in src/main.ts (obsidianmd guideline)"
status: in_progress
deps: []
links: [nid_qjuqgqfwentq2l59o5ya17vra_e, nid_tbqtxmq5gyjr9ehrpk87bcje6_e, nid_6q26wh2r8ivgbeedpf17t31ry_e, nid_uyj3is3eyv9o3ctkv2meqcin7_e, nid_l17hhil9b22jas1lwvyfgxp5w_e, nid_zs2aog8b2i9e3wutsorjm88ft_e, nid_icr9gp534nm6kgkbc8rgcpu68_e, nid_nioldkusdrwc7fqzr4bmq2bow_e]
created_iso: 2026-08-11T21:26:40Z
status_updated_iso: 2026-08-12T00:25:30Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [lint, release]
---

`eslint-plugin-obsidianmd` reports 13 `no-console` findings (rule id surfaces as `obsidianmd/rule-custom-message`) in src/main.ts — the debug command `logVicinityGraph` (console.log/console.table around lines 284-350) and the orphan-sweep logs (~269, 273). Obsidian guidelines discourage console logging in shipped plugins.

Triage, do not blanket-delete: drop the debug/dev `console.log`/`console.table` (the `debug-log-vicinity-graph` command is a dev harness — consider removing the command too), keep any deliberate error reporting but route user-facing failures through `Notice`/the existing UserNoticePort rather than console. Verify: `npx eslint src/main.ts | grep -c no-console`. Do NOT touch e2e.

