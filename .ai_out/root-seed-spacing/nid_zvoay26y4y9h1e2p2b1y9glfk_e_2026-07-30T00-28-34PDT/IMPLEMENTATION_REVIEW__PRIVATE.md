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
