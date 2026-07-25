# SWEEP__PUBLIC — `EDGE_ROUTING_SHAPE_BUFFER_PX` measured sweep (edge-routing__06 item (b), step 3)

Measurement only. **No behaviour changed** — `src/view/edgeRouting.ts:71` is restored to
`EDGE_PAIR_CURVATURE_PX / 2`, `git diff --stat -- src/` is empty, `npm test` is 774/774 green (§8).
Measured on TOP of item (a) (`setExclusive(false)`, shipped at `9f92e77`).

## 1. Summary

- **The whole non-facing win is bought by getting the buffer BELOW ~15px, and nothing below that
  matters.** Non-facing attachments at realistic group degree: **40 at buffer 17 → 22-26 at every
  value from 14 down to 5**. Between 5 and 14 the metric is flat (and non-monotone within noise).
- **The mechanism is the group's own member squares, not the neighbours.** `ELK_GROUP_PADDING` insets
  members 16px from the group border (`src/view/constants.ts:128`). Members are separate obstacles,
  so once `buffer > that padding` a member's clearance pokes OUTSIDE the group border and seals the
  group's own boundary pins. Confirmed by moving the inset and watching the cliff move with it (§4).
  **17px is exactly 1-2px over that cliff** — the shipped value is the worst plausible choice.
- **The ticket's arrowhead-overlap warning is measurably backwards.** Arrowheads overlapping a
  non-endpoint box: **4.50% at buffer 17 → 3.24% at buffer 5**, monotone (§5). Smaller buffers make
  it BETTER, because the head sits outside the target and larger buffers produce more oblique wrapped
  approaches. I could not see the predicted defect at any swept value.
- **Perf is a non-issue at every value.** Dense routing 132-147ms against 1349-1493ms layout across
  24 samples, with no buffer trend. The PERF BUDGET gate passed on all 12 runs with ~10x margin.
- **RECOMMENDED DEFAULT: 11px** (§7). It sits in the middle of a measured safe band bounded below by
  `ARROWHEAD_HALF_WIDTH_PX = 6` and above by the ~15px member-padding cliff.

## 2. The mandated sweep table

Two independent measurement sources, because no single one produces all the columns:
**non-facing** comes only from the node probes; **detour/ms/screenshots** come only from e2e.
`16` is a **bonus value** I added (not in the mandated 5/8/11/14/17) because it brackets the cliff —
it is labelled everywhere.

### 2.1 Non-facing attachments — `node .tmp/probe30-buffer-sweep.mjs`

400 seeded scenes per corpus, seed 12345, same generator as the item-(a) probes, shipped pin config.
`% len` = total routed length vs the buffer-17 control.

| buffer | corpus | non-facing | centre attach | total route len | ms (400 scenes) |
|---|---|---|---|---|---|
| **5** | low degree (802 edges) | **7** | 0 | −2.9% | 362 |
| **8** | low degree | **9** | 0 | −2.2% | 355 |
| **11** | low degree | **7** | 1 | −1.5% | 353 |
| **14** | low degree | **9** | 1 | −1.2% | 354 |
| 16 (bonus) | low degree | 20 | 1 | −0.5% | 373 |
| **17** (control) | low degree | **22** | 2 | 0.0% | 371 |
| **5** | realistic degree (1668 edges) | **22** | 2 | −2.7% | 499 |
| **8** | realistic degree | **25** | 0 | −2.2% | 500 |
| **11** | realistic degree | **26** | 0 | −1.6% | 496 |
| **14** | realistic degree | **23** | 0 | −0.6% | 497 |
| 16 (bonus) | realistic degree | 39 | 1 | −0.3% | 530 |
| **17** (control) | realistic degree | **40** | 2 | 0.0% | 527 |

Cross-check of record: the buffer-17 rows reproduce `STEP1_SET_EXCLUSIVE__PUBLIC.md` §3.1 exactly
(22 / 40 non-facing, `totalLen` 190773 / 399052). The harness is measuring the shipped configuration.

Read it as: **17 → 40, everything from 14 down → 22-26.** The 22/25/26/23 ordering across 5→14 is
noise on this corpus; do not rank those four values by it.

