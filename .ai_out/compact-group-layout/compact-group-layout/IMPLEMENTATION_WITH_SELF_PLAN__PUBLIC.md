# IMPLEMENTATION — compact group layout (for review)

Ticket: `_tickets/nodes-in-groups-folder-to-be-tighther-together.md` (nid_uzwco7e4y2bw5vzfk5vhs814a_e)
Status: **DONE** — `npm test` 1148/1148 pass (84 files), `npm run check` clean.

## What changed

Folder-group INTERIORS are now packed with elk `rectpacking` instead of `layered`.
Scope is exactly the group interior (CLARIFICATION D4): no change to the root force/d3 pass,
group padding, node sizing, edge routing, or settings.

`src/view/constants.ts` — `elkGroupMemberOptions()`:

```
before: elk.algorithm=layered, elk.direction=DOWN, elk.spacing.nodeNode=<knob>
after:  elk.algorithm=rectpacking, elk.aspectRatio=0.75,
        elk.rectpacking.orderBySize=true, elk.spacing.nodeNode=<knob>
```

`ELK_DIRECTION` is **deleted** — grep-verified the group options were its only consumer
(no compat shim left behind). `GROUP_SIDE_PADDING_PX` untouched. No new setting (D3 holds).

## Files touched

| File | Change |
|---|---|
| `src/view/constants.ts` | rectpacking options + new private `GROUP_PACKING_ASPECT_RATIO`; `ELK_DIRECTION` deleted; JSDoc rewritten (the old one explained the layered choice and would otherwise be a lie) |
| `src/view/groupPacking.test.ts` | **NEW** — 5 BDD tests, real elkjs, packing density + shape |
| `src/view/elkMapping.test.ts` | `elk.algorithm` assertion `layered` -> `rectpacking`; one test renamed (see "existing tests changed") |
| `src/view/elkMapping.ts` | module JSDoc no longer claims "layered" |
| `docs-internal/architecture-map.md` | layout-stack bullet updated |
| `_tickets/group-interiors-split-intra-group-vs-root-spacing-knob-...md` | **NEW** follow-up |

## Measured density, before -> after

