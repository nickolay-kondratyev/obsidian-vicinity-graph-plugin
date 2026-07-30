# IMPLEMENTATION REVIEW — `ELK_ROOT_SEED_NODE_SPACING_PX` measured derivation (82e554c)

## Overall: **NOT-READY** — one BLOCKING item, and it is a one-sentence fix.

The measurement work is good and the numbers are honest: I re-derived **every** figure in
the new comment from the raw TSVs and they all check out (details below). The rig is
faithful to the shipped pipeline. The problem is not the sweep — it is the *causal story*
attached to the old 113px number, which the repo's own record contradicts.

## Verified against the raw data — all ✅

Recomputed independently from `seed-sweep/results-{coarse,fine,low,high}.tsv`:

- portrait, seeds 1..9: 100.3 .. 202.9px, all over budget → comment's "100..203px" ✅
- portrait, seeds 10..18: 65.2 .. 89.1px → "65..89px" ✅
- fixture-median-normalised worst gap across 5..200: 0.773 .. 1.135 → "0.77..1.14" ✅
- 26-box vault mirror: 466.5..1031.5 within 36..44; 454.9..788.7 across 5..200 →
  "466..1032" / "455..789" ✅
- mean root fill 0.469 @200 → 0.452 @1200 ✅
- seed 20 isolated: portrait 89.1px, landscape 73.4px → "89px/73px" ✅
- zero root overlaps at every seed 1..1200 ✅

Rig sanity: overlapping seeds agree byte-for-byte across the four files (deterministic);
the metric is literally the shipped one (`rectExtentAlong`, root edges, max); and
landscape@40 = 73.4px matches the "73px here" already documented in
`src/view/d3ForceStranding.test.ts`. That last coincidence is a strong independent
cross-check that the harness reproduces the production pipeline.

`npm test` → 94 files / 1245 tests pass. `npm run check` → exit 0. No `sanity_check.sh`.

---

## 🚨 BLOCKING

### B1. The CORRECTION asserts a cause the data does not show — and the repo record says the opposite

`src/view/constants.ts`:

> "That run moved the seed and the group INTERIORS together, so it was measuring
> re-shaped containers."

The artifact that produced the 113px number says the reverse
(`.ai_out/compact-group-layout/compact-group-layout/IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md`, ~line 298):

> "lowering it blew the `d3ForceStranding.test.ts` boundary-gap budget (113.35px vs 100px).
> **Isolating it (root pinned at 40, interiors at 20) proved the regression came entirely
> from the root force seed, not the group interiors.**"

And in the same artifact (~line 167) the LANDSCAPE fixture measures **113.4px at seed 40** —
113.4 vs 113.35 is almost certainly one measurement counted twice.

The explanation that *is* verifiable from git: `forceRectLink` — commit **9454a1a**,
"direction-aware link spring … unstrands landscape containers" — landed **after** the
compact-group-layout squash (**0fb796f**) and moved that gap 113 → 73. The old number was
taken on a d3 refinement pass that no longer exists.

So the change swaps one under-supported claim for another under-supported claim, stated as
fact, in a comment whose whole purpose is "this time it is measured". Fix (keep it to what
you can prove):

> CORRECTION this comment used to carry: "taking it to 20 blew the boundary-gap budget
> (113px)". That number predates the direction-aware `forceRectLink` fix (which took the
> landscape gap 113 → 73) and was taken with the knob still feeding BOTH passes, so it does
> not describe today's pipeline. Re-measured on the current pipeline with only the seed
> swept, a seed of 20 gives 89px/73px — inside budget. The cliff is at 10, not at 20.

That keeps the correction (which is right and worth making) and drops the mechanism you
cannot back.

---

## ⚠️ IMPORTANT

### I1. "No cliff at the top either, out to 1200px" is argued only from `fill`, while the *guarded* metric blows budget up there

`results-high.tsv`, stranding-portrait: **seed 400 → 181.3px** worst gap (budget 100), seed
800 → 96.3px. It is not a cliff (600 and 1200 are fine) — it is exactly the chaos §3
describes — but the bullet mentions only fill drift, so a reader reasonably concludes high
seeds are measured-safe on the boundary-gap metric. They aren't. One clause fixes it and
actually *strengthens* the chaos argument, e.g. "…no cliff at the top out to 1200px, though
the chaos persists (portrait reads 181px at seed 400); mean root fill just drifts down …".

## 💡 Suggestions (NIT)

- **N1.** "Nine consecutive values each side" — the upper side is **eight** measured values:
  `results-low.tsv` covers 1..14, 16, 18 (15 comes from the coarse file); **17 was never
  run**. Say "nine below / eight above" or run 17.
