---
closed_iso: 2026-08-06T16:04:04Z
id: nid_cd9x8a7ltnht3vvxh13qcvlzr_e
title: Add redraw button
status: closed
deps: []
links: []
created_iso: '2026-08-05T18:48:25Z'
status_updated_iso: 2026-08-06T16:04:04Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-3
---
Right now we dont always trigger redraw as we change the nodes and it would be nice to have ability to manually trigger a redraw. I am thinking the place to add this is in navigation controls at the bottom left (in line with +/-). This redraw should have an icon that aligns with redraw/relayout function and be visually in line with other elements in the graph navigation.

## Resolution (done)

A **Redraw** control now sits in the bottom-left React Flow `<Controls>` cluster,
in line with the zoom/fit buttons.

**Why it was needed.** A rebuild whose structure is unchanged takes the
`reuse-layout` path in `src/view/GraphStructureDiff.ts` — it keeps the on-screen
positions and group boxes, refreshing node data only. That deliberately leaves
some layouts stale (most visibly a folder-group box left oversized after a
shrink, per `src/view/layoutFit.ts`). There was no user affordance to force a
fresh elk pass.

**What changed:**
- `src/view/GraphViewController.ts`: new public `redraw()` that runs the rebuild
  pipeline with a new `forceRelayout` flag (threaded `runRebuild` →
  `attemptBuildAndPublish` → `buildAndPublish`). When set, `buildAndPublish`
  bypasses `decideLayout` and forces the `"relayout"` decision, so elk always
  re-runs and `layoutVersion` bumps (the view refits). No-op when no MAIN is set.
  New `RebuildOptions` interface documents the flag.
- `src/view/VicinityGraphFlow.tsx`: a `<ControlButton>` child of `<Controls>`
  (`aria-label`/`title` "Redraw graph") calling `controller.redraw()`, plus a
  `RedrawIcon` — an inline lucide `refresh-cw` outline glyph, matching how React
  Flow renders its own zoom/fit glyphs (inline SVG). Being a native
  `.react-flow__controls-button`, it inherits the themed chrome already asserted
  by the controls-chrome e2e test.
- `src/view/graph-view.css`: a `.vicinity-graph-redraw-icon` rule re-asserting
  `fill: none; stroke: currentColor` over the library's
  `.react-flow__controls-button svg { fill: currentColor }` (whose filled-glyph
  assumption would otherwise flood this stroke icon solid).

**Tests:**
- `src/view/GraphViewController.test.ts` — redraw re-runs elk on an unchanged
  graph (diff bypassed), bumps `layoutVersion`, and is a no-op with no MAIN.
- `e2e/vicinityGraph.e2e.ts` — the redraw button renders in the controls cluster
  and, when pressed, keeps the graph whole (forced relayout republishes the same
  vicinity).

All gates green: `npm run check`, `npm test` (1656 passing), and
`npm run test:e2e -- vicinityGraph.e2e.ts` (27 passing).
