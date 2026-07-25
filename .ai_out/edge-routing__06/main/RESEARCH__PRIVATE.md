# RESEARCH__PRIVATE — edge-routing__06 step 3 (the `shapeBufferDistance` sweep)

Memory for a clone of the RESEARCH role. Deliverable is `SWEEP__PUBLIC.md`; this file is the
"how I got there / what bit me" record. Nothing here was left in `src/`.

## 0. State I started from and ended at

- Branch `main`, tree clean at `9f92e77` (item (a) `setExclusive(false)` already shipped).
- Ended: `git status --porcelain` shows ONLY ` M .ai_out/edge-routing__06/main/TOP_LEVEL_AGENT.md`
  (**not mine** — it was already modified by the parent agent while I worked; I never touched it).
  `git diff --stat -- src/` is EMPTY. `src/view/edgeRouting.ts:71` is back to
  `export const EDGE_ROUTING_SHAPE_BUFFER_PX = EDGE_PAIR_CURVATURE_PX / 2;`.
- `npm test` → `Test Files 63 passed (63) / Tests 774 passed (774)` (`.tmp/final-npm-test.log`).

## 1. The override mechanism, and the ONE gotcha in it

There is no env var and no build-time define — `EXPLORATION_PUBLIC__e2e.md` §6 is correct. Edit
`src/view/edgeRouting.ts:71`, then `npm run test:e2e -- edgeRoutingEval.e2e.ts` rebuilds and
re-copies into `.dev-vault` on its own.

**Gotcha:** do NOT replace the line with a bare literal (`= 5;`). That orphans the
`EDGE_PAIR_CURVATURE_PX` import at `:1`. `tsconfig.json` has no `noUnusedLocals` so it happens to
compile today, but it is fragile. I wrote the swept value as an offset off the shipped expression,
which keeps the import live and makes each sweep step self-documenting in the log:

```
export const EDGE_ROUTING_SHAPE_BUFFER_PX = EDGE_PAIR_CURVATURE_PX / 2 - 12;   // = 5
```

Driver: **`.tmp/sweep_e2e.py`** (`python3 .tmp/sweep_e2e.py 14 11 8 5 16`). It edits line 71, runs
the spec `RUNS_PER_VALUE = 2` times, copies `.out/edge-routing-force-<fixture>.png` aside to
`.out/sweep-buffer<VV>-<fixture>.png`, and **restores line 71 in a `finally:`** so an abort cannot
leave the tree dirty. Driver log `.tmp/sweep-driver.log`; per-run logs
`.tmp/sweep-e2e-b{05,08,11,14,16,17}-run{1,2}.log`.

`npm test` DOES go red mid-sweep on `src/view/edgeRouting.test.ts:110-118` — expected, documented,
and I never ran it while a value was applied, so I have no red log to show. Not a problem: the two
assertions are pure constant checks, their behaviour under a swept value is not in doubt.

## 2. Node probes (the only source of the non-facing metric)

All in `.tmp/`, untracked, self-contained (no repo imports), run from repo root as `node .tmp/X.mjs`.
Each mirrors the SHIPPED pin registration: one shared class, `setExclusive(false)` on group AND note
pins, `segmentPenalty 50`, `crossingPenalty 0` — only `shapeBufferDistance` varies.

| Probe | What it answers | Raw output |
|---|---|---|
| `probe30-buffer-sweep.mjs` | non-facing / centre-attach / route length / ms per buffer, both corpora. Derived from `probe11-reviewer.mjs`; same generator, same seed 12345, 400 scenes | `.tmp/probe30.out` (5/8/11/14/17), `.tmp/probe30-with16.out` (+16) |
| `probe31-inset-sensitivity.mjs` | is the 14→17 cliff mechanism or corpus artifact? Sweeps buffer 5..20 at member insets 10/16/24 | `.tmp/probe31.out` |
| `probe32-fanin-vs-buffer.mjs` | does a smaller buffer help the item-(a) fan-in (§7.3 of the review)? Deterministic N-leaves-down-one-side scene | `.tmp/probe32.out` |
| `probe33-arrowhead-overlap.mjs` | does a smaller buffer actually make arrowheads overlap neighbouring boxes? | `.tmp/probe33.out` |

**Validation that the harness is faithful:** `probe30` at buffer 17 reproduces STEP1's shipped
numbers EXACTLY — non-facing 22 (low) / 40 (realistic), `totalLen` 190773 / 399052. If a future
clone changes the probe and those two numbers move, the probe is wrong, not the finding.

