# REPRODUCE findings — edge-routing__07-wasm-abort

Produced by the REPRODUCE stage. Input to FIND_ROOT_CAUSE.

**Reproduced: YES.** Deterministic, in-process, against the real libavoid wasm, through the
production `LibavoidEdgeRouter.route()` path. The test is RED today and is a clean single-test
failure under Vitest (no worker crash).

---

## 1. The test added (this IS the regression test — it stays)

`src/view/edgeRouting.test.ts:645-679`, last test inside the existing
`describe("LibavoidEdgeRouter with real wasm", …)` block.

- `:675` — `it("WHEN a pass throws on an edge referencing an unregistered obstacle THEN a later pass still routes (the wasm module survives)", …)`
- `:662` — helper `routeEdgeWithUnregisteredObstacle()`: runs the doomed pass (obstacles `[nodeA, nodeB]`,
  one edge `A -> "NEVER_REGISTERED"`), swallows ONLY its throw, and throws a loud
  `premise broken: …` error if the pass unexpectedly succeeds — so the test can never go vacuous.
- Test body is three lines: `requireWasm(ctx)` → doomed pass → **one** assertion, that the next
  ordinary pass still produces a route (`(await route()).length > 2`, the file's existing
  bend-around-the-blocker helper).

WHY the assertion is on the SECOND call: the throw looks identical whether the module survived or
died. Only a subsequent pass distinguishes "one pass failed" (the intended pass-level fallback)
from "the wasm module is dead for the session" (the bug).

Uses the file's existing conventions unchanged: `requireWasm(ctx)` skip guard, the hoisted
`loadAvoidMock` wired to the node wasm build in `beforeAll`, `SHIPPED_CLEARANCE_PX`, BDD naming.

## 2. How to reproduce

```bash
mkdir -p .tmp/
npx vitest run src/view/edgeRouting.test.ts > .tmp/repro.txt 2>&1   # exit 1
```

## 3. Literal failure output (decisive lines)

```
stderr | src/view/edgeRouting.test.ts > LibavoidEdgeRouter with real wasm > WHEN a pass throws on an edge referencing an unregistered obstacle THEN a later pass still routes (the wasm module survives)
Aborted(Assertion failed: visGraph.size() == 0, at: ./adaptagrams/cola/libavoid/router.cpp,143,~Router)
libc++abi: terminating
Aborted(native code called abort())
libc++abi: terminating
Aborted(native code called abort())
   … (that pair repeats ~8100 times — see §5) …

 ❯ src/view/edgeRouting.test.ts (26 tests | 1 failed) 52ms
     × WHEN a pass throws on an edge referencing an unregistered obstacle THEN a later pass still routes (the wasm module survives) 27ms

 FAIL  src/view/edgeRouting.test.ts > LibavoidEdgeRouter with real wasm > WHEN a pass throws on an edge referencing an unregistered obstacle THEN a later pass still routes (the wasm module survives)
Unknown Error: program has already aborted!

 Test Files  1 failed (1)
      Tests  1 failed | 25 passed (26)
```

`npm test` (whole suite): `Test Files 1 failed | 66 passed (67)` / `Tests 1 failed | 864 passed (865)`.
The ONLY failure is the new test. `npm run check` (tsc) exits 0.

## 4. Q3 — the exact failure mode under Vitest

