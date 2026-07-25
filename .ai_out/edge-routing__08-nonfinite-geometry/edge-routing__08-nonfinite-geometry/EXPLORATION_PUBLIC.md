# EXPLORATION_PUBLIC — edge-routing__08-nonfinite-geometry (input path)

> Produced by the read-only EXPLORATION sub-agent; persisted by TOP_LEVEL_AGENT (the agent
> could not write files itself). Line numbers are as of branch base commit `6c5e1e7`.

## 1. `src/view/edgeRouting.ts` — types and `extractEdgeRoutingInput`

File is 472 lines.

Types (lines 16–61):

```ts
export interface RoutedPoint { readonly x: number; readonly y: number; }        // 16

export interface RoutingObstacle {                                              // 22
    readonly id: string;
    readonly x: number;
    readonly y: number;
    readonly widthPx: number;
    readonly heightPx: number;
    readonly kind: "note" | "folder-group";
}

export interface RoutingEdge { readonly id: string; readonly sourceId: string; readonly targetId: string; } // 40

export interface EdgeRoutingInput {                                             // 46
    readonly obstacles: readonly RoutingObstacle[];
    readonly edges: readonly RoutingEdge[];
    readonly shapeBufferPx: number;
}

export type EdgeRouteMap = ReadonlyMap<string, readonly RoutedPoint[]>;         // 61
```

`shapeBufferPx` is the resolved "Edge clearance" setting; it rides inside `EdgeRoutingInput`
(not as a separate `route()` arg) so `GraphViewController`'s cache signature covers it.

`extractEdgeRoutingInput` (lines 114–162):

```ts
export function extractEdgeRoutingInput(input: {
    readonly nodes: readonly FlowNode[];
    readonly edges: readonly FlowEdge[];
    readonly positions: ReadonlyMap<string, XY>;
    readonly groupDimensions: ReadonlyMap<string, Dimensions>;
    readonly shapeBufferPx: number;
}): EdgeRoutingInput
```

Body (122–161):
- Iterate `input.nodes`; `input.positions.get(node.id)` — `undefined` ⇒ `continue` (skipped, no error).
- `node.kind === "folder-group"` ⇒ needs `input.groupDimensions.get(node.id)`; `undefined` ⇒ `continue`.
  Otherwise obstacle sized from `groupDimensions` (elk container rect).
- Plain notes ⇒ obstacle sized from `node.width` / `node.height`.
- Every emitted obstacle's id is added to `obstacleIds: Set<string>` (line 152).
- Second pass over edges: `if (!obstacleIds.has(edge.source) || !obstacleIds.has(edge.target)) continue;`
  (155–158) — **the existing "unknown endpoint" drop**. Silent `continue`, no logging.
- Returns `{ obstacles, edges, shapeBufferPx }`.

Doc comment above the function (93–113) states the contract:

> "A node lacking a position (or a group lacking dimensions) is skipped as an obstacle; an edge
> whose endpoint is not among the emitted obstacles is dropped from the routing input (defines
> valid input — post-layout this never fires because every flow node has a position)."

That is the established discipline: **define valid input, drop what's invalid, never throw**.
A finiteness check should extend it — don't add the bad obstacle's id to `obstacleIds`, and the
existing edge pass drops referencing edges for free.

No logging inside `edgeRouting.ts`; the function is pure (top-of-file docstring 4–13:
"Pure of React Flow… testable without wasm").

**`ap_XXX_E` anchors: none anywhere in `src/`** (`grep -rn "ap_[0-9A-Za-z_]*_E"` ⇒ no matches).
The only anchor-like identifier for this ticket is `nid_a7uwpxayt6w5vdnw8ogwskwvh_e`, quoted at
`src/view/edgeRouting.ts:381` inside `AvoidArena.dispose()`'s teardown-protocol comment:

```
// NOT a claim that flushing is always safe: it executes real routing work, so it
// ABORTS if a pending obstacle carries non-finite geometry — a case that, below two
// pending pins, tore down cleanly BEFORE this flush existed. That narrow new abort is
// the price of closing the session-killer class. Validating finiteness at extraction,
// ticket `nid_a7uwpxayt6w5vdnw8ogwskwvh_e`, is what closes that residual.
```

This comment is the forward reference this ticket closes — **it must be updated** once the
extraction guard lands.

## 2. Call chain → `LibavoidEdgeRouter.route()` / `AvoidArena`

Single call site: `src/view/GraphViewController.ts:254`, in `private async resolveRoutes(...)`:

```ts
const input = extractEdgeRoutingInput({ nodes: flow.nodes, edges: flow.edges, positions,
                                        groupDimensions, shapeBufferPx: edgeRoutingClearancePx });
const signature = routingSignature(input);
if (this.routeCache !== null && this.routeCache.signature === signature) return this.routeCache.routes;
try {
    const routes = await this.edgeRouter.route(input);
    const clippedRoutes = clipRoutesToObstacles(routes, input);
    console.debug("vicinity-graph: edge routing pass", { obstacleCount, edgeCount, durationMs, maxDetourRatio, meanDetourRatio });
    ...
} catch (error: unknown) {
    if (!this.routingFailureWarned) { this.routingFailureWarned = true;
        console.warn("vicinity-graph: edge routing failed; rendering straight edges", error); }
    this.routeCache = null;  // → EMPTY_ROUTES / straight edges
}
```

