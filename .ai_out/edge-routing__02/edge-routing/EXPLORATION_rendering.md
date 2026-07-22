# Exploration: rendering routed edges (edge-routing__02)

## 1. `src/view/VicinityEdge.tsx` (84 lines)
- Imports: `BaseEdge, EdgeLabelRenderer` from `@xyflow/react` (:1); `Edge, EdgeProps` type-only (:2); `linkCountBadgeText` from `./badgeText` (:4); `edgePathFor` from `./edgeGeometry` (:5); `RoutedPoint` type-only from `./edgeRouting` (:6).
- Constants: `ARROWHEAD_LENGTH_PX = 11` (:22), `ARROWHEAD_HALF_WIDTH_PX = 6` (:23) — build static triangle `points` string, tip at origin pointing +x.
- `VicinityEdgeData` (:26-37): `{ count:number; hasOpposite:boolean; bidirectional:boolean; routedPoints?: readonly RoutedPoint[] }` — routedPoints added phase 01, NOT yet consumed.
- `VicinityEdgeType = Edge<VicinityEdgeData,"vicinity">` (:39).
- `VicinityEdge(props: EdgeProps<VicinityEdgeType>)` (:41-84). Destructures `id, sourceX, sourceY, targetX, targetY, data`. No sourcePosition/targetPosition. RF computes endpoints from node absolute positions (resolves subflow children to absolute flow coords).
  - `:49` `edgePathFor(sourceX, sourceY, targetX, targetY, data?.hasOpposite ?? false)` — routedPoints NOT read yet.
  - `:50` `linkCountBadgeText(data?.count ?? 1)`.
  - `:53` builds `arrowPoints` string once (static shape).
  - `:56` `<BaseEdge id={id} path={geometry.path} />` — no marker-end.
  - `:57-61` self-drawn target `<polygon>` via `translate(arrowX,arrowY) rotate(arrowAngleDeg)`.
  - `:62-68` optional source-side `<polygon>` gated on `data?.bidirectional === true`, using `sourceArrowX/Y/AngleDeg`.
  - `:69-81` badge via `<EdgeLabelRenderer>` + `<span className="vicinity-graph-edge__count-badge">`, positioned `translate(-50%,-50%) translate(labelX,labelY)`.

## 2. `src/view/edgeGeometry.ts` (162 lines) — pure, RF-free (confirmed no @xyflow import)
- `EdgePathGeometry` (:7-26): `path`, `labelX/Y`, `arrowX/Y/arrowAngleDeg`, `sourceArrowX/Y/sourceArrowAngleDeg`.
- Constants: `EDGE_ARROWHEAD_INSET_FRACTION=0.12` (:40); `EDGE_ARROWHEAD_INSET_MIN_PX=14` (:41); `EDGE_ARROWHEAD_INSET_MAX_PX=48` (:42); `EDGE_PAIR_CURVATURE_PX=34` (:54, also reused by edgeRouting.ts:58 `EDGE_ROUTING_SHAPE_BUFFER_PX = /2`).
- `edgePathFor(sourceX,sourceY,targetX,targetY,hasOpposite): EdgePathGeometry` (:62-120):
  - Degenerate (length===0, :74-87): straight, angle 0, arrows pinned to endpoints.
  - `!hasOpposite` (:88-99): straight `M..L..`; target arrow `arrowFromApproach(targetX,targetY,deltaX,deltaY,length)`; source arrow `sourceArrowOf(arrowFromApproach(sourceX,sourceY,-deltaX,-deltaY,length))`.
  - `hasOpposite` (:101-119): quadratic `M s Q control t`, control offset by unit-normal (right of travel, y-down) × CURVATURE; target arrow tangent = target-control; label at mid + normal×CURVATURE/2.
- `sourceArrowOf(anchor)` (:123-129) — relabels target-style anchor into source fields. Reusable for routed case.
- `ArrowAnchor` (:131-135).
- `arrowFromApproach(targetX,targetY,approachX,approachY,edgeLength): ArrowAnchor` (:142-161) — clamped inset `min(MAX,max(MIN,len*FRACTION))`, normalizes approach vector, returns tip pos + atan2 angle deg. Reuse/extend for routed arrowheads (last-seg tangent=target, first-seg tangent=source).
- `RoutedPoint` NOT here — defined `src/view/edgeRouting.ts:17-20` `{ readonly x:number; readonly y:number }`.
- `routedPathFor`/`polylineMidpoint` do NOT exist yet (net-new).

## 3. `src/view/edgeGeometry.test.ts` (111 lines) — conventions
- vitest (`describe/expect/it`).
- Strict BDD: nested `describe("edgePathFor <scenario>")`, each `it("WHEN <condition> THEN <expected>", ...)` — full WHEN/THEN sentences, no bare "should".
- Imports named constants from module under test (assertions expression-based, not magic numbers).
- `toBeCloseTo` for trig, `toBe`/`toEqual` for exact strings/objects.
- Inline comments explain geometric reasoning above assertions.
- Degenerate cases get own `it` (source==target). Ticket wants "2 points ⇒ plain M..L.. identical to today's straight case".

## 4. routedPoints threading (phase-01 wiring complete, unused by render)
- `edgeRouting.ts:17-20` defines RoutedPoint (source of truth).
- `flowMapping.ts:103-130` FlowEdge; `routedPoints?` at :129 ("Rides along unused this phase — rendering starts consuming it in edge-routing__02").
- `VicinityGraphFlow.tsx:174-192` `toReactFlowEdge` spreads routedPoints into RF edge `data` (:189); comment :181-184 asserts routedPoints ABSOLUTE flow-space, no transform ("RF re-derives each node's absolute rect even subflow children for edge endpoints").
- `GraphViewController.ts:340-350` merges route map onto FlowEdges; `:349-350` `routedPoints===undefined ? edge : {...edge, routedPoints}`.
- `GraphViewController.test.ts:439-470,515` coverage: success lands on edge, absent stays undefined, router-throw fallback publishes without routedPoints.

## Coordinate-space risk (ticket item 3)
`flowMapping.ts:322-333` `withPositions(...)`: node with `parentId` (subflow child) stored PARENT-RELATIVE: `{x: absolute.x - parentOrigin.x, y: absolute.y - parentOrigin.y}` (:331; parentOrigin falls back to UNPLACED if missing). routedPoints stored ABSOLUTE (obstacles from absolute positions/groupDimensions, edgeRouting.ts:80-112). Ticket line :40 flags flowMapping.ts:315 to verify/fix absolute-vs-parent-relative offset for group-nested nodes before trusting routedPoints vs RF sourceX/Y/targetX/Y. NOTE: VicinityGraphFlow.tsx:181-184 claims RF gives absolute endpoints even for subflow children — implementation must VERIFY this empirically (or via test) for subflow-child edges.

## CSS hooks
`graph-view.css:38-40` `.vicinity-graph-edge__arrowhead { fill: var(--text-faint) }`; `:348-354` `.vicinity-graph-edge__count-badge`. No path-specific class for routed vs straight; reuse BaseEdge default path styling (only `d` differs).
