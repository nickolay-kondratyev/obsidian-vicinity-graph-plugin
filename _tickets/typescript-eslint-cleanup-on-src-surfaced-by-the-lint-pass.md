---
id: nid_icr9gp534nm6kgkbc8rgcpu68_e
title: "typescript-eslint cleanup on src/ (surfaced by the lint pass)"
status: open
deps: []
links: [nid_qjuqgqfwentq2l59o5ya17vra_e, nid_tbqtxmq5gyjr9ehrpk87bcje6_e, nid_6q26wh2r8ivgbeedpf17t31ry_e, nid_uyj3is3eyv9o3ctkv2meqcin7_e, nid_h2hs9s7uvugweohv076dvddpm_e, nid_l17hhil9b22jas1lwvyfgxp5w_e, nid_zs2aog8b2i9e3wutsorjm88ft_e, nid_nioldkusdrwc7fqzr4bmq2bow_e]
created_iso: 2026-08-11T21:27:04Z
status_updated_iso: 2026-08-11T21:27:04Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [lint]
---

The obsidianmd recommended config layers in `typescript-eslint` type-checked rules; the same `npx eslint src` pass reports ~29 non-obsidian prod findings, several auto-fixable:
- `no-redundant-type-constituents` (10) + `no-duplicate-type-constituents` (6) — concentrated in src/view/settingsSectionFields.ts (~86-88): union types with redundant/duplicate constituents; simplify the type.
- `no-unnecessary-type-assertion` (4), `no-unused-vars` (4), `unbound-method` (4), `no-misused-promises` (1).

Not Obsidian-score-card-specific, but surfaced by the plugin and worth cleaning. Try `npx eslint src --fix` for the mechanical ones, review each `unbound-method`/`no-misused-promises` by hand (real footguns). Verify: `npx eslint src`. Do NOT touch e2e (submodule).

