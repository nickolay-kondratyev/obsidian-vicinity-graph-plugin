# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE memory (compact-group-layout)

Status: DONE. `npm test` 1148/1148 green, `npm run check` clean. Committed.

## Plan I executed

1. Verify empirically which rectpacking option ids elkjs 0.12.0 honors (scratch scripts, `.tmp/rectpack-spike*.mjs`).
2. Failing test first: `src/view/groupPacking.test.ts` (real elkjs, no d3).
3. Swap `elkGroupMemberOptions()` in `src/view/constants.ts` to rectpacking; delete now-dead `ELK_DIRECTION`.
4. Fix every doc/comment/test that named `layered` for group interiors.
5. Full suite + check; commit.

## elkjs 0.12.0 option findings (empirical, not from docs)

Bundle grep `elk\.rectpacking\.[a-zA-Z.]*` gives the real id set:
`currentPosition`, `desiredPosition`, `inNewRow`, `orderBySize`, `packing.compaction.iterations`,
`packing.compaction.rowHeightReevaluation`, `packing.strategy`, `trybox`,
`whiteSpaceElimination.strategy`, `widthApproximation.{lastPlaceShift,optimizationGoal,strategy,targetWidth}`.

Verified behaviours:
- `elk.aspectRatio` IS honored under rectpacking (soft goal of the width-approximation step only; compaction afterwards overshoots, so realized w/h drifts).
  Gotcha that cost me a spike: elk's DEFAULT aspectRatio for rectpacking is **1.3**, so `ar=1.3` looks like "no effect".
- `elk.spacing.nodeNode` IS honored under rectpacking.
- `elk.padding` (our `ELK_GROUP_PADDING`) IS honored — verified members respect top=36/side=16 and stay inside the container.
- rectpacking does NOT resize our fixed-size leaves (`whiteSpaceElimination` left node w/h untouched in every run).
- A container carrying intra-group `edges` under rectpacking does not throw; the edges are simply ignored for placement.
- `elk.rectpacking.orderBySize=true` is a real, deterministic area win (mean rel area 1.025 -> 0.966 at ar 1.0).
- `widthApproximation.optimizationGoal=AREA_DRIVEN` — REJECTED. Tiny area gain, but mean |log(w/h)| explodes 0.19 -> 1.42 (long strips). Same for `GREEDY` width approximation.
- `packing.compaction.rowHeightReevaluation` — no reliable gain, sometimes worse.

## The CLARIFICATION premise was factually wrong (important)

CLARIFICATION D1/rejected-alternatives says layered's pathological case is "members with no
intra-group links all collapse into ONE layer, producing a single very wide strip".
**Not true in elkjs 0.12.0**: `elk.separateConnectedComponents` defaults to true, so unconnected
members become separate components and ELK's own component packer arranges them in a grid-ish
block. Measured n=12 unconnected: layered box 763x640, ratio 1.19 — no strip.

