---
id: nid_y45ndtq65f15pnrwfvpgz5pks_e
title: "d3 forceLink minHalfExtent() is direction-blind: landscape containers strand neighbours"
status: open
deps: []
links: []
created_iso: 2026-07-28T00:44:12Z
status_updated_iso: 2026-07-28T00:44:12Z
type: bug
priority: 2
assignee: CC_WITH-nickolaykondratyev
---

Found while reviewing the compact-group-layout change (branch compact-group-layout).

`src/view/d3ForceRefinement.ts` computes each forceLink resting distance from `minHalfExtent(body)` = `Math.min(halfWidth, halfHeight)`, regardless of the edge direction. For a LANDSCAPE box the resting distance is therefore set by its (small) half-HEIGHT while a horizontally-linked neighbour must still clear its (large) half-width — so the neighbour ends up stranded along the box long axis.

Measured on the landscape fixture now in `src/view/d3ForceStranding.test.ts` (two 250x40 group members, folder group ~282x152): worst boundary gap 113px against the ticket-03 budget `D3_FORCE_MAX_BOUNDARY_GAP_PX = 100`.

PRE-EXISTING, not caused by the rectpacking switch: the same fixture measures 130px with the old elk `layered` group interiors, i.e. rectpacking already improves it. The portrait fixture measures 61px and is fine.

The landscape case is currently pinned with `it.fails(...)` in `src/view/d3ForceStranding.test.ts` ("WHEN the folder-group container is LANDSCAPE ..."). When this bug is fixed that test will report "expected test to fail" — flip it to a plain `it(...)` as part of the fix.

Likely fix: make the resting distance direction-aware (project the box half-extent onto the link direction, like `boundaryGapPx()` in that test already does) instead of using the smaller half-extent. Any change here must keep `src/view/D3ForceLayout.test.ts` (overlap-freedom, containment, determinism) green.

## Acceptance Criteria

- Landscape-container boundary gap <= D3_FORCE_MAX_BOUNDARY_GAP_PX with a plain `it(...)`.
- Portrait stranding test and all D3ForceLayout guarantees still green.

