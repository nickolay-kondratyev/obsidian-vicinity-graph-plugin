---
id: nid_ct22qotgtw4rezbdn5m0diyb3_e
title: "view: releasing a drag-resize refits the viewport (relayout bumps layoutVersion)"
status: open
deps: []
links: [nid_sj9qg27cmear9lgdlz5umwra5_e]
created_iso: 2026-08-04T18:17:18Z
status_updated_iso: 2026-08-04T18:17:18Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [ui, sizing, decide]
---

A committed size override now always relayouts (ticket nid_sj9qg27cmear9lgdlz5umwra5_e, `anySizeOverrideChanged` in src/view/GraphStructureDiff.ts) so the resized node no longer overlaps its neighbours or its folder-group box.

Side effect, accepted knowingly there: a fresh layout bumps `GraphViewController.layoutVersion`, and `FitViewOnLayoutChange` in src/view/VicinityGraphFlow.tsx refits the viewport on EVERY layoutVersion change. So releasing a resize handle now re-zooms and re-pans the whole graph, while the user is looking straight at ONE node.

The reviewer of the drag-to-resize commit recommended exempting a resize-driven relayout from the refit; that is a behaviour change beyond the overlap fix, and `fitView` is currently unconditional per new layout.

## Design

Options:
1. Publish WHY a layout is fresh (e.g. `FlowSnapshot` carries a refit hint alongside `layoutVersion`) and let `FitViewOnLayoutChange` skip the refit for a resize-driven one. Needs the controller to know the rebuild came from a resize — a signal the generic `ViewsRefreshPort` fan-out does not carry today.
2. Seed elk with the current positions (the V2 "Layout stability" refinement in docs-internal/plan/high-level-plan.md) so movement stays local; the refit then moves little.
3. Accept the refit and document it in README.

HUMAN DECISION REQUIRED: which of the three.

## Acceptance Criteria

Releasing a resize handle leaves the viewport where the user had it (or the accepted behaviour is documented in README), with the overlap fix intact. A BDD test captures the rule; `npm test`, `npm run check`, `npm run test:e2e -- nodeResize.e2e.ts` green.

