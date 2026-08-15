---
session_ids: [{"a": "claude", "type": "execution", "id": "7592d8f2-1628-4786-9cac-b5c014191636"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_5vz7mtm2rn6n7nj9cp5mfbslx_e
title: "Setting: Folder grouping depth slider wired end-to-end"
status: in_progress
deps: [nid_5086tzts48n7pnc4q77g7bk9e_e]
links: [nid_yyugpoh3gv8ip24cizvgrs4w4_e, nid_5086tzts48n7pnc4q77g7bk9e_e, nid_dqu2jc1kln9ltwzy3lxxocdw7_e, nid_ovayqcmi0vlmzyju40tdxw3sd_e]
created_iso: 2026-08-15T05:28:32Z
status_updated_iso: 2026-08-15T06:28:31Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: []
---

Part 2/4 of plan nid_yyugpoh3gv8ip24cizvgrs4w4_e (closed plan ticket - READ IT FIRST). Depends on the core cap ticket nid_5086tzts48n7pnc4q77g7bk9e_e.

Declare the new global view setting and wire it end-to-end, using the existing edgeDepthIntoGroups slider as the exact template at every step:
- Spec leaf: src/engine/SettingsSpec.ts, BoundedNumberSpec { default: 20, min: 0, max: 20, step: 1 } on ViewSpec (signed-off Q2).
- ViewSettings field: src/engine/types.ts. Clamp + min/max constants: src/engine/constants.ts, exported via src/engine/index.ts.
- Persistence parse+clamp: src/persistence/persistedShapes.ts. NOT published yet -> clean break, no migration (missing key falls back to spec default 20).
- Row: src/view/settingsRows.ts, Grouping section. Signed-off copy (Q4): label "Folder grouping depth"; description "Maximum levels of nested folder groups. 0 turns folder grouping off entirely; 20 is effectively unlimited." (description renders on tab via setDesc and as title tooltip on the panel automatically - the hover requirement).
- Accessor: src/view/settingsRowAccessors.ts ({read, bounds, settlesAt, interaction} from the SAME spec leaf).
- Presenters: SliderRow arm in src/view/SettingsRowView.tsx + addSlider arm in src/view/VicinityGraphSettingTab.ts (compile errors from the closed control-kind switches point at both).
- Write plan + failure notice: src/view/settingsWritePlan.ts, src/view/settingsWriteFailureNotice.ts. Section membership: src/view/settingsSectionFields.ts (grouping/view section).
- Thread the stored value into BOTH deriveFolderGroups call sites (elkMapping + flowMapping consume the grouping result; the value must reach the one place the grouping is derived) replacing the temporary unlimited constant from the core ticket.

Update the tripwire suites the plan ticket lists (settingsProductDefaults, settingsSpecBounds, settingsRowSpecCoverage, settingsRowParity, settingsRowAccessors, settingsWriteFailureNotice, settingsSectionFields, persistedShapes tests) - each fails until the field is wired; the literal default/range lands ONLY in src/engine/settingsProductDefaults.test.ts.

## Acceptance Criteria

- Slider appears in the Grouping section of BOTH the settings tab and the in-graph panel with the signed-off label and description.
- Moving the slider live-rebuilds the graph with the capped grouping; value persists in data.json and clamps on load.
- All tripwire suites updated; npm run check and npm test green.
- Rendered-behavior e2e is a separate ticket; do not add e2e here beyond keeping existing specs green.

