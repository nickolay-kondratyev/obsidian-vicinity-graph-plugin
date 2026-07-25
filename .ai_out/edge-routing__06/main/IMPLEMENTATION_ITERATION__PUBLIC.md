# IMPLEMENTATION_ITERATION — edge-routing__06 item (a), step 2b

Acting on `IMPLEMENTATION_REVIEW__PUBLIC.md` (verdict READY, nothing blocking). Refining
commit `2d08ab1`, not redoing it. **Not committed** — TOP_LEVEL_AGENT commits.

## 1. Per-item verdict

| # | Feedback | Verdict | Rationale |
|---|---|---|---|
| 1 | §6 — imprecise shipped comment ("the 4th edge …") | **INCORPORATED** | I re-measured before rewriting (§2). The reviewer is right and the picture is worse than "spill at 3 not 4": at N=3 the facing side still has **all three pins free**, yet one edge lands on the opposite side. The comment now quotes no per-side threshold at all and says why. |
| 2 | §6 — the same WHY written three times | **INCORPORATED** | Full mechanism + numbers now live only at the call site; the loader interface and the test block are one-line pointers + ticket id. A 4th near-copy the review did not list (the note-centre-pin block, `edgeRouting.test.ts:469`) also got reduced — same drift risk. |
| 3 | §7.4 — `if (!loaded) return;` reports PASSED | **INCORPORATED** | This is the CLAUDE.md no-lying-tests rule. Converted the **whole** real-wasm block (all 8 pre-existing guards, plus the 2 new tests → 11 tests today) to a dynamic `ctx.skip()`. Forced-negative evidence in §4. `it.runIf(loaded)` was **rejected as the mechanism** — see §3. |
| 4 | §5 nit — `isExclusive()` declared but unused | **INCORPORATED (kept + tested)** | I took the reviewer's recommended option. Dropping the method would have left the premise the entire fix rests on ("libavoid derives exclusivity from `visDirs`") as prose in three files with nothing to break if a libavoid upgrade flips it. Two BDD tests now assert it, which is also what makes item 1's rewritten comment executable rather than a claim. Cost: ~25 lines and one throwaway router per test. |
| 5 | §7.1 — internal docs still teach the disproved mechanism | **INCORPORATED** | Research-doc bullet corrected to the measured mechanism; **new** dated CHANGELOG entry added; the historical entry was **not** rewritten — it carries a `[Mechanism SUPERSEDED …]` marker so a reader landing there is not misled. The §7.3 fan-in observation is recorded in the research doc (and summarised in the CHANGELOG). |

Nothing rejected. Out-of-scope items left alone as instructed: `_tickets/`,
`EDGE_ROUTING_SHAPE_BUFFER_PX`, settings, `e2e/`, and the §7.5 wasm-abort bug (already
ticketed on `main` in `8cdfb4a`).

## 2. Item 1 — I verified the threshold myself before writing a new sentence

`node .tmp/probe27-spill-threshold.mjs` (new, untracked). Sweeps N = 1..14 on the **exact**
geometry of `crowdedSideTerminals()` in the test file — 200×800 group box at (400,0), N leaf
notes down its left — with buffer 17 / segment 50 / crossing 0 and the 12 `BOUNDARY_PIN_SPECS`
replicated. Letter = the group border each route terminates on; `?` = the group centre.

```
N  | default(no call) | setExclusive(false) | firstWrongSideIndex(default)
 1 | L                | L                   | -
 2 | LL               | LL                  | -
 3 | RLL              | LLL                 | edge#1
 4 | RLLL             | LLLL                | edge#1
 8 | TTTRLRLL         | LLLLLLLL            | edge#1
12 | BBBTTTRLRRLL     | LLLLLLLLLLLL        | edge#1
13 | ?BBBTTTRLRRLL    | LLLLLLLLLLLLL       | edge#1
14 | ??BBTTTBRLRRLL   | LLLLLLLLLLLLLL      | edge#1

FIRST N with any wrong-side terminal (default) = 3
FIRST N with any group-CENTRE terminal (default) = 13
```

**Conclusion, and it is stronger than the reviewer's:** the facing side has 3 pins, so a
"per-side first-come" model predicts a clean `LLL` at N=3. It is `RLL`. libavoid assigns by
globally cheapest **visible** pin, and the stacked leaves shadow each other's view of the left
pins — so the spill point is a property of the geometry, not of any pin count. The 13th-edge
CENTRE fallback, by contrast, IS structural (12 pins) and is still quoted.