The genuine pathological case is a **hub/star**: every member links one hub member => one layer =>
one very wide row. n=12 star: 2520x378. n=20 star: 4388x458. That is the extremely common
note-vault shape, so the decision still stands — the stated reason just needed correcting.
Consequence: the test the task asked for ("N members with NO intra-group edges is not a single
row") does NOT fail on baseline. I kept it as a lock and added the hub-linked variant as the
actually-failing test.

## Measured results (120 fixtures: 2-20 members x {none, sparse, chain, star} link shapes)

Relative box area vs `layered` baseline (lower = tighter), final options (ar 0.75 + orderBySize):

| link shape | rel area |
|---|---|
| none | ~1.11 (WORSE) |
| sparse | ~0.90 |
| chain | ~1.18 (WORSE) |
| star/hub | ~0.67 |
| mean | **0.94** |

Mean |log(w/h)|: 0.72 (layered) -> 0.26. That shape win is the big one; the mean area win is only ~6%.
Filed follow-up ticket `nid_zvoay26y4y9h1e2p2b1y9glfk_e` for the none/chain regressions + the
deferred second spacing knob.

Single-fixture headline (13-member hub group, the new test's fixture):
box 1734x488 (area 846k, interior fill 0.218) -> 702x523 (area 367k, fill 0.515).

## Dead end / the one real surprise: d3ForceStranding regression

With `elk.aspectRatio = 1.0` (my first pick, reasoned from "square minimizes minHalfExtent damage")
`src/view/d3ForceStranding.test.ts` FAILED: worst boundary gap 204px vs the 100px budget.

Debugged by dumping per-edge geometry (temporary `src/view/zzDebugStrand.test.ts`, since deleted;
note vitest swallows console.log here — I had to `throw new Error(lines.join("\n"))` to see output):
the stranded edge was `main.md -> folder-group:p/ep`, NOT the enchiridion leaf the test's JSDoc
talks about. The `p/ep` group has 2 equal 160px members, so it is inevitably 2:1 — `layered` made it
PORTRAIT (192x392), rectpacking at ar>=1.0 made it LANDSCAPE (392x212). d3's link resting distance
uses `minHalfExtent` (the smaller half-extent), so a landscape box's own width pushes a linked
neighbour well past that distance; a portrait box does not, because the crowd occupies the
horizontal directions.

Swept ar in {0.6,0.7,0.8,0.9,1.0,1.3} against the layout test files: **everything <= 0.9 passes,
1.0 and 1.3 fail**. I did NOT weaken the stranding assertion. Picked 0.75 (3:4 portrait):
near-best mean area (0.940) AND near-best squareness (0.261) in the portrait band, and it matches
the tall narrow pane the graph usually renders in. 0.6 has slightly better area but drifts back
toward strips (0.411).

Honest caveat recorded in the PUBLIC file: the portrait direction was DISCOVERED by the stranding
test, then justified — not the other way round.

## Files touched

- `src/view/constants.ts` — deleted `ELK_DIRECTION` (only user was the group options; grep-verified no other reference anywhere incl. e2e/docs); added private `GROUP_PACKING_ASPECT_RATIO = 0.75`; rewrote `elkGroupMemberOptions()` + its JSDoc; fixed the stale "laid out internally" phrase in `elkForceRootOptions`' JSDoc.
- `src/view/groupPacking.test.ts` — NEW, 5 tests.
- `src/view/elkMapping.test.ts` — the `elk.algorithm` assertion now expects `rectpacking` (implementation-detail assertion, unavoidable); renamed the intra-group-edge test away from "member layout hint" (rectpacking ignores those edges — the old name became a lie) and explained WHY the edges still sit on the container (elk JSON contract).
- `src/view/elkMapping.ts` — module JSDoc no longer says "layered".
- `docs-internal/architecture-map.md` — layout stack bullet updated.
- `_tickets/…-revisit-chainedge-free-packing.md` — NEW follow-up.

## Things I deliberately did NOT do

- Did not touch `GROUP_SIDE_PADDING_PX`, node sizing, root force/d3 params, or edge routing.
- Did not add a settings knob (D3 holds).
- Did not stop emitting intra-group edges to elk even though rectpacking ignores them: elk's JSON
  contract still wants them on the common ancestor, `elkMapping`'s projection logic depends on the
  split, and removing them is a separate refactor with no user-visible benefit.
- Did not implement research-doc C3/C4.

## Reproducing the metrics

Scratch harnesses are under `.tmp/` (git-ignored, may be gone): `rectpack-spike4.mjs` /
`rectpack-spike7.mjs` sweep aspect ratios over the 120-fixture grid; `rectpack-spike6.mjs` sweeps
the rectpacking sub-options; `measure.mjs` prints the single-fixture before/after headline.

---

# ITERATION 1 (review response) — findings

## Re-measured the trade-off on ONE fixture, both algorithms (13 members, heterogeneous)

Probe: temporary `src/view/zzProbe.test.ts` (deleted), constants swapped back to
`layered`/DOWN via a python patch of `elkGroupMemberOptions` (backup at `.tmp/constants.bak`).

| link shape | layered box / fill | rectpacking box / fill | rel area |
|---|---|---|---|
| hub    | 1734x488 / 0.218 | 702x523 / 0.515 | 0.43 |
| none   |  602x483 / 0.660 | 702x523 / 0.515 | 1.26 (WORSE) |
| chain  | 368x1534 / 0.336 | 702x523 / 0.515 | 0.65 (BETTER here) |

Note chain came out BETTER on my fixture but WORSE (1.12-1.16) on the reviewer's — the difference is
member width homogeneity: with uniform narrow members `layered`'s column is tight; with wide
heterogeneous members the column width is set by the widest member and wastes a lot. Both are true;
neither report is wrong. Reported both honestly.

Verdict on the headline question: **the trade stands**. Reason is not the mean area (~6%), it is that
rectpacking makes the box INDEPENDENT of link shape, so no shape can degenerate it. That is now a
test, not a claim.

## Landscape stranding — measured, and it is PRE-EXISTING

New fixture (two 250x40 members => container 282x152, ratio 1.86), full `GraphLayoutRunner` pipeline:

| group interior | worst boundary gap | budget |
|---|---|---|
| layered (baseline) | **130.3 px** | 100 |
| rectpacking @0.75  | **113.4 px** | 100 |

So the reviewer's suspicion is confirmed AND the change improves it. Not fixable inside CLARIFICATION
D4 (root d3 pass is out of scope, and `minHalfExtent` is load-bearing for `D3ForceLayout.test.ts`
guarantees). Pinned with `it.fails` + fixture-guard test + ticket `nid_y45ndtq65f15pnrwfvpgz5pks_e`.

`it.fails` chosen over a characterization assertion on the current 113px value: the assertion inside
stays the REAL budget assertion, and when the bug is fixed vitest says "expected test to fail", which
forces someone to flip it to `it`. The paired plain `it` on the container aspect ratio stops
`it.fails` from passing for an unrelated reason (fixture typo).

## Fixture change called out

`strandedHubGraph` gained a `GroupMemberShape` parameter (sizePx + title). The default
`SQUARE_GROUP_MEMBERS` sets both members' title to `"note"` where they previously took makeNode's
path-derived `"hub"`/`"sib"`. Geometry is byte-identical (width = max(160, labelWidth) = 160 either
way) — verified: the portrait tests still pass with the same numbers. Titles are geometry-only in
this fixture.

## Rejected

- Reverting the trailing-period edit on `_tickets/nodes-in-groups-...md`: already committed in
  4cd7366; reverting is more churn than the noise.
- Dropping the determinism test in `groupPacking.test.ts` (reviewer nitpick, "fine either way"):
  zero-cost, guards this specific box.
- Raising the fill floor to near the measured 0.515: brittle across elkjs versions for no new
  protection — the edge-independence test is what actually locks behaviour now.

---

# ITERATION 2 (human rejected the visual result) — findings

Status: DONE. `npm test` 1151 passed + 1 expected fail, `npm run check` clean.

## Reproducing the screenshot (do this first if you pick this up again)

Zoom factor of `HUMAN_FEEDBACK_screenshot.png` is fixed by the image node: "Clear Goals"
is square in the image (268x276) and `nodeDimensionsPx` makes width = max(sizePx, label) — the
engine max height is 160, 276/160 = **1.72**. Every other member divides out from that. Cross-checked
against "Make the Right Thing Automatic" (30 chars -> 30*7+20 = 230 label px, 389/230 = 1.69) and
"Asymmetric Risk Reward Situations" (33 chars -> capped at 250, 424/250 = 1.70). NOTE: the thumbnail
FLOOR (`THUMBNAIL_VISIBLE_MIN_NODE_PX` = 104+18 = 122) is NOT what set that node's height — 160 (the
sizing max) did. The fixture now lives in `groupPacking.test.ts` as `SCREENSHOT_MEMBERS`.

Standalone harness reproduced it exactly: 433x459, fill 0.505 (test through the real pipeline: 0.509).
Screenshot box measured off the PNG: 455x448 / ~0.49. Reproduction confirmed BEFORE changing anything.

## The rectpacking sweep answered the question and the answer was "no"

23 option combinations x 5 fixtures at spacing 40, repeated at spacing 20 (`.tmp/sweep.mjs`,
`.tmp/sweep20.mjs`). NOTHING beat the current option set on the screenshot fixture except
`trybox` / `widthApproximation.optimizationGoal=AREA_DRIVEN`, and both win only by collapsing the
group into a single-column strip (screenshot 297x613; hetero13 drops to 0.436 / 472x1177). Strips are
exactly what iteration 1 exists to prevent. `packing.compaction.iterations` and
`rowHeightReevaluation` are no-ops or worse; `whiteSpaceElimination.strategy=TO_ASPECT_RATIO` is much
worse everywhere; `expandNodes` / `contentAlignment` / `lastPlaceShift` are inert on fixed-size leaves.
`widthApproximation.strategy=TARGET_WIDTH` THROWS without `targetWidth` set.

## Custom skyline packer: BUILT, MEASURED, REJECTED

`.tmp/skyline.mjs` — skyline bottom-left, tallest-first, full width sweep from max(w) to sum(w),
picking min area. Best achievable at spacing 40 on the screenshot fixture: **0.573** (and only as a
2.6:1 strip); at a sane aspect ratio, 0.537 vs elk's 0.505. On hetero13 it was WORSE than elk (0.533
vs 0.542); on uniform8 and wide5 identical. So elk rectpacking is already within ~5% of a hand-rolled
optimum. ~100 lines of new pure code for <5% — rejected on Pareto, and reported as such.

