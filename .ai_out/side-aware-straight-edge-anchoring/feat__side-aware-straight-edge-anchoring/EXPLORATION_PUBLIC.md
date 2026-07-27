# EXPLORATION — side-aware straight-edge anchoring

Ticket: `nid_var2o7krxq7ribq3iofni3aw1_e`. Produced by the Explore agent (read-only; transcribed here by TOP_LEVEL_AGENT).

## 0. HEADLINE — the ticket's scope premise is STALE

Verified against current `src/`:

- **No `edgeRouting` ViewSetting exists.** Only `forceLayout.edgeRoutingClearancePx` survives
  (`src/engine/types.ts:293`, `SettingsSpec.ts:298`). `src/persistence/persistedShapes.ts:29-31`
  documents the removal ("Bumped to 2 when the `edgeRouting` view field was removed (routing is now
  unconditional)"). Ticket `02-remove-edge-routing-setting…` closed 2026-07-24.
- **No `ROUTING_SKIPPED_LAYOUT_MODE`, no `LayoutMode`, no radial/layered.** Zero grep hits in `src/`
  (only incidental prose mentions in `e2e/`). Ticket `01-force-layout-only…` closed 2026-07-24.
- There is also **no e2e/harness API to turn routing off** (`ObsidianHarness` has `setEdgeVisibility`,
  no `setEdgeRouting`/`setLayoutMode`).

**The work is still valuable** — the straight path is still reachable, and one of its cases fires in
normal operation. Corrected scope below.

### The REAL remaining non-routed (straight `edgePathFor`) code paths

1. **Whole-pass router/wasm failure** — `resolveRoutes` catch at `GraphViewController.ts:309-313`:
   `warnRoutingFailureOncePerSignature(error)` + `return EMPTY_ROUTES` (`:72`); `withRoutedPoints`
   (`:483-494`) early-returns the flow unchanged when `routes.size === 0`, so **every** edge renders
   straight. Warn text: `"vicinity-graph: edge routing failed; rendering straight edges"` (`:323`).
   Covered by `GraphViewController.test.ts:611-618`.
2. **Edge absent from the route map** — `withRoutedPoints` leaves `routedPoints` undefined per-edge
   (`:490-491`). Covered by `GraphViewController.test.ts:601-608`.
3. **Edge dropped from routing input** — `extractEdgeRoutingInput` (`edgeRouting.ts:115-167`) skips a
   node with no `positions` entry, a folder-group with no `groupDimensions` entry, or any non-finite
   rect (`hasFiniteGeometry`), then drops edges whose endpoints are not in `obstacleIds` (`:159-165`).
4. **`routedPoints.length < 2`** — `VicinityEdge.tsx:64` falls back to `edgePathFor`.
5. **`hasOpposite` bowed note↔note pairs** — the quadratic bow is a straight-path-only feature; routed
   pairs render as polylines.
6. **Degenerate clip fallback — FIRES IN NORMAL OPERATION.** `clipRouteToEndpointRects`
   (`edgeGeometry.ts:190-201`) returns the **unclipped 2-point chord of the original first/last
   points** on overlapping/nested rects or a wholly-inside route. libavoid pins routes at box
   CENTRES, so that chord is centre→centre, and `routedGeometryFor` with 2 points delegates to
   `edgePathFor` (`:442-444`). E.g. a note whose rect overlaps its folder-group container's rect.
   **This is the strongest justification for the ticket.**

## 1. `src/view/VicinityEdge.tsx` (98 lines)

- Imports `BaseEdge, EdgeLabelRenderer` (`:1`), `Edge, EdgeProps` types (`:2`),
  `edgePathFor, routedGeometryFor` from `./edgeGeometry` (`:5`), `RoutedPoint` type-only (`:6`).
  **No `useInternalNode`, no RF hooks at all today.**
- `ARROWHEAD_LENGTH_PX = 11`; `export const ARROWHEAD_HALF_WIDTH_PX = 6` (`:32`, asserted in
  `edgeRouting.test.ts` as the clearance floor).
- `export type VicinityEdgeData = { count; hasOpposite; bidirectional; routedPoints? }` (`:35-46`);
  `export type VicinityEdgeType = Edge<VicinityEdgeData, "vicinity">` (`:48`).
