---
closed_iso: 2026-08-15T06:55:32Z
session_ids: [{"a": "claude", "type": "execution", "id": "c14fb02b-fdb0-46b5-9f1c-99aff25ac186"}, {"a": "claude", "type": "review", "id": "56267bfb-f3fc-4336-a20f-bab92a29e0b4"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_dqu2jc1kln9ltwzy3lxxocdw7_e
title: "Disable dependent grouping rows when folder grouping depth is 0"
status: closed
deps: [nid_5vz7mtm2rn6n7nj9cp5mfbslx_e]
links: [nid_yyugpoh3gv8ip24cizvgrs4w4_e, nid_5086tzts48n7pnc4q77g7bk9e_e, nid_5vz7mtm2rn6n7nj9cp5mfbslx_e, nid_ovayqcmi0vlmzyju40tdxw3sd_e]
created_iso: 2026-08-15T05:28:44Z
status_updated_iso: 2026-08-15T06:55:32Z
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

## Resolution (2026-08-15)

Implemented exactly along the declared-dependency mechanism; all gates green
(`npm run check`, `npm test` 2183 passed, `npm run test:e2e --
settingsDependentRows.e2e.ts nestedGrouping.e2e.ts settingsUxVisual.e2e.ts`
33 passed).

- `src/view/settingsRows.ts`: new dependency `"folder-grouping-on"` in
  `SettingsRowDependency` (disabled when `globalView.folderGroupingDepth === 0`,
  named constant `FOLDER_GROUPING_OFF_DEPTH`); `DEPENDENCY_AWARE_CONTROL_KINDS`
  extended with `group-label-full-path` + `edge-depth-into-groups`; both rows
  declare `disabledWhen: "folder-grouping-on"`.
- PANEL (`SettingsRowView.tsx`): the shared `SliderRow`/`ToggleRow` now evaluate
  `isSettingsRowDisabled(row, state)` onto the native input (so EVERY panel
  slider/toggle kind is dependency-aware); `ToggleSwitch` gained an optional
  `disabled` prop. Liveness comes from the write fan-out's rebuild repaint.
- TAB (`VicinityGraphSettingTab.ts`): new `wireRowDependency()` (applies the
  render-time verdict + enrols the control in `dependents`; also DRYs the
  exclusion-patterns wiring), used by `addToggleRow` and `addSlider`.
  `setToggleDisabled`/`setSliderDisabled` set the NATIVE input's `disabled` as
  well as the component flag (`ToggleComponent.setDisabled`'s contract only
  promises the component flag). `addSlider.onChange` now awaits the write and
  re-runs `applyRowDependencies(this.rowState())` — the authoritative pass,
  since a slider (folder grouping depth) can be a dependency's master dial.
- CSS (`graph-view.css`): panel rows dim via
  `.vicinity-graph-slider-row:has(input:disabled)` (same "inert, not gone"
  treatment as the exclusion patterns row).
- Tests: `settingsRows.test.ts` (verdict at depth 0/1 for both rows);
  `GraphToolbar.component.test.tsx` rendered panel suite (disabled attr at
  depth 0, enabled at 1); `e2e/settingsDependentRows.e2e.ts` two new tab tests
  driving the REAL master slider (disable at 0 / re-enable at 2, node identity,
  scroll+focus survival, persistence poll) — e2e file lives in the submodule.

Non-obvious for the next reader: the panel's dependent rows re-enable on the
rebuild repaint that follows the master write (state prop refresh), not
optimistically; the tab re-enables via the dependents pass after the slider's
write lands.


## Notes

**2026-08-15T06:58:59Z**

__READY_AS_IS__: review found no defects; disabledWhen wiring is declarative on both surfaces, native inputs carry the disabled flag, and check + npm test (2183 passed) + settingsDependentRows e2e (4 passed) are green with no fixes needed.
