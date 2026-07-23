# IMPLEMENTATION_REVIEW — PUBLIC (edge-routing__04, Phase A + B)

Reviewer: IMPLEMENTATION_REVIEWER. Scope: committed diff on `edge-routing-04-boundary-pins`
(`git diff HEAD~1 HEAD -- src/`). Phase C explicitly out of scope.

## Overall verdict: READY

Phase A (boundary pins) and Phase B (detour telemetry) are correct, well-factored, and
match the ticket. `npm run check` GREEN, `npm test` 662/662 GREEN. I independently
verified the load-bearing risk — the libavoid `visDirs` semantics — against the real
wasm binding and the fix works as intended. One SHOULD-FIX (a missing regression guard,
not a defect) and a couple of NICE-TO-HAVEs. The perf gate remains a dev-vault check
for TOP_LEVEL (cannot be measured in-agent).

## Independent verification performed

- `npm run check` (tsc strict): exit 0.
- `npm test` (vitest): 54 files, 662 passed, 0 failed.
- **Real-wasm block DOES execute (not skipped):** `require.resolve("libavoid-js")`
  resolves and `AvoidLib.load()` succeeds in this env (confirmed by direct node probe),
  so `loaded === true` and the two assertions in `LibavoidEdgeRouter with real wasm`
  actually run.
- **Runtime ConnDir constants exist and are distinct:** probed the node binding —
  `ConnDirUp=1, ConnDirDown=2, ConnDirLeft=4, ConnDirRight=8, ConnDirAll=15`. So
  `visDirsFor` never returns `undefined`; the interface additions in `libavoidLoader.ts`
  are backed by real runtime values.
- **visDirs mapping is correct and OUTWARD-facing (the make-or-break item):** I
  replicated `route()`'s exact pin registration against libavoid-js directly.
  - Two boxes side-by-side (A `0..100`, B `300..400`, same y): route =
    `[[100,50],[300,50]]` → attaches on A's **right** midpoint and B's **left** midpoint.
    A clean direct hop, no interior traversal.
  - Two boxes stacked (A `y 0..100`, B `y 300..400`, same x): route =
    `[[50,100],[50,300]]` → A's **bottom** midpoint to B's **top** midpoint.
  This proves `visDirs` = "direction the connector may LEAVE the pin (outward)" and that
  the spec table (top→Up, right→Right, bottom→Down, left→Left) matches that semantics.
  An inverted mapping would have forced a detour here; it did not.

## Phase A correctness

- 8 pins/shape with exactly the required proportional positions: sides
  (0.5,0)/(1,0.5)/(0.5,1)/(0,0.5) + corners (0,0)/(1,0)/(0,1)/(1,1). Verified in
  `BOUNDARY_PIN_SPECS` (`edgeRouting.ts:226-235`). ✔
- Side pins face outward with correct `visDirs`; corners `ConnDirAll`. Verified
  empirically (above). ✔
- All pins share one `PIN_CLASS`; `ConnEnd` wiring unchanged (`connEnd(shape, PIN_CLASS)`
  is a pure rename of `CENTRE_PIN_CLASS`). Pins are constructed and left to shape/router
  ownership — not tracked or freed by `AvoidArena` (matches prior contract; the centre
  pin was handled identically). ✔
- `ConnDirUp/Down/Left/Right` added as typed `readonly number` on the `Avoid` interface;
  no `as number` casts introduced (`visDirsFor` reads them directly). ✔
- No lingering references to the removed `CENTRE_PIN_CLASS`/`PIN_CENTRE_FRACTION`
  (grep clean). ✔

## Phase B correctness

- `detourRatio` = clipped arc length ÷ endpoint chord (`hypot(last-first)`), reusing the
  same arc-length walk pattern as `polylineMidpoint`. Zero-chord guard returns
  `DETOUR_RATIO_DEGENERATE = 1` — never NaN/Infinity. Also guards empty/undefined ends.
  Note the metric is provably ≥ 1 (arc ≥ chord by triangle inequality), so `detourStats`
  initialising `max = 0` is safe (always overwritten when `count > 0`). ✔
- `edgeGeometry.ts` stays pure — only `Math` + the existing `RoutedPoint` type; import
  guard test still green. ✔