`positions`/`groupDimensions` come from `extractElkPositions(laidOut)` /
`extractElkDimensionsById(laidOut)`, or are reused from a prior pass (`this.positions` /
`this.groupDimensions`) when there is no structural change.
`FlowNode.width/height` come from `flowMapping.ts` `nodeDimensionsPx(node)` (line 188);
`FlowNodeBase` at 89–98; `Dimensions`/`XY` at `flowMapping.ts:364` / `:20`.

Inside `LibavoidEdgeRouter.route()` (417–461):
1. `loadAvoid()` — **load-once singleton**; `AvoidArena` wraps it; `arena.newRouter()`.
2. Sets `shapeBufferDistance`, `segmentPenalty`, `crossingPenalty` (plain numeric params).
3. Obstacle loop (430–437): `arena.shape(router, rectOf(obstacle))` → `new Point(x1,y1)`,
   `new Point(x2,y2)`, `new Rectangle(...)`, `new ShapeRef(router, rectangle)`.
   `rectOf` (464–471) computes `x2 = x + widthPx`, `y2 = y + heightPx` — **any non-finite field
   poisons the pending shape**.
4. Edge loop (438–451): missing shape ⇒ `throw new Error("edge ${id} references an obstacle with
   no registered shape")` (line 445) — the *contract-violation* throw, pass-level cost only.
5. `router.processTransaction()` (452) — **the native abort site**.
6. `finally { arena.dispose(); }` — `dispose()` (359–394) unconditionally re-flushes
   `processTransaction()` before destroying (the edge-routing__07 fix), so teardown also executes
   real routing work.

Consequence: a non-finite obstacle aborts the Emscripten module. `loadAvoid()` is a session
singleton, so **every subsequent pass in the Obsidian session silently degrades to straight
edges** — that is the session-killer class, distinct from the line-445 throw.

## 3. Existing tests — style and fixtures

`src/view/edgeRouting.test.ts`, 703 lines, vitest. Titles are uniformly
`it("WHEN <condition> THEN <outcome>", …)`.

Pure-extraction block (36–124, `describe("extractEdgeRoutingInput", …)`):
- `makeGraph` / `makeNode` / `makeEdge` from `./testFixtures/graphFixtures`, then
  `vicinityGraphToFlow(graph, false)` for `FlowNode[]`/`FlowEdge[]`.
- `positions` / `groupDimensions` are hand-written `new Map([...])` literals keyed by node id /
  `folder-group:<name>`.
- `SHIPPED_CLEARANCE_PX` = `EngineDefaults.forceLayoutSettings().edgeRoutingClearancePx` is used
  instead of a literal, "so these tests measure what users actually get."
- Local `scenario()` builder + `obstacle(id)` find-or-throw helper keep assertions terse.

Closest precedent for the new test (112–123):

```ts
it("WHEN a node lacks a position THEN it is skipped as an obstacle", () => {
    const graph = makeGraph({ nodes: [makeNode({ path: asVaultPath("lonely.md") })], edges: [] });
    const flow = vicinityGraphToFlow(graph, false);
    const input = extractEdgeRoutingInput({
        nodes: flow.nodes, edges: flow.edges,
        positions: new Map(), groupDimensions: new Map(),
        shapeBufferPx: SHIPPED_CLEARANCE_PX,
    });
    expect(input.obstacles).toEqual([]);
});
```

Real-wasm block (248–702) loads the node build of `libavoid-js` in `beforeAll` and uses
`requireWasm(ctx)` → `ctx.skip(...)` when unavailable (skips, never false-passes). Obstacles are
plain literals there.

**CRITICAL ordering constraint** — comment at 645–657 above the session-survival guard:

> "KEEP THE TWO TESTS BELOW LAST IN THIS DESCRIBE, and append new ones ABOVE this comment: if the
> teardown flush ever regresses, the first `doomedPass()` aborts the shared wasm instance and every
> test AFTER it fails for the wrong reason, hiding the real cause."

Any new real-wasm test must go **above** that block (and must itself prove module survival the way
`routeEdgeWithUnregisteredObstacle` does). Note: deliberately feeding non-finite geometry to real
wasm would ABORT the shared instance and poison the rest of the file — prefer the pure unit test
the ticket asks for.

## 4. Existing finiteness guards — house style

- `src/persistence/persistedShapes.ts:272`:
  `return typeof value === "number" && Number.isFinite(value) ? value : undefined;`
  — validate-and-coalesce-to-`undefined` on load. Closest sibling pattern.
- `src/view/edgeGeometry.test.ts:264,273`: `expect(Number.isFinite(...)).toBe(true)` — test-side
  finiteness assertions.
- Settings UI parsing uses `!Number.isNaN(...)`: `SizingSection.tsx:63,122`,
  `ForceLayoutSection.tsx:93`, `VicinityGraphSettingTab.ts:304,466`.

House style: **`Number.isFinite` / `Number.isNaN`, never the coercing globals.**
No finiteness guard exists in `edgeRouting.ts` today.

## 5. Knock-on consequences of dropping an obstacle

- Dropped obstacle ⇒ its id never enters `obstacleIds` ⇒ **edges referencing it are dropped
  automatically** by the existing 155–158 check. No separate edge-side finiteness filter needed.
- `route()` does **not** gracefully skip an edge with a missing endpoint — it throws (line 445),
  treating "every edge endpoint has an obstacle" as an extraction-guaranteed contract. So the
  finiteness drop MUST also drop the edges, via the id-membership mechanism.
- Today there are exactly two disciplines on this path: "skip the obstacle" (extraction) and
  "throw the pass" (route contract violation). No clamping/sentinel geometry anywhere — a fix
  should follow "skip the obstacle" rather than introduce a third discipline.
