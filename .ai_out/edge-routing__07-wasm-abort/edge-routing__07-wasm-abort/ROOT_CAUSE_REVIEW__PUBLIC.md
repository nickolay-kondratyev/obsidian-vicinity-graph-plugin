# ROOT CAUSE REVIEW — edge-routing__07-wasm-abort

Produced by ROOT_CAUSE_REVIEWER. Reviews `FIND_ROOT_CAUSE__PUBLIC.md`.
Input to IMPLEMENTATION. §6 is the **contract** IMPLEMENTATION is held to.

## Verdict: **APPROVED-WITH-CONDITIONS**

The diagnosis is correct and I reproduced every load-bearing claim independently. The
recommended direction (unconditional `router.processTransaction()` at the top of
`AvoidArena.dispose()`) is the right fix and I could not find a better one.

**But FIND_ROOT_CAUSE §5's headline safety claim is factually wrong and must not reach the
codebase.** It states: *"No second failure mode was found … The only way the flush itself dies is
an Emscripten abort from inside the pass … and in that case the module was already dead one line
earlier — status quo, no regression."* I falsified that with a literal (§3.2): there is a
configuration where **today's teardown is clean and survives, and the teardown flush kills the
module**. It is a narrow, doubly-gated configuration and it does **not** change the
recommendation — but the WHY comment and the `AvoidArena` docstring must state the residual
honestly rather than claim unconditional safety.

---

## 1. Does the recommended direction actually fix the reported problem? — **YES, verified myself**

Applied the two-line change to `src/view/edgeRouting.ts` myself (throwaway, reverted; `git diff --
src/` is empty and the RED test is RED again — see §5 of `ROOT_CAUSE_REVIEWER__PRIVATE.md`).

Baseline, unpatched (`.tmp/rcr-1-red.txt`):

```
Aborted(Assertion failed: visGraph.size() == 0, at: ./adaptagrams/cola/libavoid/router.cpp,143,~Router)
Unknown Error: program has already aborted!
 Test Files  1 failed (1)
      Tests  1 failed | 25 passed (26)
   [8212 lines matching "Aborted("]
```

With the flush in `dispose()` (`.tmp/rcr-2-green.txt`):

```
EXIT=0
 Test Files  1 passed (1)
      Tests  26 passed (26)
abortlines=0
```

After reverting (`.tmp/rcr-3-red-again.txt`): `Tests 1 failed | 25 passed (26)`. The RED test is a
genuine, reverting-sensitive gate on this change.

I also reproduced the production **shape** of the bug at the binding level in an isolated process
(`.tmp/rcr-probe.mjs`, scenario `2shape-finite-*` — the exact 2-obstacle/2-pin scene the committed
test uses):

```
2shape-finite-noflush  OUTCOME=[DISPOSE_REPLACED_ERROR: RangeError: Maximum call stack size exceeded] MODULE_ALIVE=[NO]
2shape-finite-flush    OUTCOME=[edge A->missing references an obstacle with no registered shape]      MODULE_ALIVE=[yes points=[2]]
```

That single pair proves both halves of the acceptance shape at once: the module survives **and**
our own diagnostic `Error` survives `finally` instead of being replaced by the `RangeError`.

## 2. Actual root cause, or a patch? — **A legitimate invariant, with a precondition of its own**

I interrogated this rather than accepting the framing.

**The case that it is a patch.** The recommendation makes teardown *do work* instead of preventing
the bad state. The structural oddity — "we built a Router and then abandoned it" — is untouched.
`dispose()` gains a responsibility that reads like cleanup but is really *completing the pass we
just gave up on*. That is a real smell and the ticket's instinct (option 2, "no partially-built
router can exist") is pointing at it.

**The case that it is the root fix — which I find decisive.** libavoid offers **no other way** to
return a Router to a destroyable state once shapes are queued:

- `~Router()` unlinks visibility data only for `isActive()` obstacles, and activation happens
  exclusively in `processTransaction()`. So the destructor's own precondition is "the transaction
  ran". That is libavoid's contract, not our invention.
- The obvious alternative — undo the registrations — **aborts**: `deleteShape()` on a shape with a
  pending `ShapeAdd` asserts (`router.cpp,287,deleteShape`; FIND_ROOT_CAUSE experiment L). I did
  not re-run L, but it is consistent with the source quoted and nothing in my findings contradicts
  it.
