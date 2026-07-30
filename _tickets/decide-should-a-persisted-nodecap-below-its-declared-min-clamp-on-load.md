---
id: nid_5meu9s38sbrv1703na77of4m7_e
title: "decide: should a persisted nodeCap below its declared min clamp on load?"
status: open
deps: []
links: [nid_x6hgehsu5il1d1shuraz3ufqy_e]
created_iso: 2026-07-30T03:08:28Z
status_updated_iso: 2026-07-30T03:08:28Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [settings, decide, persistence]
---

Surfaced by the spec-iterating bounds test added in nid_x6hgehsu5il1d1shuraz3ufqy_e (src/engine/settingsSpecBounds.test.ts).

FACTS:
- SETTINGS_SPEC declares `globalView.nodeCap.min = 1` (src/engine/SettingsSpec.ts) with the WHY "at least the central must be renderable".
- The parse path does NOT enforce it: src/persistence/persistedShapes.ts `parseViewFields` reads nodeCap through `numberOrUndefined` with no clamp, unlike `outlineMaxDepth`, which is clamped with the same function the slider uses precisely so hand-edited JSON cannot reach an off-switch value.
- A behavior-capturing test PINS the current behavior: src/persistence/persistedShapes.test.ts "WHEN a persisted view stores nodeCap zero THEN the zero survives (a real value, not an absence)" — its stated WHY is the falsy-is-not-absence rule, using nodeCap as the vehicle.
- Both number inputs already reject values below MIN_NODE_CAP (src/view/VicinityGraphSettingTab.ts, src/view/SettingsRowView.tsx), so the min is unreachable through the UI; only a hand-edited data.json (or a sync mangle) can store 0 or a negative.
- Meanwhile src/engine/settingsSpecBounds.test.ts lists nodeCap in BOUNDS_ENFORCED_OUTSIDE_THE_ENGINE and points at this ticket.

DECISION NEEDED (human): should `parseViewFields` clamp nodeCap into [min, inf) on load, like outlineMaxDepth?
- If YES: add a `clampNodeCap` next to `clampOutlineMaxDepth` in src/engine/constants.ts, use it in parseViewFields, and REWRITE the nodeCap-zero test to express the falsy-is-not-absence rule through a field that has no min (or through a stored `false`/empty-list field) so that rule keeps its coverage.
- If NO: say so on the spec next to `nodeCap.min` (the min is then an INPUT affordance only, exactly like the depth stepper bounds), and this ticket closes as documentation.

No user impact known either way: a stored nodeCap of 0 renders the central note alone.

