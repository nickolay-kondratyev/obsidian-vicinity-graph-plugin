# IMPLEMENTATION — edge-routing__07-wasm-abort

Produced by IMPLEMENTATION_WITH_SELF_PLAN. Executes the direction approved in
`FIND_ROOT_CAUSE__PUBLIC.md` §5 under the 12 conditions of `ROOT_CAUSE_REVIEW__PUBLIC.md` §6.

**Status: done, both gates green, all 12 conditions satisfied, none rejected.**

---

## 1. Plan followed

**Goal**: `AvoidArena.dispose()` returns the libavoid Router to a destroyable state before
destroying it, stated as the type's teardown protocol — so a throw inside `route()` costs one
routing pass instead of the whole wasm module.

1. Unconditional `router.processTransaction()` at the top of `dispose()`, before freeing `owned`.
2. WHY comment stating the honest invariant + the measured residual + the linked ticket.
3. `AvoidArena` docstring gains a TEARDOWN PROTOCOL paragraph beside the OWNERSHIP GOTCHA.
4. One new test (error identity), placed immediately BEFORE the survival test so the survival test
   stays last in its describe block.
5. `freshPinExclusivity`'s comment points at the canonical WHY instead of restating it.
6. Link the two tickets; close-out honesty note.
7. Gates + `Aborted(` count 0.

## 2. Exactly what changed

### `src/view/edgeRouting.ts` (+29 lines, no logic removed)

| Line(s) | Change |
|---|---|
| `320-323` | `AvoidArena` docstring: new **TEARDOWN PROTOCOL** paragraph — "a Router is only destroyable once its queued transaction has run, so `dispose()` returns it to that state before destroying it", pointing at `dispose()` for the WHY *and for the one residual it does not cover*. This is the repair of the docstring's pre-existing "even on the throw path" promise. |
| `360-383` | `dispose()`: **`this.router.processTransaction()`** as the first statement (guarded only by the existing `this.router !== null`), before the `owned` sweep, with the WHY block below. |
| `384-390` | Unchanged: `owned` sweep, then `destroy(this.router)` last. |

The WHY block records, in order: the libavoid mechanism (`~Router()` asserts `visGraph.size()==0`
but only unlinks ACTIVE obstacles; pins build visibility edges eagerly at construction); the
consequence (Emscripten abort → load-once module dead for the session); **the honest invariant** —
*"Flushing is the ONLY teardown libavoid offers: undoing the registrations instead (`deleteShape()`
on a shape with a pending add) asserts too"*; why unconditional (0.007 ms redundant flush at 100
shapes/300 edges vs. state that can drift); and then, explicitly headed **"NOT a claim that
flushing is always safe"**, the measured residual (non-finite geometry aborts *inside* the flush, a
scene that below two pending pins tears down cleanly today) with ticket
`nid_a7uwpxayt6w5vdnw8ogwskwvh_e` named as its closure, plus the WHY-NOT for a `try`/`catch`.

### `src/view/edgeRouting.test.ts` (+45/−16)

| Line(s) | Change |
|---|---|
| `18` | `EdgeRouteMap` added to the existing type-only import. |
| `458-463` | `freshPinExclusivity` docstring: rationale replaced by a pointer — "WHY: the TEARDOWN PROTOCOL comment in `AvoidArena.dispose()`" (DRY, condition 10). |
| `655-667` | New helper `doomedPass(): Promise<EdgeRouteMap>` — the raw doomed pass, extracted from the existing helper so two tests can share one scene. Keeps the "TWO obstacles on purpose / ≥2 pending pins" measurement note. |
| `669-681` | `routeEdgeWithUnregisteredObstacle()` now delegates to `doomedPass()`. Its `premise broken: …` guard and swallow-only-the-throw semantics are unchanged. |
| `683-690` | **New test** (condition 6): `WHEN a pass throws on an edge referencing an unregistered obstacle THEN it rejects with our own diagnostic error` — one assertion, `rejects.toThrow("references an obstacle with no registered shape")`. |
| `692-696` | The RED survival test — **unmodified and still LAST** in the describe block. |

### Tickets

- `nid_oy3vas85xhr34n2dby1mvows4_e` ← linked → `nid_a7uwpxayt6w5vdnw8ogwskwvh_e` (`ticket link`,
  symmetric, both `links:` frontmatter updated).
- Close-out note on the main ticket (condition 12) and a "PRECONDITION, not an unrelated find" note
  on the finiteness ticket (condition 3).

**Not touched**: `AvoidArena.owned`, the `:414` throw (now `:443`), `docs-internal/`, `CLAUDE.md`
(the knowledge is code-local and belongs in the docstring; nothing here is stable repo-wide
knowledge), `change_log` (a sub-agent must not write changelog entries — flagged for TOP_LEVEL).

## 3. Conditions from `ROOT_CAUSE_REVIEW__PUBLIC.md` §6