### 2.2 e2e eval — `npm run test:e2e -- edgeRoutingEval.e2e.ts`

**2 runs per value. Each run renders dense twice (the `force/dense` test and the `PERF BUDGET`
test), so every dense cell below is from 4 samples.** Detour ratios were identical to 3 decimals
across all 4 samples at every value; ms are given as observed min-max because they are not.

| buffer | fixture | maxDetourRatio | meanDetourRatio | routingMs (4 samples) | layoutMs (4 samples) |
|---|---|---|---|---|---|
| **5** | dense | **1.188** | **1.033** | 140.2 – 145.6 | 1348.8 – 1433.5 |
| **8** | dense | 1.226 | 1.036 | 141.2 – 142.9 | 1393.2 – 1492.5 |
| **11** | dense | 1.244 | 1.046 | 135.4 – 146.9 | 1369.6 – 1412.9 |
| **14** | dense | 1.327 | 1.055 | 132.3 – 145.8 | 1373.4 – 1430.6 |
| 16 (bonus) | dense | 1.337 | 1.062 | 133.8 – 147.4 | 1363.4 – 1449.5 |
| **17** (control) | dense | **1.342** | **1.067** | 139.7 – 143.7 | 1374.6 – 1433.6 |
| all values | medium | 1.000 | 1.000 | 9.2 – 13.2 | 27.7 – 39.4 |
| all values | sparse | see caveat | see caveat | 3.3 – 5.5 | 30.3 – 35.6 |

- **Dense detour is the one clean monotone signal in e2e**: 1.342 → 1.188 max, 1.067 → 1.033 mean as
  the buffer shrinks. Smaller buffer = straighter routes, no exceptions.
- **Medium is flat at 1.000 everywhere** — every medium route is already straight, so the detour
  metric cannot see the change there. It is not evidence of "no effect" (the screenshots do change,
  §6.2); it is evidence that this fixture's routes never detour.
- **Sparse caveat — do not use it.** The sparse fixture's `edges=` flips between 10 and 11 run to run,
  and buffer 14 produced BOTH across its two runs (run1 = 10, run2 = 11). The sparse detour values
  (1.000 / 1.001 / 1.007 / 1.013) track that edge count, not the buffer. Sparse screenshots inherit
  the same confound.
- **PERF BUDGET**: `routingMs < layoutMs` passed on all 12 runs. Routing is ~10% of layout at every
  swept value. **No swept value endangers the budget** — routing ms shows no buffer trend at all
  (per-value spread is as wide as the between-value spread).

### 2.3 Verbatim `[eval]` lines

Run logs: `.tmp/sweep-e2e-b{05,08,11,14,16,17}-run{1,2}.log`.

