# IMPLEMENTATION_WITH_SELF_PLAN — PUBLIC summary (force-layout-only)

Ticket `01-force-layout-only-remove-layered-and-radial-layout-modes.md`.
**Status: COMPLETE.** Layered + radial layout modes removed ENTIRELY; force is
the only layout. No `LayoutMode` symbol remains in production code.

## Verification (acceptance criteria)
- `npm run check` (tsc strict): **PASS** (exit 0).
- `npm test` (vitest): **PASS** — `Test Files 56 passed (56)`, `Tests 697 passed (697)`.
- Stray-symbol grep over `src/`: clean. Remaining hits are legitimate:
  - one intentional persistedShapes degradation test using a removed `layoutMode:
    "radial"` value (proves old persisted values load without error);
  - elk `layered` algorithm string in `ELK_GROUP_MEMBER_OPTIONS` (folder-group
    members — stays by design).

## Files changed
Engine (pure):
- `types.ts` — deleted `LayoutMode` type + `LAYOUT_MODES` const + doc; removed
  `ViewSettings.layoutMode` field.
- `index.ts` — dropped `LayoutMode` type export, `LAYOUT_MODES` value export,
  `DEFAULT_LAYOUT_MODE` export.
- `constants.ts` — dropped `LayoutMode` import + `DEFAULT_LAYOUT_MODE`; removed its
  use in `EngineDefaults.viewSettings()`.
- `ViewSettingsResolver.ts` — removed `layoutMode: field("layoutMode")`.

View:
- `LayoutSection.tsx` — **DELETED** (toolbar layout `<select>`).
- `GraphToolbar.tsx` — removed import + `<LayoutSection/>` usage.
- `settingsWritePlan.ts` — removed `LayoutMode` import, `global-layout` interaction
  union member, and its `case`.
- `constants.ts` — deleted `ELK_LAYER_SPACING`, `ELK_LAYERED_ROOT_OPTIONS`,
  `ELK_RADIAL_ROOT_OPTIONS`, `ELK_ROOT_OPTIONS_BY_MODE`, `LayoutMode` import.
  KEPT + re-documented `ELK_DIRECTION` (now "group-member layered pass") and
  `ELK_GROUP_MEMBER_OPTIONS`; folded `ELK_FORCE_ROOT_OPTIONS` doc to describe the
  single root. Reworded the D3 charge doc's stray "radial" mention.
- `elkMapping.ts` — dropped the `mode` variable; containers ALWAYS use
  `ELK_GROUP_MEMBER_OPTIONS`, root edges ALWAYS `projectedRootEdges`, root ALWAYS
  `ELK_FORCE_ROOT_OPTIONS`. Force pipeline behavior UNCHANGED (verified). Rewrote
  module + `projectedRootEdges` docs to drop layered/radial framing.
- `GraphViewController.ts` — removed `LayoutMode` import; deleted
  `ROUTING_SKIPPED_LAYOUT_MODE` + `isRoutingSkippedLayout`; routing gate simplified
  to `if (!graph.viewSettings.edgeRouting)`.
- `GraphStructureDiff.ts` — removed the `layoutMode` relayout comparison + doc term.
- `d3ForceRefinement.ts` — reworded stray "force/radial" prose to "force pass".

Persistence:
- `persistedShapes.ts` — removed `LAYOUT_MODES` import + `layoutMode` parse block.
  **No `PERSISTED_SHAPE_VERSION` bump** (see deviation below).

Tests / fixtures:
- `testFixtures/graphFixtures.ts` — removed `layoutMode` field, `withLayoutMode`
  helper, `LayoutMode` import; reworded doc.
- `elkMapping.test.ts` — root-algorithm assertions layered→force + INCLUDE_CHILDREN
  →undefined; folder-group cross-boundary edge expectation updated to force-PROJECTED
  ids (hand-verified); radial/force block converted to a single force block.
- `ElkLayout.test.ts` — deleted both radial describe blocks (force is covered by
  D3ForceLayout.test); base + compound blocks now run force by default.
- `D3ForceLayout.test.ts` — `hubGraph()` zero-arg; deleted the radial-comparison
  test + its `boundingBoxArea` helper + the non-force pass-through describe.
- `GraphViewController.test.ts` — deleted the radial routing-skip test; removed
  `withLayoutMode` import.
- `settingsWritePlan.test.ts` — deleted the `global-layout` test.
- `persistedShapes.test.ts` — replaced two layoutMode tests with one degradation
  test (removed field ignored, siblings survive).
- `GraphStructureDiff.test.ts` — deleted the `layoutMode` switch describe.

Docs:
- `architecture-map.md` — layout-modes line → force-only (note group members still
  use elk `layered` internally).
- `specs/graph/arrows.md` — removed the radial routing-skip bullet and the
  web-worker radial follow-up; routing now gated solely on `edgeRouting`.

## Deviation from ticket (documented, per EXPLORATION decision #3)
Ticket text said "bump per persistence convention." The codebase's ACTUAL
convention is **no bump**: `PERSISTED_SHAPE_VERSION` stayed at `1` through three
prior additive shape changes; the per-field parser silently drops unknown/removed
fields, so old `"layered"`/`"radial"` values already load without error. Confirmed
`version` is only equality-checked in the parsers — never used for gated branching.
Therefore NOT bumped. Covered by the new degradation test.

## Notes for the reviewer
- The riskiest edit was `elkMapping.test.ts`'s folder-group block: `makeViewSettings()`
  used to default `layoutMode:"layered"`, so several tests were implicitly layered.
  With the field gone they now exercise force; cross-boundary root edges switch from
  raw pass-through to projected/deduped/flipped. Expectations were re-derived from
  actual force output (not faked) and the whole suite is green.
- Force render pipeline (elk force seed + d3 refinement in `GraphLayoutRunner`,
  gated on root algorithm === force) is untouched and still exercised end-to-end.

## Stale-ticket reminder (TOP_LEVEL_AGENT to close/supersede — I did NOT touch them)
- `_tickets/layout-mode-optional-per-doc-override-ui-settings-tab-surface.md`
  (`nid_fqb570fmygcijuer2cjxtbana_E`) — target `layoutMode` field no longer exists.
- `_tickets/edge-routing-re-enable-radial-routing-via-web-worker-offload.md`
  (`nid_si26o1o5h4yrvv5v8tcgz1b68_e`) — radial no longer exists.

## Not touched (intentionally)
`docs-internal/CHANGELOG.md` still references radial — it is a historical record,
not current-state docs; left as-is. `high-level-plan.md` and `README.md` do not
mention layout modes (confirmed via grep) — no edit needed.
