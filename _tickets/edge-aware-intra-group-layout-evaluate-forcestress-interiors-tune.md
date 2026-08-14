---
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
session_ids: [{"a": "claude", "type": "decision", "id": "97349e1d-ccbf-4091-97c2-891f31979512"}, {"a": "claude", "type": "execution", "id": "3b9654a5-98f2-4aad-a98e-eb088fa294a8"}]
id: nid_7abfje1vus15rx9hzmpel9jin_e
title: "Edge-aware intra-group layout: evaluate force/stress interiors + tune"
status: open
deps: [nid_as3hdgn25pbxttimy643f46v7_e, nid_9uh2twn8whoqtplbxk0ywzpx7_e]
links: []
created_iso: 2026-08-14T00:18:09Z
status_updated_iso: 2026-08-14T02:40:10Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: []
---

Follow-up from recursive-grouping plan nid_xko67wo2z4awg5gdrm1xx1chz_e (signed-off D5: owner wants a FIRST-CLASS interior layout, evaluated after recursive grouping ships visually). Depends on the per-container layout plumbing ticket AND the nested flow-rendering ticket (step 3's screenshots need nested groups rendering; "ships visually" is the signed-off gate). Requires OWNER visual sign-off at the end (decide tag).

Context (researched 2026-08-14): group interiors use elk rectpacking which IGNORES intra-group edges - a measured decision from a 120-fixture density sweep (src/view/constants.ts:157-194, elkGroupMemberOptions at 195-202) with an explicit WHY-NOT accepting routed-curve interiors. Recursion changes the inputs: more members, nested boxes, more intra-group edges. Feasibility is good: containers already carry intra-group edges in the elk input, elk SEPARATE_CHILDREN lays each level independently, refineForceRootLayout is generic - candidate = swap a container algorithm string + run per-container d3 refinement via the plumbing seam. Known costs: force interiors are less dense -> bigger boxes (src/view/groupPacking.test.ts fill-ratio guards exist for exactly this), synchronous per-container d3 time, visual re-tuning.

Approach (mirror the rectpacking decision process):
1. Extend the groupPacking fixture sweep with nested containers + intra-group edge sets.
2. Candidates: rectpacking (baseline), elk force seed + per-container d3 refinement, elk stress. Measure density, edge length/crossings, layout time.
3. Present measured results + screenshots to owner for the try-out flow; owner picks; tune the winner; update the WHY-NOT comment in constants.ts with the new decision either way.

## DECISION (2026-08-14, decision session)

**The question the `decide` tag was asking — "which interior layout ships?" — cannot be answered before the evaluation runs, and the evaluation itself needs no new decision: D5 in the closed plan ticket (`nid_xko67wo2z4awg5gdrm1xx1chz_e`) already signed it off. So: the tag comes off NOW to unblock the work, and the owner's visual sign-off is DEFERRED to the moment artifacts exist.** Concretely:

1. **Run the evaluation as written above (steps 1–2) once both deps close.** No re-litigation of scope; D5 authorized it.
2. **The working session ranks candidates against a declared envelope before involving the owner** (guidance, tunable with recorded reasoning — not hard gates):
   - **Density:** mean box area regression vs the rectpacking baseline ≤ ~15% across the fixture sweep. Force interiors are known to be less dense; some bloat is the price of edge-awareness, but recursion multiplies nested-box bloat, so past that it defeats the point of the density work already in `groupPacking.test.ts`.
   - **Edge quality:** report mean intra-group edge length and crossing count per candidate; a switch is only worth proposing if it improves these meaningfully (rough bar: ≥ 20% crossing reduction on the edge-heavy fixture shapes).
   - **Time:** the per-container d3 refinement is synchronous; total layout-time increase at the largest fixture should stay within ~50ms of baseline.
3. **Branch on the result:**
   - **If NO candidate clears the envelope:** rectpacking stays, and the working session updates the WHY-NOT comment in `src/view/constants.ts` with the new measured numbers (nested + edged fixtures) and closes this ticket. That outcome changes nothing shipped, so it does NOT need owner sign-off — the ticket text already blesses "update the WHY-NOT … either way".
   - **If a candidate clears it:** tune it, then write the measured comparison + screenshot paths (`.out/`) into THIS ticket's body and re-add `decide` + `need-human` to the tags. The owner then makes the reserved visual call (D5's "owner visual sign-off") with evidence in hand — that final pick is a taste judgment the owner explicitly kept, and it is not being decided here.

**Rejected options:**
- *Escalate to the owner now* — rejected: there are no measurements or screenshots yet (both deps are open), so the owner would be asked to pick blind, and the ticket would sit un-runnable by agents in the meantime. The tag was marking a FUTURE sign-off, not a present question.
- *Drop the owner sign-off entirely and let the working session pick by the metrics* — rejected: D5 explicitly reserves the final visual call for the owner; overriding a signed-off reservation is not this session's to make. The envelope above only filters what is worth showing, it does not substitute for the pick.
- *Pre-pick a winner (e.g. "stress") now* — rejected: the whole point of mirroring the rectpacking process is that the 120-fixture sweep, not intuition, made that call last time; nested + edged inputs are exactly the regime where intuition failed before.

## EVALUATION RESULTS (2026-08-13, execution session) — needs OWNER visual call

Steps 1–2 are done. Harness: `src/view/interiorLayoutEval.test.ts` (gated behind
`VICINITY_INTERIOR_EVAL=1`, skipped by `npm test`). Reproduce the record with:

```
VICINITY_INTERIOR_EVAL=1 npx vitest run src/view/interiorLayoutEval.test.ts
```

