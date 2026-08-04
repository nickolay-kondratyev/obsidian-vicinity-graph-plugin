---
id: nid_cx5zoz7ptucg9nxalibv0mbjb_e
title: "engine: content-aware central and pinned node sizing"
status: open
deps: [nid_o5hz7ilcauwe2acqdfh6pcuam_e]
links: [nid_o5hz7ilcauwe2acqdfh6pcuam_e, nid_lwionnvohw9k58jw7a2dybht2_e, nid_qjsj5mth2phdqctbm0vfx9elw_e, nid_9hx6okamx3yt0rg9iad2f4151_e, nid_kyowb4v8v51nslbicl4szgcd5_e, nid_jcxzhexfaksge2arjzca3w7ff_e]
created_iso: 2026-08-03T23:48:47Z
status_updated_iso: 2026-08-03T23:48:47Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [sizing, engine]
---

Part of the node-sizing rethink (docs-internal/plan/node-sizing-rethink.md, origin nid_kyowb4v8v51nslbicl4szgcd5_e).

Today src/engine/NodeSizer.ts gives every central (MAIN + pinned) CENTRAL_SIZE_SCORE (=1.0 -> maxPx) regardless of content, so an empty central/pinned note renders huge. Per the decided direction (see decide ticket answers for Q1/Q2):
- Remove the central metric bypass; centrals get the normal computed size FLOORED at a named prominence constant (proposal ~0.35 score) so centrality is visible but not dominating.
- If Q1 = size-to-fit-content: default node size derives from the rendered content (outline line count / thumbnail presence) clamped by the minPx/maxPx dials; metric dials become clamps/weights per the decision.
- sizeScore semantics for truncation ranking (src/engine/NodePriorityChain.ts) must be preserved per Q4.

Pure engine change: src/engine/NodeSizer.ts + constants + tests (BDD, start failing). Update docs-internal/plan/high-level-plan.md Sizing section and settingsProductDefaults.test.ts if any default changes. npm test is sufficient (no view change), but expect e2e specs asserting central size to need alignment.

## Acceptance Criteria

Empty central/pinned nodes no longer render at maxPx; behavior matches decided Q1/Q2; all sizing tests updated with explicit alignment noted.


## Notes

**2026-08-04T00:03:14Z**

DECIDED (2026-08-03, decide ticket closed): Q1 = size-to-fit rendered content. Owner went FURTHER than option (b): REMOVE the metric dials entirely (own-file-size, total-linker-size, backlink-count, outlink-count, depth-decay). Default node size = fit what the node shows (title only -> fits the title; outline lines; thumbnail), clamped by the minPx/maxPx dials, which stay as clamps. Q2 = centrals/pinned get a modest named prominence floor, no maxPx bypass.

OPEN IMPLEMENTATION POINT this ticket must settle: NodePriorityChain ranks truncation via sizeScore ("higher size score" tiebreak). With metrics gone, either keep a HIDDEN content-derived relevance score for ranking only, or drop that link in the chain and let distance-to-MAIN take over. Also: removing the dials removes their settings rows/spec leaves - clean break on stored data (version bump, unpublished), and the size-to-fit estimate lives in the view mapping like nodeDimensionsPx width today. Coordinate with the Title-only preference ticket on restating the preference-independence rule (size now legitimately follows displayed content).
