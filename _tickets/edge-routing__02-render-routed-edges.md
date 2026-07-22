---
id: nid_82xnrearif6y7fcd80y5gprkc_e
title: "edge-routing__02-render-routed-edges"
status: open
deps: [nid_pc87xabr7xi67c4qmht938r2o_e]
links: []
created_iso: 2026-07-22T16:04:58Z
status_updated_iso: 2026-07-22T16:04:58Z
type: task
priority: 1
assignee: CC_WITH-nickolaykondratyev
parent: nid_w8co2gp7cok2a2hwwsm88brfo_e
---

# Phase 2 — Render routed edges (smoothed path, arrowheads, badge, e2e visual smoke)

Parent epic (full plan): `_tickets/edge-routing-via-libavoid-js-obstacle-avoiding-edges-for-all-layouts-force-directed-first.md` (id `nid_w8co2gp7cok2a2hwwsm88brfo_e`).
DEPENDS ON: `edge-routing__01-routing-pass-and-snapshot-threading` (`nid_pc87xabr7xi67c4qmht938r2o_e`) — `FlowEdge.routedPoints`/`VicinityEdgeData.routedPoints` must already exist and be populated when the `edgeRouting` setting is ON.

## Goal

`VicinityEdge` renders the routed polyline (smoothed, organic-looking) with correct arrowheads and count badge. Straight-line rendering remains the fallback whenever `routedPoints` is absent or degenerate.

## Current rendering (read before changing)

- `src/view/VicinityEdge.tsx:34` `VicinityEdge`: `<BaseEdge>` with path from `edgePathFor` (`:49`), self-drawn `<polygon>` target arrowhead (`:50`), optional source arrowhead for `bidirectional` (`:56`), count badge via `EdgeLabelRenderer` (`:63`). Arrowheads are NOT React Flow marker-end.
- `src/view/edgeGeometry.ts`: `edgePathFor` (`:62`) — straight `M..L..` (`:94`) or quadratic bow when `hasOpposite` (`:114`, curvature `EDGE_PAIR_CURVATURE_PX = 34` at `:54`). `arrowFromApproach` (`:142`) computes the target triangle inset back along the incoming tangent (inset fraction 0.12, min 14px, max 48px, `:40-42`). `sourceArrowOf` (`:123`) for the bidirectional source-side arrow.
- These geometry functions are pure and unit-tested — keep the new ones the same way (RF-free module).

## Work items

1. `src/view/edgeGeometry.ts` — new pure functions (BDD/GIVEN-WHEN-THEN vitest, failing-first):
   - `routedPathFor(points: RoutedPoint[]): string` — SVG path over the polyline with rounded corners: quadratic smoothing at each interior bend (shrink each corner by a named constant, e.g. `ROUTED_CORNER_RADIUS_PX`; clamp to half of adjacent segment lengths so short segments don't invert). 2 points ⇒ plain `M..L..` identical to today's straight case.
   - Arrowhead generalization: target arrowhead from the LAST segment tangent, source arrowhead from the FIRST segment tangent. Reuse/extend `arrowFromApproach`/`sourceArrowOf` rather than duplicating the inset rules (DRY — the inset constants live once).
   - `polylineMidpoint(points: RoutedPoint[]): {x, y}` — walk the polyline to half of total length; used for badge anchoring.
2. `src/view/VicinityEdge.tsx`:
   - When `data.routedPoints` present (length ≥ 2): render `routedPathFor` path; arrowheads from segment tangents; badge at `polylineMidpoint`.
   - Else: EXACTLY current behavior (`edgePathFor` + existing arrow/badge math). No behavior change when routing is OFF — all pre-existing edge tests must pass untouched (respect existing behavior-capturing tests).
   - `hasOpposite` pairs while routing is ON: render each routed polyline as-is (no bow). Separation comes from libavoid buffers. If visual overlap is bad in practice, record it here and defer to the arrows.md:88-94 collapse-to-bidirectional follow-up — do NOT invent a third mechanism in this ticket.
3. Coordinate space check: routed points are absolute/flow coords; `VicinityEdge` draws in the same flow coordinate space RF provides `sourceX/sourceY` in — verify for subflow-child edges (parent-relative node positions, `src/view/flowMapping.ts:315`) and fix at the mapping layer if there's an offset, with a WHY comment.
4. e2e (Playwright, existing `e2e/` setup): vault fixture in force layout where a straight A→B edge would cross node C (positions deterministic — layout is seeded, `src/view/d3ForceRefinement.ts:108` fixed-seed LCG). With `edgeRouting` ON assert the rendered edge path has >2 route points (path `d` contains bends) and take a screenshot for the visual record (screenshots go to `/.out`, NOT source control).

## Acceptance criteria

- [ ] Routing ON in dev-vault (force layout): edges visibly route around nodes with smooth corners; arrowheads point along the final approach; badges sit on the routed path.
- [ ] Routing OFF: pixel-identical to today (all pre-existing vitest + e2e green without modification).
- [ ] New geometry functions fully unit-tested (rounded-corner path, degenerate 2-point case, midpoint walk, tangent arrowheads).
- [ ] e2e visual smoke passes; screenshot saved under `/.out`.
- [ ] `npm run check` clean.

## Out of scope

- Enabling by default, tuning routing parameters, layered/radial verification (ticket `edge-routing__03-all-layouts-tuning-default-on`).
- Collapsing hasOpposite pairs into single bidirectional lines (separate follow-up per `docs-internal/vicinity-graph-specs/arrows.md:88-94`).