Headline (13-member hub-linked group — the new test's fixture):

| | box | area | interior fill |
|---|---|---|---|
| before (`layered`) | 1734x488 | 846k px² | 0.218 |
| after (`rectpacking`) | 702x523 | 367k px² | **0.515** |

**57% less box area, 2.4x the interior fill.**

Broad sweep — 120 fixtures (member counts 2-20 x four intra-group link shapes, heterogeneous
member rectangles), relative box area vs the `layered` baseline (lower = tighter):

| intra-group links | rel. area | note |
|---|---|---|
| hub/star | **0.67** | the big win; commonest note-vault shape |
| sparse | 0.90 | |
| none | 1.11 | **slightly WORSE** |
| chain | 1.18 | **slightly WORSE** |
| **mean** | **0.94** | |

Mean box irregularity `|log(w/h)|`: **0.72 -> 0.26** — extreme strips (worst observed under
`layered`: 4388x458) are gone. Honestly: the *shape* win is much bigger than the *area* win,
and two link shapes regress ~10-18%. Follow-up ticket filed
(`nid_zvoay26y4y9h1e2p2b1y9glfk_e`) covering those regressions and the deferred second
spacing knob.

## Decisions, with WHY

**Aspect ratio = 0.75 (3:4 portrait), not square or landscape.**
This is the one place I deviated from the obvious reading of the approved plan, and it was
forced by evidence, so please read it:

- My first pick was `1.0` (square), reasoned from `d3ForceRefinement.minHalfExtent()`.
  It **broke `src/view/d3ForceStranding.test.ts`** (worst boundary gap 204px vs the 100px
  ticket-03 budget).
- Root cause (debugged, not guessed): the `p/ep` fixture group has two equal 160px members, so
  its box is inevitably 2:1. `layered` made it PORTRAIT (192x392); rectpacking at ratio >= 1.0
  makes it LANDSCAPE (392x212). d3's link resting distance uses the box's *smaller* half-extent,
  so a landscape box's own width pushes its linked neighbour past that distance — the stranded
  edge was `main.md -> folder-group:p/ep`, not the leaf named in that test's JSDoc.
- Swept ratios {0.6, 0.7, 0.8, 0.9, 1.0, 1.3} against the layout tests: everything <= 0.9 passes,
  1.0 and 1.3 fail. 0.75 sits at the flat part of both curves (near-best area 0.940 AND
  near-best squareness 0.261) and matches the tall narrow pane the graph usually renders in.
- I did **not** relax the stranding assertion.

**`elk.rectpacking.orderBySize=true`** (beyond the approved option list): deterministic, and
measurably tightens packing (mean rel area 1.025 -> 0.966). Side effect worth knowing: members are
placed largest-first rather than in path order. Since rectpacking ignores intra-group edges
anyway, member order inside a box was already not meaningful.

**Rejected after measuring**: `widthApproximation.optimizationGoal=AREA_DRIVEN` (tiny area gain,
mean `|log(w/h)|` explodes 0.19 -> 1.42 — long strips), `GREEDY` width approximation,
`packing.compaction.rowHeightReevaluation`.

## Correction to CLARIFICATION (please note)

CLARIFICATION states layered's pathological case is "members with **no** intra-group links all
collapse into ONE layer, producing a single very wide strip". **That is not true in elkjs 0.12.0**:
`elk.separateConnectedComponents` defaults to true, so unconnected members become separate
components and ELK's own component packer already grids them (n=12 unconnected: 763x640, ratio 1.19).

The real pathological case is a **hub/star**: every member links one hub member => one layer =>
one very wide row (n=12: 2520x378; n=20: 4388x458). That is the common note-vault shape, so the
approved decision stands — only its stated reason needed correcting.

Consequence for the requested test: "N members with NO intra-group edges is not a single row"
**passes on the unmodified baseline**, so it could not be the failing-first test. I kept it as a
regression lock and added the hub-linked variant, which DID fail on baseline:

```
× ... THEN the group is not laid out as a single row   expected 1734 to be less than 1422
× ... THEN the interior is densely filled              expected 0.218 to be greater than 0.4
```

## Tests

New `src/view/groupPacking.test.ts` (real elkjs, no d3, BDD, one behavior per test):

1. hub-linked group is not a single row — box width < members laid end to end
2. hub-linked group interior fill > 0.4
3. edge-free group is not a single row (lock)
4. edge-free group interior fill > 0.4 (lock)
5. determinism of the group box

Metrics are relative to the members' OWN geometry (end-to-end width; member area / interior area),
never elk's exact pixel output, so an elk version bump cannot make them brittle.

### Existing tests changed (called out explicitly)

- `src/view/elkMapping.test.ts`: `"elk.algorithm": "layered"` -> `"rectpacking"`. Unavoidable —
  it asserts the exact option we changed. No assertion was weakened.
- Same file: `"WHEN mapping THEN intra-group edges still live on their container (member layout
  hint)"` -> `"… still live on their container"`, with a comment that elk's JSON contract (not a
  layout hint) is the reason. The assertion is byte-identical; only the now-false parenthetical
  went. Intra-group edges are still emitted onto their container.
- No other test was touched. `ElkLayout.test.ts`, `D3ForceLayout.test.ts`, `edgeRouting.test.ts`,
  `d3ForceStranding.test.ts` all pass unmodified.

## Verification

```
npm test    -> Test Files 84 passed (84) | Tests 1148 passed (1148)
npm run check -> exit 0 (tsc src + e2e)
```

Not run: `npm run test:e2e` (real-Obsidian release gate). Visual confirmation in the dev vault is
worth doing before release, since this changes what every folder group looks like.

## No open questions

No `#QUESTION_FOR_HUMAN` blockers. The two items a human may want to weigh in on are captured in
the follow-up ticket rather than blocking this change: (a) the ~10-18% area regression on
edge-free and chain-linked groups, (b) whether intra-group spacing deserves its own knob.

---

# Iteration 1 — response to IMPLEMENTATION_REVIEW__PUBLIC.md

`npm test` -> 84 files, **1150 passed + 1 expected-fail** (the pinned landscape bug, below).
`npm run check` -> exit 0. No source behaviour changed in this iteration — the code change is
JSDoc; everything else is tests + one new ticket.