- `GraphViewController.detourStats` iterates the **clipped** map
  (`detourStats(clippedRoutes)`), computed once, O(total points), skipping nothing
  because an `EdgeRouteMap` only contains routed edges; empty map → neutral `{1,1}`.
  It uses the clipped routes, not raw `routes`. ✔
- Tests: 4 BDD `WHEN…THEN`, one behaviour each — straight = 1, L-detour = exact
  `200/hypot(100,100)`, collinear waypoint = 1, zero-chord = degenerate. No
  assertion-fudging. ✔

## Regression risk

- `clipRouteToEndpointRects` / `clipRoutesToObstacles` UNCHANGED — becomes a near no-op
  for boundary-pinned routes but still enforces the arrowhead-on-boundary contract. ✔
- Routing signature / cache path unchanged; radial still routing-skipped (untouched). ✔
- Behaviour nuance (implementer callout): the routing-pass `console.debug` line moved
  below the `isStale` early-return so it can report metrics on clipped routes. A
  discarded stale pass no longer emits a duration line. Acceptable (discarded work);
  no test depended on it (suite green).

## Findings

### SHOULD-FIX
1. **No automated regression guard for the ticket's central behaviour (facing-side
   attachment).** The real-wasm block runs under vitest and asserts only "bends around a
   blocker" + "no waypoint inside blocker" — both would still pass if the `visDirs`
   mapping were inverted or reverted to a centre pin. The whole point of edge-routing__04
   (edges attach on the side facing the counterpart) has zero coverage: swap
   `ConnDirUp`/`ConnDirDown` and all 662 tests stay green. Since I confirmed the block
   executes, add one cheap assertion there — e.g. two boxes side-by-side, assert the
   route's first point is on the source's right edge and the last on the target's left
   edge (as my probe showed: `[[100,50],[300,50]]`). This locks the fix in and is exactly
   the "could/should a test assert side-facing attachment" the task flags. Not blocking
   (fix is verified correct now), but the fix is currently unprotected.

### NICE-TO-HAVE
2. **`detourRatio` inner `if (a === undefined || b === undefined) continue;`** is dead in
   practice (dense array, `i` in `1..len-1`) and exists only to satisfy
   `noUncheckedIndexedAccess`. Fine as-is; a short "strict-index guard, unreachable"
   note would prevent a future reader thinking sparse routes are expected. Minor.

### NIT
3. `detourStats` and `DetourStats`/`EMPTY_DETOUR_STATS` live in `GraphViewController.ts`.
   Reasonable (telemetry aggregation is a view concern), but if more pass-level metrics
   accrue, consider colocating the aggregation with `detourRatio` in `edgeGeometry.ts`.
   Not needed now.

## STOP condition / what the dev-vault check MUST still confirm (TOP_LEVEL)

Route QUALITY and PERF cannot be verified in-agent (wasm router only resolves under
esbuild for the real pass; I could only probe the binding in isolation). TOP_LEVEL must,
on the repro (`.out/vaults/public`, `wealth-buys-external-freedom.md`, outgoing 2 /
incoming 1, routing ON, force layout):
- Confirm `freedom → Discipline Leads to Freedom` and
  `wealth-buys-external-freedom → rel` now render near-direct (attach on facing sides).
- Confirm `maxDetourRatio` in the `vicinity-graph: edge routing pass` debug line drops
  materially vs. before, on the repro AND the sparse/medium/dense fixtures.
- **Perf gate:** 8 pins × ~100 obstacles — confirm `durationMs` stays well under layout
  time (~140ms routing baseline vs ~1460ms layout). If blown, the ticket fallback is
  group-only pins (would require threading `FlowNode.kind` onto `RoutingObstacle`, not
  done — see implementer callout (a)).

---

# Round 2 focused review — group-only pins + telemetry fix (`c060122`, `5e175ed`)

**Verdict: READY.** No BLOCKING, no SHOULD-FIX. Both Round-1 open items are now closed.

Reviewed `git diff HEAD~2 HEAD -- src/` (edgeRouting.ts, edgeRouting.test.ts,
GraphViewController.ts). `npm run check` exit 0; `npm test` **664 passed / 664**
(was 662 + the 2 new facing-side tests). Real-wasm block genuinely EXECUTES
(`loaded=true`; the 2 new wasm tests report 2ms/0ms, not skipped).

