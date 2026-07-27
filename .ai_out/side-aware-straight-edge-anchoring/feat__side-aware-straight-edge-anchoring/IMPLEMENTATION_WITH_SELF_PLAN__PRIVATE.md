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