## Should-fix #1 — no test guards the stranding budget for a LANDSCAPE container — **ACCEPTED**

Added to `src/view/d3ForceStranding.test.ts` a second fixture whose folder group is forced landscape
(two members, `sizePx` 40 + a title long enough to hit the 250px label cap => container 282x152,
ratio 1.86). Measured through the real `GraphLayoutRunner`:

| group interior | worst boundary gap | budget |
|---|---|---|
| `layered` (pre-change baseline) | **130.3 px** | 100 |
| `rectpacking` @0.75 (now) | **113.4 px** | 100 |

**The reviewer was right, and the honest finding is that the landscape case is broken — but it was
broken BEFORE this change, and this change improves it (130 -> 113).** Root cause is exactly where
the reviewer pointed: `d3ForceRefinement.minHalfExtent()` feeds every forceLink resting distance the
smaller half-extent regardless of edge direction. Fixing it is a root-d3 change, which CLARIFICATION
D4 puts out of scope and which would re-open the `D3ForceLayout.test.ts` guarantees.

So it is pinned, not hidden: **`it.fails(...)`** carrying the REAL budget assertion (no weakened
threshold, no skip). When the bug is fixed vitest reports "expected test to fail", forcing whoever
fixes it to flip it to a plain `it`. A paired plain `it` asserts the container really is landscape,
so `it.fails` cannot pass for an unrelated reason. New ticket:
**`nid_y45ndtq65f15pnrwfvpgz5pks_e`** — "d3 forceLink minHalfExtent() is direction-blind".

Fixture change called out: `strandedHubGraph` now takes a `GroupMemberShape`; the default sets both
group members' title to `"note"` instead of the path-derived `"hub"`/`"sib"`. Geometry is identical
(width = max(160, labelWidth) = 160 either way) and the two original assertions pass unchanged.

## Should-fix #2 — JSDoc leads with the best case — **ACCEPTED**

`elkGroupMemberOptions`'s JSDoc no longer says only "57% less area". It now states, in the same
paragraph: hub/star 45-55% less area; edge-free and chain ~10-25% LARGER; mean area only ~6% better;
the durable win is shape regularity (|log(w/h)| 0.72 -> 0.26), with the ticket reference.

## Should-fix #3 — the edge-free tests do not lock what they claim — **ACCEPTED (reframed, not retitled)**

Two changes to `src/view/groupPacking.test.ts`:

1. The file JSDoc now carries the measured layered-vs-rectpacking table (below) and states plainly
   that the edge-free case got LOOSER, that this is an accepted trade, and that **no floor test can
   catch it** — a floor cannot see that the old value was higher. The floor's job is stopping further
   decay, nothing more.
2. New test that captures what the change actually buys, and fails hard on the baseline:
   **"WHEN the same members carry hub, chain or no intra-group links THEN the group box is
   identical"**. rectpacking ignores intra-group edges, so no link shape can degenerate the box —
   with the flip side stated in the same JSDoc: the edge-free case no longer gets its own
   better-than-average packing either.

