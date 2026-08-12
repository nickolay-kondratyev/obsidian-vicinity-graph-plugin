---
closed_iso: 2026-08-12T00:22:06Z
session_ids: [{"a": "claude", "type": "execution", "id": "b0ebac4d-3a4a-4305-b7d4-eb19c75ff3d9"}, {"a": "claude", "type": "review", "id": "94e7a41c-ebc9-45e7-808f-14aab719189e"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_zs2aog8b2i9e3wutsorjm88ft_e
title: "DECIDE: obsidianmd/settings-tab/prefer-setting-definitions (VicinityGraphSettingTab)"
status: closed
deps: []
links: [nid_qjuqgqfwentq2l59o5ya17vra_e, nid_tbqtxmq5gyjr9ehrpk87bcje6_e, nid_6q26wh2r8ivgbeedpf17t31ry_e, nid_uyj3is3eyv9o3ctkv2meqcin7_e, nid_h2hs9s7uvugweohv076dvddpm_e, nid_l17hhil9b22jas1lwvyfgxp5w_e, nid_icr9gp534nm6kgkbc8rgcpu68_e, nid_nioldkusdrwc7fqzr4bmq2bow_e]
created_iso: 2026-08-11T21:27:04Z
status_updated_iso: 2026-08-12T00:22:06Z
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

## Resolution (2026-08-11)

Decision (a) implemented: kept the hand-built `Setting(...)` rows, silenced the
rule for this one file with a documented WHY.

**Key discovery / dead end avoided:** the obsidianmd *recommended* config sets
`eslint-comments/no-restricted-disable` to forbid inline-disabling any
`obsidianmd/*` rule (see `node_modules/eslint-plugin-obsidianmd/dist/lib/index.js`
~line 272). An inline `// eslint-disable-next-line
obsidianmd/settings-tab/prefer-setting-definitions` therefore does NOT work — it
produces two new errors (`no-restricted-disable` + `require-description`). The
config-supported way to scope the rule off is a per-file override in the flat
config.

**What was changed:**
- `eslint.config.mjs` — added a final config block scoping
  `obsidianmd/settings-tab/prefer-setting-definitions` to `"off"` for
  `files: ["src/view/VicinityGraphSettingTab.ts"]`, with a WHY comment (two-presenter
  parity architecture; inline directive forbidden by config; ticket id; revisit
  conditions).
- `src/view/VicinityGraphSettingTab.ts` — added a WHY-NOT comment on the class
  pointing at the config-level suppression and the parity rationale.

No runtime/DOM behavior change (comments + lint config only), so no e2e run.

**Verification:**
- `npx eslint src/view/VicinityGraphSettingTab.ts` → clean (exit 0, no warning).
- `npm run check` → passes.
- `settingsRowParity.test.ts` + `typedNumberFields.test.ts` → 11 passed.

Note: repo-wide `npx eslint .` still reports pre-existing issues in OTHER files
— those belong to the sibling per-group lint tickets this one links to, not here.