```
### buffer 5 — .tmp/sweep-e2e-b05-run1.log
[eval] force/sparse: routingMs=3.9000000059604645 layoutMs=35.3999999910593 obstacles=13 edges=11 maxDetourRatio=1.001 meanDetourRatio=1.000
[eval] force/medium: routingMs=12.700000002980232 layoutMs=38 obstacles=21 edges=20 maxDetourRatio=1.000 meanDetourRatio=1.000
[eval] force/dense: routingMs=141.5 layoutMs=1433.5 obstacles=101 edges=292 maxDetourRatio=1.188 meanDetourRatio=1.033
[eval] PERF dense/force: routingMs=140.20000000298023 layoutMs=1366.0999999940395 obstacles=101 edges=292 maxDetourRatio=1.188 meanDetourRatio=1.033
### buffer 5 — .tmp/sweep-e2e-b05-run2.log
[eval] force/sparse: routingMs=3.5 layoutMs=34.8999999910593 obstacles=13 edges=11 maxDetourRatio=1.001 meanDetourRatio=1.000
[eval] force/medium: routingMs=13.199999988079071 layoutMs=39.19999998807907 obstacles=21 edges=20 maxDetourRatio=1.000 meanDetourRatio=1.000
[eval] force/dense: routingMs=141.1000000089407 layoutMs=1364 obstacles=101 edges=292 maxDetourRatio=1.188 meanDetourRatio=1.033
[eval] PERF dense/force: routingMs=145.59999999403954 layoutMs=1348.7999999970198 obstacles=101 edges=292 maxDetourRatio=1.188 meanDetourRatio=1.033

### buffer 8 — .tmp/sweep-e2e-b08-run1.log
[eval] force/sparse: routingMs=3.2999999970197678 layoutMs=35.6000000089407 obstacles=13 edges=10 maxDetourRatio=1.000 meanDetourRatio=1.000
[eval] force/medium: routingMs=9.5 layoutMs=27.700000002980232 obstacles=21 edges=20 maxDetourRatio=1.000 meanDetourRatio=1.000
[eval] force/dense: routingMs=142.90000000596046 layoutMs=1484.699999988079 obstacles=101 edges=292 maxDetourRatio=1.226 meanDetourRatio=1.036
[eval] PERF dense/force: routingMs=142.79999999701977 layoutMs=1435.7999999970198 obstacles=101 edges=292 maxDetourRatio=1.226 meanDetourRatio=1.036
### buffer 8 — .tmp/sweep-e2e-b08-run2.log
[eval] force/sparse: routingMs=5.5 layoutMs=33 obstacles=13 edges=10 maxDetourRatio=1.000 meanDetourRatio=1.000
[eval] force/medium: routingMs=12.599999994039536 layoutMs=39.400000005960464 obstacles=21 edges=20 maxDetourRatio=1.000 meanDetourRatio=1.000
[eval] force/dense: routingMs=142.69999998807907 layoutMs=1492.5 obstacles=101 edges=292 maxDetourRatio=1.226 meanDetourRatio=1.036
[eval] PERF dense/force: routingMs=141.19999998807907 layoutMs=1393.199999988079 obstacles=101 edges=292 maxDetourRatio=1.226 meanDetourRatio=1.036

### buffer 11 — .tmp/sweep-e2e-b11-run1.log
[eval] force/sparse: routingMs=3.5 layoutMs=30.299999997019768 obstacles=13 edges=11 maxDetourRatio=1.007 meanDetourRatio=1.001
[eval] force/medium: routingMs=12.5 layoutMs=36.20000000298023 obstacles=21 edges=20 maxDetourRatio=1.000 meanDetourRatio=1.000
[eval] force/dense: routingMs=143.29999999701977 layoutMs=1397.2999999970198 obstacles=101 edges=292 maxDetourRatio=1.244 meanDetourRatio=1.046
[eval] PERF dense/force: routingMs=140.30000001192093 layoutMs=1391.7000000029802 obstacles=101 edges=292 maxDetourRatio=1.244 meanDetourRatio=1.046
### buffer 11 — .tmp/sweep-e2e-b11-run2.log
[eval] force/sparse: routingMs=3.4000000059604645 layoutMs=35 obstacles=13 edges=11 maxDetourRatio=1.007 meanDetourRatio=1.001
[eval] force/medium: routingMs=13 layoutMs=39.1000000089407 obstacles=21 edges=20 maxDetourRatio=1.000 meanDetourRatio=1.000
[eval] force/dense: routingMs=146.90000000596046 layoutMs=1412.9000000059605 obstacles=101 edges=292 maxDetourRatio=1.244 meanDetourRatio=1.046
[eval] PERF dense/force: routingMs=135.3999999910593 layoutMs=1369.5999999940395 obstacles=101 edges=292 maxDetourRatio=1.244 meanDetourRatio=1.046

### buffer 14 — .tmp/sweep-e2e-b14-run1.log
[eval] force/sparse: routingMs=3.300000011920929 layoutMs=33.79999999701977 obstacles=13 edges=10 maxDetourRatio=1.000 meanDetourRatio=1.000
[eval] force/medium: routingMs=12.400000005960464 layoutMs=29.299999997019768 obstacles=21 edges=20 maxDetourRatio=1.000 meanDetourRatio=1.000
[eval] force/dense: routingMs=140.5 layoutMs=1430.5999999940395 obstacles=101 edges=292 maxDetourRatio=1.327 meanDetourRatio=1.055
[eval] PERF dense/force: routingMs=140.5 layoutMs=1373.4000000059605 obstacles=101 edges=292 maxDetourRatio=1.327 meanDetourRatio=1.055
### buffer 14 — .tmp/sweep-e2e-b14-run2.log
[eval] force/sparse: routingMs=3.7000000029802322 layoutMs=32.79999999701977 obstacles=13 edges=11 maxDetourRatio=1.013 meanDetourRatio=1.001
[eval] force/medium: routingMs=12.699999988079071 layoutMs=28.69999998807907 obstacles=21 edges=20 maxDetourRatio=1.000 meanDetourRatio=1.000
[eval] force/dense: routingMs=145.79999999701977 layoutMs=1426.5999999940395 obstacles=101 edges=292 maxDetourRatio=1.327 meanDetourRatio=1.055
[eval] PERF dense/force: routingMs=132.29999999701977 layoutMs=1390.2999999970198 obstacles=101 edges=292 maxDetourRatio=1.327 meanDetourRatio=1.055

### buffer 16 (BONUS, not in the mandated sweep) — .tmp/sweep-e2e-b16-run1.log
[eval] force/sparse: routingMs=3.5 layoutMs=32.79999999701977 obstacles=13 edges=10 maxDetourRatio=1.000 meanDetourRatio=1.000
[eval] force/medium: routingMs=13 layoutMs=38.1000000089407 obstacles=21 edges=20 maxDetourRatio=1.000 meanDetourRatio=1.000
[eval] force/dense: routingMs=147.40000000596046 layoutMs=1449.5 obstacles=101 edges=292 maxDetourRatio=1.337 meanDetourRatio=1.062
[eval] PERF dense/force: routingMs=133.79999999701977 layoutMs=1363.4000000059605 obstacles=101 edges=292 maxDetourRatio=1.337 meanDetourRatio=1.062
### buffer 16 (BONUS) — .tmp/sweep-e2e-b16-run2.log
[eval] force/sparse: routingMs=3.300000011920929 layoutMs=32.29999999701977 obstacles=13 edges=10 maxDetourRatio=1.000 meanDetourRatio=1.000
[eval] force/medium: routingMs=13.100000008940697 layoutMs=35.6000000089407 obstacles=21 edges=20 maxDetourRatio=1.000 meanDetourRatio=1.000
[eval] force/dense: routingMs=142 layoutMs=1443.7999999970198 obstacles=101 edges=292 maxDetourRatio=1.337 meanDetourRatio=1.062
[eval] PERF dense/force: routingMs=141.79999999701977 layoutMs=1367.1000000089407 obstacles=101 edges=292 maxDetourRatio=1.337 meanDetourRatio=1.062

### buffer 17 (CONTROL, today's shipped value) — .tmp/sweep-e2e-b17-run1.log
[eval] force/sparse: routingMs=3.5 layoutMs=32.900000005960464 obstacles=13 edges=10 maxDetourRatio=1.000 meanDetourRatio=1.000
[eval] force/medium: routingMs=9.199999988079071 layoutMs=27.799999997019768 obstacles=21 edges=20 maxDetourRatio=1.000 meanDetourRatio=1.000
[eval] force/dense: routingMs=139.70000000298023 layoutMs=1433.6000000089407 obstacles=101 edges=292 maxDetourRatio=1.342 meanDetourRatio=1.067
[eval] PERF dense/force: routingMs=139.90000000596046 layoutMs=1404.6000000089407 obstacles=101 edges=292 maxDetourRatio=1.342 meanDetourRatio=1.067
### buffer 17 (CONTROL) — .tmp/sweep-e2e-b17-run2.log
[eval] force/sparse: routingMs=3.2999999970197678 layoutMs=32.79999999701977 obstacles=13 edges=10 maxDetourRatio=1.000 meanDetourRatio=1.000
[eval] force/medium: routingMs=13.199999988079071 layoutMs=38.79999999701977 obstacles=21 edges=20 maxDetourRatio=1.000 meanDetourRatio=1.000
[eval] force/dense: routingMs=143.70000000298023 layoutMs=1426.2000000029802 obstacles=101 edges=292 maxDetourRatio=1.342 meanDetourRatio=1.067
[eval] PERF dense/force: routingMs=139.79999999701977 layoutMs=1374.6000000089407 obstacles=101 edges=292 maxDetourRatio=1.342 meanDetourRatio=1.067
```