The shipped comment (`src/view/edgeRouting.ts:278-300`) now says exactly that, including an
explicit `WHY-NOT a threshold rule` line so the next reader does not re-introduce a hard number.

## 3. Item 3 — why `ctx.skip()` and not `it.runIf(loaded)`

`it.runIf(...)` is evaluated at **collection** time; wasm availability is only known after
`beforeAll` runs. `it.runIf(loaded)` would always see the initial value and never skip —
i.e. it would look like a fix while changing nothing. Vitest 4's `TestContext.skip` has the
overload `(note?: string): never`, so a helper reads cleanly and narrows for TS:

`src/view/edgeRouting.test.ts:232` — `requireWasm(ctx: TestContext): Avoid`, documented with
both the WHY (a bare `return` reports PASS) and the WHY-NOT (`runIf`). The describe's
`let loaded = true` became `let avoid: Avoid | null = null`, which removes a redundant second
source of truth and gives the new tests the instance they need.

## 4. Item 3 — forced-negative PROOF (`avoid = null`, then restored)

Temporarily replaced `avoid = libavoid.AvoidLib.getInstance() as Avoid;` with `avoid = null;`
and ran `npx vitest run src/view/edgeRouting.test.ts --reporter=verbose` (verbose is required —
the default reporter prints only the summary):

```
 ↓ … > WHEN a rectangle blocks the straight path THEN the route bends around it (>2 points) 0ms [the libavoid node wasm build did not load in this environment]
 ↓ … > WHEN routing around the obstacle THEN no waypoint falls strictly inside it 0ms [the libavoid node wasm build did not load in this environment]
 ↓ … > WHEN two boxes are separated horizontally THEN the edge attaches on the facing (right→left) borders 0ms [the libavoid node wasm build did not load in this environment]
 ↓ … > WHEN two boxes are separated vertically THEN the edge attaches on the facing (bottom→top) borders 0ms [the libavoid node wasm build did not load in this environment]
 ↓ … > WHEN two group boxes are offset diagonally THEN the source endpoint clears every corner of its box 0ms [the libavoid node wasm build did not load in this environment]
 ↓ … > WHEN two group boxes are offset diagonally THEN the target endpoint clears every corner of its box 0ms [the libavoid node wasm build did not load in this environment]
 ↓ … > WHEN a directional boundary pin is constructed THEN libavoid defaults it to EXCLUSIVE 0ms [the libavoid node wasm build did not load in this environment]
 ↓ … > WHEN the ConnDirAll note centre pin is constructed THEN libavoid defaults it to NON-exclusive 0ms [the libavoid node wasm build did not load in this environment]
 ↓ … > WHEN more edges approach a group box than it has pins THEN no route terminates at the group centre 0ms [the libavoid node wasm build did not load in this environment]
 ↓ … > WHEN eight edges approach the same side of a group box THEN every route still terminates on that facing side 0ms [the libavoid node wasm build did not load in this environment]
 ↓ … > WHEN several edges attach to the same note square THEN no route cuts through the boxes in between 0ms [the libavoid node wasm build did not load in this environment]
 Test Files  1 passed (1)
      Tests  13 passed | 11 skipped (24)
```

Before this change the same forced-negative run reported **24 passed** — 11 silent lies.
The file was restored from `.tmp/edgeRouting.test.ts.bak` immediately after; `grep -n "TEMP
forced-unavailable" src/view/edgeRouting.test.ts` returns nothing and the real run is back to
`24 passed (24)`.

## 5. Item 4 — the two new premise tests, and the wasm-teardown trap I checked first

`src/view/edgeRouting.test.ts:404` — `WHEN a directional boundary pin is constructed THEN
libavoid defaults it to EXCLUSIVE` (`ConnDirUp` → `true`).
`src/view/edgeRouting.test.ts:409` — `WHEN the ConnDirAll note centre pin is constructed THEN
libavoid defaults it to NON-exclusive` (`ConnDirAll` → `false`).

The helper `freshPinExclusivity` (`:388`) builds a throwaway router + shape + pin, reads
`isExclusive()`, then tears down **respecting the ownership rule**: only Points/Rectangle are
`destroy()`ed, the Router last, the pin never. Before writing it I checked the review's §7.5
abort hazard with `node .tmp/probe28-pin-default-teardown.mjs`: a connector-less arena survives
teardown both with and without `processTransaction()`. I still call `processTransaction()` first
(cheap, consistent with `AvoidArena`, and it keeps the test off the known abort path). No
`ShapeConnectionPin` reaches `AvoidArena.owned` or any `destroy()` path — verified by grep;
`registerPinsForShape(avoid, …)` still takes `avoid`, not the arena.