It writes `.out/interior-eval.md` (git-ignored). Sweep = {flat, nested} ×
member counts {4,8,12,16,20} × link shapes {none, hub, chain, dense} = 40 graphs
per candidate, each run through the real `GraphLayoutRunner` (elk + the
per-container d3 seam from the plumbing ticket).

### Aggregate (means over the 40-graph sweep)

| candidate | mean box area | vs baseline | mean fill | mean edge len (edged) | total crossings (edged) | mean time/graph | max time |
|---|---|---|---|---|---|---|---|
| rectpacking (baseline) | 475 289 | +0.0% | 0.433 | 291 | 1077 | 7.6 ms | 41 ms |
| **elk force + d3 refine** | 518 685 | **+9.1%** | 0.412 | **183** | **399** | 39 ms | 128 ms |
| elk stress | 598 494 | +25.9% | 0.466 | 131 | 48 | 43 ms | 193 ms |

### Per-shape edge quality (edged shapes, summed over counts+nesting)

| shape | candidate | mean edge len | crossings |
|---|---|---|---|
| chain | rectpacking | 289 | 300 |
| chain | force | 173 | 42 |
| chain | stress | 120 | 0 |
| dense | rectpacking | 270 | 777 |
| dense | force | 205 | 357 |
| dense | stress | 132 | 48 |
| hub | rectpacking | 316 | 0 |
| hub | force | 172 | 0 |
| hub | stress | 140 | 0 |

### Verdict against the declared envelope (DECISION §2)

- **stress — DISQUALIFIED on correctness.** On hub shapes its fill ratio exceeds
  1.0 (up to 1.096 at 20 members): members no longer fit their own bounding box,
  i.e. **stress OVERLAPS group members** (it has no node-overlap removal). It also
  busts density (+25.9% mean, +78% on the chain/20 nested case). Out.
- **force — CLEARS density and edge quality, MISSES time.**
  - Density: **+9.1%** mean box area ≤ the ~15% envelope. ✓
  - Edge quality: crossings **1077 → 399 (−63%)** overall; dense −54%, chain −86%;
    mean intra-group edge length **291 → 183 (−37%)**. Both far past the ≥20%
    crossing-reduction bar. ✓
  - Time: at the LARGEST fixture (nested, 20+20 = 40 nodes) force takes ~126 ms vs
    baseline ~9 ms — **+~116 ms**, over the "~50 ms of baseline" guideline (the d3
    interior refinement runs to convergence synchronously, per container). The
    envelope calls time "tunable with recorded reasoning, not a hard gate", and
    layout is off the render hot path (async rebuild), but this is a real cost. ✗
    on the letter of the guideline.

### Why this is escalated NOW rather than tuned-then-shown (a cost the ticket did not foresee)

The ticket assumed a clearing candidate = "swap a container algorithm string + run
the d3 seam", then screenshot + owner sign-off. The sweep surfaced a gap: the
`GraphLayoutRunner` seam refines a container's INTERIOR but **does not refit the
container's elk-computed box** afterward. The force/stress numbers above were only
obtained because the harness recomputes each box as the bounding box of the
refined children. On the real render path elk's stored container box would be
stale, so members would poke outside their group border. **Shipping force interiors
therefore needs a new box-refit step** (recompute container width/height + re-pad
after `refineForceRootLayout`, then let the parent re-place the resized box — likely
a second bottom-up pass in `GraphLayoutRunner`). That is genuine engineering, plus
edge re-routing interplay (`edgeRouting.ts` uses `GROUP_SIDE_PADDING_PX` as a
clearance ceiling), and only after it exists can real screenshots be produced.

Producing that shippable build + screenshots speculatively is exactly the work the
STOP protocol says not to sink before the owner authorizes it, because the owner may
prefer to keep rectpacking.

### DECISION NEEDED (owner)

Given force buys a large, consistent edge-readability win (−63% crossings, −37%
edge length, indistinguishable on the common hub shape) at +9% density and a
real-but-off-hot-path +~116 ms at 40 nodes, **AND** requires new interior box-refit
engineering before it can ship or be screenshotted:

- **Option A — Invest in force interiors.** Authorize the box-refit work; the
  execution agent builds it, tunes force (density/time), produces `.out/`
  screenshots on the nested+edged fixtures, and returns for your final visual pick
  (the D5-reserved call). Best edge readability; most work; some layout-time cost.
- **Option B — Keep rectpacking, close the question.** Update the WHY-NOT comment in
  `src/view/constants.ts` with these nested+edged numbers (edge-awareness was
  measured and the density/time/engineering cost was judged not worth it) and close.
  Zero shipped change; keeps the interior link-shape-independent.
- **Option C — Force WITHOUT the density envelope pressure** (e.g. only when a group
  has many intra-group edges) — a scoped middle ground; more complexity, deferrable.

**Recommendation: Option A**, but conditionally. The edge-quality win is real and is
the entire point of this line of work; +9% density is within budget and the hub
case (the commonest note-vault shape) is a wash. The two hesitations are the
box-refit engineering and the +116 ms — both surmountable and both off the render
hot path. If the owner does not want to spend the box-refit engineering now, Option B
is a clean, honest close (the numbers here become the WHY-NOT record) with no shipped
regression.

Deferred to owner because D5 explicitly reserved the final visual pick, and the
box-refit investment is a scope/taste tradeoff the ticket did not settle.

## AUTHORIZATION (2026-08-14, owner)

**Owner picked Option A**: "Yes I authorize the full design work on this to be
performed GREAT. Go forward with design work." The build phase is therefore
unblocked: box-refit engineering, force-interior tuning (density/time), honest
re-measurement through the REAL layout path, and `.out/` screenshots on the
nested+edged fixtures. `decide`/`need-human` tags come OFF for the build and
will be RE-ADDED when the screenshots exist — the final visual pick (D5) remains
the owner's and is NOT decided by the build phase.
