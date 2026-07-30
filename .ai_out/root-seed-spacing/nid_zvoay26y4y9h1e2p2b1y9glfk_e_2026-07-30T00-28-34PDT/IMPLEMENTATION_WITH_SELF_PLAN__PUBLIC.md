# PUBLIC — `ELK_ROOT_SEED_NODE_SPACING_PX` now has a measured derivation

Ticket `nid_zvoay26y4y9h1e2p2b1y9glfk_e`, remaining scope only.

## Outcome

**40 is KEPT. No behavior change — the constant's value, the `elkMapping.test.ts`
locked literal and every layout are byte-identical.** What changed is that the
number is now derived from measurement instead of inherited.

## Decision, in one line

The final root layout has exactly ONE structural requirement on the seed — be
above ~10px — and above that it is measurably flat and chaotic, so there is no
better value to move to; 40 keeps ~4x margin over the cliff.

## Measured numbers

Swept the seed in isolation (group interiors held at the shipped 20px) over 9
root-topology fixtures through the real `vicinityGraphToElk` → `GraphLayoutRunner`
pipeline (elk force seed + d3 refinement), scored on the same projected-extent
boundary-gap metric `d3ForceStranding.test.ts` uses (budget 100px).

1. **Lower cliff at 10 — real, not noise.** On the portrait stranding fixture,
   every seed in 1..9 is over budget (100..203px); every seed in 10..18 is under
   (65..89px). Nine consecutive values each side. Mechanism: a seed tighter than
   the boxes' own separation hands d3 an interleaved start it cannot untangle.
   The landscape fixture is flat at 73.4px across the same range.
2. **Flat above the cliff.** Across 5..200 (40x), the fixture-median-normalised
   worst gap only wobbles 0.77..1.14 with no trend; total stranded edges 43..55,
   no trend.
3. **Chaotic, not tunable.** A ±4px nudge (36..44) moves the metric as much as or
   more than the whole 5..200 range: on the 26-box vault mirror, 466..1032px
   within 36..44 against 455..789px across 5..200.
4. **No upper cliff** out to 1200px; mean root fill just drifts 0.469 → 0.452,
   so going higher buys nothing.
5. Zero root-box overlaps at every seed tested (1..1200) — the rect collide always
   resolves them.

Raw data: `seed-sweep/results-{coarse,fine,low,high}.tsv` in this folder.
Harness + reproduction commands: `seed-sweep/seed.sweep.ts` (+ `vitest.config.ts`),
and the "Harness" section of the PRIVATE file. Deliberately NOT added under `src/`:
it is a one-off measurement rig, not a behavior test.

## Correction to a previously documented number — please note

The old comment asserted "taking it down to 20 blew the boundary-gap budget —
113px against 100px". That measurement moved the seed **and** the group interiors
together, so it was measuring re-shaped containers, not the seed. Isolated, a seed
of 20 measures **89.1px (portrait) / 73.4px (landscape) — inside budget**. The real
cliff is at 10. The doc comment now states this explicitly rather than quietly
dropping the old claim. (`d3ForceStranding.test.ts` also mentions 113px, for a
different and accurate reason — direction-blind `forceLink`; that one is untouched.)

## Files touched

- `src/view/constants.ts` — `ELK_ROOT_SEED_NODE_SPACING_PX` doc comment: the
  "WHY IT IS PINNED" and "40 is inherited, not derived / tracked in <ticket>"
  paragraphs are replaced by the measured derivation above plus the correction.
  The ticket is no longer referenced as an open question. Value unchanged.
- `src/view/elkMapping.test.ts` — the value-lock comment no longer says "40 is the
  value the root pass has always seen"; it now says 40 sits ~4x above the measured
  cliff in an insensitive band, and points at the sweep. Assertion unchanged.

Nothing else in `src/` changed.

## Tests

- `npm test` → **94 files / 1245 tests passed**.
- `npm run check` → **exit 0**.
- `npm run test:e2e` deliberately not run (real-Obsidian release gate, out of scope).

No test was added. The derivation is already captured by behavior tests —
`d3ForceStranding.test.ts` guards the cliff at the shipped seed and
`elkMapping.test.ts` value-locks 40 — so a sweep test would duplicate that
knowledge (DRY) and cost seconds per run. This matches the file's own precedent:
`GROUP_PACKING_ASPECT_RATIO = 0.75` carries its measured curve in the comment.

## Suggested follow-up tickets (NOT filed, NOT fixed — out of scope)

1. **The boundary-gap metric is not meaningful on high-degree stars.** A hub can
   only be adjacent to ~6 boxes, so `ungrouped-star-30` reports 22-24 "stranded"
   edges at every seed — geometry, not layout quality. If root-layout quality is
   ever tuned again, the metric needs a degree-aware variant; today it is only
   trustworthy as a *regression* signal on the two fixed stranding fixtures.
2. **The d3 refinement is chaotically sensitive to its input arrangement** (§3
   above). That is fine for a seed nobody tunes, but it means any future root-pass
   tuning cannot be validated on a handful of fixtures — it would need a
   distribution over many, with medians rather than single readings.

## Left open

Ticket not closed, nothing committed, no change-log entry — per instructions, the
orchestrator owns those.
