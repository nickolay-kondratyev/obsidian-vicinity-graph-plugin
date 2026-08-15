---
closed_iso: 2026-08-15T05:29:02Z
id: nid_yyugpoh3gv8ip24cizvgrs4w4_e
title: "Plan: Folder grouping depth slider (0-20, 0 = grouping off)"
status: closed
deps: []
links: [nid_5086tzts48n7pnc4q77g7bk9e_e, nid_5vz7mtm2rn6n7nj9cp5mfbslx_e, nid_dqu2jc1kln9ltwzy3lxxocdw7_e, nid_ovayqcmi0vlmzyju40tdxw3sd_e, nid_d422lwuzc4ks6v9dng9e3hd3e_e]
created_iso: 2026-08-15T05:27:58Z
status_updated_iso: 2026-08-15T05:29:02Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
---

HIGH-LEVEL PLAN (decisions signed off by human 2026-08-15 via .out/current_decision.md; exploration ticket nid_d422lwuzc4ks6v9dng9e3hd3e_e).

## Goal
Add a "Folder grouping depth" slider (0-20, default 20) limiting how many levels of nested folder-group boxes render. 0 disables folder grouping entirely; 20 is effectively unlimited (no sentinel value - no sane vault nests 20 group levels).

## Signed-off decisions
- Q1 SEMANTICS: depth N = RENDERED group-nesting levels (what the eye counts). Build the full group tree as today in src/view/folderGrouping.ts (deriveFolderGroups), then MERGE any group deeper than N rendered levels into its level-N ancestor (its member notes fall up into that box). A collapsed single-child chain (box labeled A/B/C) counts as ONE level, since it is one box. Additionally: when boxes disappear (depth lowered), the relationships previously collapsed into group-boundary arrows MUST become visible again as individual note-to-note edges - edge collapse must follow the NEW (shallower) group structure, which falls out naturally because elkMapping/flowMapping derive edge collapse from the grouping result, but must be asserted by tests.
- Q2 RANGE: min 0, max 20, step 1, default 20.
- Q3 DEPENDENT ROWS: when depth = 0, the now-moot rows "Edge depth into groups" and the group-label full-path toggle are DISABLED via the existing declarative disabledWhen mechanism in src/view/settingsRows.ts (extend DEPENDENCY_AWARE_CONTROL_KINDS where a kind is not yet dependency-aware).
- Q4 COPY: label "Folder grouping depth" in the existing Grouping section; description/hover: "Maximum levels of nested folder groups. 0 turns folder grouping off entirely; 20 is effectively unlimited." Rows already render description on the settings tab (setDesc) and as native title tooltip on the in-graph panel - the hover requirement is free.
- Q5 STRUCTURE: focused tickets (this closed plan + 4 implementation tickets, linked, with deps).

## Key exploration facts (2026-08-15)
- Grouping is ONE pure function: deriveFolderGroups in src/view/folderGrouping.ts. Always-on, unbounded; only gate is MIN_GROUP_MEMBER_COUNT = 2. No depth notion exists anywhere yet.
- The existing "Edge depth into groups" slider (edgeDepthIntoGroups) is the exact end-to-end wiring template: spec leaf (src/engine/SettingsSpec.ts BoundedNumberSpec) -> clamp (src/engine/constants.ts) -> ViewSettings field (src/engine/types.ts) -> persistence parse+clamp (src/persistence/persistedShapes.ts) -> row declaration (src/view/settingsRows.ts, grouping section) -> accessor (src/view/settingsRowAccessors.ts) -> both presenters (src/view/SettingsRowView.tsx SliderRow + src/view/VicinityGraphSettingTab.ts addSlider) -> write plan (src/view/settingsWritePlan.ts) -> failure notice (src/view/settingsWriteFailureNotice.ts) -> section membership (src/view/settingsSectionFields.ts).
- Spec-walking tripwire suites fail until the field is fully wired (by design): src/engine/settingsProductDefaults.test.ts, src/engine/settingsSpecBounds.test.ts, src/view/settingsRowSpecCoverage.test.ts, src/view/settingsRowParity.test.ts, src/view/settingsRowAccessors.test.ts, src/view/settingsWriteFailureNotice.test.ts, src/view/settingsSectionFields.test.ts, src/persistence/persistedShapes.test.ts.

## Ticket breakdown (see links/deps on this ticket)
1. Core: depth-cap parameter + merge-up pass in deriveFolderGroups, unit-tested (no setting yet).
2. Setting: spec leaf + full slider wiring + threading into the deriveFolderGroups call sites + tripwire test lines.
3. Dependent rows disabled at 0 (disabledWhen).
4. e2e coverage of rendered behavior (levels capped, 0 = flat with individual edges restored, hover copy present).