`probe33` replicates the shipped arrow placement deliberately and I checked it against source:
`edgeGeometry.ts routedGeometryFor()` passes `targetSegment.length` (**the LAST SEGMENT**, not the
whole edge) as `edgeLength`, so `inset = min(48, max(14, lastSeg*0.12))` is almost always exactly 14.
Triangle from `VicinityEdge.tsx:22-23`: 11px long, 6px half-width, tip at the anchor.
Stated approximation: `clipRouteToEndpointRects` is not replicated — pins sit ON the border with
`insideOffset 0`, so the clip is a no-op for the terminal point.

## 3. Environment notes

- e2e is fully headless here. One run of `edgeRoutingEval.e2e.ts` = **4 passed, ~19.8s**, plus ~40s
  of `setup:dev-vault` build in front. 11 runs cost ~12 minutes wall clock. No flakes, rc=0 every run.
- Obsidian binary was already cached at `.tmp/obsidian/obsidian-1.12.7/` — no download delay.
- `convert` (ImageMagick) is available; **PIL is NOT** (`ModuleNotFoundError: No module named 'PIL'`).
  I used `convert ... -crop WxH+X+Y +repage -filter point -resize 500%` to zoom the dense screenshot.
- Bash calls print ~20 lines of shell-profile preamble before real output — budget for it, always
  redirect to `.tmp/` and grep.

## 4. Timing variance actually observed (say this, don't hand-wave it)

Each e2e run renders dense TWICE (the `force/dense` test and the `PERF BUDGET` test), so **2 runs
per value = 4 dense samples per value**. Every number in the public table comes from 4 samples.

- Dense `routingMs` across ALL 24 samples: **132.3 … 147.4 ms**. Per-value spread (e.g. 132.3-145.8
  at buffer 14) is as large as the spread BETWEEN values. There is **no buffer trend in routing ms** —
  do not let anyone read one into it.
- Dense `layoutMs` across all samples: **1348.8 … 1492.5 ms**. Layout does not depend on the buffer
  at all; this is pure noise and it is the denominator of the PERF BUDGET gate.
- Detour ratios are **perfectly deterministic** per buffer on dense and medium — all 4 samples per
  value agree to 3 decimals. That is why the detour column is trustworthy where the ms column is not.

**Sparse-fixture confound (important, cost me a wrong conclusion):** `edges=` on the sparse line
flips between 10 and 11 run-to-run, and buffer 14 produced BOTH (run1=10, run2=11). So it is
fixture/timing nondeterminism, not a buffer effect. Consequence: the sparse `maxDetourRatio`
(1.000 vs 1.001/1.007/1.013) and the **sparse screenshots** are NOT comparable across values.
Medium and dense are deterministic; use those.

## 5. Findings a clone should not have to re-derive

1. **The cliff is the group's own member squares.** `ELK_GROUP_PADDING = "[top=36.0,left=16.0,
   bottom=16.0,right=16.0]"` (`src/view/constants.ts:128`). Member notes are separate obstacles
   (`extractEdgeRoutingInput` emits them), so libavoid inflates them too. Once `buffer > side
   padding`, a member's clearance pokes OUTSIDE the group border and seals the group's own boundary
   pins from the outside. `probe31` confirms the cliff MOVES with the inset (flat then jump at
   inset+1 for inset 16; rises from 11 for inset 10; absent up to 20 for inset 24).
2. **The ticket's arrowhead premise is measurably backwards.** `probe33`: arrowhead-over-another-box
   3.24% at buffer 5 → 4.50% at 17, monotone, consistent across all three box kinds. The head sits
   14-25px OUTSIDE the target along the approach; larger buffers give more oblique wrapped approaches
   whose last leg crosses other boxes.
3. **The shipped invariant compares different axes.** `buffer` is a PERPENDICULAR clearance;
   `EDGE_ARROWHEAD_INSET_MIN_PX` is a LONGITUDINAL offset back from the terminal. The constant that
   actually protects the arrowhead body is `ARROWHEAD_HALF_WIDTH_PX = 6` (`VicinityEdge.tsx:23`).
4. **Buffer does not touch the fan-in.** `probe32`: 3 distinct terminals at EVERY buffer (3 = the pin
   count per side; it is an architectural floor). At N=16 buffer 5 is marginally worse (10 stacked on
   one point vs 8).
5. **The e2e fixtures barely exercise the group pathology.** Medium detour is 1.000 at every buffer
   (all routes straight); dense has NO folder groups at all. The only e2e-visible group effect is the
   grp-b→grp-c attachment flip in the medium screenshot. The corpus probes are the real evidence.

## 6. What I did NOT do

No implementation, no settings, no `src/` change surviving, no ticket edit, no commit. `.out/` is
gitignored (`.gitignore:15`) and nothing was source-controlled.
