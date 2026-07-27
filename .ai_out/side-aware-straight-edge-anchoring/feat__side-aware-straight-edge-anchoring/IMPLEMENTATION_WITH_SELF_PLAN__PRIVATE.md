# PRIVATE — side-aware straight-edge anchoring (rehydration memory)

Ticket `nid_var2o7krxq7ribq3iofni3aw1_e`. Branch `feat/side-aware-straight-edge-anchoring`.

## Plan (checklist)

**Goal**: non-routed edges anchor on the FACING SIDE of both endpoint rects (floating-edge pattern),
computed purely in `edgeGeometry.ts`, wired with a thin line in `VicinityEdge.tsx`.

1. [ ] `edgeGeometry.ts`: private `rectBorderPointToward(rect, towardX, towardY)` built on the
   EXISTING `segmentRectEntryPoint` + `isStrictlyInsideRect`. No new intersection math.
2. [ ] `edgeGeometry.ts`: exported `facingSideAnchorsFor(sourceRect?, targetRect?): StraightEdgeAnchors | null`.
   `null` = fall back to RF handle coords (either rect missing, or degenerate overlap).
3. [ ] `edgeGeometry.test.ts`: BDD tests (facing side up/down/left/right/diagonal, source mirror,
   overlap fallback, missing-rect fallback, `hasOpposite` bow from new endpoints).
4. [ ] `VicinityEdge.tsx`: `useInternalNode(source/target)` + `clipRectOfNode` + one `??` line.
5. [ ] `docs-internal/specs/graph/arrows.md`: new `## Straight (non-routed) edge anchoring` section.
6. [ ] `npm test`, `npm run check`, try `npm run test:e2e` (output → `.tmp/`).
7. [ ] Ticket for the stale `VicinityGraphFlow.tsx:96-99` comment.
8. [ ] Commit; write PUBLIC.

## Key facts learned (don't re-derive)

- `segmentRectEntryPoint(from, to, rect)` (Liang–Barsky, `edgeGeometry.ts:261`) needs `from` OUTSIDE
  and `to` INSIDE. Calling it with `from = otherCentre`, `to = ownCentre` yields the facing-side
  border point directly. Verified by hand: rect [200..300]x[0..100], from (50,50) → returns (200,50).
- `isStrictlyInsideRect` is the degenerate detector: if the other node's centre is strictly inside
  this rect, there is no facing side → `null`.
- `edgePathFor` signature/output bytes MUST stay put — `edgeGeometry.test.ts:255` asserts
  `routedGeometryFor([2 pts]) toEqual edgePathFor(...)`, and `routedGeometryFor:443` calls it
  positionally.
- No jsdom/@testing-library in this repo → React components are NOT unit-testable. All logic pure.
- `useInternalNode` returns `| undefined`. Rect = `internals.positionAbsolute` +
  (`measured.width ?? node.width`, `measured.height ?? node.height`). Never DOM-measure
  (`onlyRenderVisibleElements` unmounts culled nodes but keeps them in the store).
- Ticket scope is STALE: `edgeRouting` ViewSetting and `ROUTING_SKIPPED_LAYOUT_MODE`/`LayoutMode` were
  deleted by closed tickets. The live justification is the degenerate `clipRouteToEndpointRects`
  chord fallback (`edgeGeometry.ts:190-201`), which fires in NORMAL operation.
- Spec path is `docs-internal/specs/graph/arrows.md` (not `docs-internal/vicinity-graph-specs/`).
- `e2e/selectorGuard.test.ts:205` is a tripwire on the edge-path selector — not touched.

## ITERATION 1 (post-review) — facts learned, do NOT re-derive

- **The straight branch is NOT reached in normal operation.** `clipRouteToEndpointRects`'s
  degenerate chord is a 2-point `routedPoints` array → `VicinityEdge` takes the ROUTED
  branch. My original CALLOUT 1 was wrong; corrected in PUBLIC + `arrows.md`.
- **No un-routed first frame either**: `GraphViewController.runRebuild` awaits
  `resolveRoutes` BEFORE `publish` (line ~234-241), so nothing is published un-routed.
  Live paths for the straight branch: whole-pass router failure, edge missing from the
  route map, endpoint dropped from `extractEdgeRoutingInput` (no position / no group
  dimensions / `hasFiniteGeometry`).
- **Degenerate chord ⟂ facing anchors.** Brute force (200k random rect pairs, throwaway
  vitest harness under `src/view/__scratch.test.ts`, deleted): for a 2-point centre→centre
  chord, **0 of ~37,700** degenerate cases have usable anchors; for 3-point routes,
  191/~37,600 (~0.5%). Structural reason: a chord degenerates exactly when a box swallows
  the other's border crossing = exactly when the ordering guard returns null. Pinned by a
  test. → B2(b) REJECTED, ticket `nid_bq5k5gx5k3112otsbz1u0h7ba_e` (`[decide]`).
- **Scratch-harness trick**: vitest here swallows `console.log`; write to `.tmp/…` with
  `appendFileSync` instead. Put the scratch file under `src/**/*.test.ts` so vitest picks
  it up, and DELETE it before committing.
- Guards now in `facingSideAnchorsFor`: `undefined` rect → `isAnchorableRect` (finite AND
  positive extent) → strictly-inside → crossing null → **dot(drawn, centre) <= 0**.
  The last one covers partial overlap (<0) and touching (==0).
- `isAnchorableRect`'s `widthPx>0 && heightPx>0` is what RESTORES `segmentRectEntryPoint`'s
  "`to` strictly inside" precondition — do not delete it thinking it is redundant.
- Did NOT edit `CLAUDE.md` (C5): project config, and `docs-internal/tickets/` does still
  exist. Flagged to the human as CALLOUT 7 instead.