## 3. Screenshots

All under `.out/` (gitignored, never source-controlled). One set per swept value:

```
.out/sweep-buffer05-{sparse,medium,dense}.png
.out/sweep-buffer08-{sparse,medium,dense}.png
.out/sweep-buffer11-{sparse,medium,dense}.png
.out/sweep-buffer14-{sparse,medium,dense}.png
.out/sweep-buffer16-{sparse,medium,dense}.png     (bonus value)
.out/sweep-buffer17-{sparse,medium,dense}.png     (control)
.out/crop-dense-b05.png, .out/crop-dense-b17.png  (hub region, 5x point-upscaled, for eyeballing)
```

Which of them actually differ (md5, so this is fact not impression):

| fixture | distinct images across the six values |
|---|---|
| medium | exactly **two**: {5, 8, 11, 14} identical, {16, 17} identical |
| dense | **six** — every value differs |
| sparse | four, but the differences track the 10-vs-11 edge-count confound (§2.2), **not** the buffer |

## 4. Why the cliff is where it is (the mechanism, not a curve fit)

`ELK_GROUP_PADDING = "[top=36.0,left=16.0,bottom=16.0,right=16.0]"` (`src/view/constants.ts:128`).
A group's member notes are emitted as their OWN routing obstacles (`extractEdgeRoutingInput`), so
libavoid inflates each member by the buffer too. When `buffer > side padding`, the member's clearance
region extends past the group's own border and seals the group's boundary pins from the outside —
the visibility blocking that `edge-routing__05` identified as the root cause.