- **N2.** "Above the cliff … Across 5..200" includes seed 5, which the previous bullet
  classes as *below* the cliff (portrait@5 = 120.9px, over budget). The aggregate band
  should read 10..200 (or note that 5 is the coarse sweep's first sample).
- **N3.** The comment never says where the sweep lives. Since `.ai_out/` is
  source-controlled here, one pointer to
  `.ai_out/root-seed-spacing/nid_zvoay26y4y9h1e2p2b1y9glfk_e_.../seed-sweep/` makes the
  derivation re-runnable from the source file. Cheap, and it is the difference between
  "measured" and "measured, and you can check me".
- **N4.** The `elkMapping.test.ts` comment tail is now one ~140-char unwrapped line;
  re-wrap to match the surrounding block.

## Things I checked and explicitly agree with

- **Leaving `d3ForceStranding.test.ts`'s 113px untouched is correct.** That 113 is the
  landscape fixture failing the *direction-blind `forceLink`* bug, fixed by
  `forceRectLink` (73px) — a different, accurate statement. Note that the two 113s are
  probably the *same run*, which is precisely why B1 matters: the old constants.ts claim
  looks like a mis-attribution of that reading, not a separate seed measurement.
- **Ticket satisfied**: the constant no longer points at
  `nid_zvoay26y4y9h1e2p2b1y9glfk_e` as an open question, and carries a derivation. Value
  unchanged; `elkMapping.test.ts` assertion unchanged; no anchor points touched.
- **No new test — right call.** The sweep is chaotic and slow and encodes no invariant;
  `d3ForceStranding.test.ts` guards the cliff at the shipped seed and `elkMapping.test.ts`
  value-locks 40. A sweep test would duplicate that knowledge and add flake surface.
- **Harness in `.ai_out/`, not `src/` — right call.** One-off measurement rig, not
  behavior. Its documented reproduction (copy to `.tmp/seed-sweep/`) is consistent with its
  `../../src/...` imports, so it really does re-run as written.
- **"Keep 40 because inside a flat band the incumbent is the cheapest correct choice"** is
  the right conclusion from this data and is well argued.

## Documentation updates needed

None beyond the comment edits above. No CLAUDE.md change warranted.

---

# Round 2 — verification of `1fc2f76`

## Overall: **READY.** All six items resolved. No new findings, no residual disagreement.

## B1 — resolved, and **the implementer's rejection of my suggested clause is correct; I was wrong**

I verified the chain myself rather than taking it on report:

| Claim | Check | Result |
|---|---|---|
| `0fb796f` is an ancestor of `9454a1a` | `git merge-base --is-ancestor` | ✅ YES |
| `9454a1a` does not touch `constants.ts` | `git show 9454a1a --stat` → ticket md, `d3ForceRefinement.ts`, `d3ForceStranding.test.ts`, `forceRectLink{,.test}.ts` | ✅ |
| seed reads 40 both sides of the fix | `9454a1a^:constants.ts` and `9454a1a:constants.ts` | ✅ both `= 40` |
| pre-fix test cited 113px under `it.fails` | `9454a1a^:d3ForceStranding.test.ts:207` — "Measured worst gap on this fixture: 113px against the 100px budget", asserted with `it.fails` | ✅ |
| the fix moved it to 73px | `9454a1a:d3ForceStranding.test.ts` — "used to FAIL (113px) … 73px here" | ✅ |

My proposed clause ("and was taken with the knob still feeding BOTH passes") **would have
been false**: at `9454a1a^` the split had already landed, so that 113px reading was taken
with the seed pinned at 40 and interiors at 20. I inferred it from the prior pass's
narrative instead of from git — exactly the failure mode I flagged. Good catch; correctly
rejected rather than accepted to please the reviewer.

The new wording — "113px was never a property of a seed of 20; it is the LANDSCAPE
fixture's reading under the direction-blind `forceLink`, taken with the seed at 40" — is
**fully backed**, every element checkable in-tree or from git history, with no asserted
mechanism beyond what those commits record.

## I1 and N1..N4 — all real

- **I1** ✅ The top-end bullet now says the chaos persists and names 181px at seed 400
  (`results-high.tsv`: 181.3). No longer readable as "high seeds are safe".
- **N1** ✅ Fixed by **measuring**, not by softening: `results-seed15-17.tsv` gives portrait
  15 = 75.5, 17 = 65.2. All nine of 10..18 are now measured (65.2..89.1), so both
  "65..89px" and "nine consecutive values each side" are literally true. Bonus: seed 15
  reproduces the coarse run to the decimal — determinism re-confirmed.
- **N2** ✅ Band restated as 10..200 / 0.77..1.13. I recomputed with fixture medians taken
  over the ≥10 subset: **0.769..1.132** — matches exactly. (Using the old all-seed medians
  it is 0.773..1.135; normalising over ≥10 is the internally consistent choice now that the
  claim is scoped to ≥10.) "455..789 across the sweep" also holds over ≥10 (454.9 @45,
  788.7 @70).
- **N3** ✅ Pointer to `.ai_out/root-seed-spacing/…/seed-sweep` added to the comment.
- **N4** ✅ Re-wrapped.

## Changed-figure honesty re-check

Only three figures changed (0.77..1.13, the 10..200 band, 181px at 400) plus the two new
measurements (15, 17). All recomputed from the TSVs above. Unchanged figures were verified
in round 1 and are untouched.

## Comment syntax and green

Read the full block: one `/** … */`, no stray `*/` — the artifact path is plain prose, no
glob. `npm test` → 94 files / 1245 tests pass. `npm run check` → exit 0. Worktree clean.

## Verdict: **READY** — ship it.