- "Prevent the abandoned router" is **not achievable as a total solution**. Validating endpoints
  earlier removes *one* trigger; it cannot remove OOM, binding-glue throws, or any future
  in-window throw. An abandoned, partially-registered Router is always possible, so a safe teardown
  path is required *regardless* of how much validation is added. Validation is therefore additive,
  never alternative.

**Where I land:** "flush before destroy" is the genuine teardown contract of the library, and
`AvoidArena`'s docstring already *promises* safe teardown "even on the throw path" — a promise the
class never honoured. Repairing it is invariant repair, not papering over.

**The honest caveat (this is the correction to §5):** the invariant is *"flushing is the only
teardown libavoid offers"*, **not** *"flushing is always safe"*. The flush is only as safe as the
pending work is valid. See §3.2.

## 3. Second failure modes

### 3.1 Happy-path cost and measurement realism — **acceptable, measurement is realistic**

Re-measured myself at the repo's own dense-fixture scale (`scale-double-flush`,
`scale-errorpath-flush`; 100 note shapes, 300 connectors, one pin each — mirroring
`registerPinsForShape` for `kind: "note"`):

```
shapes=100 edges=300 pass_tx=305.7ms teardown_flush=0.007ms
shapes=100 error_path_teardown_flush=197.3ms
```

- **Happy path: 0.007 ms** against a 305 ms pass — free, matching the investigator's 0.01 ms. The
  redundant flush finds an empty action list and returns.
- **Measurement realism:** 100 nodes / ~292 edges is not an arbitrary number — it is the repo's own
  stated dense fixture, cited in the `EDGE_ROUTING_CROSSING_PENALTY_PX` doc comment
  (`src/view/edgeRouting.ts:80-91`) as the scale the routing budget was tuned against. So the
  measurement is at the documented worst case, not a toy.
- **Error path: ~197 ms one-off** (investigator: 174 ms). Paid only on a pass that is already
  failing and already falling back to straight edges, on a path §4 shows is unreachable today.
  Trading ~200 ms once for "the session does not die" is obviously correct. **Not a concern.**
- **Routing behaviour is unchanged**: the flush happens after `readRoute()` has already read every
  connector, and on the happy path it is a no-op. No route in the 26-test real-wasm suite changed.

### 3.2 **THE FINDING: the teardown flush turns one currently-recoverable failure into a session kill**

The mandate's highest-value question, answered with a literal. Same probe, one variable changed
(shape geometry finite vs. `NaN`), teardown with and without the flush:

```
1shape-finite-noflush  OUTCOME=[edge A->missing references an obstacle with no registered shape]  MODULE_ALIVE=[yes points=[2]]   aborts=0
1shape-finite-flush    OUTCOME=[edge A->missing references an obstacle with no registered shape]  MODULE_ALIVE=[yes points=[2]]   aborts=0
1shape-nan-noflush     OUTCOME=[edge A->missing references an obstacle with no registered shape]  MODULE_ALIVE=[yes points=[2]]   aborts=0
1shape-nan-flush       ABORT: Aborted(Assertion failed: ang >= 0, at: ./adaptagrams/cola/libavoid/geometry.cpp,635
                       OUTCOME=[DISPOSE_REPLACED_ERROR] MODULE_ALIVE=[NO]                                          aborts=1
```

Read row 3 against row 4. With **one** obstacle carrying non-finite coordinates and an in-window
throw: **today the module survives and our `Error` propagates; with the fix the module dies inside
the teardown flush.** The abort is the newly-filed `ang >= 0` geometry assertion
(`nid_a7uwpxayt6w5vdnw8ogwskwvh_e`) firing *from `dispose()`* — a place it cannot fire today.

This is exactly the regression class the mandate asked about, and FIND_ROOT_CAUSE missed it: its
experiments I/P tested non-finite geometry, and F/G/D/M/H/N tested the flush, but it never crossed
the two **below the 2-pin abort threshold**. Above that threshold there is no regression — the
no-flush teardown already aborts (`2shape-nan-noflush`: `visGraph.size() == 0`, 8132 abort lines),
so the fix strictly improves it.

**Why this does not block the fix:**

1. It is **doubly gated**: it needs an in-window throw (§4: unreachable in production) **and**
   non-finite geometry **and** fewer than two pending pins (i.e. exactly one note obstacle, or a
   scene whose obstacles happen to carry one pin total). Folder-group obstacles carry 12 pins each,
   so any group in the scene puts you above the threshold, where the fix only helps.
