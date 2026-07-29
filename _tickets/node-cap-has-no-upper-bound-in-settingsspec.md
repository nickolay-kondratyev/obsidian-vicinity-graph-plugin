---
id: nid_aau4r0sj8oudhi711qr9j5x1l_e
tags: [settings]
title: "Node cap has no upper bound in SETTINGS_SPEC"
status: open
deps: []
links: []
created_iso: 2026-07-27T17:44:42Z
status_updated_iso: 2026-07-27T17:44:42Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
---

`SETTINGS_SPEC.globalView.nodeCap` (`src/engine/SettingsSpec.ts`, `MinBoundedNumberSpec`) is the ONLY numeric setting with no `max`. `src/view/VicinityGraphSettingTab.ts` (`renderPerformance()`) therefore accepts any integer >= `MIN_NODE_CAP`; a typed `100000000` reaches `src/engine/GraphTruncator.ts` and the layout pass.

Explicitly held OUT OF SCOPE of the settings debounce/validation ticket (`nid_x6l6x07rd1d1h4cefqmnyrbec_e`): that ticket named only sizing px + decay-k, and capping the cap changes user-visible behavior.

## Design

Needs `nodeCap` widened from `MinBoundedNumberSpec` to `BoundedNumberSpec` in `src/engine/SettingsSpec.ts` (plus the locked-in literals in `src/engine/SettingsSpec.test.ts`), a WHY comment for the chosen ceiling, and a clamp on the write path. The unbounded shape looks deliberate ("power users may want everything"), so the ceiling is a product call, not a code call.

## Acceptance Criteria

HUMAN picks a ceiling (or confirms unbounded is intended and this ticket is closed as WONTFIX); if bounded, the spec, its test, and the tab input`s `max` attribute all agree.


## Notes

**2026-07-29T17:28:25Z**

DECISION (owner, 2026-07-29): CEILING = 1000.

globalView.nodeCap becomes a plain BoundedNumberSpec { default: 100, min: 1, max: 1000 }, like every
other numeric setting -- so the tab's input max attribute, the spec baseline test literals, and the
clamp all fall out of one edit.

WHY 1000 (owner picked this over the 5000 that was floated): 1000 is comfortably above any legible
graph, so the chance of a legitimate request being blocked is near zero, and it is a deliberate hard
"no" to whole-vault rendering -- that is not what this plugin is for. The failure mode being closed
is a typo/paste (e.g. 100000000), which today silently degrades to "no truncation" because
GraphTruncator.ts:42 just slices, pushing unbounded cost onto elk + React Flow layout.

Unpublished repo => clamp stored values on load, no migration.
