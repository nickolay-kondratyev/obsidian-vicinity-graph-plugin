---
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
session_ids: [{"a": "claude", "type": "decision", "id": "97349e1d-ccbf-4091-97c2-891f31979512"}]
id: nid_7abfje1vus15rx9hzmpel9jin_e
title: "Edge-aware intra-group layout: evaluate force/stress interiors + tune"
status: in_progress
deps: [nid_as3hdgn25pbxttimy643f46v7_e, nid_9uh2twn8whoqtplbxk0ywzpx7_e]
links: []
created_iso: 2026-08-14T00:18:09Z
status_updated_iso: 2026-08-14T02:32:13Z
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

