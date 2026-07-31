---
closed_iso: 2026-07-24T00:43:03Z
id: nid_si26o1o5h4yrvv5v8tcgz1b68_e
title: "edge-routing: re-enable radial routing via web-worker offload"
status: closed
deps: []
links: []
created_iso: 2026-07-22T18:57:48Z
status_updated_iso: 2026-07-24T00:43:03Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
---

Phase 3 (edge-routing__03, id nid_o1f05i1pu3lgkmaxpbaj13x3x_e) gated obstacle-avoiding edge routing OFF for the `radial` layout mode per a human decision, because routing added ~490ms (visibility-graph build over ~100 obstacles) versus radial's ~45ms layout on a dense all-edges vicinity, with little visual benefit (radial spokes are near-straight).

The gate lives in `src/view/GraphViewController.ts` as `ROUTING_SKIPPED_LAYOUT_MODE: LayoutMode = "radial"` + `isRoutingSkippedLayout(mode)`, checked in `resolveRoutes` beside the `edgeRouting` OFF gate.

This ticket: once the deferred web-worker routing offload exists (routing off the main thread so a ~500ms pass no longer blocks the UI), reconsider re-enabling routing for radial (remove/relax the gate) — or add a smarter cost heuristic (e.g. only route radial when spokes actually cross obstacles). Depends on the web-worker offload work landing first.

Acceptance: radial routing either re-enabled behind the offload with no UI jank, OR an explicit decision recorded that radial stays straight-spoke by design.

## Acceptance Criteria

- Web-worker routing offload exists (prerequisite).
- Radial routing re-enabled without main-thread jank, OR documented decision to keep radial straight-spoke.
- arrows.md routing section updated to match.


## Notes

**2026-07-24T00:43:03Z**

Superseded/closed by force-layout-only removal (ticket nid_ihlfchb69wt1hqot6iqy7a9m9_e, commit e68a86a). Radial layout no longer exists, so re-enabling radial routing is moot. Routing is now unconditional when edgeRouting is on (the ROUTING_SKIPPED_LAYOUT_MODE radial guard was removed).
