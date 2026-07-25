---
id: nid_oy3vas85xhr34n2dby1mvows4_e
title: "edge routing: a throw inside route() kills the wasm module for the rest of the session"
status: open
deps: []
links: []
created_iso: 2026-07-25T00:04:02Z
status_updated_iso: 2026-07-25T00:04:02Z
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

