---
id: nid_abreq4lmpo8vnvf61y9k9yly0_e
title: "SettingsSpec 'exact shipped baseline' toEqual silently omits outlineMaxDepth"
status: open
deps: []
links: [nid_3k0a4zl6in0mj8lcjibkjq2dx_e, nid_niz5dz6uqeyv237ckm15ittqa_e, nid_8p0nn2g34d97finokwlz3u1dt_e]
created_iso: 2026-07-25T03:52:21Z
status_updated_iso: 2026-07-25T03:52:21Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [tests]
---

`src/engine/SettingsSpec.test.ts` (~:28-79) has a test whose name promises the defaults literal equals "the exact shipped baseline", but the object it builds and the object it compares against BOTH omit `ViewSettings.outlineMaxDepth`. So the field has never been asserted, and the test's shape makes under-population invisible: you add a key to `SETTINGS_SPEC.globalView` and nothing goes red.

Found while adding `nodePreviewPreference` in `node-content-preference` (which WAS added to both sides of that literal, correctly). The old omission was left alone on purpose so that branch's diff stayed attributable.

## Acceptance Criteria

1. `outlineMaxDepth` appears on both sides of the baseline `toEqual`.
2. The test can no longer silently omit a field — e.g. build the actual object by projecting EVERY key of `SETTINGS_SPEC.globalView` (or add a compile-time exhaustiveness guard) so a new spec entry with no baseline value fails.
Do not weaken the existing assertions. Note the file also carries a known-RED `linkStrengthFactor.max` baseline tracked by docs-internal/tickets/ticket-settings-baseline-tests-stale-after-spacing-change.md — do not fix that here.