- Signature (`:50-58`): `VicinityEdge({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps<VicinityEdgeType>)`.
  It does **not** currently destructure `source`/`target`, but `EdgeProps` exposes both node ids
  (`node_modules/@xyflow/react/dist/esm/types/edges.d.ts:98`) — zero plumbing needed.
- **The single branch to modify (`:62-66`):**
  ```ts
  const routedPoints = data?.routedPoints;
  const geometry =
      routedPoints !== undefined && routedPoints.length >= 2
          ? routedGeometryFor(routedPoints)
          : edgePathFor(sourceX, sourceY, targetX, targetY, data?.hasOpposite ?? false);
  ```
- `hasOpposite` bow lives entirely inside `edgePathFor` (quadratic, bows right-of-travel). Set in
  `flowMapping.ts:258`; forced `false` for group-collapsed pairs (`:271`, which use
  `bidirectional: true` instead, `:272`).
- Arrowheads (`:69-85`): `<polygon className="vicinity-graph-edge__arrowhead">` at
  `geometry.arrowX/arrowY` rotated `arrowAngleDeg`; a second at `sourceArrowX/Y/sourceArrowAngleDeg`
  only when `data.bidirectional === true`.
- Badge (`:67`, `:86-97`): `linkCountBadgeText(count)` in an `<EdgeLabelRenderer>`.
- Path via `<BaseEdge id={id} path={geometry.path} />` → DOM class `.react-flow__edge-path`.

## 2. `src/view/edgeGeometry.ts` (542 lines) — export surface

```ts
export interface EdgePathGeometry {            // :13-32
  readonly path: string;
  readonly labelX: number; readonly labelY: number;
  readonly arrowX: number; readonly arrowY: number; readonly arrowAngleDeg: number;
  readonly sourceArrowX: number; readonly sourceArrowY: number; readonly sourceArrowAngleDeg: number;
}
export const EDGE_ARROWHEAD_INSET_FRACTION = 0.12;   // :46
export const EDGE_ARROWHEAD_INSET_MIN_PX = 14;       // :47
export const EDGE_ARROWHEAD_INSET_MAX_PX = 48;       // :48
export const EDGE_PAIR_CURVATURE_PX = 34;            // :60
export function edgePathFor(sourceX, sourceY, targetX, targetY, hasOpposite: boolean): EdgePathGeometry; // :68-126
export const ROUTED_CORNER_RADIUS_PX = 10;           // :148
export interface ClipRect { readonly x; readonly y; readonly widthPx; readonly heightPx; }  // :156-161
export function clipRouteToEndpointRects(points, sourceRect: ClipRect, targetRect: ClipRect): RoutedPoint[]; // :180-203
export function routedPathFor(points: readonly RoutedPoint[]): string;                       // :303-338
export function polylineMidpoint(points): { readonly x; readonly y };                        // :345
export const DETOUR_RATIO_DEGENERATE = 1;            // :384
export function detourRatio(points): number;                                                 // :398
export function routedGeometryFor(points: readonly RoutedPoint[]): EdgePathGeometry;         // :439-464
```

Module-private helpers:

```ts
function clipTrailingInsideRect(points, rect: ClipRect): RoutedPoint[] | null;                // :213-241
function isStrictlyInsideRect(point: RoutedPoint, rect: ClipRect): boolean;                   // :244-248
function segmentRectEntryPoint(from, to, rect: ClipRect): RoutedPoint | null;                 // :261-293  ← Liang–Barsky
function sourceArrowOf(anchor: ArrowAnchor): { sourceArrowX; sourceArrowY; sourceArrowAngleDeg }; // :467-473
interface ArrowAnchor { arrowX; arrowY; arrowAngleDeg }                                       // :475-479
interface SegmentVector { deltaX; deltaY; length }                                            // :481-485
function distinctSegmentFrom(points, fromIndex: number, step: 1 | -1): SegmentVector;         // :494-511
function arrowFromApproach(targetX, targetY, approachX, approachY, edgeLength): ArrowAnchor;  // :518-542
```

