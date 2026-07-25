# ROOT_CAUSE_INVESTIGATOR — private rehydration notes

Ticket: `_tickets/edge-routing-a-throw-inside-route-kills-the-wasm-module-for-the-rest-of-the-session.md`
Branch: `edge-routing__07-wasm-abort`. Status: **DONE** — `FIND_ROOT_CAUSE__PUBLIC.md` written, git clean,
RED test still RED, follow-up ticket filed.

## What I did, in order

1. Read `EXPLORATION_PUBLIC.md`, `REPRODUCE__PUBLIC.md`, the ticket, `CLAUDE.md`,
   `src/view/edgeRouting.ts`, `src/view/GraphViewController.ts:240-308`.
2. Determined ticket option (c): `extractEdgeRoutingInput` (`edgeRouting.ts:154-160`) already filters
   edges whose endpoints are not obstacles, and `resolveRoutes` feeds `route()` that output directly
   ⇒ **the `:414` throw is unreachable in production**. This is the finding that reframes the ticket.
3. Built `.tmp/rc-probe.mjs` — one scenario per node process (an abort poisons the module), each ending
   with a happy-path route printing `MODULE_ALIVE=[yes|no]`. Outputs in `.tmp/rc/*.txt`.
4. Fetched adaptagrams source from GitHub raw (`cola/libavoid/router.cpp`, `connectionpin.cpp`,
   `obstacle.cpp`) — this gave the *mechanism*, see below.
5. Patched `AvoidArena.dispose()` temporarily (flush first), ran the real test file → 26/26 green,
   0 abort lines; wrote a throwaway `src/view/rcScratch.test.ts` for error-identity + folder-group
   scenes → 2/2 green with patch, 2/2 red without. **Reverted the patch (`git checkout --`) and deleted
   the scratch spec.**
6. Filed ticket `nid_a7uwpxayt6w5vdnw8ogwskwvh_e` (non-finite geometry aborts inside
   `processTransaction`) — different failure class, deliberately out of scope.

## The mechanism (the bit worth not re-deriving)

- `ShapeConnectionPin`'s ctor → `commonInitForShapeConnection()` creates a `VertInf` **and eagerly calls
  `vertexVisibility(m_vertex, nullptr, true, true)` when `m_router->m_allows_polyline_routing`** (we use
  `PolyLineRouting`). So visibility EDGES exist before any transaction ⇒ ≥2 pin vertices ⇒
  `visGraph.size() > 0`. That is the ≥2-pin threshold, explained.
- `~Router()` only calls `obstaclePtr->removeFromGraph()` `if (obstaclePtr->isActive())`; a queued
  `ShapeAdd` shape is `m_active(false)` until `processTransaction()`. `~Obstacle()` then deletes the
  shape's `VertInf`s raw. Orphaned `EdgeInf`s survive → `COLA_ASSERT(visGraph.size() == 0)` (router.cpp:143).
- `Router::deleteShape` asserts there is no pending `ShapeAdd` for that shape (router.cpp:287) ⇒ the
  "delete everything then flush" teardown is not an option (measured: it aborts).
- UNVERIFIED (didn't read `Obstacle::makeActive()`): that shape CORNER vertices only enter
  `router->vertices` on activation. It is the natural explanation for "1 pin is safe", and nothing in
  the recommendation depends on it.

## Measurement highlights (full table in the PUBLIC doc)

- unconditional flush is safe on empty / parameterless / half-built / already-flushed routers.
- 2nd `processTransaction()` at 100 shapes / 292 edges: **0.01ms**. Error-path flush of 100 pending
  shapes: **174ms** (one-off, failure path only).
- NaN and Infinity coordinates → `Aborted(Assertion failed: ang >= 0, geometry.cpp,635,rotationalAngle)`
  inside `processTransaction` — NOT fixed by any teardown change. Zero/negative-size rects are accepted.
- Binding misuse throws catchably (`ReferenceError: _emscripten_bind_Point_Point_1 is not defined`) —
  a second, real JS-throw source inside the danger window.
- `AvoidLib` load-once singleton re-verified myself in `node_modules/libavoid-js/dist/index-node.mjs`.

## Recommendation delivered

Unconditional `this.router.processTransaction()` at the top of `AvoidArena.dispose()`, framed as a
teardown INVARIANT of `AvoidArena` (docstring + test). Rejected: ticket option 2 (unreachable hole,
DRY violation), conditional/state-tracked flush, `deleteShape`-then-flush (aborts), leaking the router,
any loader-level recovery (impossible).

## Gotchas for a fresh instance

- NEVER let an abort run's stderr into context: ~8.1k `Aborted(...)` lines per abort. Always
  `> .tmp/xxx.txt 2>&1` then `grep -c "Aborted("` + targeted greps.
- Every bash call prints ~15 lines of shell-profile preamble; ignore it.
- Reproduce test must stay LAST in the real-wasm describe or it takes 12 other tests down with it.
