# IMPLEMENTATION_REVIEWER — PRIVATE memory (edge-routing__06 item (a), commit `2d08ab1`)

Written 2026-07-24 by the reviewer of `2d08ab1`. Read this before re-reviewing item (a);
everything below was verified first-hand, not taken from the implementer's notes.

## 0. What I reviewed

Commit `2d08ab1` on `main`: `src/view/edgeRouting.ts` (+15 comment lines, `const pin` +
`pin.setExclusive(false)`), `src/view/libavoidLoader.ts` (`unknown` → `AvoidShapeConnectionPin`),
`src/view/edgeRouting.test.ts` (+163, three real-wasm tests). Plus `.ai_out/` docs (not code).

## 1. Verification commands and REAL results

```
npm run check                -> CHECK_EXIT=0        (log: .tmp/rev/check.log)
npm test                     -> TEST_EXIT=0, Test Files 63 passed (63), Tests 772 passed (772)
                                (log: .tmp/rev/test.log)
node .tmp/rev/probe-ii.mjs   -> default exclusivity by visDirs   (log: .tmp/rev/probe-ii.log)
node .tmp/rev/probe-i.mjs    -> N-leaf side-crowding sweep        (log: .tmp/rev/probe-i.log)
node .tmp/rev/probe-mult.mjs -> terminal-point multiplicity
node .tmp/rev/probe-throwpath.mjs -> router destroy without processTransaction
```
My probes are written from scratch (they do NOT import the implementer's `.tmp/probe*.mjs`);
they replicate `BOUNDARY_PIN_SPECS`, `PIN_CLASS = 1`, buffer 17 / segment 50 / crossing 0.

Gotcha for a future clone: a probe that destroys the Router **without** `processTransaction()`
aborts the wasm (`Assertion failed: visGraph.size() == 0`) and then floods stdout — always call
`processTransaction()` before `Avoid.destroy(router)` in probes, and redirect output to a file.

## 2. Claim (ii) — default exclusivity is derived from `visDirs`: **TRUE**

`.tmp/rev/probe-ii.mjs`, `isExclusive()` read immediately after construction:

```
up     visDirs=  1 isExclusive()=true
down   visDirs=  2 isExclusive()=true
left   visDirs=  4 isExclusive()=true
right  visDirs=  8 isExclusive()=true
all    visDirs= 15 isExclusive()=false
L|R    visDirs= 12 isExclusive()=true     <- multi-direction is still exclusive
none   visDirs=  0 isExclusive()=false
```
So the rule is "ConnDirAll (or none) → shared; anything else → exclusive", not "one direction →
exclusive". The implementer's wording (directional ⇒ exclusive, `ConnDirAll` centre pin ⇒ not)
is accurate for the two cases the code actually creates.

## 3. Claim (i) — the centre fallback starts at the 13th edge, not the 4th: **TRUE**

`.tmp/rev/probe-i.mjs`: 200x800 group box at (400,0), N leaf notes (60x30) stacked down its LEFT,
one edge each. Terminal border per edge; `C` = exact group centre.

```
N    default (today-before-fix)      C   len     setExclusive(false)   C   len
 3   RLL                             0   1199    LLL                   0    925
 4   RLLL                            0   1546    LLLL                  0   1266
 5   TRLLL                           0   1809    LLLLL                 0   1610
 8   TTTRLRLL                        0   3176    LLLLLLLL              0   2527
12   BBBTTTRLRRLL                    0   6468    LLLLLLLLLLLL          0   3510
13   CBBBTTTRLRRLL                   1   6982    LLLLLLLLLLLLL         0   3838
16   CCCCBTTTBBRLRRLL                4   7939    LLLLLLLLLLLLLLLL      0   4688
20   CCCCCCCCTTTBBRBLRRLL            8   9548    LLLL...(20)           0   6105
```
`setExclusive(true)` reproduced the "default" column byte-for-byte at every N — confirming the
default IS exclusive for directional pins.

Conclusions:
- **The TICKET is wrong** ("the 4th edge approaching a given side ... falls back to the group's
  CENTRE"; "a probe put 5 of 8 left-approaching edges on the group centre"). At 8 edges there are
  ZERO centre attachments; 5 of 8 land on the WRONG SIDE. Centre fallback begins at exactly N=13.
- **The IMPLEMENTER is right** on both counts, and their numbers reproduce exactly.
- Extra nuance I measured that nobody stated: spill to a wrong-side pin starts at **N=3**, not
  N=4 (`RLL`) — pin choice is a global cheapest-assignment, not per-side first-come. The shipped
  code comment's "the 4th edge approaching a side" is therefore approximate.

## 4. Non-vacuity of the new tests — mutation-tested in a throwaway worktree

`git worktree add .worktree/rev-mutate 2d08ab1 --detach`, symlinked `node_modules`, mutated,
`npx vitest run src/view/edgeRouting.test.ts`, then `git worktree remove --force`.

- **M1** (`pin.setExclusive(false)` deleted = pre-change state): `2 failed | 20 passed`. The two
  new pin-exhaustion tests fail; the hub/note guard stays green (as the implementer documented).
  This also PROVES the node wasm really loads under vitest here, so `if (!loaded) return;` is not
  silently no-oping any real-wasm test in this environment.
- **M2** (`pin.setExclusive(spec.dir === "all")` — note centre pin forced exclusive, group pins
  left shared): `1 failed | 21 passed`, the failure being the note-square obstacle-crossing guard.
  So test 3 has teeth AND its hand-rolled Liang–Barsky `segmentCrosses` helper genuinely detects
  crossings (it is not stuck returning false).

## 5. Behaviour-capturing tests — nothing weakened

`git show 2d08ab1 -- src/view/edgeRouting.test.ts` is a single `@@ -367,4 +367,167 @@` append.
Confirmed unchanged in the working tree: `CORNER_CLEARANCE_TOL_PX = 12` (:234),
`FACING_BORDER_TOL_PX = 3` (:292), `MID_SPAN_TOL_PX = 10` (:293),
`EDGE_ROUTING_CROSSING_PENALTY_PX = 0` (`edgeRouting.ts:96`, asserted at `.test.ts:129`).
No test removed, no `skip`, no anchor point touched. Diff touches no `e2e/`, no `_tickets/`.

## 6. Ownership / double-free — verified safe

`grep -rn "ShapeConnectionPin" src/` → constructed at exactly one site (`edgeRouting.ts:269`).
`registerPinsForShape(avoid, shape, kind)` still takes `avoid`, NOT the arena, returns `void`, and
the pin is a block-scoped `const` that never escapes. `owned.push` occurs only for Point (x2),
ConnEnd, Rectangle. `dispose()` destroys `owned` then the router last. Structural invariant intact.
Exporting `AvoidShapeConnectionPin` widens the type surface only; nothing stores a pin.

## 7. Findings I raised (see the PUBLIC file for full wording)

Nothing blocking. SHOULD-FIX: (1) research docs still assert the disproved "4th edge → CENTRE"
mechanism (`docs-internal/research/research-layout-aesthetics.md:121-125`, echoed in
`docs-internal/CHANGELOG.md`); (2) the acceptance criterion "recorded in this ticket's notes" is
not yet satisfied — the numbers live only in `.ai_out/`. NICE-TO-HAVE: comment duplication of the
same WHY across 3 sites; the "4th edge" phrasing; `isExclusive()` declared but never called;
fan-in convergence (below); the `if (!loaded) return;` silent-pass shape.

**New consequence I measured that nobody recorded** (`.tmp/rev/probe-mult.mjs`): non-exclusive
pins make many edges terminate at the SAME point. N=8: 8 distinct terminals before → 3 after, with
6 of 8 at exactly (400,400). N=16: 13 distinct → 3. Net win (length −20%/−41%, no centre
fallback), but arrowhead stacking is a real aesthetic trade-off worth recording in the ticket.

**Pre-existing latent bug found while probing** (NOT this diff): `LibavoidEdgeRouter.route()`
throws at `edgeRouting.ts:408` when an edge references an unregistered shape; `finally
{ arena.dispose(); }` then destroys the Router with shapes registered and no `processTransaction()`
— reproduced in `.tmp/rev/probe-throwpath.mjs`: `Aborted(Assertion failed: visGraph.size() == 0,
router.cpp,143,~Router)`, i.e. wasm abort, and `loadAvoid()` memoizes the dead instance for the
session. Deserves its own ticket; explicitly out of scope for item (a).

## 8. Verdict issued

**READY** for item (a). No blocking findings.
