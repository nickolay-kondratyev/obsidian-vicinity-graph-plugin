---
closed_iso: 2026-08-04T18:18:03Z
id: nid_sj9qg27cmear9lgdlz5umwra5_e
title: 'view: a drag-resize under the relayout threshold leaves the node overlapping
  its neighbours / group box'
status: closed
deps: []
links: [nid_qjsj5mth2phdqctbm0vfx9elw_e, nid_ct22qotgtw4rezbdn5m0diyb3_e]
created_iso: '2026-08-04T16:11:57Z'
status_updated_iso: 2026-08-04T18:18:03Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [ui, sizing]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
`decideLayout` (src/view/GraphStructureDiff.ts) relayouts only when a surviving node's rendered box grew past `SIZE_RELAYOUT_THRESHOLD` (+100%). Since drag-to-resize (ticket nid_qjsj5mth2phdqctbm0vfx9elw_e) feeds the committed `sizePx` override through `nodeDimensionsPx`, a resize BELOW that threshold — e.g. dragging a 100px node to 180px — takes the `reuse-layout` path: elk positions AND the cached folder-group box dimensions (`GraphViewController.groupDimensions`) are reused verbatim, so the grown node can visibly overlap its neighbours and spill outside its folder-group border until some unrelated structural change forces a fresh layout.

The threshold exists for PASSIVE growth (the engine re-scoring a node after a large paste), where a layout jump under the user's reading position is the bigger evil. An explicit drag-resize is the opposite case: the user asked for the new box and is looking straight at it.

Found during the adversarial review of the drag-to-resize commit (868a5b9..HEAD). NOT patched there: which way to resolve it is a product call, not a bug fix.

## Design

Options (pick one, they are mutually exclusive):
1. A committed size override always relayouts — teach the rebuild path that THIS rebuild came from a resize (a signal the generic `ViewsRefreshPort` fan-out does not carry today, so it needs a seam). - [HUMAN: LETS try this out this seems like a simple approach we resize, and it triggers a layout re-render making sure the rendering will look good.]

Whichever wins, `groupDimensions` must be re-derived with the positions; today both are reused together.

## DECIDE (why this is not just "pick option 2")

Relayouting on every committed resize is NOT free, and the cost lands on the same gesture: a fresh layout bumps `layoutVersion`, which is what `FitViewOnLayoutChange` fits the viewport on — so releasing the drag would re-zoom and re-pan the WHOLE graph, and elk may reorder the neighbours the user was reading. Today's behaviour instead leaves the node exactly where it was, overlapping.

So the product question is which of the two the human wants after a release:
- **(a) correct layout, moving graph** — options 1/2, plus deciding whether a resize-driven relayout should be exempt from the refit (a second, smaller decision: `fitView` is currently unconditional per new layout).
- **(b) still graph, overlapping node** — option 3, documented in README.

A middle road exists and is worth pricing: relayout, but SEED elk with the current positions (already flagged as the V2 refinement under *Layout stability* in the high-level plan), which keeps the movement local to the resized node's neighbourhood.

Reviewer's recommendation: (a) via option 2 + suppressing the refit for a resize-driven relayout — the user is looking straight at one node and a viewport jump is the most disorienting part of the change. Not implemented, because the refit exemption is a behaviour change beyond this ticket's one-line diff.

## Acceptance Criteria

A note dragged to ~1.5x its computed size no longer overlaps its neighbours or its folder-group border after the commit rebuild (or the accepted behaviour is documented in README).
A BDD test in src/view/GraphStructureDiff.test.ts captures the chosen rule.
`npm test`, `npm run check` and `npm run test:e2e -- nodeResize.e2e.ts` green.

--------------------------------------------------------------------------------
HUMAN: while the layout is not free we can KISS and only trigger the re-layout after the resize is complete. So we DO NOT trigger the re-layout while the human is dragging the resize, but once the dragging is complete THEN we trigger the re-layout.

--------------------------------------------------------------------------------

## RESOLUTION (2026-08-04) — option 1, WITHOUT a new seam

Implemented as a pure rule in `src/view/GraphStructureDiff.ts`: a new
`anySizeOverrideChanged(previous, next)` check, ahead of the growth threshold,
returns `relayout` whenever a SURVIVING node's per-node `sizePx` override was
set, cleared, or moved to another box (compared by VALUE — every rebuild
resolves a fresh object from `data.json`, so an identity check would relayout on
every unrelated rebuild).

WHY no seam was needed after all: the override is stored state, and it can only
change because the user released a drag-resize or chose "Reset size". So the
rebuild's OWN inputs already say "this came from a resize" — teaching
`ViewsRefreshPort` to carry a resize signal would have been a second, weaker
statement of the same fact. This also satisfies the HUMAN's KISS constraint by
construction: the drag lives in React Flow's local node state and only reaches
the store on RELEASE, so the rule cannot fire mid-drag.

`groupDimensions` is re-derived automatically — the `relayout` branch in
`GraphViewController.runRebuild` takes both positions and
`extractElkDimensionsById(laidOut)` from the fresh elk pass.

Side effects, both intentional:
- A CLEARED override (Reset size) now relayouts too. The computed box is usually
  SMALLER, so the growth threshold never fired and the reset used to leave a hole
  where the big box had been.
- The growth threshold is now purely about PASSIVE growth (engine re-scoring, a
  wider title), which is the only thing it was ever meant to damp.

Docs: `docs-internal/plan/high-level-plan.md` (*Layout stability*) states the new
exception; README's *Node size* section states the user-visible half.

FOLLOW-UP, filed not silently patched: the relayout bumps `layoutVersion`, so
`FitViewOnLayoutChange` refits the viewport on release — ticket
`nid_ct22qotgtw4rezbdn5m0diyb3_e` (tagged `decide`) carries that call.

Tests: 5 new BDD cases in `src/view/GraphStructureDiff.test.ts` (sub-threshold
resize, shrink, identical re-commit, gaining an override, clearing one); two
pre-existing cases were INVERTED on purpose — the sub-threshold and shrink cases
asserted the old `reuse-layout`, which is exactly the bug.
Verified: `npm test` (1570 passed), `npm run check`,
`npm run test:e2e -- nodeResize.e2e.ts` (8 passed) and
`npm run test:e2e -- vicinityGraph.e2e.ts` (25 passed).
