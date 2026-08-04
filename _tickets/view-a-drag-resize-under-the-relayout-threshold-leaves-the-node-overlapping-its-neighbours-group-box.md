---
id: nid_sj9qg27cmear9lgdlz5umwra5_e
title: "view: a drag-resize under the relayout threshold leaves the node overlapping its neighbours / group box"
status: open
deps: []
links: [nid_qjsj5mth2phdqctbm0vfx9elw_e]
created_iso: 2026-08-04T16:11:57Z
status_updated_iso: 2026-08-04T16:11:57Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [ui, sizing]
---

`decideLayout` (src/view/GraphStructureDiff.ts) relayouts only when a surviving node's rendered box grew past `SIZE_RELAYOUT_THRESHOLD` (+100%). Since drag-to-resize (ticket nid_qjsj5mth2phdqctbm0vfx9elw_e) feeds the committed `sizePx` override through `nodeDimensionsPx`, a resize BELOW that threshold — e.g. dragging a 100px node to 180px — takes the `reuse-layout` path: elk positions AND the cached folder-group box dimensions (`GraphViewController.groupDimensions`) are reused verbatim, so the grown node can visibly overlap its neighbours and spill outside its folder-group border until some unrelated structural change forces a fresh layout.

The threshold exists for PASSIVE growth (the engine re-scoring a node after a large paste), where a layout jump under the user's reading position is the bigger evil. An explicit drag-resize is the opposite case: the user asked for the new box and is looking straight at it.

Found during the adversarial review of the drag-to-resize commit (868a5b9..HEAD). NOT patched there: which way to resolve it is a product call, not a bug fix.

## Design

Options (pick one, they are mutually exclusive):
1. A committed size override always relayouts — teach the rebuild path that THIS rebuild came from a resize (a signal the generic `ViewsRefreshPort` fan-out does not carry today, so it needs a seam).
2. Compare overrides separately in `decideLayout`: any node whose `override.sizePx` CHANGED between builds forces `relayout`, while engine `sizePx` keeps the threshold. Purely local to src/view/GraphStructureDiff.ts and needs no new seam — likely the 80/20.
3. Accept the overlap and say so in README (*Node size*).

Whichever wins, `groupDimensions` must be re-derived with the positions; today both are reused together.

## Acceptance Criteria

A note dragged to ~1.5x its computed size no longer overlaps its neighbours or its folder-group border after the commit rebuild (or the accepted behaviour is documented in README).
A BDD test in src/view/GraphStructureDiff.test.ts captures the chosen rule.
`npm test`, `npm run check` and `npm run test:e2e -- nodeResize.e2e.ts` green.

