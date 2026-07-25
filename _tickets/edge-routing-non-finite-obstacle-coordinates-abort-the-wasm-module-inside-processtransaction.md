---
id: nid_a7uwpxayt6w5vdnw8ogwskwvh_e
title: "edge routing: non-finite obstacle coordinates abort the wasm module inside processTransaction"
status: open
deps: []
links: []
created_iso: 2026-07-25T14:54:10Z
status_updated_iso: 2026-07-25T14:54:10Z
type: bug
priority: 2
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

