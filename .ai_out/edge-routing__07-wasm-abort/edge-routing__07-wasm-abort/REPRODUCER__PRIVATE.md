# REPRODUCER — private working notes (edge-routing__07-wasm-abort)

Rehydration notes for a fresh REPRODUCER. Public deliverable: `REPRODUCE__PUBLIC.md` (same dir).

## Status: DONE

- Repro test written, RED, committed on branch `edge-routing__07-wasm-abort`.
- `git status` clean; only `src/view/edgeRouting.test.ts` was touched (+36 lines). No production
  code changed at any point.
- `npm run check` green. `npm test` = exactly 1 failure (the new test), 864 passing.

## What I did, in order

1. Read `EXPLORATION_PUBLIC.md`, the ticket, `src/view/edgeRouting.ts:255-441`,
   `src/view/edgeRouting.test.ts` (whole real-wasm block, 243-644).
2. **Probed the binding directly first**, in throwaway `.tmp/*.mjs` scripts, one variant per node
   process (so an abort in one variant cannot confound the next). This was the right call: my very
   first guess (shape registered, no `processTransaction`, destroy) did **NOT** abort, which would
   have made a naive test look "unreproducible".
3. Bisected the trigger → number of `ShapeConnectionPin`s pending (see below).
4. Wrote the BDD test at the END of the real-wasm describe block; ran it → RED.
5. Temporarily moved the test to the FRONT of the describe block (python script + backup copy) to
   measure collateral; restored from `.tmp/edgeRouting.test.ts.bak`.
6. Answered Q5 through the *production* path with a temporary spec `src/view/__q5_scratch.test.ts`
   (deleted after; it asserted plain-Error identity + module survival for 0 and 1 obstacle).
7. Full `npm test` + `npm run check`, then wrote deliverables and committed.

## The trigger, precisely (this is the key finding, beyond the exploration doc)

Destroying an `Avoid.Router` that never ran `processTransaction()`:

| pending state | destroy outcome |
|---|---|
| no shapes | clean |
| shapes, **no pins** | clean |
| **1 pin** (any position, any `ConnDir*`, on 1 shape) | clean |
| **2+ pins** (one shape or spread over two) | **ABORT** `visGraph.size() == 0` @ router.cpp:143 |

Position/direction/`kind` are all irrelevant — only the pin COUNT. Reading: `visGraph.size()` counts
visibility EDGES; two pin vertices produce the first edge. Production registers ≥1 pin per obstacle,
so **≥2 obstacles ⇒ danger**, i.e. every realistic scene. The exploration doc's "≥1 registered
obstacle" is therefore an under-approximation and my scene deliberately uses two notes.

## Failure-mode facts (do not re-derive)

- First (doomed) `route()` rejects with `RangeError: Maximum call stack size exceeded` — Emscripten's
  `abort()` recurses during tear-down. Our intended `Error("… references an obstacle with no
  registered shape")` is *replaced*, because the abort is raised inside `finally`.
- Second `route()` rejects with `Unknown Error: program has already aborted!` ← what Vitest prints.
- Vitest worker does NOT crash. One clean failing test. Other test files unaffected (own workers).
- Test ORDER inside the file matters: test last → `1 failed | 25 passed`; test first →
  `13 failed | 13 passed`.
- stderr flood ~16.2k lines per abort. ALWAYS redirect vitest output to `.tmp/`.

## Test-design decisions (defend these in review)

- **Exactly one `expect`**, on the SECOND route. The doomed pass is a GIVEN, run by helper
  `routeEdgeWithUnregisteredObstacle()` which swallows only the throw and **throws loudly**
  (`premise broken: …`) if the pass ever stops throwing — so no silent-fallback lie, and the test
  cannot degrade into a duplicate of the plain routing tests.
- WHY-NOT `await expect(...).rejects.toThrow(<our message>)` on the first call: today that ALSO fails
  (the abort replaces our Error), giving two independent red reasons and a muddier signal. That
  error-identity behaviour is called out in `REPRODUCE__PUBLIC.md` §7.2 as a fix constraint instead,
  and is a good candidate for a second focused test at IMPLEMENTATION time.
- Placement LAST is deliberate (see order sensitivity above); note it in any review of a move.
- Reused the file's `nodeA`/`nodeB` fixtures and the existing `route()` helper so the "good" pass is
  a scene the file already proves routable.

## Gotchas for whoever comes next

- `npm test`/vitest output while RED is 16k+ lines — never let it into context unredirected.
- The scratch spec must live under `src/` to be picked up (`test.include: src/**/*.test.{ts,tsx}`);
  remember to delete it.
- Bare `import("libavoid-js")` under vitest/node resolves the Chromium browser build and aborts —
  use the file-URL node build the way `beforeAll` already does.
- After the fix, expect the doomed pass to reject with our own `Error` and the test to be green with
  no stderr flood; if the flood persists the abort is still happening somewhere.