I did **not** raise the fill floor to near the measured 0.515 (the reviewer's alternative): it would
be brittle across elkjs versions and would add no protection the edge-independence test does not
already give.

## Final honest density numbers (13-member fixture, re-measured this iteration, both algorithms)

| intra-group links | `layered` box / fill | `rectpacking` box / fill | rel. area |
|---|---|---|---|
| hub-linked | 1734x488 / 0.218 | 702x523 / 0.515 | **0.43** |
| none | 602x483 / 0.660 | 702x523 / 0.515 | **1.26 (worse)** |
| chain | 368x1534 / 0.336 | 702x523 / 0.515 | 0.65 |

On the reviewer's fixture chain regressed (1.12-1.16); on this one it improves. The difference is
member-width homogeneity: `layered`'s chain column is only tight when members are uniformly narrow;
with wide heterogeneous members the column takes the widest member's width and wastes the rest. Both
measurements are correct — the honest statement is **chain is a wash, edge-free is a real regression,
hub is a large win**.

## Nitpicks

- `box!` non-null assertions -> `requireGroupBox()` helper. **ACCEPTED** (matches strict-TS style).
- Drop the determinism test as a duplicate of `ElkLayout.test.ts`. **REJECTED** — zero cost, and it
  guards this specific box; the reviewer marked it take-or-leave.
- Revert the trailing-period diff noise in `_tickets/nodes-in-groups-...md`. **REJECTED** — it is
  already committed in `4cd7366`; reverting is more churn than the noise it removes.
- Close the originating ticket / write the change_log: left to TOP_LEVEL_AGENT.
- `npm run test:e2e` + dev-vault visual pass: still not run, still recommended before release.

## Open questions

No new `#QUESTION_FOR_HUMAN` from this iteration. The reviewer's two stand, and my measurements
sharpen the second one:

1. `_tickets/` vs `docs-internal/tickets/` — which is authoritative? (`CLAUDE.md` says the latter,
   the `ticket` CLI and every existing ticket use the former.)
2. Do you accept edge-free folder groups becoming ~26% larger (fill 0.66 -> 0.515) in exchange for
   the hub win and the elimination of extreme strips? **My recommendation: yes, ship it** — the
   defensible property is that the box is now independent of link shape, so no folder can degenerate
   into a 1734x488 strip. If you disagree, the lever is option 2 of
   `nid_zvoay26y4y9h1e2p2b1y9glfk_e` (keep `layered` for groups with no intra-group edges), which
   costs a branch in `elkMapping` and re-introduces shape-dependent boxes.

---

# Iteration 2 — the human rejected the visual result

The screenshot (`HUMAN_FEEDBACK_screenshot.png`) was reproduced as a test fixture BEFORE anything
changed: 5 members whose px sizes divide out of the image's zoom factor (fixed by the 160px image
node). Real pipeline, real elkjs: **433x459, interior fill 0.509** — the complaint, reproduced.

## The headline: it was never the packing algorithm

Sum of the five members' areas is 86,514 px². The same rectangles each expanded by the 40px member
gap come to 149,514 px². **At a 40px gap, no packer on earth can exceed fill 0.58** — and elk was
already delivering 0.51. The empty space the human saw was the GAP, not the placement.

Two independent measurements confirm it:

1. **Full rectpacking sub-option sweep** (23 combinations x 5 fixtures, at spacing 40 AND 20).
   Nothing beat the current option set except by degenerating groups into single-column strips.

   | option | screenshot fill @40 | verdict |
   |---|---|---|
   | current (`ar 0.75` + `orderBySize`) | 0.505 | baseline |
   | `orderBySize=false` | 0.491 | worse |
   | `aspectRatio` 0.6 / 0.9 / 1.0 | 0.505 | inert on this fixture |
   | `packing.compaction.iterations` 5 / 20 | 0.505 | inert (and worse on a 2-member group) |
   | `packing.compaction.rowHeightReevaluation` | 0.505 | inert / worse on hetero13 |
   | `packing.strategy` SIMPLE / NONE | 0.505 / 0.371 | inert / much worse |
   | `widthApproximation.strategy=GREEDY` | 0.505 | inert |
   | `widthApproximation.strategy=TARGET_WIDTH` | THROWS | needs `targetWidth`; not usable |
   | `widthApproximation.optimizationGoal=AREA_DRIVEN` | 0.507 | **strip** (346x575; hetero13 373x1206) |
   | `trybox=true` | 0.562 | **strip** (297x613; hetero13 collapses to 0.436) |
   | `whiteSpaceElimination.strategy=TO_ASPECT_RATIO` | 0.389 | much worse everywhere |
   | `expandNodes`, `contentAlignment`, `lastPlaceShift=false` | 0.505 | inert on fixed-size leaves |

2. **A custom skyline packer was actually written and measured** (not guessed): bottom-left skyline,
   tallest-first, exhaustive width sweep. At spacing 40 its ceiling on the screenshot fixture is 0.573
   (as a 2.6:1 strip); at a sane aspect ratio 0.537 vs elk's 0.505 — and it is WORSE than elk on the
   13-member fixture (0.533 vs 0.542), identical on the uniform and wide fixtures. **elk rectpacking is
   already within ~5% of a hand-rolled optimum.** ~100 lines of new pure code for under 5%: rejected.

