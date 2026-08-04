---
id: nid_ct22qotgtw4rezbdn5m0diyb3_e
title: "view: releasing a drag-resize refits the viewport (relayout bumps layoutVersion)"
status: open
deps: []
links: [nid_sj9qg27cmear9lgdlz5umwra5_e, nid_9ep12hkmk4zjv2p28emmrhieq_e]
created_iso: 2026-08-04T18:17:18Z
status_updated_iso: 2026-08-04T18:17:18Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [ui, sizing, decide]
---

A committed size override relayouts so the resized node no longer overlaps its neighbours or its folder-group box (ticket nid_sj9qg27cmear9lgdlz5umwra5_e).

UPDATE 2026-08-04 (ticket nid_9ep12hkmk4zjv2p28emmrhieq_e): the relayout is no longer unconditional — `src/view/layoutFit.ts` now asks whether the new box still FITS where the layout put it, and a fitting resize reuses the layout, so it neither re-arranges the graph nor refits the viewport. This SHRINKS the problem below to the colliding case (where a re-arrangement is happening anyway and a refit is far more defensible), but does not decide it.

Side effect, accepted knowingly there: a fresh layout bumps `GraphViewController.layoutVersion`, and `FitViewOnLayoutChange` in src/view/VicinityGraphFlow.tsx refits the viewport on EVERY layoutVersion change. So releasing a resize handle now re-zooms and re-pans the whole graph, while the user is looking straight at ONE node.

The reviewer of the drag-to-resize commit recommended exempting a resize-driven relayout from the refit; that is a behaviour change beyond the overlap fix, and `fitView` is currently unconditional per new layout.

## Design

Options:
1. Publish WHY a layout is fresh (e.g. `FlowSnapshot` carries a refit hint alongside `layoutVersion`) and let `FitViewOnLayoutChange` skip the refit for a resize-driven one. Needs the controller to know the rebuild came from a resize — a signal the generic `ViewsRefreshPort` fan-out does not carry today.
2. Seed elk with the current positions (the V2 "Layout stability" refinement in docs-internal/plan/high-level-plan.md) so movement stays local; the refit then moves little.
3. Accept the refit and document it in README.

HUMAN DECISION REQUIRED: which of the three.

Interim (review follow-up, 2026-08-04): the refit is stated as a *Known
caveat* under README's *Node size* (now scoped to the colliding case), so the
shipped behaviour is not silently different from what that section promises. That is option 3's documentation half
only — it does NOT pre-empt the decision; delete the caveat if 1 or 2 wins.

## Acceptance Criteria

Releasing a resize handle leaves the viewport where the user had it (or the accepted behaviour is documented in README), with the overlap fix intact. A BDD test captures the rule; `npm test`, `npm run check`, `npm run test:e2e -- nodeResize.e2e.ts` green.

--------------------------------------------------------------------------------
HUMAN QUESTION: I tested the resizing and when there is no layout I dont see a change in where the graph is, the view appears to be stable, the graph appears to be stable (unless we do a relayout due to clashes, which is expected to relayout). 