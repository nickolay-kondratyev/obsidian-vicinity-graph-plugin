---
closed_iso: 2026-07-25T15:22:29Z
id: nid_oy3vas85xhr34n2dby1mvows4_e
title: "edge routing: a throw inside route() kills the wasm module for the rest of the session"
status: closed
deps: []
links: [nid_a7uwpxayt6w5vdnw8ogwskwvh_e]
created_iso: 2026-07-25T00:04:02Z
status_updated_iso: 2026-07-25T15:22:29Z
type: bug
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [edge-routing, wasm, robustness]
---

Found while reviewing edge-routing__06 item (a). PRE-EXISTING, not introduced by that work.

`LibavoidEdgeRouter.route()` in `src/view/edgeRouting.ts` throws when a routing edge references an obstacle id that was never registered as a shape (around `src/view/edgeRouting.ts:408`). The `finally { arena.dispose(); }` block then destroys the Router while shapes are still registered and `processTransaction()` was never called.

Reproduced by the reviewer against the real wasm build:

    Aborted(Assertion failed: visGraph.size() == 0, at: ./adaptagrams/cola/libavoid/router.cpp,143,~Router)

That is a wasm ABORT, not a caught exception. Because `loadAvoid()` in `src/view/libavoidLoader.ts` memoises the instance, the module stays dead for the remainder of the Obsidian session: the throw that was meant to surface a single pass-level fallback instead takes edge routing down permanently, and every later rebuild silently renders unrouted edges.

Evidence and context: `.ai_out/edge-routing__06/main/IMPLEMENTATION_REVIEW__PUBLIC.md` section 7.5. Ownership rules that constrain any fix are documented at `src/view/edgeRouting.ts:288-298` (the Router owns ShapeRefs/ConnRefs/pins and frees them itself -- never `destroy()` them yourself).

## Design

Two candidate directions, pick with measurement:
1. Have `AvoidArena.dispose()` call `router.processTransaction()` before `destroy(router)` when shapes were registered but no transaction ran, so the Router tears down from a clean state.
2. Resolve every connector endpoint FIRST and only register shapes once all endpoints are known to exist, so the throw happens before any libavoid object is created.

Option 2 is the more root-cause fix (no partially-built router can exist); option 1 is the smaller change. Prefer whichever keeps `AvoidArena` ownership rules intact and does not add a second failure mode.

Also consider whether `loadAvoid()` should stop memoising an instance whose module has aborted, so a dead module can be rebuilt rather than poisoning the session.

## Acceptance Criteria

- A real-wasm BDD test in `src/view/edgeRouting.test.ts` routes an input whose edge references a missing obstacle, and asserts that a SECOND `route()` call afterwards still succeeds (today the module is dead).
- The test is RED before the fix.
- No `ShapeConnectionPin`, `ShapeRef` or `ConnRef` is ever pushed into `AvoidArena.owned` or `destroy()`ed by us.
- `npm run check` and `npm test` green.


## Notes

**2026-07-25T15:08:50Z**

CLOSE-OUT (implementation done, awaiting review).

Fixed: `AvoidArena.dispose()` (`src/view/edgeRouting.ts`) now flushes the pending libavoid transaction (`router.processTransaction()`) before `destroy(router)`, stated as the type's TEARDOWN PROTOCOL. Design option 1 was chosen over option 2 because option 2 only closes the missing-obstacle trigger while ANY other throw between the first connection pin and `processTransaction()` stays a session-killer. Option 3 (stop memoising an aborted instance) is impossible: `libavoid-js`'s `AvoidLib` is a load-once singleton BELOW our `loadAvoid()` memo, so a dead module cannot be rebuilt in-process.

HONEST SCOPE: the specific trigger named in this ticket is NOT reachable from a real vault today. `extractEdgeRoutingInput` already drops every edge whose endpoint has no obstacle, and it is the sole production input path into `route()`, so the `throw` it re-checks is unreachable defensive code. This fix therefore did NOT repair an observed user-facing session failure; it closes the CLASS, so that a future in-window throw costs one routing pass instead of the whole session. The throw is deliberately kept as the executable statement of the seam's precondition.

RESIDUAL (not covered): the teardown flush executes real routing work, so it aborts on non-finite obstacle geometry. Linked ticket nid_a7uwpxayt6w5vdnw8ogwskwvh_e is the precondition that makes this teardown invariant unconditionally safe.

Tests: `src/view/edgeRouting.test.ts` — the RED session-survival test is now GREEN (kept LAST in its describe block; an abort kills the shared wasm instance for every later test in the file), plus one new test that the doomed pass rejects with our own diagnostic Error instead of the abort's `RangeError`. `npm test` 866 passed (67 files), `npm run check` exit 0, zero `Aborted(` lines.

**2026-07-25T15:22:29Z**

RESOLVED on branch `edge-routing__07-wasm-abort`.

Root cause (deeper than the ticket text): libavoid unlinks a shape's visibility data only once the shape is ACTIVE (activation happens in `processTransaction()`), while `ShapeConnectionPin`'s constructor builds visibility edges EAGERLY. So a Router destroyed with an unprocessed transaction leaves orphaned `EdgeInf`s and trips `COLA_ASSERT(visGraph.size()==0)` (router.cpp:143) -> Emscripten abort -> memoised module dead for the session. Measured trigger is >=2 pending `ShapeConnectionPin`s (not >=1 obstacle).

Fix: unconditional `router.processTransaction()` as the first statement of `AvoidArena.dispose()` (src/view/edgeRouting.ts) -- framed as a teardown invariant of `AvoidArena`, since flushing is the ONLY teardown libavoid offers.

Design option 2 (endpoint pre-resolution) REJECTED: it closes only the specific missing-obstacle hole, leaves the whole class ("any throw between first shape registration and processTransaction") open, and duplicates a rule `extractEdgeRoutingInput` already enforces.

The ticket's `loadAvoid()` de-memoisation idea is IMPOSSIBLE as a recovery lever: `libavoid-js`'s own `AvoidLib.load()` is a load-once singleton, so re-running init returns the same poisoned instance. The fix must prevent the abort, not recover from it.

IMPORTANT scoping note: the `:414` throw is UNREACHABLE from production today (`extractEdgeRoutingInput` filters every missing-endpoint edge, and it is the sole input path). This change closes a latent CLASS of session-killing failure; it does not fix a live user-facing bug.

Known, knowingly-accepted residual: with non-finite obstacle coordinates AND an in-window throw AND <2 pins, the teardown flush itself now aborts where teardown previously survived. Doubly-gated and unreachable; real closure is ticket nid_a7uwpxayt6w5vdnw8ogwskwvh_e.

All 4 acceptance criteria met. Regression tests: src/view/edgeRouting.test.ts (last two tests in the real-wasm describe, must stay last). npm run check + npm test green (67 files / 866 tests, 0 wasm aborts).
