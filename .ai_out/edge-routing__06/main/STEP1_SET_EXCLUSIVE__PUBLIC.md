# STEP 1 — `setExclusive(false)` on the connection pins (edge-routing__06 item (a))

Status: **DONE**, all verification green. Not committed (TOP_LEVEL_AGENT commits).
Scope kept to item (a): no settings, no `EDGE_ROUTING_SHAPE_BUFFER_PX` change, no `e2e/` change.

## 1. What changed

| File | Lines | Change |
|---|---|---|
| `src/view/edgeRouting.ts` | `266-294` (`registerPinsForShape`) | the constructed `ShapeConnectionPin` is held in a local `const pin` just long enough for `pin.setExclusive(false)` (`:292`), plus a WHY block pointing at the router-owned-pin OWNERSHIP GOTCHA below it |
| `src/view/libavoidLoader.ts` | `40-48`, `72-86` | the `ShapeConnectionPin` constructor now returns the new exported `interface AvoidShapeConnectionPin { setExclusive(exclusive: boolean): void; isExclusive(): boolean }` instead of `unknown`. `setConnectionCost` deliberately NOT exposed (closed negative result), stated in the interface doc |
| `src/view/edgeRouting.test.ts` | `371-533` | three real-wasm BDD tests + helpers, in the existing `LibavoidEdgeRouter with real wasm` block (same `if (!loaded) { return; }` skip shape, inline `kind`-typed obstacle literals) |

No pin is pushed into `AvoidArena.owned`; no pin is `destroy()`ed; `registerPinsForShape` still takes
`avoid`, not `arena`. `EDGE_ROUTING_CROSSING_PENALTY_PX` untouched (0). No tolerance was loosened —
`FACING_BORDER_TOL_PX`, `MID_SPAN_TOL_PX`, `CORNER_CLEARANCE_TOL_PX` are byte-identical.

New tests (`src/view/edgeRouting.test.ts`):
1. `:417` WHEN more edges approach a group box than it has pins THEN no route terminates at the group centre
2. `:426` WHEN eight edges approach the same side of a group box THEN every route still terminates on that facing side
3. `:515` WHEN several edges attach to the same note square THEN no route cuts through the boxes in between

## 2. RED-before evidence (tests 1 and 2, verbatim from `.tmp/step1-red.log`)

The ticket's literal test spec ("8 edges → none at the group centre") does **not** go red: exclusivity
is per PIN, and all 12 boundary pins share `PIN_CLASS`, so a group falls back to its centre only from
the **13th** edge. Test 1 therefore uses 16 edges (measured 4 centre attachments before the fix); test 2
keeps the ticket's 8-edge scene and asserts the symptom that scene actually shows — the crowd spilling
onto the wrong side. Both were red on the unmodified router:

```
stderr | ... WHEN more edges approach a group box than it has pins THEN no route terminates at the group centre
Warning: In ConnEnd::assignPinVisibilityTo():
         ConnEnd for connector 21 can't connect to shape 1
         since it has no pins with class id of 1.          (x4)

 ❯ src/view/edgeRouting.test.ts (21 tests | 2 failed) 55ms
     × WHEN more edges approach a group box than it has pins THEN no route terminates at the group centre 30ms
     × WHEN eight edges approach the same side of a group box THEN every route still terminates on that facing side 2ms

AssertionError: expected [ { x: 500, y: 400 }, …(3) ] to deeply equal []
+ [ { "x": 500, "y": 400 }, { "x": 500, "y": 400 }, { "x": 500, "y": 400 }, { "x": 500, "y": 400 } ]   // the group CENTRE, 4x

AssertionError: expected [ { x: 550, y: +0 }, …(4) ] to deeply equal []
+ [ { "x": 550, "y": 0 }, { "x": 500, "y": 0 }, { "x": 450, "y": 0 }, { "x": 600, … ]                  // top/right borders, not the facing left one
```

Test 3 was **green before the change** — see §4; it is a guard, not a fix, and it does have teeth
(it fails when the centre pin is forced exclusive: `.tmp/step1-note-red2.log` control run, 3 failed).

## 3. Measured before/after (my runs, not the ticket's quoted numbers)

### 3.1 Seeded crowded corpus — `node .tmp/probe11-reviewer.mjs` (400 scenes/corpus, seed 12345)

A = today (no `setExclusive` call), B = shared class + `setExclusive(false)` on the group pins.

| corpus | variant | nonFacing | centreAttach | totalLen | Δ len | ms |
|---|---|---|---|---|---|---|
| low degree (1-3 edges/group, 802 edges) | A today | **24** | 2 | 191412 | — | 387 |
| low degree | B `setExclusive(false)` | **22** | 2 | 190773 | **-0.3%** | 377 |
| realistic degree (1-7 edges/group, 1668 edges) | A today | **82** | 2 | 408612 | — | 536 |
| realistic degree | B `setExclusive(false)` | **40** | 2 | 399052 | **-2.3%** | 530 |

Independently reproduces the ticket's quoted 24→22 / 82→40 and -0.3% / -2.3% exactly.

`node .tmp/probe21-shipped.mjs` re-runs the same corpora with the variant that matches what is actually
shipped here (`setExclusive(false)` on group **and** note pins): identical numbers to B (22 / 40,
-0.3% / -2.3%, ms 379 / 530) — every leaf in that corpus has degree 1, so the note pins never bind.

### 3.2 Deterministic side-crowding probe — `node .tmp/probe25-group-default-vs-true.mjs`

