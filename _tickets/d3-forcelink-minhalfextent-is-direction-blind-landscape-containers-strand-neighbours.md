---
closed_iso: 2026-07-29T18:03:39Z
id: nid_y45ndtq65f15pnrwfvpgz5pks_e
title: 'd3 forceLink minHalfExtent() is direction-blind: landscape containers strand
  neighbours'
status: closed
deps: []
links: []
created_iso: '2026-07-28T00:44:12Z'
status_updated_iso: 2026-07-29T18:03:38Z
type: bug
priority: 2
assignee: CC_WITH-nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
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

## Resolution (2026-07-29)

Fixed by replacing d3's `forceLink` with a purpose-built `src/view/forceRectLink.ts`.

WHY a custom force: d3 resolves each link's resting distance ONCE, before the
first tick, so a box can only contribute a single direction-blind scalar — no
choice of scalar is right for both axes of a landscape box. `forceRectLink`
recomputes the resting distance every tick as the two boxes' extents PROJECTED
onto the live centre-to-centre direction plus `linkGapPx` ("the rectangles touch
with a gap", whatever the approach angle). Spring mechanics otherwise mirror d3's
forceLink (default strength `1 / min(degree)` scaled by the Link-force slider,
degree-weighted impulse bias), so the tuning sliders keep their meaning, and
coincident centres tie-break deterministically instead of jiggling randomly.

- `d3ForceRefinement.minHalfExtent()` deleted; links are resolved to bodies in
  the refinement and handed to the force already resolved.
- Landscape fixture worst boundary gap: **113px -> 73px** (budget 100).
  Portrait fixture unchanged at 61px.
- `it.fails(...)` in `src/view/d3ForceStranding.test.ts` flipped to a plain
  `it(...)`; its `boundaryGapPx()` now measures with the exported
  `rectExtentAlong()` (DRY with the force itself).
- New unit tests `src/view/forceRectLink.test.ts`.
- `npm test` (1162) and `npm run check` green.