`node .tmp/probe31-inset-sensitivity.mjs` — 200 scenes, realistic degree, 843 edges, member inset
varied. The cliff **moves with the inset**, which is what makes this a mechanism and not an artifact:

| member inset | buf5 | buf8 | buf11 | buf13 | buf14 | buf15 | buf16 | buf17 | buf18 | buf20 |
|---|---|---|---|---|---|---|---|---|---|---|
| 10px | 16 | 17 | 20 | 22 | 23 | 24 | 25 | 25 | 27 | 26 |
| **16px (the real one)** | 16 | 19 | 17 | 17 | 16 | 14 | 15 | **25** | 27 | 26 |
| 24px | 17 | 22 | 19 | 20 | 20 | 21 | 22 | 20 | 23 | 22 |

At inset 16 the metric is flat up to buffer 16 and jumps at 17. At inset 10 it degrades from 11
onward. At inset 24 it never degrades in the swept range. **Today's 17 is 1px over the cliff.**

Empirically the safe ceiling is a little tighter than 16: the 400-scene corpus (inset 15) already
degrades at 16, and the medium e2e fixture's screenshot flips between 14 and 16. **Treat 14 as the
measured ceiling, not 16.**

## 5. Arrowhead-overlap assessment — the ticket's premise does not survive measurement

**Answer to "at which swept values can you actually see it": at none of them, and the measurement
says the effect runs the other way.**

**5.1 Why the screenshots alone cannot answer it.** The `.out` captures are the whole flow pane at
fitView zoom. On the dense fixture that is ~0.1x, so a 14px inset and a 6px-half-width head are
sub-pixel. I cropped and 5x point-upscaled the hub region (`.out/crop-dense-b05.png` vs
`crop-dense-b17.png`): at buffer 5 the routes are visibly straighter and less bundled and approach
the hub more directly; at 17 they take wider swings and bundle into thicker corridors. **I could not
see an arrowhead overlapping a node body at either value** — and at that zoom I would not trust
myself to, in either direction. Sparse/medium are legible but too uncrowded to exhibit the case.

