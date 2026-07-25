# IMPLEMENTATION_REVIEW__PUBLIC — edge-routing__06 item (a), commit `2d08ab1`

Reviewer verdict: **READY**. No blocking findings. Everything below was verified first-hand
(fresh probes written from scratch, mutation testing in a throwaway worktree); I did not take
either the implementer's or the ticket's word for anything.

## Summary

`registerPinsForShape` now holds the constructed `ShapeConnectionPin` in a local `const` just
long enough to call `setExclusive(false)`; `libavoidLoader.ts` narrows that constructor's return
from `unknown` to a two-method `AvoidShapeConnectionPin`; three real-wasm BDD tests are appended
to `edgeRouting.test.ts`. The fix is correct, the measured claims are true, the wasm ownership
invariant is intact, and no pre-existing test was touched or loosened.

## Independent verification (real output)

```
npm run check   -> CHECK_EXIT=0
npm test        -> TEST_EXIT=0    Test Files  63 passed (63)    Tests  772 passed (772)
```

## 1. Safety against the wasm double-free rule — verified, NO FINDINGS

- `ShapeConnectionPin` is constructed at exactly one site (`src/view/edgeRouting.ts:269`;
  `grep -rn ShapeConnectionPin src/ e2e/` confirms). It is a block-scoped `const`, never
  returned, never stored, never destroyed.
- `registerPinsForShape(avoid, shape, kind)` still takes `avoid`, **not** the arena — the
  invariant remains structurally enforced, exactly as `EXPLORATION_PUBLIC__routing.md §1.3`
  demanded. A future edit would have to change the signature to get a pin near `owned`.
- `AvoidArena.owned` receives only Point/Point/Rectangle (`:329,:344`) and ConnEnd (`:335`).
  `dispose()` frees those, then the Router last.
- Exporting the `AvoidShapeConnectionPin` type widens the type surface but not the lifetime
  surface, and its JSDoc opens with "Router-owned: never `destroy()` it." Good.

## 2. Are the two contradicting claims TRUE? — **BOTH TRUE. The ticket text is wrong.**

Probe: 200x800 group box at (400,0), N leaf notes stacked down its LEFT, one edge each, buffer 17
/ segment 50 / crossing 0, `BOUNDARY_PIN_SPECS` replicated. `C` = terminal exactly at group centre.

```
N    default (= today, pre-fix)      C   len     setExclusive(false)   C   len
 3   RLL                             0   1199    LLL                   0    925
 4   RLLL                            0   1546    LLLL                  0   1266
 8   TTTRLRLL                        0   3176    LLLLLLLL              0   2527
12   BBBTTTRLRRLL                    0   6468    LLLLLLLLLLLL          0   3510
13   CBBBTTTRLRRLL                   1   6982    LLLLLLLLLLLLL         0   3838
16   CCCCBTTTBBRLRRLL                4   7939    LLLLLLLLLLLLLLLL      0   4688
20   CCCCCCCCTTTBBRBLRRLL            8   9548    LLLL…(20)             0   6105
```
An explicit `setExclusive(true)` arm reproduced the "default" column byte-for-byte at every N.

**(i) Exclusivity is per pin over the whole 12-pin shared-class pool — CONFIRMED.** Centre
fallback begins at exactly the **13th** edge. At 8 edges there are **zero** centre attachments and
**5 of 8** land on the wrong side. The ticket's "the 4th edge ... falls back to the group's CENTRE"
and "a probe put 5 of 8 left-approaching edges on the group centre" (ticket lines 29/36) are both
incorrect; the implementer's correction is right, and the ticket text must be fixed on close.

**(ii) libavoid derives the default from `visDirs` — CONFIRMED.** `isExclusive()` read immediately
after construction: `up/down/left/right` (1/2/4/8) → `true`; `ConnDirAll` (15) → `false`;
`ConnDirLeft|ConnDirRight` (12) → `true`; `0` → `false`. So the precise rule is "ConnDirAll or none
→ shared, anything else → exclusive", which makes the implementer's statement accurate for the two
cases the code actually creates, and makes the note centre pin's `setExclusive(false)` a genuine
measured no-op — I reproduce that too.

## 3. Test quality and requirements coverage — verified, NO BLOCKING FINDINGS

Mutation-tested in a throwaway worktree at `2d08ab1` (removed afterwards):

| Mutation | Result |
|---|---|
| M1 — delete `pin.setExclusive(false)` (= pre-change state) | `2 failed \| 20 passed`: the 16-edge centre test and the 8-edge facing-side test both fail |
| M2 — `pin.setExclusive(spec.dir === "all")` (note centre pin forced exclusive only) | `1 failed \| 21 passed`: the note-square obstacle-crossing guard fails |

Consequences:
- **Nothing passes vacuously here.** M1 failing is direct proof the node wasm loads under vitest
  in this environment, so `if (!loaded) { return; }` is not silently no-oping the block.
- M2 also proves the hand-rolled Liang–Barsky `segmentCrosses` helper actually detects crossings
  (a helper stuck at `false` would have kept the test green) — my main worry about test 3, cleared.
