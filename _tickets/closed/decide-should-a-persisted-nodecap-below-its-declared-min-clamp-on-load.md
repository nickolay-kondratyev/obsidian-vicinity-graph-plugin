---
closed_iso: 2026-07-31T17:22:22Z
id: nid_5meu9s38sbrv1703na77of4m7_e
title: "decide: should a persisted nodeCap below its declared min clamp on load?"
status: closed
deps: []
links: [nid_x6hgehsu5il1d1shuraz3ufqy_e]
created_iso: 2026-07-30T03:08:28Z
status_updated_iso: 2026-07-31T17:22:22Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [settings, persistence]
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


## Notes

**2026-07-31T17:22:22Z**

DECIDED (owner, 2026-07-31): NO — parseViewFields keeps loading nodeCap VERBATIM; the declared min stays an INPUT affordance only, exactly like the depth stepper bounds.

Rationale: the outlineMaxDepth clamp exists because a stored 0 there is a hidden OFF-SWITCH stepping on nodePreviewPreference's job; a nodeCap of 0 has no such conflict — it degrades gracefully (central note renders alone). The closer precedent is the depths (linkDepthOut etc.), which are stored verbatim with the clamp living only on the input accessor. Clamping would also have silently rewritten a stored 0->1 and required rewriting the falsy-is-not-absence pin test for no user-visible gain.

Applied (documentation only, per the ticket's NO branch):
- src/engine/SettingsSpec.ts — nodeCap doc comment now states the min is an input affordance and records this decision id.
- src/engine/settingsSpecBounds.test.ts — the BOUNDS_ENFORCED_OUTSIDE_THE_ENGINE reason for globalView.nodeCap now cites the decision instead of pointing at this open ticket.
- Behavior-capturing test persistedShapes.test.ts (nodeCap zero survives) stays AS-IS — it now pins decided behavior, not an open question.

Verified: vitest on settingsSpecBounds/persistedShapes/SettingsSpec suites (64 passed) and npm run check clean.