## What shipped

The member gap came down: **`elkNodeSpacingPx` default 40 -> 20**. The value is derived, not tuned to
a fixture — 20 is the first value on the slider's 5px grid at or above the group's own 16px side
padding — i.e. the SMALLEST grid value that still keeps folder-mates from crowding tighter than the
group's wall inset, so the interior rhythm stays uniform (20 vs 16 is a 4px difference; at 40 the
member-to-member gap was 2.5x the wall inset, which is exactly why the interior read as scattered).
Going BELOW the gutter (15 -> fill 0.610) would put members closer to each other than to the wall,
and was rejected for that reason.

That forced one structural change. The knob fed BOTH elk passes, and lowering it blew the
`d3ForceStranding.test.ts` boundary-gap budget (113.35px vs 100px). Isolating it (root pinned at 40,
interiors at 20) proved the regression came **entirely from the root force seed**, not the group
interiors. So the two spacings were split IN CODE — no new setting: the root seed now uses an internal
`ELK_ROOT_SEED_NODE_SPACING_PX = 40` (frozen at the old shared value so the root pass stays
byte-identical, CLARIFICATION D4), and the knob means exactly what its label says.

## Before -> after, every fixture, honest

| fixture | before (40px gap) | after (20px gap) | box area |
|---|---|---|---|
| **screenshot (the complaint)** | 433x459 / **0.509** | 413x419 / **0.591** | -13% |
| hetero13, hub-linked | 702x523 / 0.515 | 602x483 / **0.660** | -21% |
| hetero13, chain | 702x523 / 0.515 | 602x483 / **0.660** | -21% |
| hetero13, edge-free | 702x523 / 0.515 | 602x483 / **0.660** | -21% |

No fixture regressed. Bonus: `layered`'s edge-free box on that fixture is 602x483 / 0.660 at both
spacings — **rectpacking@20 now matches it to the pixel**, so the edge-free regression iteration 1
accepted as a trade is gone at the shipped spacing, while the box stays independent of link shape.

## Tests

- NEW `groupPacking.test.ts`: the screenshot fixture with a fill floor of **0.54** — fails at the
  rejected 0.509, passes at 0.591, ~7% headroom each side. This is the regression lock on the actual
  complaint.
- Existing heterogeneous-group fill floor RAISED 0.4 -> 0.55 (measured 0.660): 0.4 no longer caught
  anything, since the rejected layout's 0.515 cleared it.
- `elkMapping.test.ts`: the test that captured "the knob reaches the root spacing" now captures the
  opposite, with the reason in its JSDoc. Behaviour change, not a weakened assertion — nothing was
  deleted or skipped.
- `npm test`: 84 files, 1151 passed + 1 expected fail (the pre-existing landscape-stranding `it.fails`).
  `npm run check`: clean.

## Human decisions (SETTLED)

1. **The "Group member spacing" slider no longer affects the root layout pass.** Before, it also seeded
   the top-level arrangement; now it only sets the gap inside folder groups (which is what its label
   and description always claimed). **DECIDED: keep it — the slider is intra-group only**, and the
   slider is not renamed. A user with a saved non-default value keeps it inside groups but not in the
   root seed; accepted. Recorded in `ELK_ROOT_SEED_NODE_SPACING_PX`'s JSDoc.
2. **Your saved settings still say 40.** The default changed, but an existing `data.json` keeps the old
   value, so the improvement only appears after **Restore defaults** (or dragging the slider to 20).
   **DECIDED: no migration** — pre-release, single user. Recorded in `SettingsSpec.ts`.
3. **If 0.591 still reads as airy**, the only remaining lever is a gap below the group's 16px side
   padding (15px -> 0.610, 10px -> ~0.65). That is a taste call, not an engineering one: the packing
   itself is within 5% of optimal and the theoretical ceiling at a 20px gap is ~0.63. Say the word and
   it is a one-constant change.

---

# Iteration 3 — response to IMPLEMENTATION_REVIEW (NEEDS_ITERATION)

