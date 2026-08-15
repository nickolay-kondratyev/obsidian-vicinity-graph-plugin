---
closed_iso: 2026-08-15T06:40:03Z
session_ids: [{"a": "claude", "type": "execution", "id": "7592d8f2-1628-4786-9cac-b5c014191636"}, {"a": "claude", "type": "review", "id": "781f048c-3a42-4793-bbe2-178fe7d11963"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_5vz7mtm2rn6n7nj9cp5mfbslx_e
title: "Setting: Folder grouping depth slider wired end-to-end"
status: closed
deps: [nid_5086tzts48n7pnc4q77g7bk9e_e]
links: [nid_yyugpoh3gv8ip24cizvgrs4w4_e, nid_5086tzts48n7pnc4q77g7bk9e_e, nid_dqu2jc1kln9ltwzy3lxxocdw7_e, nid_ovayqcmi0vlmzyju40tdxw3sd_e]
created_iso: 2026-08-15T05:28:32Z
status_updated_iso: 2026-08-15T06:40:03Z
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

## Resolution (2026-08-15, commit 23d230c)

Wired exactly per the edgeDepthIntoGroups template, every step the ticket lists:

- Spec leaf `globalView.folderGroupingDepth` `{default 20, min 0, max 20, step 1}`
  in `src/engine/SettingsSpec.ts` (ViewSpec); `ViewSettings.folderGroupingDepth`
  in `src/engine/types.ts`; `clampFolderGroupingDepth` +
  `MIN/MAX_FOLDER_GROUPING_DEPTH` in `src/engine/constants.ts`, exported via
  `src/engine/index.ts`; `EngineDefaults.viewSettings()` carries the default.
- Persistence: `parseViewFields` in `src/persistence/persistedShapes.ts` parses
  and clamps with the same function; missing key falls back to the spec default
  20 (clean break, no migration, no PERSISTED_SHAPE_VERSION bump).
- Row declared FIRST in the Grouping section (`src/view/settingsRows.ts`,
  general → specific: it is the master dial the other two rows depend on) with
  the signed-off Q4 label/description; new control kind
  `"folder-grouping-depth"`. Accessor `SettingsRowAccessors.folderGroupingDepth()`;
  interaction `"global-folder-grouping-depth"` in `settingsWritePlan.ts`;
  failure-notice mapping; `folderGroupingDepth` in the grouping column of
  `settingsSectionFields.ts` (so the section reset restores it). Both presenters
  render it as a slider (`SettingsRowView.tsx` `FolderGroupingDepthRow`,
  `VicinityGraphSettingTab.addSlider`).
- Threading: `elkMapping.ts`, `flowMapping.ts` AND `layoutFit.ts` now pass
  `viewSettings.folderGroupingDepth` to `deriveFolderGroups` (the ticket named
  two call sites; the core ticket's resolution had found a third in
  `layoutFit.ts` — left on UNLIMITED it would diverge from the rendered
  grouping, so it takes the cap via a new required parameter, supplied by
  `GraphStructureDiff` from `next.viewSettings`). The temporary
  `UNLIMITED_GROUP_NESTING_DEPTH` constant survives only as the test fixture
  value.
- NOT in the ticket text but required by the live-rebuild AC: `decideLayout`
  (`GraphStructureDiff.ts`) now relayouts when only `folderGroupingDepth`
  changed — the same node/edge id sets produce a DIFFERENT group-box structure,
  so reusing positions would leave new boxes unplaced. Covered by a new BDD
  test beside the nodePreviewPreference reuse tripwire.
- Tests: literal default pinned ONLY in `settingsProductDefaults.test.ts`
  (`"globalView.folderGroupingDepth": 20`); enforcer registered in
  `settingsSpecBounds.test.ts`; switch arms added in
  `settingsRowSpecCoverage/settingsRowAccessors/settingsWriteFailureNotice`
  tests; non-default fixture values in `settingsSectionFields.test.ts` and
  `persistedShapes.test.ts` (plus a new parsing describe: round-trip, 0
  survives, over-max clamps, missing key defaults); threading tripwires in
  `elkMapping.test.ts` / `flowMapping.test.ts` (depth 0 ⇒ no containers / no
  group nodes, flat notes); `graphFixtures.makeViewSettings` ships 20.
- Verified: `npm run check` green, `npm test` green (2175 passed), and the FULL
  `npm run test:e2e` green (184 passed) — no e2e specs added or changed.

Follow-ups already ticketed: dependent-row disabling at 0
(nid_dqu2jc1kln9ltwzy3lxxocdw7_e), rendered-behavior e2e
(nid_ovayqcmi0vlmzyju40tdxw3sd_e).


## Notes

**2026-08-15T06:42:54Z**

__READY_AS_IS__: review found only a stranded comment in persistedShapes.ts (fixed, a762ddf); wiring matches the edgeDepthIntoGroups template at every seam, all three deriveFolderGroups call sites threaded, check + npm test green (2175 passed).