2. Non-finite geometry is *already* a session-killer on the normal path — `processTransaction()` at
   `:421` aborts on it regardless (`aborting-pass-noflush` and `aborting-pass-flush` are identical:
   `ang >= 0`, module dead, dispose throws either way). The fix does not create the hazard; it
   widens the window in which an already-fatal input fires by one narrow case.
3. No alternative avoids it. A **conditional** flush (`a′`) does not help — in the regressing
   scenario shapes *were* registered and no transaction *did* run, so any state-tracked guard flushes
   too. Nor does a `try`/`catch` around the flush: `destroy(router)` on the next line runs on an
   aborted module and throws identically (`aborting-pass-*` shows dispose throwing post-abort). I
   **agree with the investigator's rejection of both**, now on measured grounds.
4. The clean closure is **finiteness validation before any shape is registered** — which is already
   filed as its own ticket. That ticket is what makes this teardown invariant unconditionally safe.

**What it does change:** the code comment must not claim the flush is unconditionally safe. See §6.

### 3.3 Pass-level fallback contract and error identity — **preserved, verified**

- `2shape-finite-flush` (§1) shows the doomed pass rejecting with **our own** `Error("edge
  A->missing references an obstacle with no registered shape")`, not the `RangeError` the abort
  substitutes today. `GraphViewController.resolveRoutes()`'s catch therefore logs a real diagnostic
  and returns `EMPTY_ROUTES` — one warning, one pass lost, session intact.
- No `ShapeRef`/`ConnRef`/`ShapeConnectionPin` is tracked or destroyed by the change; `owned` is
  untouched. Ticket acceptance criterion 3 holds.
- The single-pass-level-fallback contract is preserved: still exactly one `throw` → one catch → one
  `EMPTY_ROUTES`. No silent per-edge skip is introduced.

## 4. Is "unreachable in production" correct? — **YES, independently verified**

I checked this myself rather than taking §2 on trust, including the paths the mandate named.

- **Sole production input path.** `grep -rn "\.route(" src/ --include=*.ts --include=*.tsx` excluding
  tests returns exactly one hit: `src/view/GraphViewController.ts:270`. Its `input` is built at
  `:254` by `extractEdgeRoutingInput` and reaches `:270` with **only** a signature computation and a
  cache lookup in between (`:261-264`). Nothing mutates or synthesises an `EdgeRoutingInput`
  anywhere else in `src/`.
- **The filter is total, not conditional.** `extractEdgeRoutingInput` (`edgeRouting.ts:154-160`)
  drops every edge whose source or target is missing from `obstacleIds`, and `obstacleIds` is added
  to on exactly the paths that also `push` an obstacle. This holds for **every** node-skip branch —
  missing position (`:126`) and missing group dimensions (`:131`) alike — because the `continue`
  precedes the `obstacleIds.add(node.id)` at `:152`. Pinned / collapsed / filtered nodes do not get
  their own path here: whatever survives into `flow.nodes`/`flow.edges` goes through the same total
  filter. There is no branch that emits an edge without both endpoints.
- **No stale-input caching.** `routeCache` (`GraphViewController.ts:99`) stores
  `{signature, routes}` — **results only**. The input is re-extracted from fresh
  `flow`/`positions`/`groupDimensions` on every call, so no stale input can be replayed into
  `route()`.

So `:414` is genuinely unreachable from production today. Two consequences I want on record:

1. **Keep the `:414` throw.** I agree with the investigator. It is the executable statement of
   `route()`'s precondition, it costs nothing, and it is what makes the regression test possible.
   Turning it into a silent per-edge skip would violate the no-silent-fallback rule and delete the
   only mechanical statement of the contract.
2. **Say the reachability plainly in the ticket close-out.** The user-visible bug described in the
   ticket ("every later rebuild silently renders unrouted edges") **cannot currently be triggered by
   a real vault** through this trigger. The value of the fix is that it closes the whole class so a
   future in-window throw is not a session-killer — that is real and worth doing, but the ticket
   should not be closed claiming a live user-facing bug was fixed. Being straight about this matters
   more than the fix looking impressive.

## 5. Was a better option missed? — **No. One rejection deserves re-argument, and the combination question resolves via my §3.2 finding**

- **Ticket option 2 (pre-resolve endpoints) — agree it is not the fix.** It closes a hole that
  cannot be reached (§4) while leaving the class open, and it duplicates the endpoint contract that
  `extractEdgeRoutingInput` already owns (DRY on a business rule across two files). Noting for
  completeness: option 2 *would* incidentally sidestep my §3.2 regression **for the `:414` trigger
  specifically** (no shapes registered → empty router → flush is safe, `0shape-flush` confirms).
  That is not enough to promote it: it does nothing for any other in-window throw, which is the
  whole point of choosing the class-wide fix.
