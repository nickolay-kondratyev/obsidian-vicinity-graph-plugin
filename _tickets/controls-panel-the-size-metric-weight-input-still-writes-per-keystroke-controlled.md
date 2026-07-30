---
closed_iso: 2026-07-30T09:14:24Z
id: nid_9uzrvqv0k5qgckgdaqtgr41ky_e
title: "controls panel: the size-metric WEIGHT input still writes per keystroke (controlled)"
status: closed
deps: []
links: [nid_hatwq2jlkhno5t6awcz0q6t9q_e]
created_iso: 2026-07-30T08:09:17Z
status_updated_iso: 2026-07-30T09:14:24Z
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


## Notes

**2026-07-30T09:14:24Z**

RESOLVED. The panel's per-metric Weight input is now uncontrolled + blur/Enter-committed, so an out-of-range multi-digit weight no longer snaps mid-keystroke.

Design decision (the one the ticket left open): NEITHER a two-layout NumberField NOR policy-only reuse. The commit PROTOCOL was extracted into a useNumberFieldCommit hook in src/view/SettingsRowView.tsx — bounds->min/max/step, defaultValue, reseed key, Enter-blurs-to-commit, aria-invalid/aria-describedby refusal wiring — shared 100%, layout shared 0%. NumberField folded into NumberRow. The decision still comes from NumberRowCommitPolicy; the value half still from SettingsRowAccessors.metricWeight; the input is still disabled while its metric is off.

Also fixed en route: a refusal message could outlive a store move (it now binds to the stored value it judged, via the pure NumberFieldRefusal seam in src/view/numberRowCommit.ts); e2e/controlsRestart.e2e.ts set a panel number input without blurring, which would have stored nothing.

New guard: src/view/typedNumberFields.test.ts scans every row-rendering module for a controlled number input; shared scan reader in src/view/rowRenderingSource.ts.

npm run check exit 0; npm test exit 0 (96 files / 1283 tests). npm run test:e2e NOT run (needs real Obsidian) — worth running before release.
Reviewed to APPROVED in round 2. change_log: lgie1vruudg6aaieb1c4cesfv. Commits: 1875811, 7da47d3, e75c33f.
Follow-ups filed: nid_bbe962ojwwkhzn3uq27zw5w6l_e (focus-out commits an untyped value); the disabled-criterion test was recorded on nid_7qot0m6nuxxmd5z0yb9jylsd6_e.