**5.2 So I measured it instead** — `node .tmp/probe33-arrowhead-overlap.mjs`, 400 scenes, realistic
degree, 1668 arrowheads. It replicates the shipped placement exactly: `routedGeometryFor()` passes
the **last segment's** length as `edgeLength`, so `inset = min(48, max(14, lastSeg × 0.12))`; the
triangle is `VicinityEdge.tsx`'s 11px-long, 6px-half-width head with its tip at that anchor. Stated
approximation: `clipRouteToEndpointRects` is not replicated (pins sit on the border with
`insideOffset 0`, so it is a no-op for the terminal point).

| buffer | heads overlapping a non-endpoint box | breakdown (group member / other leaf / crowding note) | tip extrapolated off-route |
|---|---|---|---|
| **5** | **54 / 1668 = 3.24%** | 10 / 11 / 35 | 4 (0.24%) |
| 8 | 61 = 3.66% | 10 / 12 / 43 | 4 |
| 11 | 65 = 3.90% | 9 / 13 / 47 | 5 |
| 14 | 69 = 4.14% | 9 / 16 / 48 | 4 |
| 16 (bonus) | 75 = 4.50% | 14 / 16 / 49 | 4 |
| **17** (control) | **75 = 4.50%** | 15 / 15 / 49 | 4 |

Monotone, and consistent across all three box kinds. **Shrinking the buffer reduces arrowhead
overlap by ~28%.** The reason is that the head sits 14-25px OUTSIDE the target along the approach,
in the corridor in front of it; a larger buffer produces more oblique, wrapped approaches whose
final leg passes over other boxes.

