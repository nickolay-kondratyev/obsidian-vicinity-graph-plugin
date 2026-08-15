---
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_dqu2jc1kln9ltwzy3lxxocdw7_e
title: "Disable dependent grouping rows when folder grouping depth is 0"
status: in_progress
deps: [nid_5vz7mtm2rn6n7nj9cp5mfbslx_e]
links: [nid_yyugpoh3gv8ip24cizvgrs4w4_e, nid_5086tzts48n7pnc4q77g7bk9e_e, nid_5vz7mtm2rn6n7nj9cp5mfbslx_e, nid_ovayqcmi0vlmzyju40tdxw3sd_e]
created_iso: 2026-08-15T05:28:44Z
status_updated_iso: 2026-08-15T06:45:28Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: []
---

Part 3/4 of plan nid_yyugpoh3gv8ip24cizvgrs4w4_e (closed plan ticket - READ IT FIRST). Depends on the slider ticket nid_5vz7mtm2rn6n7nj9cp5mfbslx_e.

Signed-off Q3: when "Folder grouping depth" is 0 (folder grouping fully off), two existing Grouping rows are moot and must render DISABLED (not hidden):
- "Edge depth into groups" (edgeDepthIntoGroups slider)
- the group-label full-path toggle (groupLabelFullPath)

Use the existing declarative mechanism: disabledWhen on the row declarations in src/view/settingsRows.ts (per CLAUDE.md: disabledWhen is DATA, not a presenter branch; dependent rows render always, disabled). The type accepts disabledWhen only on DEPENDENCY_AWARE_CONTROL_KINDS - extend that set (and the presenters honouring it in src/view/SettingsRowView.tsx and src/view/VicinityGraphSettingTab.ts) for any of these two control kinds not yet dependency-aware.

## Acceptance Criteria

- With depth 0, both rows are disabled on the settings TAB and the in-graph PANEL; any depth >= 1 re-enables them live.
- disabledWhen declared on the rows (no presenter branches, no hand-typed labels).
- BDD tests: panel side via the rendered jsdom component suites (src/view/*.component.test.tsx pattern, harness src/view/testFixtures/settingsPanelHarness.tsx); the tab has no npm-test rendering, so cover it in the settings e2e spec (existing dependent-row e2e patterns).
- npm run check, npm test green; run the settings-surface e2e (npm run test:e2e) since this is settings-row/DOM behavior.