One 200x800 group box, N leaf notes stacked down its left, one edge each. Terminal border per edge
(`L/R/T/B`, `?` = group centre):

| N | variant | terminals | centre | non-facing | totalLen |
|---|---|---|---|---|---|
| 8 | default (today) | `TTTRLRLL` | 0 | 5 | 3176 |
| 8 | explicit `setExclusive(true)` | `TTTRLRLL` | 0 | 5 | 3176 |
| 8 | `setExclusive(false)` | `LLLLLLLL` | **0** | **0** | **2527 (-20%)** |
| 16 | default (today) | `????BTTTBBRLRRLL` | 4 | 13 | 7939 |
| 16 | `setExclusive(false)` | `LLLLLLLLLLLLLLLL` | **0** | **0** | **4688 (-41%)** |

(`.tmp/probe14-side-crowding.mjs` sweeps N = 4/8/12/13/16/20 and shows the centre fallback starting
exactly at N = 13, i.e. once all 12 pins are taken.)

## 4. Decision: the note-square CENTRE pin

**Decision: yes, `setExclusive(false)` is applied to the note centre pin too — but as an explicit
statement of intent, not as a behaviour change. It is a measured no-op today.**

Evidence, and a correction to the ticket's premise:

1. The ticket (and the earlier probes) assumed "libavoid directional pins default to EXCLUSIVE". Measured
   on this binding via the newly exposed `isExclusive()`, the default is **derived from the pin's
   visibility directions**:
   - a directional boundary pin (`ConnDirLeft/Right/Up/Down`) reports `isExclusive() === true`;
   - the note centre pin (`ConnDirAll`) reports `isExclusive() === false`.
   Confirmed behaviourally: for group pins, "no call" and explicit `setExclusive(true)` produce
   byte-identical routes (§3.2), while for note pins "no call" behaves like `setExclusive(false)`.
2. Corpus check `node .tmp/probe26-note-default-vs-false.mjs` (200 seeded scenes, one hub note of degree
   2-8, 949 edges, group pins non-exclusive in both arms):
   `routes differing between variants: 0`, `totalLen 386782` in both, `routesThroughObstacles 106` in both.
   So the call changes nothing today.
3. It is still worth making: the default we depend on is invisible and direction-derived. Forcing the
   note pin exclusive (or giving `CENTRE_PIN_SPEC` a direction, which flips the default) makes every edge
   after the first at a multi-edge note lose its pin, and the pin-less fallback routes **straight through
   whatever lies between**: `node .tmp/probe22-note-ring.mjs` — 6 spokes into one hub note, each with a
   box on its straight line — gives `routesThroughObstacles = 5/6` exclusive vs `0/6` non-exclusive, and
   over the seeded corpus 339/949 vs 106/949. Test 3 above locks that property in.

**Honest caveat:** my first pass at this measured "today" as explicit `setExclusive(true)` and briefly
concluded there was a live obstacle-cutting bug at multi-edge notes. That was wrong — explicit `true` is
not today's state. The claim does not appear in the shipped comments or tests; §4.2 is the corrected
measurement.

## 5. Verification (real output)

```
npm run check    -> CHECK_EXIT=0   (tsc -noEmit, strict)
npm test         -> TEST_EXIT=0    Test Files  63 passed (63) / Tests  772 passed (772)
npx vitest run src/view/edgeRouting.test.ts -> 22 passed (22)
```

The previously-known `src/engine/SettingsSpec.test.ts` failure is gone (fixed on `main` before this step),
so the suite is FULLY green. Every pre-existing facing-side / corner-clearance real-wasm test stayed green
throughout — none was touched or loosened. e2e deliberately NOT run (next step's job).

## 6. Notes for the ticket / follow-ups

Ready to paste into the ticket's notes (acceptance criterion (a) "recorded in this ticket's notes") —
I did not edit `_tickets/…` myself:

> (a) measured 2026-07-24, implementer: non-facing attachments 24 → 22 (low degree, 802 edges, total route
> length -0.3%) and 82 → 40 (realistic degree, 1668 edges, -2.3%); routing ms unchanged (387→377, 536→530).
> Corrections to the ticket text: (i) exclusivity is per pin over the whole 12-pin shared-class pool, so the
> group CENTRE fallback starts at the 13th edge, not the 4th — at 8 edges the symptom is 5 of 8 landing on
> the wrong SIDE; (ii) the "default EXCLUSIVE" rule holds for directional pins only — the `ConnDirAll` note
> centre pin is created non-exclusive, so `setExclusive(false)` there is a measured no-op (0 of 949 routes
> changed) kept for explicitness.

`#QUESTION_FOR_HUMAN:` none blocking. Two informational calls I made and would reverse on request:
1. I added **two** tests beyond the ticket's mandated one (the 8-edge facing-side test and the note-square
   obstacle-crossing guard). Both are cheap, both fail under a plausible mutation. Say the word if you want
   the diff trimmed to the single mandated test.
2. The ticket's item-(a) rationale text is now partly inaccurate (see §6 corrections). I left the ticket file
   untouched; someone should fold those two corrections in when the ticket is closed.

Probes used (untracked, `.tmp/`, all re-runnable from the repo root):
`probe11-reviewer.mjs` (pre-existing), `probe14-side-crowding.mjs`, `probe21-shipped.mjs`,
`probe22-note-ring.mjs`, `probe25-group-default-vs-true.mjs`, `probe26-note-default-vs-false.mjs`.