- Both helpers throw (not skip) on a missing route, so a router that returns nothing fails loudly.

**Requirements-coverage answer on the ticket's mandated test** ("8 edges approaching one side of a
group box → no route terminates at the group centre"): as literally specified, that test is
**unsatisfiable as a RED test** — at 8 edges the pre-change router produces 0 centre attachments,
so the mandated assertion was already green before the fix. The implementer's substitution is
**honest and strictly stronger**, not a weakening:
- test 2 keeps the mandated 8-edge scene and asserts every terminal sits on the facing left border
  — which logically *implies* "none at the centre", so the mandated criterion is covered, and the
  test is genuinely RED before the change (M1);
- test 1 keeps the mandated *assertion* (no centre attachment) and raises the edge count to 16,
  where the centre pathology actually exists (measured C=4 pre-fix).
I consider acceptance criterion (a)'s test clause **satisfied**, and the substitution should be
recorded in the ticket rather than silently absorbed (see §7.2).

## 4. No behaviour-capturing test weakened — verified, NO FINDINGS

`git show 2d08ab1 -- src/view/edgeRouting.test.ts` is one pure-append hunk (`@@ -367,4 +367,167 @@`).
Confirmed intact in the working tree: `CORNER_CLEARANCE_TOL_PX = 12` (`:234`),
`FACING_BORDER_TOL_PX = 3` (`:292`), `MID_SPAN_TOL_PX = 10` (`:293`),
`EDGE_ROUTING_CROSSING_PENALTY_PX = 0` (`src/view/edgeRouting.ts:96`, asserted `:129`), plus the
`EDGE_ROUTING_SHAPE_BUFFER_PX` invariants at `:110-118`. No test deleted, skipped or re-toleranced;
no `ap_XXX_E` anchor touched; no `e2e/` or `_tickets/` file modified.

## 5. API narrowing — verified, NO FINDINGS (one nit)

`AvoidShapeConnectionPin { setExclusive(boolean): void; isExclusive(): boolean }` matches
`node_modules/libavoid-js/dist/index.d.ts:55-66` exactly, is minimal, and correctly refrains from
exposing `setConnectionCost` — with the reason (the closed `edge-routing__05` negative result)
stated in the JSDoc. This is the right shape for the file's "narrow only what we use" convention.

- **NICE-TO-HAVE:** `isExclusive()` is declared but called nowhere in `src/` (only referenced in
  prose). The ticket did ask for it, so keeping it is defensible; if you want it to earn its keep,
  the cheap option is one BDD test locking the derived default
  (`WHEN a directional pin is constructed THEN libavoid defaults it to exclusive`), which also
  documents the premise the whole fix rests on. Otherwise drop it and keep the interface to one
  method. Either is fine; I would not block on it.

## 6. Code quality per CLAUDE.md

**⚠️ NICE-TO-HAVE — the same WHY is written three times.** The exclusivity rationale now appears at
`src/view/edgeRouting.ts:278-291` (15 lines), `src/view/libavoidLoader.ts:73-80`, and
`src/view/edgeRouting.test.ts:371-380`. CLAUDE.md's own heuristic ("if you'd write the same WHY
comment twice, even a single line is likely worth extracting") applies: three copies will drift.
Suggested resolution: keep the full mechanism + measured numbers in ONE place (the call-site
comment reads best), and shorten the other two to a one-line pointer at it plus the ticket id.

**⚠️ NICE-TO-HAVE — one imprecise sentence in the shipped comment.** `edgeRouting.ts:281-282` says
"the 4th edge approaching a side is pushed onto a pin of the WRONG side". My sweep shows the spill
starts at **N=3** (`RLL`) — libavoid assigns pins by global cheapest-assignment, not per-side
first-come, so the exact threshold is geometry-dependent. Given that the ticket's original hard
"4th edge" rule is precisely what this commit is correcting, I would not ship a new hard number:
suggest "once a side's three pins are taken, further edges are pushed onto pins of other sides —
measured, this can begin as early as the 3rd edge".

**Scope creep judgement (two tests beyond the mandate): keep both.**
- Test 2 (8-edge facing side) is not really scope creep — it is the ticket's own scene, and it is
  the test that makes the mandated criterion meaningful. Clearly earns its keep.
- Test 3 (note-square hub guard, ~50 lines including the Liang–Barsky helper) is the debatable one:
  it guards a *decision* (applying the call uniformly, including to the `ConnDirAll` centre pin)
  that is a measured no-op today. It earns its keep because M2 shows it is the only test that fails
  if someone gives `CENTRE_PIN_SPEC` a direction or forces the pin exclusive — i.e. it guards the
  one way this change could silently become harmful. I would keep it; if the human wants the diff
  minimal, this is the only piece I would cut, and cutting it loses real coverage.

**SRP / structure:** the new helpers sit inside the existing `describe` next to their tests,
matching the file's established layout. No production-code responsibility was added or moved.
No over-engineering in `src/`: the production change really is one line plus a type.

## 7. Findings requiring action before the ticket closes