- **`a′` conditional flush, `d2` `deleteShape`, `d3` leak, `d4`/`d5` loader recovery — all correctly
  rejected.** I re-verified the `d4`/`d5` blocker independently: `AvoidLib` in
  `node_modules/libavoid-js/dist/index-node.mjs` is a module-scope singleton whose `load()`
  short-circuits on an already-set `avoidLib`, so nothing above it can rebuild a dead module. Not
  recoverable in-process, full stop.
- **Is "safe teardown invariant + earlier validation" warranted, or over-engineering?** My §3.2
  finding changes the answer from the investigator's. It is **warranted, but as a separate ticket,
  not bundled here** — because the two fixes have different triggers, different tests and different
  reachability stories, and bundling them would give this ticket two behaviours. What I *do* require
  is that the dependency be made explicit: the finiteness ticket is not merely "another bug", it is
  **the precondition that makes this teardown invariant unconditionally safe**. Filing it and
  linking it is the Pareto-correct move; implementing both here is not.
- **Nothing better exists.** Once you accept that an abandoned, partially-registered Router is always
  possible (§2), flush-before-destroy is the only teardown libavoid permits. There is no third door.

## 6. Conditions IMPLEMENTATION must satisfy

1. **Implement the unconditional flush** at the top of `AvoidArena.dispose()`, before freeing
   `owned`. No state tracking, no conditional guard, no `try`/`catch` around the flush — each was
   measured to buy nothing (§3.2 point 3).
2. **Do not write "no second failure mode" (or any unconditional-safety claim) into the code.** The
   WHY comment and/or the `AvoidArena` docstring must record the measured residual: *the teardown
   flush executes real routing work, so it aborts if the pending obstacles carry non-finite
   geometry — a case whose teardown is clean today when fewer than two pins are pending.* Reference
   ticket `nid_a7uwpxayt6w5vdnw8ogwskwvh_e` as the closure for it. A comment that overstates the
   guarantee is worse than no comment.
3. **Link the tickets.** Add `nid_a7uwpxayt6w5vdnw8ogwskwvh_e` to this ticket's `links:` (and note in
   that ticket that it is the precondition for `AvoidArena`'s teardown invariant). It must not read
   as an unrelated find.
4. **Do NOT add a regression test for the §3.2 residual.** It would lock in a known-bad behaviour and
   would poison every later test in the file (the abort kills the shared wasm instance —
   REPRODUCE §4). Document it; the finiteness ticket owns the test.
5. **Keep the RED test at `edgeRouting.test.ts:675` last in its describe block**, unmodified. Do not
   weaken its premise guard (`premise broken: …`) or its second-pass assertion.
6. **Add exactly one further test**: the doomed pass rejects with **our own** diagnostic `Error`
   (`… references an obstacle with no registered shape`). Verified achievable (§1). One behaviour per
   test — do not fold it into the survival test.
7. **Keep the `:414` throw exactly as is** (§4). No silent per-edge skip; no duplicated endpoint
   validation inside `route()`.
8. **Do not touch `AvoidArena.owned`** — no `ShapeRef`/`ConnRef`/`ShapeConnectionPin` may be tracked
   or destroyed by us (ticket acceptance criterion; `edgeRouting.ts:309-319`).
9. **Update the `AvoidArena` class docstring** so the teardown protocol sits beside the OWNERSHIP
   GOTCHA — the docstring currently *promises* safe teardown "even on the throw path", which is the
   promise being repaired. State it as a protocol ("the Router is returned to a destroyable state
   before it is destroyed"), with the residual from condition 2.
10. **Point `freshPinExclusivity`'s comment (`edgeRouting.test.ts:458-464`) at the canonical WHY** in
    `AvoidArena.dispose()` instead of restating the rationale (DRY).
11. **Green gates**: `npm test` and `npm run check`. `grep -c "Aborted("` on the test output must be
    **0** — with the fix there is no abort flood, so a non-zero count is a real failure.
12. **Close-out honesty**: the ticket close-out / changelog must state that the specific trigger is
    unreachable from production today and that the fix closes the *class* (§4 consequence 2). Do not
    describe it as fixing an observed user-facing session failure.

No open `#QUESTION_FOR_HUMAN:` items.