| Question | Answer (measured) |
|---|---|
| Does the abort crash the Vitest worker / process? | **No.** Vitest reports one normally-failed test and exits 1. |
| How does the abort surface to JS? | The FIRST `route()` (the doomed pass) rejects with **`RangeError: Maximum call stack size exceeded`** — Emscripten's `abort()` re-enters itself thousands of times during tear-down and blows the JS stack — NOT with our `Error("edge … references an obstacle with no registered shape")`. The abort replaces the intended error, because it is raised inside `finally { arena.dispose() }`. |
| What is the reported test failure? | The SECOND `route()` rejects with **`Unknown Error: program has already aborted!`** (Emscripten's post-abort guard). That is what Vitest prints. |
| Is the module really dead? | **Yes.** Verified at the binding level too: a happy-path route works *before* the abort, and every route *after* it throws (`.tmp/probe6.mjs`; thrown value after abort has no `name`/`message`). |
| Does test ORDER within the file matter? | **Yes, decisively.** With the test LAST: `1 failed | 25 passed`. With the same test moved FIRST in the describe block: **`13 failed | 13 passed`** — every later real-wasm test in the file fails with `Unknown Error: program has already aborted!`. |
| Does it poison OTHER test files? | **No.** Vitest runs each file in its own worker; the full-suite run shows exactly one failure. |

**Consequence for IMPLEMENTATION:** the test is kept LAST in the describe block on purpose. Keeping
that position is not cosmetic — moving it earlier turns one honest RED into 12 misleading collateral
failures while the bug exists. Once the fix lands the test becomes an ordinary green test and is
safe in `npm test`; position should still be preserved so a future REGRESSION stays legible.

## 5. Noise warning (RED state only)

Each abort floods **stderr with ~16,200 lines** (`Aborted(native code called abort())` /
`libc++abi: terminating` pairs). `npm test` output goes from ~hundreds of lines to **16,447 lines**.
Always redirect to `.tmp/` while the bug is unfixed. After the fix there is no abort, so no flood.

## 6. Q5 — does the failure need registered obstacles? (answer refines the exploration doc)

The exploration doc said "≥1 registered obstacle". **That is not precise enough.** Measured, via the
production `route()` path (temporary scratch spec, since deleted) and via direct-binding probes:

| Scene (edge references a missing obstacle) | Result |
|---|---|
| `obstacles: []` | `route()` rejects with our plain `Error("edge A->missing references an obstacle with no registered shape")`; **module survives**, next route succeeds. |
| `obstacles: [oneNote]` | Same — plain `Error`, **module survives**. |
| `obstacles: [noteA, noteB]` (2 obstacles) | **ABORT**; module dead. |

Direct-binding probes isolate the true trigger: destroying a Router with no `processTransaction()` is
safe with **0 or 1 `ShapeConnectionPin`** pending and aborts from **2 pins onward** — independent of
pin position (`0.5,0` vs `0.5,0.5`), direction (`ConnDirUp` vs `ConnDirAll`), shape count, or whether
the pins sit on one shape or two. A Router holding shapes but **no pins at all** also tears down
cleanly. Consistent reading: `visGraph.size()` counts *visibility edges*, and the first visibility
edge appears only once two pin vertices exist.

Since production registers ≥1 pin per obstacle (12 boundary pins on a folder-group, 1 centre pin on a
note), **any real scene with ≥2 obstacles is in the danger zone** — i.e. effectively every scene.
`kind` is irrelevant: two plain notes are enough.

## 7. Constraints this places on the fix

1. The fix must make `AvoidArena.dispose()` safe when **≥2 connection pins are pending and
   `processTransaction()` never ran**. "≥1 obstacle" is the wrong guard condition; "shapes/pins were
   registered and no transaction has run" is the right one (and `>=2 pins` should NOT be special-cased
   — that is a libavoid internal, not a contract).
2. After the fix, the doomed pass must still reject with **our own `Error`** (`… references an
   obstacle with no registered shape`) — today the abort *replaces* it, which also destroys the
   diagnostic that `GraphViewController.resolveRoutes()` logs. FIND_ROOT_CAUSE should treat
   "the original throw survives `finally`" as part of the acceptance shape, though the committed test
   deliberately asserts only the session-survival behaviour (one behaviour per test). A separate,
   focused test for the error identity would be a reasonable IMPLEMENTATION addition.
3. Ticket design **option 2** (resolve all endpoints before creating any shape) fixes only the
   missing-obstacle path; the abort window is "any throw between the first pin registration and
   `processTransaction()`". Option 1 (flush before destroy) closes the whole class. Measurements here
   support option 1 as the load-bearing fix; option 2 remains a nice-to-have narrowing.
4. Confirmed non-viable as recovery: nothing at the `loadAvoid()` layer helps — the module is dead
   in-process (§4 row 4), matching the exploration doc's `AvoidLib` singleton finding.

## 8. Evidence artifacts (untracked, `.tmp/`, not committed)

- `.tmp/repro.txt` — RED run of the file, test last.
- `.tmp/repro-first.txt` — RED run with the test moved first (13 failures).
- `.tmp/full-test.txt` — full `npm test` run.
- `.tmp/check.txt` — `npm run check` (clean).
- `.tmp/probe*.mjs`, `.tmp/p*.txt` — direct-binding probes behind §6.

No open `#QUESTION_FOR_HUMAN:` items.
