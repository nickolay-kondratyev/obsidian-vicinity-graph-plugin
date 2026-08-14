---
id: nid_7abfje1vus15rx9hzmpel9jin_e
title: "Edge-aware intra-group layout: evaluate force/stress interiors + tune"
status: open
deps: [nid_as3hdgn25pbxttimy643f46v7_e, nid_9uh2twn8whoqtplbxk0ywzpx7_e]
links: []
created_iso: 2026-08-14T00:18:09Z
status_updated_iso: 2026-08-14T00:18:09Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: [decide]
---

Follow-up from recursive-grouping plan nid_xko67wo2z4awg5gdrm1xx1chz_e (signed-off D5: owner wants a FIRST-CLASS interior layout, evaluated after recursive grouping ships visually). Depends on the per-container layout plumbing ticket AND the nested flow-rendering ticket (step 3's screenshots need nested groups rendering; "ships visually" is the signed-off gate). Requires OWNER visual sign-off at the end (decide tag).

Context (researched 2026-08-14): group interiors use elk rectpacking which IGNORES intra-group edges - a measured decision from a 120-fixture density sweep (src/view/constants.ts:157-194, elkGroupMemberOptions at 195-202) with an explicit WHY-NOT accepting routed-curve interiors. Recursion changes the inputs: more members, nested boxes, more intra-group edges. Feasibility is good: containers already carry intra-group edges in the elk input, elk SEPARATE_CHILDREN lays each level independently, refineForceRootLayout is generic - candidate = swap a container algorithm string + run per-container d3 refinement via the plumbing seam. Known costs: force interiors are less dense -> bigger boxes (src/view/groupPacking.test.ts fill-ratio guards exist for exactly this), synchronous per-container d3 time, visual re-tuning.

Approach (mirror the rectpacking decision process):
1. Extend the groupPacking fixture sweep with nested containers + intra-group edge sets.
2. Candidates: rectpacking (baseline), elk force seed + per-container d3 refinement, elk stress. Measure density, edge length/crossings, layout time.
3. Present measured results + screenshots to owner for the try-out flow; owner picks; tune the winner; update the WHY-NOT comment in constants.ts with the new decision either way.