**5.3 The invariant compares two different axes.** `EDGE_ROUTING_SHAPE_BUFFER_PX` is a
**perpendicular** clearance from an obstacle. `EDGE_ARROWHEAD_INSET_MIN_PX` is a **longitudinal**
offset back from the terminal along the route. `buffer > inset` is therefore an aesthetic scale rule,
not a geometric guarantee, and the doc comment at `edgeRouting.ts:63-66` ("a route clears a box
further out than the arrowhead ever sits") does not describe a real containment relation.

The constant that **does** protect the arrowhead body is `ARROWHEAD_HALF_WIDTH_PX = 6`
(`src/view/VicinityEdge.tsx:23`): a head drawn on a route that clears every box by `buffer` px keeps
its body outside those boxes as long as `buffer > 6`. **That is the invariant worth keeping.**

## 6. Fan-in assessment (`IMPLEMENTATION_REVIEW__PUBLIC.md` §7.3)

**The buffer does not touch the fan-in, in either direction.** `node .tmp/probe32-fanin-vs-buffer.mjs`,
one 200x800 group, N leaves stacked down its left side, one edge each, shipped pin config:

| scene | buffer 5 | 8 | 11 | 14 | 16 | 17 |
|---|---|---|---|---|---|---|
| N=8, distinct terminals | 3 | 3 | 3 | 3 | 3 | 3 |
| N=8, max stacked on one point | 6 | 6 | 6 | 6 | 6 | 6 |
| N=16, distinct terminals | 3 | 3 | 3 | 3 | 3 | 3 |
| N=16, max stacked on one point | **10** | 8 | 8 | 8 | 8 | 8 |

(Identical with and without member squares inside the group; all 3 pins on the facing side, zero
centre fallbacks, at every buffer.)

- **3 distinct terminals is an architectural floor, not a buffer effect**: `BOUNDARY_PIN_SPECS` puts
  exactly 3 pins on each side. No buffer value can produce more than 3 terminals on one side.
- A smaller buffer makes it **very slightly worse at high degree** — at N=16, buffer 5 stacks 10
  edges on a single point where every other value stacks 8. This is the only measured metric on which
  small buffers lose.
- **Does it look bad in the screenshots?** Not visibly in this sweep. The medium fixture's groups each
  carry one collapsed `×4` edge, so no stacking case appears; the dense fixture has no folder groups
  at all. So the sweep produced **no visual evidence either way** on fan-in — the §7.3 concern is
  neither confirmed nor refuted here, and item (b) is not the lever for it. If the human wants it
  addressed, it needs more pins per side or a spread heuristic (a follow-up ticket), not a buffer change.

## 7. RECOMMENDATION

### Recommended default: **11px**

The measured safe band is **`ARROWHEAD_HALF_WIDTH_PX (6) < buffer ≤ 14`**:
- **lower bound 6** — below it, an arrowhead body drawn on a route that clears a box by `buffer` px
  can poke into that box (§5.3). The human's proposed 5 sits 1px under this.
- **upper bound 14** — measured, twice: the 400-scene corpus degrades at 16, and the medium e2e
  fixture's routing flips back to the buffer-17 behaviour between 14 and 16 (§3, §4). Structurally
  it is `ELK_GROUP_PADDING`'s 16px side padding, less a little slack.

**11 is the midpoint of that band** — 5px of margin above the arrowhead half-width, 3px below the
measured ceiling — so it survives a modest change to either `ELK_GROUP_PADDING` or the arrowhead
geometry without silently falling off a cliff. Every headline metric is fully captured there:
non-facing 40 → 26 (realistic) and 22 → 7 (low degree), dense `maxDetourRatio` 1.342 → 1.244,
`meanDetourRatio` 1.067 → 1.046, total route length −1.6%, arrowhead overlap 4.50% → 3.90%,
routing ms unchanged.

**The trade-off I am explicitly trading away:** buffer 5 is measurably better on the *continuous*
quality metrics — dense `maxDetourRatio` 1.188 vs 1.244, route length −2.7% vs −1.6%, arrowhead
overlap 3.24% vs 3.90%. I am giving up roughly half of the remaining detour improvement in exchange
for (a) staying above the 6px arrowhead half-width, (b) a robustness margin at both ends of the band,
and (c) visible breathing room between routes and boxes. If the human values route straightness above
those margins, **8px** is the defensible alternative (still above 6, detour 1.226) and **5px** is
defensible on the numbers alone — I do not recommend it only because it violates the one clearance
relation that is geometrically real.

**Suggested clamp range for the slider** (a call for the human, not measured): min 6 (the arrowhead
half-width floor), max 24, step 1. A max above ~16 lets the user re-create today's pathology, which
is arguably fine for a knob — but say so deliberately.

### Which of the ticket's three invariant options the data supports: **option 3, with replacements**

- **Option 1 (re-derive the curvature tie) — NOT supported.** Nothing in the measurements makes
  `EDGE_PAIR_CURVATURE_PX` relevant to obstacle clearance. The real constraints are the arrowhead
  half-width and the group padding. Picking a divisor that happens to land near 11 would be
  numerology, and it would silently move the buffer if anyone re-tunes the bow curvature.
- **Option 2 (shrink `EDGE_ARROWHEAD_INSET_MIN_PX`) — NOT supported, and would be a fix for a
  non-problem.** Arrowhead overlap gets *better* at smaller buffers (§5.2), so there is nothing to
  compensate for; and the inset governs a longitudinal offset, so shrinking it would not change any
  clearance.
- **Option 3 (accept the decoupling) — SUPPORTED**, but "accept the decoupling" undersells it. The
  buffer is not un-derived; it is derived from two *different* constants that this sweep measured:

  1. `EDGE_ROUTING_SHAPE_BUFFER_PX > ARROWHEAD_HALF_WIDTH_PX` (6) — an arrowhead body drawn on a
     route stays clear of every box the route clears. Replaces the current `> EDGE_ARROWHEAD_INSET_MIN_PX`
     assertion, which compares a perpendicular clearance to a longitudinal offset.
  2. `EDGE_ROUTING_SHAPE_BUFFER_PX < ` the folder-group side padding (16, from `ELK_GROUP_PADDING`) —
     a member square's clearance never pokes outside its group's border and seals the group's own
     boundary pins. Replaces the current `=== EDGE_PAIR_CURVATURE_PX / 2` assertion.

  Both are testable as pure constant relations, both carry a measured rationale for the test comment,
  and neither is a loosening: the two existing tests get **replaced by two stronger ones**, not deleted
  or weakened. Recording this is what acceptance criterion (b)#1 asks for.

  Implementation note (not done by me): `ARROWHEAD_HALF_WIDTH_PX` is module-private in
  `src/view/VicinityEdge.tsx:23` and `ELK_GROUP_PADDING` is an **elk syntax string**
  (`"[top=36.0,left=16.0,bottom=16.0,right=16.0]"`) in `src/view/constants.ts:128`, so invariant 2
  is not machine-checkable today without extracting a numeric side-padding constant.

## 8. Restore verification (run after the last sweep run)

```
$ git status --porcelain
 M .ai_out/edge-routing__06/main/TOP_LEVEL_AGENT.md      <- NOT mine; already modified by the parent agent

$ git diff --stat -- src/
(empty)

$ sed -n '71p' src/view/edgeRouting.ts
export const EDGE_ROUTING_SHAPE_BUFFER_PX = EDGE_PAIR_CURVATURE_PX / 2;

$ npm test
 Test Files  63 passed (63)
      Tests  774 passed (774)
```

No `src/` change survives. Neither buffer-invariant test at `src/view/edgeRouting.test.ts:110-118`
was loosened, skipped or deleted at any point.

## 9. `#QUESTION_FOR_HUMAN:`

1. **`#QUESTION_FOR_HUMAN:` The ticket's stated visual consequence at small buffers is measurably
   reversed** (§5.2: arrowhead overlap 4.50% → 3.24% as the buffer shrinks). Do you accept option 3
   with the two replacement invariants in §7, and should the ticket text be corrected on close the
   way item (a)'s was?
2. **`#QUESTION_FOR_HUMAN:` 11 or 5?** Your proposal was 5. On the numbers 5 is fine and slightly
   better on detour and length; my only objection is that it sits below `ARROWHEAD_HALF_WIDTH_PX = 6`.
   If you weight route straightness above that margin, take 8; if you want the shipped default to be
   provably clear of the arrowhead body with margin, take 11.
3. **`#QUESTION_FOR_HUMAN:` Slider clamp range** — min 6 / max 24 / step 1 is my suggestion. A max of
   24 lets a user re-create today's pathology. Deliberate, or clamp the max at 14?
4. **`#QUESTION_FOR_HUMAN:` Follow-up ticket?** `ELK_GROUP_PADDING` is an elk syntax *string*, so the
   buffer's real upper bound cannot be asserted in a test today. Worth extracting a numeric
   side-padding constant, or leave it as a documented comment?
5. **`#QUESTION_FOR_HUMAN:` Fan-in (§6) got no visual evidence from this sweep** — neither e2e fixture
   contains a group with several separate edges. If §7.3 matters to you, it needs its own fixture and
   its own ticket; the buffer is not the lever.

## 10. Notes and honest gaps

- The **`.out/public` real-vault screenshot smoke** (Epictetus / `clear-goals.md`, ticket line 115) was
  NOT done — `ObsidianHarness` hardcodes `.dev-vault` and cannot drive that vault, so it is a manual
  step (per `EXPLORATION_PUBLIC__e2e.md` §5). It remains outstanding for acceptance.
- **Sparse fixture numbers and screenshots are unusable for this comparison** (§2.2). I have not
  investigated the 10-vs-11 edge nondeterminism; it looks like a settle-timing race in the eval spec,
  and it is pre-existing. Candidate for its own chore ticket.
- The **medium fixture's detour is 1.000 at every value**, and the **dense fixture has no folder
  groups**, so e2e cannot see the group facing-side symptom this ticket is about. The corpus probes
  are the only source of that signal. Anyone re-running this should not expect e2e to confirm it.
- Probes are untracked in `.tmp/` and vanish on a clean clone: `probe30-buffer-sweep.mjs`,
  `probe31-inset-sensitivity.mjs`, `probe32-fanin-vs-buffer.mjs`, `probe33-arrowhead-overlap.mjs`,
  plus the driver `sweep_e2e.py`. Raw outputs `.tmp/probe3{0,1,2,3}*.out`.