> **RETEST PRECONDITION — read before judging this branch in your vault.**
> Your `data.json` almost certainly still stores `elkNodeSpacingPx: 40`, because the
> settings tab persists the whole view slice whenever anything in it is touched, and the
> new default only applies when the key is ABSENT. **Hit "Restore force layout defaults"
> (or drag "Group member spacing" to 20) BEFORE looking at the graph** — otherwise you
> will see the exact layout you already rejected and nothing will appear to have changed.

Tightening pass only. **No production behaviour changed in this iteration** — the diff is
one new test, one new test assertion, and documentation corrections.

## BLOCKING — ACCEPTED and fixed

**1. Nothing pinned the root seed spacing.** Correct, and worse than stated: the
knob-independence test compares two computed values, so deleting the option entirely made
it pass with `undefined === undefined`.

Added `src/view/elkMapping.test.ts`:
`"WHEN mapping THEN the root seed asks elk for 40px between root-level boxes"` asserting
the LITERAL `"40"`. I did **not** take the reviewer's suggested
`String(ELK_ROOT_SEED_NODE_SPACING_PX)` form: importing the constant makes the lock move
with the code it is supposed to pin. The JSDoc says so explicitly.

**Proof the lock bites** (both mutants run, both reverted; the pre-existing test survives
both, which is the hole):

| mutation | new lock | old comparison test |
|---|---|---|
| constant `40 -> 20` | **FAILS** | passes |
| `elk.spacing.nodeNode` deleted from `elkForceRootOptions()` | **FAILS** | passes vacuously |

The knob-independence test was kept, not replaced.

## SHOULD-FIX

| # | item | disposition |
|---|---|---|
| 2 | change_log entry is false / missing | **DEFERRED — not mine.** TOP_LEVEL_AGENT owns the change log and was instructed to correct it. I wrote no change_log entry. |
| 3 | fixture hand-mirrors the default; floor JSDoc overstates | **ACCEPTED.** Added a mirror assertion in `groupPacking.test.ts` against `EngineDefaults.forceLayoutSettings()`, and corrected the floor JSDoc to state what it can and cannot see. Kept the fixture value literal (the other 12 fields in `makeViewSettings` are literals too — deriving one field would be the inconsistent choice). |
| 4 | retest precondition must lead the hand-off | **ACCEPTED** — it now leads this section. |
| 5a | `ELK_ROOT_SEED_NODE_SPACING_PX` JSDoc self-contradicts | **ACCEPTED.** Rewritten as one coherent WHY: what it is, why the seed still matters despite being refined away, why it is pinned at 40, what breaks if it moves (the 113px/100px stranding budget — re-run that suite), why it is not the user knob, and the trade-off for users with a saved non-default value. |
| 5b | ticket lists `elkNodeSpacingPx 40` as a ship-time default | **ACCEPTED** — corrected in `_tickets/decide-pre-release-force-layout-tuning-….md`. |

## Suggestions

- `fillRatio` denominator: **documented, not changed.** Correcting it to the real member
  band moves every floor by ~0.03 for zero added protection, and the error runs
  conservative (it under-reports density, so the floors are stricter than they read). The
  JSDoc no longer calls it "the padded-in interior" and states the bias.
- Stranding JSDoc's "113px against 100px": that number was measured with the seed at 40,
  which is what still ships, so it is not stale for the seed. Left alone.
- Ticket `nid_uzwco7e4y2bw5vzfk5vhs814a_e` closed-while-acceptance-open: **flagged, not
  touched** — closure is upstream bookkeeping. Recommend reopening until the retest lands.

## Tests

`npm test` -> exit 0, **1153 passed + 1 expected fail** (the iteration-1 `it.fails`
landscape-stranding pin, untouched and still failing honestly). `npm run check` -> exit 0.
Net +2 tests, nothing weakened, skipped, deleted or realigned.

## Human decisions (SETTLED)

Item 1 from iteration 2 (the "Group member spacing" slider no longer feeds the root layout
seed) was **decided by the human: keep it — the slider is intra-group only**, slider not
renamed. I did NOT change that behaviour: the knob's label always said "group member", and
the seed is refined away by d3. A user with a saved non-default value loses that value's
reach into the root seed silently; that trade-off is written into the constant's JSDoc so it
is visible at the code, not only in this document.
