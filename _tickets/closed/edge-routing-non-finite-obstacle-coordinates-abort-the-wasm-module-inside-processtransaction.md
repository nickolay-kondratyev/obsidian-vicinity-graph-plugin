---
closed_iso: 2026-07-25T15:59:22Z
id: nid_a7uwpxayt6w5vdnw8ogwskwvh_e
title: "edge routing: non-finite obstacle coordinates abort the wasm module inside processTransaction"
status: closed
deps: []
links: [nid_oy3vas85xhr34n2dby1mvows4_e, nid_8vmo5ibhv1bvh2ukrgmafpofj_e]
created_iso: 2026-07-25T14:54:10Z
status_updated_iso: 2026-07-25T15:59:22Z
type: bug
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [edge-routing, wasm, robustness]
---

Found while root-causing ticket `edge-routing: a throw inside route() kills the wasm module for the rest of the session` (out dir `.ai_out/edge-routing__07-wasm-abort/`). SEPARATE failure class -- that ticket fixes TEARDOWN; this one is about the routing pass itself.

Measured against the real libavoid node build (probe `.tmp/rc-probe.mjs`, scenarios `I_degenerate_geometry` / `P_infinite_geometry`):

- a `RoutingObstacle` whose coordinates contain `NaN` or `Infinity` makes `router.processTransaction()` ABORT:
  `Aborted(Assertion failed: ang >= 0, at: ./adaptagrams/cola/libavoid/geometry.cpp,635,rotationalAngle)`
- an Emscripten abort is unrecoverable in-process: the shared `AvoidLib` instance is a load-once singleton, so edge routing is dead for the rest of the Obsidian session (same session-poisoning consequence as the teardown ticket).
- zero-size and negative-size rectangles are ACCEPTED by libavoid (no abort) -- only non-finite values are fatal.

`src/view/edgeRouting.ts:114 extractEdgeRoutingInput` does not check that `positions` / `groupDimensions` values are finite, and nothing between the layout runners (`src/view/D3ForceLayout.ts`, `src/view/ElkLayoutRunner.ts`) and `LibavoidEdgeRouter.route()` guards it either.

UNVERIFIED: whether the d3-force / elk layout can actually emit a non-finite position in practice (d3-force can produce NaN for degenerate configurations). Establishing reachability is the first step -- if it is unreachable, the cheap answer is still a finiteness filter at extraction, since the downstream cost of being wrong is a dead router for the whole session.

## Design

Drop (or repair) obstacles with non-finite geometry in `extractEdgeRoutingInput`, the same place edges with unknown endpoints are already dropped -- that keeps the validation at the SOURCE of the routing input, pure and unit-testable without wasm, and out of the wasm-facing `route()`.

WHY-NOT validate inside `route()`: the abort happens in `processTransaction()`, not on the throw path, so the teardown fix from the sibling ticket does NOT protect against this; and a pure extraction-level filter needs no wasm test to cover it.

## Acceptance Criteria

- A pure unit test on `extractEdgeRoutingInput` proving an obstacle with a non-finite x/y/width/height never reaches the routing input.
- Reachability from the real layout pipeline established (documented either way).
- `npm run check` and `npm test` green.


## Notes

**2026-07-25T15:08:36Z**

PRECONDITION for the linked teardown ticket, not an unrelated find. `AvoidArena.dispose()` now flushes the pending transaction before destroying the Router; that flush executes real routing work, so it ABORTS on non-finite obstacle geometry. Measured residual: with fewer than two connection pins pending, teardown used to be clean and now aborts (probe row `1shape-nan-flush`, `Aborted(Assertion failed: ang >= 0, geometry.cpp,635)`). Doubly gated (needs an in-window throw AND non-finite geometry AND <2 pending pins), so it does not block that fix — but finiteness validation at extraction is what makes the teardown invariant unconditionally safe. See `.ai_out/edge-routing__07-wasm-abort/edge-routing__07-wasm-abort/ROOT_CAUSE_REVIEW__PUBLIC.md` section 3.2.

**2026-07-25T15:23:01Z**

Priority raised 2 -> 1 as part of closing nid_oy3vas85xhr34n2dby1mvows4_e (teardown-flush fix).

WHY: the teardown flush added to `AvoidArena.dispose()` (src/view/edgeRouting.ts) means a non-finite obstacle coordinate can now abort during TEARDOWN as well as during the routing pass. Measured by ROOT_CAUSE_REVIEWER: with one obstacle carrying non-finite coords plus an in-window throw (<2 pins), teardown previously survived and propagated our diagnostic Error -- it now aborts (`ang >= 0`, geometry.cpp:635) and kills the module. That path is doubly-gated and unreachable from production today, and no alternative teardown avoids it (conditional flush and try/catch were both measured useless), so it was knowingly accepted. THIS ticket is the real closure: guarantee finite geometry at the input boundary so libavoid never sees a non-finite coordinate in the first place.

**2026-07-25T15:59:22Z**

RESOLVED on branch `edge-routing__08-nonfinite-geometry`.

`extractEdgeRoutingInput` (`src/view/edgeRouting.ts`) now drops any obstacle whose x/y/widthPx/heightPx is non-finite, via a module-private `hasFiniteGeometry`. A dropped obstacle id never enters `obstacleIds`, so the pre-existing edge pass drops its edges too -- required, because `route()` throws on an edge whose endpoint has no registered shape. Zero-size and negative-size rects are still ACCEPTED (libavoid tolerates them; dropping them would have been an unrequested behavior change). The stale forward-reference comment in `AvoidArena.dispose()` was corrected: the guarantee is now scoped to obstacles produced by `extractEdgeRoutingInput` (the only production input path), and it says outright that `route()` is public with an unvalidated `EdgeRoutingInput`.

REACHABILITY: REACHABLE today, but NOT via the layout runners the ticket hypothesized. d3-force refinement (`src/view/d3ForceRefinement.ts`) is clamped and jiggles coincident bodies via a seeded LCG; no persisted node coordinates exist in this repo at all (only pins: docid + timestamp). The live path is SIZING: `src/engine/NodeSizer.ts:143` computes `1 / (1 + k * minDepth)` unguarded, so `depthDecayK = -1` yields an `Infinity` sizePx that flows through `nodeDimensionsPx` into `FlowNode.width/height` and into a note obstacle. `depthDecayK = Infinity` yields `NaN` instead (`Infinity * 0` at the root note). `1e999` parses to `Infinity` for minPx/maxPx and passes the guards too. That upstream defect is OUT OF SCOPE here and is filed as `nid_8vmo5ibhv1bvh2ukrgmafpofj_e`.

GATES: `npm run check` exit 0; `npm test` exit 0 -- 68 files / 916 tests, 0 failed, 0 skipped. Verified independently by IMPLEMENTATION_REVIEWER, not just self-reported. New tests were confirmed to FAIL with the guard disabled.

Flow record: `.ai_out/edge-routing__08-nonfinite-geometry/edge-routing__08-nonfinite-geometry/`.