**DRY answer — the segment-vs-rect-border math ALREADY EXISTS.** `segmentRectEntryPoint` (`:261-293`)
is exactly the "where does a segment cross this rect's border" primitive, in Liang–Barsky form,
already returning `null` on the degenerate/parallel-outside case. Its contract assumes `from`
outside-or-on-border and `to` strictly inside. A `rectBorderPointToward(rect, towardX, towardY)`
helper can be built directly on it: call with `from = towardPoint` (other node's centre, outside),
`to = rectCentre` (strictly inside) → the border crossing on the facing side, no new math.
`isStrictlyInsideRect` (`:244-248`) is the ready-made degenerate detector.
**`ClipRect` (`{x, y, widthPx, heightPx}`, absolute top-left) is the existing rect type — reuse it,
do NOT introduce a second rect shape.** It is structurally satisfied by `RoutingObstacle`
(`edgeRouting.ts:22-37`).

Coordinate-space note at `edgeGeometry.ts:425-428` (`routedGeometryFor`): routedPoints and RF's
`sourceX/Y`/`targetX/Y` are both ABSOLUTE flow coords; no transform applied. (The ticket cites
":229-232" — line numbers have drifted; current is `:420-438`.)

## 3. `src/view/edgeGeometry.test.ts` (~308 lines) — conventions

- vitest `import { describe, expect, it }` (`:1`); named value imports (`:2-15`);
  `import type { ClipRect }` (`:16`); `import type { RoutedPoint } from "./edgeRouting"` (`:17`).
- `describe("<function> <behaviour area>")` + `it("WHEN … THEN …")`, one assertion per test, often a
  `toEqual` on a small destructured object.
- Fixture helpers declared **inside** the relevant `describe`. The clip block (`:135-178`) declares
  local `pt`/`rect` builders; `routedGeometryFor` blocks (`:226+`, `:259+`) declare their own `pt`.
- Rect fixtures are small integer rects (e.g. `{x:0,y:0,widthPx:100,heightPx:100}`) with expectations
  at exact border coordinates, so no epsilon is needed.
- **Existing straight-edge tests to protect:** `:19-50` (`edgePathFor` line/bow/label/degenerate),
  `:52-93` (inset MIN/fraction/MAX clamps, curve end-tangent), `:95-113` (source-side anchor mirror),
  `:254-258` (`routedGeometryFor` 2-point == `edgePathFor` parity — a **byte-identity** assertion that
  constrains any change to `edgePathFor`'s output string).

## 4. Hard-coded handle Positions (ticket line numbers are stale)

- `src/view/NoteNode.tsx:90` — `<Handle type="target" position={Position.Top} …/>` (ticket said `:68`)
- `src/view/NoteNode.tsx:116` — `<Handle type="source" position={Position.Bottom} …/>` (ticket said `:91`)
- `src/view/FolderGroupNode.tsx:26-31` — `type="target" position={Position.Top} isConnectable={false}`
- `src/view/FolderGroupNode.tsx:45-50` — `type="source" position={Position.Bottom} isConnectable={false}`
- Comment at `NoteNode.tsx:88-89` states handles exist only as edge anchors, hidden in CSS.
- Aside: `VicinityGraphFlow.tsx:96-99` claims folder-group parents render **no** `<Handle>` — now
  inaccurate vs `FolderGroupNode.tsx`. Do not disturb; the culling `forceInitialRender` rationale
  references it. (Candidate follow-up ticket.)

## 5. Route-map plumbing (`GraphViewController.ts`)

- `runRebuild` (`:190-245`): layout → `resolveRoutes(flow, positions, groupDimensions,
  graph.viewSettings.forceLayout.edgeRoutingClearancePx, token)` (`:234-240`) →
  `publish(graph, positions, groupDimensions, withRoutedPoints(flow, routes))` (`:244`).
- `private async resolveRoutes(…): Promise<EdgeRouteMap>` (`:256-314`). Routing is **unconditional**.
- `clipRoutesToObstacles(routes, input)` (`:427-447`) — module-level; builds `obstacleById`, calls
  `clipRouteToEndpointRects` per edge; leaves the route unclipped if either obstacle is missing
  (`:440-443`). The **clipped** map is cached (`:307`) and returned.
- `withRoutedPoints(flow, routes)` (`:483-494`).
- Cache: `routingSignature(input)` covers obstacles + edges + clearance; a stale-token pass returns
  `EMPTY_ROUTES` (`:304-306`) but `runRebuild`'s own `isStale` check (`:241-243`) discards it.

## 6. Node rects at edge-render time

- **`useInternalNode` is NOT used anywhere in the repo** (zero grep hits in `src/`, `e2e/`). Only
  `useReactFlow`/`useStore` in `VicinityGraphFlow.tsx:1,141,146` (`FitViewOnLayoutChange`).
- **RF version:** `"@xyflow/react": "^12.11.2"`, installed `12.11.2`.
  `useInternalNode<NodeType>(id: string): InternalNode<NodeType> | undefined`.
  `InternalNodeBase` = `Omit<NodeType,'measured'> & { measured: {width?, height?},
  internals: { …, positionAbsolute: XYPosition, … } }`.
  **The hook returns `| undefined` — the implementation MUST handle that** (fall back to today's
  `sourceX/Y`/`targetX/Y`).
- **Subflows ARE used.** `toReactFlowNode` (`VicinityGraphFlow.tsx:157-172`) sets `parentId` for
  folder-group members and sets **explicit `width`/`height` on the node object** (`:161-165`),
  deliberately so culling and `fitView` never need DOM measurement. So prefer
  `internals.positionAbsolute` + (`measured.width ?? node.width`, `measured.height ?? node.height`).
- RF supplies absolute `sourceX/Y`/`targetX/Y` even for subflow children (`VicinityGraphFlow.tsx:181-184`).
- `<ReactFlow>` at `VicinityGraphFlow.tsx:73-124`; no explicit `ReactFlowProvider`, but custom edges
  render inside `<ReactFlow>`, so store hooks are legal in `VicinityEdge`.
- `onlyRenderVisibleElements` is on (`:102`) — culled nodes are unmounted from the DOM but remain in
  the RF store, so `useInternalNode` still resolves them. **Do NOT switch to DOM measurement.**

## 7. Spec doc — PATH CORRECTED

The ticket says `docs-internal/vicinity-graph-specs/arrows.md`. **That directory does not exist.**
Live file: **`docs-internal/specs/graph/arrows.md`** (81 lines). Structure — `##` headings, **NO
numbers** (so the boundary-clip doc's "section 5" reference is stale):

1. `# Graph edges: group-collapsing, direction & routing` (`:1`) + blockquote convention note (`:3-6`)
2. `## Group-collapsed arrows` (`:8`)
3. `## Bidirectional edges: one line, two arrowheads` (`:32`) — `:36-38` already says "`hasOpposite`
   note↔note pairs still bow only in the straight-line (non-routed) fallback"
4. `## Obstacle-avoiding routing (always on)` (`:40`) — includes "**Straight-line fallback**
   (`edgePathFor`) when the wasm/router fails … or an edge is absent from the route map" (`:49-52`)
   and "**Boundary clipping**" (`:58-64`)
5. `## Test coverage` (`:70`)
6. `## Follow-ups` (`:78`)

A new `## Straight (non-routed) edge anchoring` section fits between the routing section (ends `:68`)
and `## Test coverage` (`:70`), plus a one-line amendment to the straight-line-fallback bullet
(`:49-52`) and the `## Bidirectional…` section.

## 8. e2e specs touching edge geometry

- `e2e/edgeRouting.e2e.ts` (~230 lines) — primary geometry spec.
  `EDGE_PATH_SELECTOR = ".vicinity-graph-flow .react-flow__edge-path"` (`:53`).
  - `ROUTING_FIXTURES` (`:42-51`): hub `erouting/er_c.md` + 6-ring with 3 diameter chords;
    `harness.setEdgeVisibility("all-edges")` in `beforeAll` (`:88`). Bend detector `bentEdgeCount` =
    paths with `>=2` `L` commands (`:102-104`). **Comment at `:26-28`: "a straight edge emits exactly
    one `L` and a paired bow emits none"** — a side-aware straight edge still emits one `L`, so this
    detector is unaffected.
  - `facing/` fixture from `scripts/setup-dev-vault.sh` (`:56-58`, `FACING_HUB_PATH =
    "facing/hub-facing.md"`): a folder-group box approached by 12 edges from one clustered side;
    asserts which BORDER each terminal lands on, `BORDER_HIT_TOL_PX = 6` (`:67`), non-vacuity floor
    `MIN_FACING_BOX_TERMINALS = 8` (`:76`). **Closest existing prior art for a side-attachment e2e
    assertion**; reads flow-space rects from the DOM.
- `e2e/edgeRoutingEval.e2e.ts` — screenshot/perf eval harness, same selector (`:29`), not a tight gate.
- `e2e/vicinityGraph.e2e.ts:125-127` — one arrowhead per edge; `:202-221` — arrowhead fill follows
  theme `--text-faint`.
- `e2e/selectorGuard.test.ts:205` — tripwire asserting the exact class list used with the edge-path
  selector; **touching that selector string requires updating the guard**.
- **No fixture exercises a non-routed edge.** Routing cannot be turned off (no setting, no harness
  method) and the router does not fail in e2e. A deterministic straight edge in e2e would need an
  injected router failure (no seam today) or the degenerate-clip case.
- **Test env:** `vitest.config.ts` includes only `src/**/*.test.{ts,tsx}` and `e2e/**/*.test.ts`;
  **no jsdom/happy-dom, no @testing-library** — there is currently **no way to unit-test a React
  component**. New geometry must live in pure `edgeGeometry.ts`, with `VicinityEdge.tsx` limited to a
  thin, untestable wiring line.

## 9. Prior art

### `.ai_out/collapsed-group-arrows-boundary-clip/…`

- `EXPLORATION_PUBLIC.md`: a repo-wide grep for intersection helpers returned **zero** matches before
  that ticket — `clipRouteToEndpointRects` was net-new math. Its line numbers and its references to
  `withEdgeRouting`/`setLayoutMode`/`docs-internal/vicinity-graph-specs/` are all now **stale**.
- `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md` — decisions that BIND this work:
  - `ClipRect` was deliberately declared **local** to `edgeGeometry.ts` so the pure-math layer imports
    no routing types. **Reuse it; do not add a second rect type.**
  - Clip contract: strict-inside test (a point exactly ON the border is kept); degenerate → unclipped
    2-point chord; `points.length < 2` → copy; never empty/NaN. Missing obstacle at the call site →
    route left unclipped.
  - **Arrowhead inset constants were reviewed and deliberately NOT changed.** After boundary
    anchoring, `arrowFromApproach` insets 14–48px BACK along the approach, so the head sits just
    OUTSIDE the box pointing inward. That is the accepted look; the same will now happen on straight
    edges (CALLOUT 1 noted notes' arrowheads moved outside the boundary on the routed path) — so this
    change makes the straight path **consistent** with the routed one.
  - An e2e geometry assertion was explicitly downgraded to screenshot + a stronger controller-level
    exact-coordinate unit test — a ticket-sanctioned Pareto precedent.

### `.ai_out/edge-routing-05-twelve-point-anchors/…`

- `BOUNDARY_PIN_SPECS` in `edgeRouting.ts` is now **12 side-only pins** (4 sides × {0.25, 0.5, 0.75},
  outward-perpendicular; corners removed). Folder-group boxes get these; **note squares keep a single
  CENTRE pin** (`CENTRE_PIN_SPEC`, perf) — which is exactly why routed note termini need the boundary
  clip and why straight note edges are the remaining offender.
- `docs-internal/research/facing-side-edge-attachment.md` (parked `edge-routing__05` negative result):
  pin **costs cannot** fix facing-side attachment (0/43, 0/818 probes); wrap-arounds are
  visibility-BLOCKED pins, not near-ties. **Facing-side anchoring must be solved geometrically at
  render time, not via the router** — precisely this ticket's approach.

## 10. Concrete recommendation for the implementer

- Add to `edgeGeometry.ts` a pure helper built on the existing `segmentRectEntryPoint`, e.g.
  `export function rectBorderPointToward(rect: ClipRect, towardX: number, towardY: number): { x; y } | null`
  (`null` when `toward` is not strictly outside / the crossing is indeterminate), then a small
  composer for the straight-edge endpoint pair.
- **Keep `edgePathFor`'s existing signature intact** — `edgeGeometry.test.ts:254-258` asserts
  byte-identity between `routedGeometryFor`'s 2-point output and `edgePathFor`, and
  `routedGeometryFor:443` calls it positionally.
- In `VicinityEdge.tsx`: destructure `source`, `target`; `useInternalNode(source)` /
  `useInternalNode(target)`; build `ClipRect`s from `internals.positionAbsolute` +
  (`measured.width ?? width`, `measured.height ?? height`); fall back to today's `sourceX/Y`,
  `targetX/Y` whenever either node is `undefined` or the intersection is `null`
  (overlapping/nested rects).
- **Do not touch handles, layout, or the routed branch.**
