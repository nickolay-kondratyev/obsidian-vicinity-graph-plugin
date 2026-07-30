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
2. **Flat above the cliff.** Across 10..200 (20x), the fixture-median-normalised
   worst gap only wobbles 0.77..1.13 with no trend; total stranded edges 43..55,
   no trend. (Band computed over seeds ≥ 10 only — seed 5 is below the cliff.)
3. **Chaotic, not tunable.** A ±4px nudge (36..44) moves the metric as much as or
   more than the whole range: on the 26-box vault mirror, 466..1032px within
   36..44 against 455..789px across the sweep.
4. **No upper cliff** out to 1200px — but **no safety up there either**: the chaos
   persists (portrait reads 181px at seed 400, over the 100px budget; 96px at 800).
   Mean root fill just drifts 0.469 → 0.452, so going higher buys nothing.
5. Zero root-box overlaps at every seed tested (1..1200) — the rect collide always
   resolves them.

Raw data: `seed-sweep/results-{coarse,fine,low,high,seed15-17}.tsv` in this folder.
Harness + reproduction commands: `seed-sweep/seed.sweep.ts` (+ `vitest.config.ts`),
and the "Harness" section of the PRIVATE file. Deliberately NOT added under `src/`:
it is a one-off measurement rig, not a behavior test.

## Correction to a previously documented number — please note

The old comment asserted "taking it down to 20 blew the boundary-gap budget —
113px against 100px". **113px was never a property of a seed of 20.** Verified
against git:

- `9454a1a` ("direction-aware link spring (`forceRectLink`)") records the landscape
  fixture at **113px → 73px**, and **does not touch `constants.ts`** — the seed
  constant reads 40 both at `9454a1a^` and at `9454a1a`.
- `0fb796f` (the compact-group-layout squash that produced the 113 number) is an
  ancestor of `9454a1a`.
- At `9454a1a^`, `d3ForceStranding.test.ts` carried the landscape budget assertion
  as `it.fails(...)` with the comment "113px against the 100px budget".

So 113px is the landscape fixture's reading under the old direction-blind
`forceLink` spring, taken **with the seed at 40**. Re-measured on today's pipeline
with only the seed swept, a seed of 20 gives **89.1px / 73.4px — inside budget**.
The real cliff is at 10. The comment states this rather than quietly dropping the
old claim. (`d3ForceStranding.test.ts`'s own mention of 113px is accurate — it is
about the `forceLink` bug — and is untouched.)

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

- `npm test` → **94 files / 1245 tests passed** (re-run after review round 1).
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

## Review round 1 — per-item disposition

| Item | Disposition | Note |
|---|---|---|
| **B1** (blocking): correction's causal claim unsupported | **ACCEPTED**, reworded — but *not* with the reviewer's wording | I verified the git timeline myself (see the Correction section). I **rejected** the reviewer's suggested clause *"and was taken with the knob still feeding BOTH passes"*: at `9454a1a^` the split had **already** landed (seed pinned 40, interiors 20), so that clause is wrong for the reading actually preserved in the test file — adopting it would swap one unbacked mechanism for another, which is exactly what B1 objects to. The comment now states only what git proves. |
| **I1**: high-end bullet argued from `fill` alone | **ACCEPTED** | Bullet now names the 181px reading at seed 400 and says there is no safety up there, only no cliff. |
| **N1**: "nine each side" was nine below / eight above | **ACCEPTED** — fixed by *measuring*, not by softening | Ran the missing seed 17 (65.2px) plus 15 as a determinism cross-check (75.5px, reproduces the coarse file byte-for-byte). 10..18 is now fully sampled, all 65.2..89.1, so "nine each side" is exact. |
| **N2**: flat band included below-cliff seed 5 | **ACCEPTED** | Recomputed over seeds ≥ 10: 0.769..1.132. The 26-box 455..789 figure is unchanged (seed 5 reads 538.1, interior to it). |
| **N3**: no pointer to the sweep data | **ACCEPTED** | Comment points at `.ai_out/root-seed-spacing/` → the artifact's `seed-sweep` folder. |
| **N4**: 135-char line in `elkMapping.test.ts` | **ACCEPTED** | Re-wrapped to the block's ~80 cols. |

Not revisited (reviewer explicitly agreed): `d3ForceStranding.test.ts`'s 113px left
untouched, no new test, harness in `.ai_out/`, keep 40.

**Self-inflicted breakage, caught and fixed before exit:** the first N3 edit wrote the
artifact path as a glob, and the `*/` **closed the block comment** — `npm test` went to
11 failed files, `npm run check` to `TS1005`. Path re-spelled without a glob; both green
again. Recorded because it is an easy trap for the next editor of this comment.

## Left open

Ticket not closed, nothing committed, no change-log entry — per instructions, the
orchestrator owns those.