## 6. What changed (file:line)

| File | Line | Change |
|---|---|---|
| `src/view/edgeRouting.ts` | `278-300` | WHY block rewritten: labelled SINGLE SOURCE, "4th edge" replaced by the measured "first wrong-side terminal at N = 3, and no threshold rule because it is geometry-dependent", 13th-edge centre fallback kept. Production code (`pin.setExclusive(false)`, `:301`) **unchanged**. |
| `src/view/libavoidLoader.ts` | `71-81` | `AvoidShapeConnectionPin` doc reduced to a pointer at `registerPinsForShape` + ticket id; keeps the `setConnectionCost` WHY-NOT (that one is not a duplicate — it is about this interface). |
| `src/view/edgeRouting.test.ts` | `206-236` | `let loaded = true` → `let avoid: Avoid | null = null`; new `requireWasm(ctx)` helper. |
| `src/view/edgeRouting.test.ts` | 8 call sites | every `if (!loaded) { return; }` → `requireWasm(ctx)`, signatures `async () =>` → `async (ctx) =>`. |
| `src/view/edgeRouting.test.ts` | `373-412` | two new premise tests + `freshPinExclusivity` helper + named constants. |
| `src/view/edgeRouting.test.ts` | `414-419`, `469-474` | the two duplicated WHY blocks reduced to pointers at the call-site comment. |
| `docs-internal/research/research-layout-aesthetics.md` | `121-146` | bullet marked SHIPPED; corrected mechanism sub-bullet (per-pin over a shared 12-pin pool; wrong-side spill from the 3rd edge; CENTRE fallback from the 13th); new fan-in sub-bullet recording review §7.3 (8 → 3 distinct terminals at N=8, 13 → 3 at N=16, N arrowheads can stack on one point, invisible to every corpus metric). |
| `docs-internal/CHANGELOG.md` | `3-33` | NEW dated entry for the shipped behaviour change (measurements, the direction-derived default, the loader narrowing, the tests, the fan-in caveat). |
| `docs-internal/CHANGELOG.md` | `55-57` | historical `edge-routing__05` entry: `[Mechanism SUPERSEDED …]` marker appended to the wrong bullet. Entry itself **not** rewritten. |

Untouched, as required: `EDGE_ROUTING_CROSSING_PENALTY_PX` (0), `EDGE_ROUTING_SHAPE_BUFFER_PX`
(17), `FACING_BORDER_TOL_PX`, `MID_SPAN_TOL_PX`, `CORNER_CLEARANCE_TOL_PX`, every `ap_XXX_E`
anchor, `_tickets/`, `e2e/`, settings. No test was deleted, skipped-by-default, or re-toleranced.

## 7. Verification (real output)

```
npm run check   -> CHECK_EXIT=0     (tsc -noEmit, strict)
npm test        -> TEST_EXIT=0      Test Files  63 passed (63)
                                         Tests  774 passed (774)
npx vitest run src/view/edgeRouting.test.ts  -> 24 passed (24)
```

**774 vs the 772 before this step: +2, the two new premise tests. Nothing was skipped in the real
run** — the node wasm loads in this environment, so the new `ctx.skip()` path is inert here (its
behaviour is proven only by the forced-negative run in §4). No count went down.

Logs: `.tmp/s2b-check2.log`, `.tmp/s2b-test.log`, `.tmp/s2b-edgerouting.log`,
`.tmp/s2b-skip-evidence.log`. New probes: `.tmp/probe27-spill-threshold.mjs`,
`.tmp/probe28-pin-default-teardown.mjs` (both untracked, re-runnable from the repo root).

## 8. `#QUESTION_FOR_HUMAN:`

None blocking. One thing to fold in when the ticket closes (TOP_LEVEL_AGENT owns `_tickets/`):
the paste-ready notes block in `STEP1_SET_EXCLUSIVE__PUBLIC.md` §6 is now **incomplete** — it
says "not the 4th; at 8 edges the symptom is 5 of 8 on the wrong side", which is true but stops
short. Add: *the first wrong-side terminal appears at the **3rd** edge, before the facing side's
three pins are even used up (libavoid assigns by globally cheapest visible pin), so no per-side
threshold rule holds*, plus the review §7.3 fan-in observation now recorded in
`docs-internal/research/research-layout-aesthetics.md:137`.