## What actually costs the space (the measurement that decided everything)

Sum of member areas 86,514 px². Sum of the SAME rects expanded by the 40px gap: 149,514 px². So the
absolute fill ceiling at spacing 40 is 0.58 — the human's layout was already at 0.51 of a possible
0.58. **The gap, not the placement, was the empty space.** At spacing 20 the ceiling rises to 0.75.

## The trap: the knob feeds BOTH elk passes

Lowering `elkNodeSpacingPx` 40 -> 20 broke `d3ForceStranding.test.ts` (worst boundary gap 113.35 vs
the 100px budget). Isolated it by hardcoding the ROOT options' spacing back to 40 while leaving the
group interiors at 20 — all stranding tests green. So the regression came 100% from the root force
SEED, not from the group interiors. Hence `ELK_ROOT_SEED_NODE_SPACING_PX` in `constants.ts`:
`elkForceRootOptions()` no longer takes the knob. Container shape was NOT the cause — the 2x160px
fixture stays portrait 192x392 at every spacing from 10 to 40 (checked).

## Before -> after, measured through the real pipeline (probe test, since deleted)

| fixture | @40 (rejected) | @20 (shipped) |
|---|---|---|
| screenshot (5 members) | 433x459 / 0.509 | 413x419 / **0.591** |
| hetero13 hub-linked | 702x523 / 0.515 | 602x483 / **0.660** |
| hetero13 chain | 702x523 / 0.515 | 602x483 / **0.660** |
| hetero13 edge-free | 702x523 / 0.515 | 602x483 / **0.660** |

