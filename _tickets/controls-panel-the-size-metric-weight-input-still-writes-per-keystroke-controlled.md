---
id: nid_9uzrvqv0k5qgckgdaqtgr41ky_e
title: "controls panel: the size-metric WEIGHT input still writes per keystroke (controlled)"
status: open
deps: []
links: [nid_hatwq2jlkhno5t6awcz0q6t9q_e]
created_iso: 2026-07-30T08:09:17Z
status_updated_iso: 2026-07-30T08:09:17Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [sizing, settings, ux, settings-cleanup]
---

Left over after nid_hatwq2jlkhno5t6awcz0q6t9q_e, which converted the panel's NumberRow-based rows (Min px / Max px / decay k via SizingNumberRow, and NodeCapRow) to UNCONTROLLED, blur-committed fields.

The one typed field in the panel that was NOT converted is the per-metric WEIGHT input in `SizingMetricRow` (src/view/SettingsRowView.tsx). It has its own inline markup rather than going through `NumberRow` (it sits beside the metric enable toggle, is `disabled` when the metric is off, and carries a "Weight" title), so it kept `value={weight}` + a per-`onChange` write.

Consequence: the SAME field-snapping the parent ticket fixed everywhere else. `metricWeight` is clamped by `clampSizingNumber`, so typing a value past the weight range snaps the field mid-keystroke. It is milder than the min/max case (the range is small and users rarely type multi-digit weights), which is why it was left out of scope rather than fixed silently.

The settings TAB's weight input is already fine — it is debounced via `src/view/settingsDebounce.ts` (`VicinityGraphSettingTab.addSizingMetric`).

SUGGESTED FIX: render the weight through the same `NumberField` the parent ticket introduced in src/view/SettingsRowView.tsx (blur-commit + reseed-on-remount), passing `NO_CROSS_FIELD_RULE` from src/view/numberRowCommit.ts and a `disabled` flag. That needs `NumberField` to grow a `disabled` prop and to allow markup other than the label-beside-field shape — decide whether that is one shared component with two layouts, or whether the metric row keeps its markup and reuses only `NumberRowCommitPolicy`.

## Acceptance Criteria

- Typing a multi-digit out-of-range weight into the PANEL no longer snaps the field mid-keystroke.
- No knowledge duplicated: the commit decision still comes from `NumberRowCommitPolicy` (src/view/numberRowCommit.ts), the value half still from `SettingsRowAccessors.metricWeight`.
- The weight input stays disabled while its metric is off.
- `npm run check` and `npm test` green.

