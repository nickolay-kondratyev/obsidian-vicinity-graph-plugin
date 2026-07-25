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

---

# PART 2 — item (b) review (commits `fc94c33` + `dc71503`, base `3786495`)

Written 2026-07-25. Everything below verified first-hand. HEAD at review time was `2f61c7d`
(a ticket-only commit that TOP_LEVEL_AGENT landed mid-review — `docs(tickets): file the
plugin-wide settings-slider a11y gap`; it already answers step 5b's question 2).

## 1. Verification commands and REAL results

```
npm run check                                  -> CHECK_EXIT=0        (.tmp/rev-b/check.log)
npm test                                       -> 63 files / 779 tests passed (.tmp/rev-b/test.log)
npx tsc -p e2e/tsconfig.json --noEmit          -> E2E_TSC_EXIT=0
npm run setup:dev-vault                        -> SETUP_EXIT=0, bundle grep edgeRoutingClearancePx = 2
npm run test:e2e -- edgeRoutingEval.e2e.ts     -> 5 passed (24.4s), EXIT=0
npm run test:e2e -- edgeRouting.e2e.ts         -> 2 passed (2.4s)
npm run test:e2e -- settingsUxVisual.e2e.ts    -> 7 passed (2.6s)
npm run test:e2e -- edgeRouting.e2e.ts -g "crowded from one side" -> 1 passed (order-independent)
```

`[eval]` AFTER, my own run, reproduces STEP5B verbatim: dense 1.244/1.046, facing 1.266/1.047.
PERF BUDGET routingMs=134.1 vs layoutMs=1382.7 (~10.3x).

## 2. Mutation matrix (throwaway worktree `.worktree/rev-b`, removed after)

| # | Mutation | Result |
|---|---|---|
| M1 | drop `String(input.shapeBufferPx)` from `routingSignature` | **1 failed** — the cache test. Teeth confirmed. |
| M2 | `resolveRoutes(..., 17, token)` (ignore the setting) | **2 failed** — arrival + cache. Teeth confirmed. |
| M3 | spec range → `min: 5, max: 16` | **2 failed** — one per replaced invariant. Teeth confirmed. |
| M4 | `setRoutingParameter(avoid.shapeBufferDistance, 17)` | **ALL GREEN.** 24/24 unit, 779/779 suite, and **all e2e green** — `[eval]` merely printed dense 1.342/1.067 + facing 1.310/1.061 without asserting. **THE GAP.** |
| M5 | revert item (a) `pin.setExclusive(false)` → `void pin`, rebuild vault, e2e | facing test **fails**, `facingSide=[top] terminals=[12]`, offenders `left@855,679 left@855,621 left@855,564 bottom@1138,736` — byte-identical to STEP5B §3. Independently reproduced. |
| M6 | clearance-17 + facing e2e | facing test still **passes** → the facing gate guards item (a) only, NOT item (b). |

M4+M6 together: item (b) has **no assertion anywhere** on the final hop into libavoid.

## 3. Probes I wrote from scratch

- **Clearance-does-reach-libavoid probe** (worktree, real wasm, existing A/B/blocker scene,
  deleted after): total route length `216.64 @6 · 218.89 @8 · 222.61 @11 · 226.74 @14 · 231.31 @17`.
  Deterministic and monotone → a `len(min) < len(max)` real-wasm test closes the M4 gap with no
  new fixture and no flake. This is the concrete fix I recommended.
- **Pre-change `data.json` probe** (worktree, deleted after): a full version-2 file with
  non-default forceLayout, pins, exclusion and NO `edgeRoutingClearancePx` →
  `repelStrength 900 / linkStrengthFactor 3 / linkGapPx 123 / collidePaddingPx 77 /
  elkNodeSpacingPx 55` all survive, new field defaults to 11, pins + exclusion intact.
  Clamping: `999 → 14`, `-5 → 6`. **NO-BUMP is verified correct, not taken on trust.**
  (My `centerPullStrength: 0.42` came back 0.15 — that is the pre-existing clamp max, not a bug.)

## 4. Geometric verdict on `>=` (asked explicitly)

At buffer exactly 6 with `ARROWHEAD_HALF_WIDTH_PX = 6`: libavoid routes on the visibility graph of
buffer-expanded shapes, so a hugging route sits at distance exactly `buffer` from the box.
Half-width 6 == buffer 6 → the head's outer vertex lands **ON** the boundary: **tangent, zero-area
overlap**. `>=` is sound; `min: 7` would be gold-plating. Implementer's resolution of D3's internal
contradiction is right and was flagged rather than hidden.

Nuance nobody recorded, and it is now the tightest relation in the file: `ROUTED_CORNER_RADIUS_PX
= 10` is for the first time LARGER than the minimum reachable clearance (6) — impossible when the
buffer was a fixed 17. Corner rounding cuts inward by `r(1 − 1/√2) ≈ 2.9px`; the diagonal margin at
a buffer corner is `6√2 ≈ 8.49px`, so the drawn curve still clears. Safe, but undocumented.

## 5. Findings issued (full wording in `IMPLEMENTATION_REVIEW_B__PUBLIC.md`)

No BLOCKING. SHOULD-FIX: (1) the M4 gap — untested last hop; (2) `src/view/edgeGeometry.ts:8`
comment is now false (it claims `edgeRouting.ts` imports `EDGE_PAIR_CURVATURE_PX`, deleted in
`fc94c33`); (3) missing CHANGELOG entry for item (b) + `research-layout-aesthetics.md:145,:256`
still recommending a shipped change as future work (same class as my still-open item-(a) finding).
NICE-TO-HAVE: arrowhead constants split across `VicinityEdge.tsx` / `edgeGeometry.ts`; the corner-
radius relation above; "four" over-deleted from the native-parity comments; the retired constant's
"small relative to inter-node spacing" thread not carried into the spec JSDoc.

## 6. Verdict issued

**READY** for item (b). Outstanding acceptance-criteria items are ticket-notes hygiene owned by
TOP_LEVEL_AGENT (the ticket file is untouched since `6a64555`), not implementation defects.
