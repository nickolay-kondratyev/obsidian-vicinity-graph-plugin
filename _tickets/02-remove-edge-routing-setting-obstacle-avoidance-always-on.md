---
closed_iso: 2026-07-24T00:59:06Z
id: nid_n2zht3y7sa953l5whfqi5zw1b_e
title: "remove edge-routing setting: obstacle avoidance always on"
status: closed
deps: [nid_ihlfchb69wt1hqot6iqy7a9m9_e]
links: []
created_iso: 2026-07-23T23:33:57Z
status_updated_iso: 2026-07-24T00:59:05Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [routing, settings, simplification]
---

Decision: obstacle-avoiding edge routing (libavoid) is always ON; remove the user setting entirely.

Scope:
- src/engine/types.ts:201-202 — remove edgeRouting field from ViewSettings (its doc comment is also stale: says default OFF, actual default is ON per src/engine/constants.ts:49).
- src/engine/constants.ts:49,84 — remove DEFAULT_EDGE_ROUTING.
- src/engine/ViewSettingsResolver.ts:51 — remove resolution.
- src/view/VicinityGraphSettingTab.ts:51-60 — remove the "Obstacle-avoiding edge routing" toggle.
- src/view/settingsWritePlan.ts:35-36,86-87 — remove the "global-edge-routing" command.
- src/persistence/persistedShapes.ts:133-134 — drop edgeRouting parsing (old persisted values ignored; bump persisted version per convention).
- src/view/GraphViewController.ts:246 — routing pass runs unconditionally (the isRoutingSkippedLayout radial guard is removed by the layered/radial-removal ticket; do that ticket first).
- Tests/fixtures: src/view/testFixtures/graphFixtures.ts:40-85 currently uses baseline edgeRouting:false with withEdgeRouting() opt-in — invert: routing is always on, so remove the field/helper and update tests that relied on routing-off baseline. Update src/view/GraphViewController.test.ts:433-465 (router-not-invoked-when-off case is removed behavior — explicit human-approved removal), src/view/settingsWritePlan.test.ts, src/persistence/persistedShapes.test.ts:43-60, src/view/edgeRouting.test.ts, src/view/GraphStructureDiff.test.ts.
- Consider test perf: FakeEdgeRouter keeps unit tests fast; real libavoid wasm stays lazy-loaded (src/view/edgeRouting.ts:369) and e2e-covered (e2e/edgeRouting.e2e.ts).
- Update README.md settings model + docs-internal/plan/high-level-plan.md.

## Acceptance Criteria

- npm test and npm run check pass.
- No edgeRouting setting in ViewSettings, settings tab, write plan, or persistence.
- Routing pass always runs in GraphViewController; e2e routing tests pass.