## 1. Group-only pins — CORRECT
- `registerPinsForShape` (`edgeRouting.ts:253`) gives EVERY shape ≥1 pin under the
  shared `PIN_CLASS`: folder-group → 8 `BOUNDARY_PIN_SPECS`, note → `[CENTRE_PIN_SPEC]`.
  No shape is ever pinless, so every `ConnEnd(shape, PIN_CLASS)` still resolves — no
  edge left routeless. Verified.
- `RoutingObstacle.kind` is populated straight from `FlowNode.kind`
  (`extractEdgeRoutingInput`, `edgeRouting.ts:131-153`). `FlowNode.kind` is a closed
  union `"note" | "folder-group"` (`flowMapping.ts:92,97`), so the else-branch only
  ever sees `"note"` — the mapping is exhaustive, no mis-labelled kind. Sizing logic
  is unchanged from before (folder-group→groupDimensions, else→node w/h); only the
  `kind` label is added, so no obstacle-geometry regression.
- Group-without-dimensions is still `continue`-skipped (pre-existing); a note keeps a
  single centre pin with `ConnDirAll`, reproducing the EXACT pre-edge-routing__04 note
  behaviour → guards against loss of previously-working note→note routing.
- Named pin-spec tables (`BOUNDARY_PIN_SPECS`, `CENTRE_PIN_SPEC`), no magic numbers
  (`PIN_EDGE_MIN/MID/MAX`, `PIN_INSIDE_OFFSET`, `PIN_CLASS`). The pin loop is now DRY'd
  into `registerPinsForShape` (SRP). `visDirsFor` exhaustive switch, no `as` casts.

## 2. Telemetry reorder — CORRECT
- `clippedRoutes` is computed once (`GraphViewController.ts:271`); the SAME map is fed
  to `detourStats`, logged, cached, and returned. No double-clip, no divergence.
- `isStale` early-return now sits AFTER the log (`:290`) but still BEFORE the cache
  write, so a stale pass returns `EMPTY_ROUTES` and never populates `routeCache` —
  identical rebuild/cache/error-path behaviour to before, only cost is one extra
  clip+detour on a superseded pass (documented, cheap). Closes the Round-1 false-pass:
  the eval now measures the real 101-obstacle pass (VERIFICATION Round 2: obstacles=101,
  routingMs≈125.7 ≪ layout≈1495).
- Detour math is safe: `detourStats` iterates only map entries (edges that actually
  routed), `count===0 → EMPTY_DETOUR_STATS` (neutral 1); `detourRatio` guards
  missing endpoints and `chord===0 → DETOUR_RATIO_DEGENERATE` (no NaN/Infinity).

## 3. Tests — GENUINE, nothing removed
- `extractEdgeRoutingInput` assertions extended with the correct `kind` (`"note"` /
  `"folder-group"`) — accurate.
- The 2 new real-wasm tests assert facing-side attachment on **folder-group** obstacles
  (right→left border ≈100/300, bottom→top ≈100/300, mid-span ±10px). Not weakened: with
  centre-only pins the endpoints would sit at box centres and these would FAIL, so they
  genuinely lock in the outward `visDirs` mapping — the exact Round-1 SHOULD-FIX. The
  note-square-keeps-centre-pin rationale is documented in the test block.
- Pre-existing wasm tests (bends-around / no-waypoint-inside) retained, only annotated
  with `kind: "note"`. No behavior-capturing test removed. No `ap_XXX_E` anchors in the
  touched files (none removed).

## 4. Standards / layering / strict TS
- Purity intact (edgeRouting.ts still `obsidian`/react-free; wasm behind lazy import).
- `noUncheckedIndexedAccess` respected (guarded `points[0]`/`[len-1]`, `polyline[…]`).
- Interface doc on `RoutingObstacle.kind` and `registerPinsForShape` explains the
  WHY/WHY-NOT (perf fallback) succinctly.

## Nits (non-blocking, optional)
- `registerPinsForShape` allocates a fresh `[CENTRE_PIN_SPEC]` per note shape; could
  hoist a module-level `CENTRE_PIN_SPECS` array. Negligible (~100 tiny arrays).
- Every non-stale pass now emits a `console.debug` line (incl. trivial intermediate
  passes during rapid nav). Intended (the eval parses them) and debug-level/silent by
  default — fine.