| # | Condition | How it is satisfied |
|---|---|---|
| 1 | Unconditional flush at top of `dispose()`, no state tracking / guard / try-catch | `edgeRouting.ts:382`, first statement, inside the pre-existing null check only. No new fields, no branch on "did a transaction run", no `try`/`catch`. |
| 2 | No unconditional-safety claim; record the measured residual + ticket ref | `edgeRouting.ts:376-379`: *"NOT a claim that flushing is always safe: it executes real routing work, so it ABORTS if a pending obstacle carries non-finite geometry — a scene that (below two pending pins) tears down cleanly today."* + `nid_a7uwpxayt6w5vdnw8ogwskwvh_e`. The positive claim is worded as *"Flushing is the ONLY teardown libavoid offers"* (`:370`), never "flushing is safe". |
| 3 | Link the tickets; note the precondition relationship | `ticket link` run (both frontmatters carry the other id); note added to `nid_a7uwpxayt6w5vdnw8ogwskwvh_e` stating it is the precondition that makes the teardown invariant unconditionally safe, with the `1shape-nan-flush` literal. |
| 4 | Do NOT add a regression test for the §3.2 residual | No such test added. It is documented in the `dispose()` comment and on the finiteness ticket only. |
| 5 | RED test stays last, unmodified, guard intact | `edgeRouting.test.ts:692-696` — still the final `it` in `describe("LibavoidEdgeRouter with real wasm")`. Body and the `premise broken: …` guard unchanged; only the helper's *call target* moved to the extracted `doomedPass()` (same scene, same behaviour). |
| 6 | Exactly one further test: our own diagnostic `Error` | `edgeRouting.test.ts:683-690`, one assertion, separate `it`, not folded into the survival test. |
| 7 | Keep the `:414` throw as is | Unchanged (now `edgeRouting.ts:443`). No per-edge skip, no duplicated endpoint validation. |
| 8 | Do not touch `AvoidArena.owned` | `owned` is untouched; no `ShapeRef`/`ConnRef`/`ShapeConnectionPin` is tracked or destroyed. The flush is a method call on the Router. |
| 9 | Docstring states the teardown protocol beside OWNERSHIP GOTCHA | `edgeRouting.ts:320-323`, phrased as a protocol and pointing at the residual. |
| 10 | `freshPinExclusivity` comment points at the canonical WHY | `edgeRouting.test.ts:458-463`. |
| 11 | Green gates, `grep -c "Aborted("` = 0 | §4. |
| 12 | Close-out honesty (unreachable trigger, class-level fix) | Ticket note: *"the specific trigger named in this ticket is NOT reachable from a real vault today … this fix did NOT repair an observed user-facing session failure; it closes the CLASS."* |

**Rejected conditions: none.**

## 4. Test results (literal)

```
# 1. baseline, before any edit  (.tmp/impl-0-red.txt)
npx vitest run src/view/edgeRouting.test.ts
EXIT=1   grep -c "Aborted(" = 8212
 Test Files  1 failed (1)
      Tests  1 failed | 25 passed (26)

# 2. with the fix                (.tmp/impl-1-green.txt)
EXIT=0   aborts=0
 Test Files  1 passed (1)
      Tests  27 passed (27)

# 3. gates                       (.tmp/impl-check.txt, .tmp/impl-test.txt)
npm run check   -> CHECK_EXIT=0
npm test        -> TEST_EXIT=0   aborts=0
 Test Files  67 passed (67)
      Tests  866 passed (866)
```

`866 = 865` (the pre-existing suite) `+ 1` (the new error-identity test); the previously failing
test is the same one that is now green.

### Bite check on the new test (it fails for the RIGHT reason)

With `processTransaction()` in `dispose()` temporarily replaced by `void 0` and only the new test
selected (`.tmp/impl-2-identity-red.txt`, fix restored immediately after):

```
AssertionError: expected [Function] to throw error including 'references an obstacle with no regist…'
                but got 'Maximum call stack size exceeded'
 Tests  1 failed | 26 skipped (27)
```

That is exactly the behaviour the fix restores: today the abort raised inside
`finally { arena.dispose() }` *replaces* our diagnostic with Emscripten's stack overflow, so
`GraphViewController.resolveRoutes()` logs noise instead of the real reason.

## 5. For the reviewer to scrutinise

1. **The one refactor inside a protected test.** Condition 5 says the RED test stays *unmodified*.
   I extracted `doomedPass()` out of `routeEdgeWithUnregisteredObstacle()` so the new test reuses
   the same scene (DRY) — the guard helper's semantics, its `premise broken: …` throw and the test
   body are unchanged. If a reviewer reads condition 5 as covering the helper's *text*, this is the
   only place to object; the behaviour is identical either way.
2. **Comment length.** The `dispose()` WHY block is long (23 lines) because conditions 2 and 9 make
   it the canonical home for this knowledge — the mechanism, the "only teardown offered" invariant,
   the residual, and two WHY-NOTs. Trim only if the reviewer disagrees with that placement.
3. **Test ORDER is load-bearing** while any test in the file can abort: the two
   unregistered-obstacle tests are the last two, the survival test last of all. Anything inserted
   after them inherits the risk of being poisoned by a future regression.
4. **`change_log` deliberately not written** — sub-agents must not; TOP_LEVEL owns it. The ticket is
   deliberately left `open` (not `closed`) in case an IMPLEMENTATION_REVIEW stage follows; its
   close-out note is already written, so closing it is a one-command action for TOP_LEVEL.

No open `#QUESTION_FOR_HUMAN:` items.
