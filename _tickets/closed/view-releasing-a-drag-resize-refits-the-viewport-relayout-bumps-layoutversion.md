---
closed_iso: 2026-08-05T01:25:20Z
id: nid_ct22qotgtw4rezbdn5m0diyb3_e
title: 'view: releasing a drag-resize refits the viewport (relayout bumps layoutVersion)'
status: closed
deps: []
links: [nid_sj9qg27cmear9lgdlz5umwra5_e, nid_9ep12hkmk4zjv2p28emmrhieq_e]
created_iso: '2026-08-04T18:17:18Z'
status_updated_iso: 2026-08-05T01:25:20Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [ui, sizing]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
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

HUMAN DECISION (2026-08-04): **option 3** — accept the refit for the colliding
case, document it. The human tested the shipped behaviour and confirmed the
fitting case is already stable (view and graph both), and that a relayout on a
clash is expected to move things.

## Resolution (2026-08-04) — validated, option 3, closed

The ticket describes a behaviour that is **no longer a bug** in the case that
mattered, and is intended in the case that remains:

- **Fitting resize — NOT a real issue (fixed by nid_9ep12hkmk4zjv2p28emmrhieq_e).**
  `GraphViewController.buildAndPublish` only increments `layoutVersion` inside
  the `else` branch that runs elk (src/view/GraphViewController.ts:346); the
  `reuse-layout` decision keeps the previous positions and does NOT touch it.
  `FitViewOnLayoutChange` (src/view/VicinityGraphFlow.tsx:266) is keyed on
  `layoutVersion`, so no bump ⇒ no `fitView`. The human's observation is exactly
  what the code does.
- **Colliding resize — real, and intended.** A clash re-runs elk, bumps
  `layoutVersion`, and refits. The graph re-arranged anyway; re-framing it so the
  new arrangement is fully visible is the defensible behaviour. Options 1 and 2
  were both rejected as complexity that buys nothing here (option 2's layout
  seeding remains a V2 refinement in its own right, unrelated to this ticket).

Changes:
- `e2e/nodeResize.e2e.ts` — the fitting-resize test now also asserts the
  **viewport**: it wheel-zooms to a framing the user chose, commits a fitting
  (shrink) resize, and asserts the `.react-flow__viewport` transform is
  byte-identical afterwards. A refit would snap that framing back to the fitted
  one, so this fails if `fitView` ever runs on a reuse-layout rebuild.
- `README.md` — the *Node size* caveat is re-worded from "Known caveat …
  Tracked in <this ticket>" to a **by design** note, since it is now the decided,
  shipped behaviour rather than an open defect.

Verified: `npm test` (1638 passed), `npm run check`, `npm run test:e2e --
nodeResize.e2e.ts` (9 passed) — all green.

## Acceptance Criteria

Releasing a resize handle leaves the viewport where the user had it (or the accepted behaviour is documented in README), with the overlap fix intact. A BDD test captures the rule; `npm test`, `npm run check`, `npm run test:e2e -- nodeResize.e2e.ts` green.

--------------------------------------------------------------------------------
HUMAN QUESTION: I tested the resizing and when there is no layout I dont see a change in where the graph is, the view appears to be stable, the graph appears to be stable (unless we do a relayout due to clashes, which is expected to relayout).  - validate whether this ticket describes a real issue.

ANSWER: the observation is correct and now test-locked — see *Resolution* above.
A fitting resize reuses the layout, never bumps `layoutVersion`, and therefore
never refits; only a colliding resize relayouts + refits, which is intended.