Bonus, verified with `.tmp/layered.mjs`: `layered`'s edge-free box is 602x483 / 0.660 at BOTH
spacings — rectpacking@20 now MATCHES it to the pixel. The accepted edge-free regression from
iteration 1 is gone at the shipped spacing.

## Files touched

- `src/engine/SettingsSpec.ts` — `elkNodeSpacingPx` default 40 -> 20 + rewritten doc.
- `src/engine/types.ts` — knob doc no longer claims it feeds the root seed.
- `src/view/constants.ts` — new private `ELK_ROOT_SEED_NODE_SPACING_PX`; `elkForceRootOptions()` lost
  its parameter; `elkGroupMemberOptions` JSDoc numbers refreshed + sweep/skyline findings recorded.
- `src/view/elkMapping.ts` — root options call + comment.
- `src/view/forceLayoutFieldMeta.ts` — user-facing description dropped "(also spaces the initial
  layout pass)", which had become false.
- `src/view/testFixtures/graphFixtures.ts` — fixture spacing 40 -> 20 (mirrors the shipped default).
- `src/view/groupPacking.test.ts` — `SCREENSHOT_MEMBERS` fixture + fill test; floor 0.4 -> 0.55; the
  layered-vs-rectpacking table now has both spacings.
- `src/view/elkMapping.test.ts` — the root-spacing-threading test now asserts the knob does NOT reach
  the root (behaviour change, documented in the test's JSDoc, not deleted).
- `src/engine/forceLayoutSettings.test.ts`, `src/engine/SettingsSpec.test.ts` — shipped-baseline mirrors.
- `_tickets/group-interiors-split-intra-group-vs-root-spacing-knob-…md` — UPDATE section.

## Rejected in iteration 2

- Spacing 15 (fill 0.610): below the group's own 16px side padding, i.e. members closer to each other
  than to the wall. 20 is the first slider-grid value at/above the gutter.
- Making the intra-group gap a FRACTION of the knob: the knob is labelled "Group member spacing" in
  px; scaling it makes the number in the UI a lie. Splitting the ROOT off instead keeps it honest.
- `trybox` / `AREA_DRIVEN`: strips (see sweep).
- Touching `GROUP_SIDE_PADDING_PX`, `GROUP_TOP_PADDING_PX`, node sizing, edge routing, root d3.

## Known trade-off NOT fixed

At a 20px member gap the edge router's default 11px clearance cannot fit BETWEEN two members
(11+11 = 22 > 20), so intra-group edges detour around the member cluster instead of threading it.
No test regressed; noted because it is a real consequence and a future ticket could measure it.

---

# ITERATION 3 (review response — tightening pass) — findings

Status: DONE. `npm test` 1153 passed + 1 expected fail, `npm run check` clean. No behaviour changed.

## The blocking hole, and how I proved the new lock is real

Reviewer was right: `elkMapping.test.ts`'s knob-independence test compares two COMPUTED
values, so it survives the option disappearing. Added a separate literal lock,
`toBe("40")`, deliberately NOT `String(ELK_ROOT_SEED_NODE_SPACING_PX)` — importing the
constant would make the lock move with the thing it pins.

Two mutants run against `src/view/elkMapping.test.ts` (`.tmp/lock-mutant-*.log`,
`constants.ts` restored from `.tmp/constants.bak` after each):

| mutant | new lock | pre-existing comparison test |
|---|---|---|
| `ELK_ROOT_SEED_NODE_SPACING_PX = 40 -> 20` | FAILS | passes (blind to value) |
| delete `"elk.spacing.nodeNode"` from `elkForceRootOptions()` | FAILS | passes VACUOUSLY (undefined === undefined) |

So the reviewer's vacuous-pass scenario is not hypothetical — it was reproduced, and the
new test is the only thing that catches either mutant.

## Fixture-mirror lock

`graphFixtures.elkNodeSpacingPx: 20` still hand-mirrors the shipped default (kept literal
for consistency with the other 12 hand-written defaults in `makeViewSettings`), but the
mirror is now asserted in `groupPacking.test.ts` against
`EngineDefaults.forceLayoutSettings()`. The overstated floor JSDoc was corrected to say
what the floor can and cannot see.

## Deliberately NOT done

- `fillRatio` denominator left alone: correcting it to the real member band moves every
  floor by ~0.03 and buys nothing (it errs conservative). Documented instead.
- change_log: TOP_LEVEL_AGENT owns it (explicit instruction).
- Ticket `nid_uzwco7e4y2bw5vzfk5vhs814a_e` reopening: bookkeeping owned upstream; flagged
  in PUBLIC rather than touched.
- The non-default-knob-user trade-off: behaviour untouched by instruction; the JSDoc now
  states it in full so the human can judge it.
