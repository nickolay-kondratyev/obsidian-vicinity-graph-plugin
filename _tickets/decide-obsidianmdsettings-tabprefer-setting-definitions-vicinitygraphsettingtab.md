---
id: nid_zs2aog8b2i9e3wutsorjm88ft_e
title: "DECIDE: obsidianmd/settings-tab/prefer-setting-definitions (VicinityGraphSettingTab)"
status: open
deps: []
links: [nid_qjuqgqfwentq2l59o5ya17vra_e, nid_tbqtxmq5gyjr9ehrpk87bcje6_e, nid_6q26wh2r8ivgbeedpf17t31ry_e, nid_uyj3is3eyv9o3ctkv2meqcin7_e, nid_h2hs9s7uvugweohv076dvddpm_e, nid_l17hhil9b22jas1lwvyfgxp5w_e, nid_icr9gp534nm6kgkbc8rgcpu68_e, nid_nioldkusdrwc7fqzr4bmq2bow_e]
created_iso: 2026-08-11T21:27:04Z
status_updated_iso: 2026-08-11T21:27:04Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [lint, release]
---

`obsidianmd/settings-tab/prefer-setting-definitions` at src/view/VicinityGraphSettingTab.ts:77 — the rule prefers Obsidian's declarative setting-definition API over hand-built `Setting(...)` rows.

This repo INTENTIONALLY uses a single declared row model (`src/view/settingsRows.ts`, `SETTINGS_GROUPS`) rendered by two presenters (tab + in-graph panel) — see CLAUDE.md "Settings rows". Adopting the plugin-native setting-definitions API would fight that architecture and the tab/panel parity guards.

DECISION NEEDED: 
- (a) leave as-is with a scoped eslint-disable + WHY comment referencing the settingsRows model, or (
- (b) revisit if the score-card treats this as a hard blocker. Recommendation: 


HUMAN DECISION -> (a). Verify current: `npx eslint src/view/VicinityGraphSettingTab.ts`., dont fight the architecture for now.

