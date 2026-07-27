---
id: nid_aau4r0sj8oudhi711qr9j5x1l_e
title: "[decide] Node cap has no upper bound in SETTINGS_SPEC"
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

