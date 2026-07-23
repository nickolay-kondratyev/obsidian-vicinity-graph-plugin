---
id: nid_ihlfchb69wt1hqot6iqy7a9m9_e
title: "force-layout-only: remove layered and radial layout modes"
status: open
deps: []
links: []
created_iso: 2026-07-23T23:33:41Z
status_updated_iso: 2026-07-23T23:33:41Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [layout, settings, simplification]
---

Decision: "Organic (force)" is the only layout mode we keep. Remove "layered" and "radial" entirely (type, UI, elk options, routing special-cases, tests).

Scope:
- src/engine/types.ts:139-142 — delete LayoutMode union + LAYOUT_MODES (or collapse to the single value and inline away). Remove layoutMode field from ViewSettings (src/engine/types.ts:200) and re-exports in src/engine/index.ts:46,56.
- src/engine/constants.ts:40,83 — remove DEFAULT_LAYOUT_MODE.
- src/engine/ViewSettingsResolver.ts:50 — remove layoutMode resolution.
- src/view/LayoutSection.tsx — delete the toolbar layout <select> (labels Radial / Organic (force) / Layered (rows)).
- src/view/settingsWritePlan.ts:34,84-85 — remove the "global-layout" command.
- src/persistence/persistedShapes.ts:141-142 — drop layoutMode parsing; old persisted values are simply ignored (persisted shapes carry a version field — bump per persistence convention).
- src/view/constants.ts:79-97,143-147 — delete ELK_LAYERED_ROOT_OPTIONS, ELK_RADIAL_ROOT_OPTIONS, ELK_ROOT_OPTIONS_BY_MODE, ELK_DIRECTION, ELK_LAYER_SPACING; keep ELK_FORCE_ROOT_OPTIONS and use it directly in src/view/elkMapping.ts:33,78. NOTE: ELK_GROUP_MEMBER_OPTIONS (layered INSIDE folder containers) stays — force root still uses layered arrangement inside groups.
- src/view/GraphViewController.ts:246,361-368 — remove isRoutingSkippedLayout / ROUTING_SKIPPED_LAYOUT_MODE (radial-only concept).
- Tests: update src/view/settingsWritePlan.test.ts:77-80, src/persistence/persistedShapes.test.ts:43-60, src/view/GraphViewController.test.ts (radial-skip cases ~:456-465), src/view/elkMapping.test.ts, src/view/ElkLayout.test.ts. Keep src/view/D3ForceLayout.test.ts. This is explicit human-approved removal of behavior-capturing tests for layered/radial.
- Supersede/close stale tickets: _tickets/layout-mode-optional-per-doc-override-ui-settings-tab-surface.md and _tickets/edge-routing-re-enable-radial-routing-via-web-worker-offload.md (radial no longer exists).
- Update docs: docs-internal/plan/high-level-plan.md, README.md (settings model), docs-internal/architecture-map.md if it mentions layout modes.

## Acceptance Criteria

- npm test and npm run check pass.
- No LayoutMode symbol remains; toolbar has no layout selector; force pipeline (elk force seed + d3 refinement) unchanged.
- Old persisted layoutMode values load without error.

