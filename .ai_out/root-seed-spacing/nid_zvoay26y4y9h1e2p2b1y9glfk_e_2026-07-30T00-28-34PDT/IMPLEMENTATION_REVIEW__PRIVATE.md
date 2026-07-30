# PRIVATE — review memory, `ELK_ROOT_SEED_NODE_SPACING_PX` derivation (commit 82e554c)

## What I verified, and how

Re-derived every number in the new `constants.ts` comment from
`seed-sweep/results-{coarse,fine,low,high}.tsv` with a python pass (no numbers taken
on trust from the PUBLIC artifact).

| Comment claim | Data | Verdict |
|---|---|---|
| seeds 1..9 portrait over budget, 100..203px | 202.9/123.5/120.9/192.6/120.9/192.6/121.0/123.3/100.3 | ✅ exact |
| seeds 10..18 land 65..89px | 75.5/75.5/89.1/89.1/89.1/75.5(coarse)/75.5/65.2 | ✅ range exact; **17 never measured** (low file = 1..14,16,18; 15 from coarse) |
| normalised worst gap 0.77..1.14 across 5..200 | fixture-median-normalised MEAN per seed = 0.773 (100) .. 1.135 (10) | ✅ |
| 26-box vault: 466..1032 within 36..44 | 466.5 (44) .. 1031.5 (36) | ✅ |
| 26-box vault: 455..789 across 5..200 | 454.9 (45) .. 788.7 (70) | ✅ |
| fill 0.469 @200 -> 0.452 @1200 | mean fill 0.469 / 0.452 | ✅ |
| seed 20 isolated = 89px/73px | portrait 89.1, landscape 73.4 | ✅ |
| zero overlaps everywhere | overlaps column all 0 in all 4 files | ✅ |

Cross-validation of the harness itself: overlapping seeds across files are byte-identical
(deterministic), the metric is literally the shipped one (`rectExtentAlong`, root edges,
max), the fixtures mirror `d3ForceStranding`'s, and landscape@40 = 73.4 matches the
number `d3ForceStranding.test.ts` documents ("73px here"). The rig is trustworthy.

## The one real problem: the CORRECTION's causal claim

New comment: *"That run moved the seed and the group INTERIORS together, so it was
measuring re-shaped containers."*

Repo record says otherwise —
`.ai_out/compact-group-layout/compact-group-layout/IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md:298`:
> "lowering it blew the `d3ForceStranding.test.ts` boundary-gap budget (113.35px vs 100px).
> Isolating it (root pinned at 40, interiors at 20) proved the regression came **entirely
> from the root force seed**, not the group interiors."

That is the exact opposite attribution. Also in the same artifact, line 167: the LANDSCAPE
fixture measured **113.4px at seed 40** under `rectpacking` — 113.4 vs 113.35 is almost
certainly one measurement double-counted.

Timeline that actually explains the discrepancy: `forceRectLink` (commit **9454a1a**,
"direction-aware link spring … unstrands landscape containers") landed AFTER the
compact-group-layout squash (**0fb796f**) and moved the landscape gap 113 -> 73. So the
old 113px was measured on a d3 pass that no longer exists. That is verifiable from git;
the "re-shaped containers" mechanism is not, and is contradicted.

## Metric honesty gap at the top end

`results-high.tsv`, stranding-portrait: seed 400 -> **181.3px** worst gap (over the 100px
budget), seed 800 -> 96.3px. The comment's "No cliff at the top either, out to 1200px"
is argued only from mean fill and never mentions that the *guarded* metric blows budget
up there. Not a cliff (600/1200 are fine) — it is the chaos the comment already describes
— but the omission reads as "high seeds are measured-safe", which the data does not say.

## Smaller

- "Nine consecutive values each side": upper side is 8 measured values (17 missing).
- "Above the cliff … Across 5..200" includes seed 5, which the same comment classes as
  below the cliff (portrait@5 = 120.9px, over budget). Band should read 10..200.
- Comment never says where the sweep/raw data live; a source reader cannot re-run it.
- `elkMapping.test.ts` comment tail is one ~140-char unwrapped line.

## Green

`npm test` 94 files / 1245 tests pass; `npm run check` exit 0 (logs in `.tmp/rev-*.log`).
No `sanity_check.sh` in repo. Value unchanged, `elkMapping.test.ts` assertion unchanged,
ticket reference removed from the comment (ticket scope satisfied). No anchor points in
either file. Agree with "no new test" and with keeping the rig in `.ai_out/` (its
`../../src` imports resolve correctly from the documented `.tmp/seed-sweep/` copy).

Verdict: NOT-READY on the correction sentence only (one-sentence fix).

---

# Round 2 — verification of `1fc2f76`

## B1 — I was wrong on the mechanism I proposed; the implementer is right. Chain verified myself:

- `git merge-base --is-ancestor 0fb796f 9454a1a` → YES.
- `9454a1a --stat` touches: ticket md, `d3ForceRefinement.ts`, `d3ForceStranding.test.ts`,
  `forceRectLink.ts`, `forceRectLink.test.ts`. **Not `constants.ts`.**
- `git show 9454a1a^:src/view/constants.ts` and `9454a1a:` both → `= 40`.
- `9454a1a^:d3ForceStranding.test.ts:207` → "Measured worst gap on this fixture: 113px
  against the 100px budget" on the LANDSCAPE describe, asserted via `it.fails`.
- `9454a1a:d3ForceStranding.test.ts` → "used to FAIL (113px)" … "73px here".

So at the moment 113px was recorded in-tree, the split had ALREADY landed (seed 40,
interiors 20) — my proposed clause "taken with the knob still feeding BOTH passes" would
have been false. Rejection correct; my clause was inferred from the prior narrative, not
from git. New wording is anchored entirely to in-tree, git-verifiable facts. Backed. No
residual disagreement.

## Round-1 items

- **I1** — bullet now names 181px at seed 400 (data: 181.3). ✅
- **N1** — `results-seed15-17.tsv`: portrait 15 = 75.5 (identical to the coarse run →
  determinism holds), 17 = 65.2. All nine of 10..18 now measured, range 65.2..89.1, so
  "65..89px" and "nine consecutive values each side" are literally true. ✅
- **N2** — band restated as 10..200 / 0.77..1.13. Recomputed with medians over the ≥10
  subset: **0.769..1.132** — matches. (With the old all-seed medians it is 0.773..1.135;
  the ≥10 median is the internally consistent choice for a ≥10 claim.) "455..789 across
  the sweep" also holds over ≥10 (454.9 @45, 788.7 @70). ✅
- **N3** — `.ai_out/root-seed-spacing/…/seed-sweep` pointer added. ✅
- **N4** — line re-wrapped. ✅

## Syntax / green

Read the whole block comment: single `/** … */`, no stray `*/` (the artifact path is plain
prose, no glob). `npm test` 94/1245 pass, `npm run check` exit 0, worktree clean.

**READY.**