### 7.1 SHOULD-FIX — internal docs still teach the disproved mechanism
`docs-internal/research/research-layout-aesthetics.md:121-125` still states
"`setExclusive(false)`, so the 4th edge approaching a side stops falling back to the group CENTRE",
and `docs-internal/CHANGELOG.md` (2026-07-24 entry) repeats it. Both are now measurably wrong in
the same way the ticket is. Per CLAUDE.md ("keep related docs up-to-date"), correct the research
doc bullet to the measured mechanism (per-pin over a shared 12-pin pool; wrong-side spill from ~the
3rd edge, centre fallback from the 13th) and add a new dated CHANGELOG entry for this shipped
behaviour change rather than rewriting the historical one.

### 7.2 SHOULD-FIX — acceptance criterion "recorded in this ticket's notes" is not yet met
AC (a) requires the before/after non-facing count and total route length in the ticket. They are
currently only in `.ai_out/edge-routing__06/main/STEP1_SET_EXCLUSIVE__PUBLIC.md`. The implementer
deliberately left `_tickets/` untouched and pre-wrote the paste-in block (§6 of that file); someone
with write access to the ticket must paste it, **including** the two corrections to the ticket's own
WHY text and the note that the mandated 8-edge/no-centre test was replaced by a stronger pair.

### 7.3 NICE-TO-HAVE — an unrecorded consequence: edges now fan into the SAME point
Measured (mine, same probe): with shared pins, distinct terminal points collapse.
`N=8`: 8 distinct terminals before → **3** after, with **6 of 8** at exactly (400,400).
`N=16`: 13 distinct → **3**. This is still a clear net win (route length −20% at N=8, −41% at N=16,
zero centre fallbacks, all on the facing side), and it is the classic fan-in look, but N arrowheads
stacked on one border point is a real visual consequence that neither the ticket nor the corpus
metrics (non-facing count, total length) can see. Recommend recording it in the ticket notes, and —
if it looks bad in the item-(b) screenshot smoke — filing a follow-up (more pins per side, or a
spread heuristic) rather than reverting anything here.

### 7.4 NICE-TO-HAVE — `if (!loaded) { return; }` turns a broken environment into 8 green tests
Pre-existing pattern, not introduced here, but this commit raises the count of tests hiding behind
that boolean to 8. I verified the wasm DOES load here (M1 fails), so nothing is currently hidden.
Still, a lost wasm build would report "all green", which is exactly the failure mode CLAUDE.md calls
a lie. Cheap fix, no behaviour lost: switch the guard to vitest's dynamic skip (`ctx.skip()` /
`it.runIf(loaded)`) so an unavailable wasm reports SKIPPED instead of PASSED.

### 7.5 SHOULD-FIX as a separate TICKET — pre-existing wasm-abort on the routing throw path
**Not introduced by this diff; do not fix it inside item (a).** `LibavoidEdgeRouter.route()` throws
at `src/view/edgeRouting.ts:408` when an edge references an unregistered shape. The `finally
{ arena.dispose(); }` then destroys the Router with shapes registered and `processTransaction()`
never called. I reproduced what libavoid does in that state:
`Aborted(Assertion failed: visGraph.size() == 0, at: ./adaptagrams/cola/libavoid/router.cpp,143,~Router)`
— i.e. a wasm abort, and since `loadAvoid()` memoises the instance, the module stays dead for the
rest of the Obsidian session. The intended "surface the pass-level fallback" throw would instead
take routing down permanently. Suggested ticket: call `router.processTransaction()` before
`destroy()` in `AvoidArena.dispose()` when shapes were registered (or register shapes only after
all endpoints resolve), with a real-wasm test that routes an input whose edge references a missing
obstacle and asserts a second `route()` call still succeeds.

## Documentation Updates Needed

- `docs-internal/research/research-layout-aesthetics.md:121-125` — correct the mechanism (7.1).
- `docs-internal/CHANGELOG.md` — new entry for this shipped behaviour change (7.1).
- `_tickets/edge-routing06-…md` — measurements + the two corrections + the test substitution (7.2),
  ideally plus the fan-in observation (7.3).
- No `CLAUDE.md` change needed: the layering, engine-purity and pin-ownership rules already cover
  this change and are respected.

## Verdict

**READY** — item (a) is correct, measured, safely scoped, well tested and does not weaken any
existing guarantee. The SHOULD-FIX items are documentation/ticket-hygiene (7.1, 7.2) and a
pre-existing follow-up ticket (7.5); none of them justifies holding the commit.

`#QUESTION_FOR_HUMAN:` 1 — the ticket's own WHY text for item (a) is measurably wrong ("4th edge →
group CENTRE", "5 of 8 on the centre"). Confirm you want it corrected in place when the ticket
closes, since `edge-routing__05`'s research doc and `docs-internal/CHANGELOG.md` repeat the same
claim and would otherwise keep teaching it.

`#QUESTION_FOR_HUMAN:` 2 — do you want the note-square hub guard test (test 3, ~50 lines) kept? I
recommend keeping it (it is the only test that catches a future direction change on
`CENTRE_PIN_SPEC`), but it is beyond the ticket's mandate and it is the one trim available if you
want the diff minimal.
