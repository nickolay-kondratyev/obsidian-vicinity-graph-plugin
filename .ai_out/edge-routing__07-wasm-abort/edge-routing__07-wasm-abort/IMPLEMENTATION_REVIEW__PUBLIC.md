# IMPLEMENTATION REVIEW — edge-routing__07-wasm-abort

Reviewer: IMPLEMENTATION_REVIEWER. Branch `edge-routing__07-wasm-abort`, diff `main...HEAD`.
Reviewed with fresh eyes against the ticket's Acceptance Criteria, the 12 conditions of
`ROOT_CAUSE_REVIEW__PUBLIC.md` §6, and the repo `CLAUDE.md` / `docs-internal/architecture-map.md`.

## Verdict: **APPROVED-WITH-CONDITIONS**

BLOCKING: **0**. SHOULD-FIX: **2**. NIT: **2**. Suggestions/follow-ups: **2**.

The change is the right one and it is small: one statement of real logic
(`src/view/edgeRouting.ts:382`), the rest is WHY. All four ticket Acceptance Criteria are met,
all 12 conditions are genuinely satisfied **in the code** (independently verified, not taken on
the IMPLEMENTATION file's word), and both new tests **bite**. The two SHOULD-FIX items are
comment/robustness-of-intent issues, not correctness — they can be fixed in place without
re-running the flow.

---

## 1. Independently-run gates (literal summary lines)

`npm run check` → exit **0**:

```
> vicinity-graph@0.1.1 check
> tsc -noEmit
```

`npm test` → exit **0**:

```
 Test Files  67 passed (67)
      Tests  866 passed (866)
```

`grep -c "Aborted(" .tmp/rev-test.txt` → **0** (condition 11 satisfied).

`npx vitest run src/view/edgeRouting.test.ts --reporter=verbose` → exit 0, `Tests 27 passed (27)`.
The two new tests are **executed, not skipped** — `requireWasm(ctx)` resolves the real wasm in this
environment, and both appear as `✓` in the verbose list:

```
 ✓ … THEN it rejects with our own diagnostic error 1ms
 ✓ … THEN a later pass still routes (the wasm module survives) 0ms
```

No `sanity_check.sh` exists in this repo.

## 2. Do the new tests BITE? — **YES, verified empirically**

I temporarily replaced `this.router.processTransaction();` (`src/view/edgeRouting.ts:382`) with a
no-op in a scratch edit, re-ran the file, then restored via `git checkout --`. Result:

```
 × … THEN it rejects with our own diagnostic error 31ms
 × … THEN a later pass still routes (the wasm module survives) 0ms
 Test Files  1 failed (1)
      Tests  2 failed | 25 passed (27)
```

with `grep -c "Aborted("` = **8212** lines of wasm abort flood. Exactly the two new tests flip red
and the other 25 stay green — which also independently confirms the "keep them LAST" placement is
doing its job today. `git status` is clean; `grep -n "processTransaction();"` confirms both call
sites (`:382` teardown, `:450` pass) are present as shipped.

## 3. Ticket Acceptance Criteria — all four met

| AC | Verdict | Evidence |
|---|---|---|
| Real-wasm BDD test routing an edge with a missing obstacle, asserting a SECOND `route()` still succeeds | ✅ | `src/view/edgeRouting.test.ts:692-696` |
| The test is RED before the fix | ✅ | verified myself (§2), not just claimed |
| No `ShapeConnectionPin`/`ShapeRef`/`ConnRef` in `owned` or `destroy()`ed by us | ✅ | `owned` untouched (`src/view/edgeRouting.ts:327, 340, 346, 355`); the fix is a method call on the Router |
| `npm run check` + `npm test` green | ✅ | §1 |

## 4. The 12 conditions — spot-checked in the code

All 12 hold. The three worth recording explicitly:

- **Condition 1** — the flush is the first statement of `dispose()` and is guarded *only* by the
  pre-existing `this.router !== null` null-check (`src/view/edgeRouting.ts:360`), not by any
  "did a transaction run" state. No `try`/`catch`. ✅
- **Condition 5** — the RED survival test's `it(...)` body is **byte-identical** to commit
  `b8beef2` (`git diff b8beef2..HEAD -- src/view/edgeRouting.test.ts`); only the *helper* it calls
  was split. The `premise broken: …` guard and the second-pass assertion are untouched.
- **Condition 8** — confirmed by reading, and by the fact that the only libavoid handles created
  in the change are none.

### On the flagged `doomedPass()` extraction — **not a problem, it is the right call**

IMPLEMENTATION extracted `doomedPass()` out of `routeEdgeWithUnregisteredObstacle()` so the new
error-identity test and the survival test share one scene
(`src/view/edgeRouting.test.ts:661-681`). This does **not** erode condition 5:

- the behaviour-capturing `it` is unchanged;
- `routeEdgeWithUnregisteredObstacle()` keeps its two load-bearing properties — it swallows only
  the pass's own failure and it **fails loudly** if the doomed pass ever stops throwing;
- the alternative (duplicating the two-obstacle scene, including the measured "≥2 pending pins"
  rationale) is exactly the knowledge duplication `CLAUDE.md` forbids.

The two helpers now have one responsibility each: `doomedPass()` = the scene, the wrapper = the
premise guard. Approved as-is.

---

## 5. Findings

### 🚨 BLOCKING — none

### ⚠️ SHOULD-FIX

**S1. The "keep these tests LAST" requirement exists nowhere a future maintainer will look.**
`src/view/edgeRouting.test.ts:645-652` explains the *mechanism* (an abort kills the shared wasm
instance for every later pass) but never states the resulting **rule**. The rule is recorded only
in the ticket close-out and in `.ai_out/` — neither is open when someone appends an `it` to
`describe("LibavoidEdgeRouter with real wasm")`. Today that costs nothing (no abort occurs); the
day the flush regresses, a contributor's unrelated new test goes red too and the failure signal
stops pointing at the cause. Note also that it is **both** new tests that must stay last, not just
the survival one — the first `doomedPass()` in file order is the one that would kill the module.

*Resolution* — one line above `const UNREGISTERED_OBSTACLE_ID` (`:653`), e.g.:

> `// KEEP THESE TWO TESTS LAST IN THIS DESCRIBE: if the teardown flush ever regresses, the first`
> `// doomed pass aborts the shared wasm instance and every test AFTER it fails for the wrong reason.`

**S2. `src/view/edgeRouting.ts:377-378` says "today" about behaviour this change just altered.**

> `… so it ABORTS if a pending obstacle carries non-finite geometry — a scene that (below two`
> `pending pins) tears down cleanly today.`

Read in the post-fix file, "today" parses as "with the code you are looking at" — the opposite of
what is meant. The intended statement (per `nid_a7uwpxayt6w5vdnw8ogwskwvh_e`, note of
2026-07-25T15:08:36Z, probe row `1shape-nan-flush`) is that this sub-case **used to** tear down
cleanly and now aborts: i.e. the flush is a narrow, doubly-gated **regression** traded for closing
the session-killer class. That is an honest and defensible trade, and it is exactly the trade
condition 2 exists to keep visible — so the sentence that carries it must not be ambiguous.

*Resolution* — `… — a case that tore down cleanly BEFORE this flush existed (fewer than two
pending pins), so the flush trades a narrow new abort for closing the session-killer class.`

The same present-tense drift is milder at `src/view/edgeRouting.test.ts:646-648` ("`finally {
arena.dispose() }` then destroys a Router whose shapes were never flushed"), which now describes
code that does the opposite. Conventional for a regression-guard comment, but a `WITHOUT THIS
FLUSH,` opener would remove the doubt.

### 💡 NIT

**N1. The `0.007ms` measurement is scoped to the redundant (success-path) flush only.**
`src/view/edgeRouting.ts:372-373` is correctly worded ("a *redundant* flush finds an empty action
list"), so it is not wrong — but a reader can carry the number over to the throw path, where the
flush runs a **real routing pass** over every shape and every `ConnRef` created before the throw
(a late-edge violation in a 300-edge scene routes ~299 connectors before failing). Still trivially
better than a dead session; worth half a clause so nobody is surprised.

**N2. `dispose()` leaks `owned` + the Router if the flush itself throws.** The WHY-NOT at
`src/view/edgeRouting.ts:380-381` is sound for the case that actually occurs (an Emscripten abort
poisons the module, so `destroy()` would throw identically and the leak is moot — the module is
gone). I checked the other properties and they hold: the ordering **flush → free `owned` →
`destroy(router)` is correct** (the Rectangles/Points backing pending shape adds are still alive
during the flush), and `dispose()` is **idempotent** — `owned.length = 0` and `router = null` make
a second call a no-op, so the `finally` in `route()` cannot double-free. No action needed; recorded
so the next reviewer does not have to re-derive it.

### Suggestions / follow-ups (not for this change)

**F1. Consider bumping `nid_a7uwpxayt6w5vdnw8ogwskwvh_e` from priority 2 to 1.** It stopped being
a speculative find the moment this fix shipped: it is now the precondition that makes a *shipped*
teardown invariant unconditionally safe (its own note says so). Priority 2 understates that.
Reachability of non-finite geometry from d3-force is still `UNVERIFIED`, which is the cheap first
step.

**F2. `GraphViewController.resolveRoutes()`'s warn-once latch is worth revisiting** — pre-existing,
out of scope, but this fix changes its calculus. `routingFailureWarned`
(`src/view/GraphViewController.ts:301-304`) was harmless when the first routing failure killed the
session anyway; now that failures are survivable and recurring, every *later, different* failure is
silently swallowed and the user just sees straight edges. A ticket, not a patch.

## 6. Scope discipline, architecture, security

Clean. No over-engineering (one statement + WHY), no speculative error handling (the `try`/`catch`
was deliberately *not* added, with the reason recorded), no dead code, no unrelated edits. Layering
untouched — `src/view/` only, no new imports, no engine/adapter boundary crossed
(`docs-internal/architecture-map.md` unaffected). No removed tests, no removed `ap_XXX_E` anchors
(verified by grepping the removed-lines side of the diff). No security surface: no I/O, no
deserialization, no user input, no secrets.

## 7. Documentation

Correct placement. The knowledge is **code-local invariant** knowledge and lives in the
`AvoidArena` docstring (`src/view/edgeRouting.ts:320-323`) and the `dispose()` WHY — not in
`CLAUDE.md`, which is right: nothing here is stable repo-wide knowledge, and adding it would
violate the "SUCCINCT, stable, not volatile" rule. `CLAUDE.md` and `docs-internal/` are untouched,
and nothing volatile leaked into either. `docs-internal/CHANGELOG.md` correctly gets no entry —
there is no user-observable behaviour change (the trigger is unreachable from production).

The honest-invariant framing is **preserved**: the positive claim is scoped to *"Flushing is the
ONLY teardown libavoid offers"*, and the residual is headed *"NOT a claim that flushing is always
safe"*. Subject to **S2**, which sharpens rather than reverses it. The ticket close-out's HONEST
SCOPE paragraph is exemplary — it states plainly that no observed user-facing failure was repaired
and that the fix closes the class.

No open `#QUESTION_FOR_HUMAN:` items.

## 8. Conditions attached to the approval

1. Apply **S1** (in-file "keep last" rule).
2. Apply **S2** (unambiguous wording of the residual).

Neither needs re-review of the logic; both are comment-only. Gates already green.
