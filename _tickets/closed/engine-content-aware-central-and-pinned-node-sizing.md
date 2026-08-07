---
closed_iso: 2026-08-04T23:39:54Z
id: nid_cx5zoz7ptucg9nxalibv0mbjb_e
title: 'engine: content-aware central and pinned node sizing'
status: closed
deps: [nid_o5hz7ilcauwe2acqdfh6pcuam_e]
links: [nid_o5hz7ilcauwe2acqdfh6pcuam_e, nid_lwionnvohw9k58jw7a2dybht2_e, nid_qjsj5mth2phdqctbm0vfx9elw_e,
  nid_9hx6okamx3yt0rg9iad2f4151_e, nid_kyowb4v8v51nslbicl4szgcd5_e, nid_jcxzhexfaksge2arjzca3w7ff_e]
created_iso: '2026-08-03T23:48:47Z'
status_updated_iso: 2026-08-04T23:39:54Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [sizing, engine]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-4
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

**2026-08-04T23:39:54Z**

RESOLVED (2026-08-04). Implemented on branch CC_nid_cx5zoz7ptucg9nxalibv0mbjb_e__engine-content-aware-central-and-pinned-node-sizin_fable. npm run check clean, npm test 1556/1556, full Playwright e2e 134 passed / 1 pre-existing skip.

What shipped:
- Content-fit sizing (Q1, owner went further than option b): the five metric dials REMOVED end to end (engine spec leaves, settings rows/accessors/presenters, persistence keys, tests). `SizingSettings` is now `{minPx, maxPx}` — clamps only.
- DEVIATION from this ticket's note: the size-to-fit estimate lives ENGINE-side (`NodeSizer.contentFitPx` — title lines + renderable outline entries + attachment row + thumbnail reveal floor), NOT in the view mapping. `GraphNode.sizePx` stays the one number downstream reads; the sizer resolves the same `nodePreviewKind` decision the view renders by. Rationale recorded in docs-internal/plan/node-sizing-rethink.md §6 item 2.
- Q2: central bypass replaced by `CENTRAL_PROMINENCE_FLOOR_SCORE = 0.35` — centrals/pinned floor at round(minPx + 0.35*(maxPx-minPx)) = 82px at 40/160 defaults; no maxPx bypass. Empty centrals no longer render at maxPx (acceptance met).
- Open point SETTLED: the NodePriorityChain "higher size score" truncation tiebreak was DROPPED (no hidden content score); distance-to-MAIN takes over. Chain: minDepth → distanceToMain → pin recency → docid → path.
- Clean break on stored data but NO PERSISTED_SHAPE_VERSION bump: stale metric/depthDecayK keys are simply never read; a bump would discard pins + nodeOverrides wholesale (consistent with nid_8p0nn2g34d97finokwlz3u1dt_e).
- Docs updated: high-level-plan.md Sizing section rewritten, README sizing bullet, node-sizing-rethink.md §5/§6 settled.

E2E alignment (all with explicit alignment notes):
- Crowd-cap truncation determinism now rests on the lexicographic PATH tiebreak (same survivors, new reason); `SettingsWriteWindow` drain sentinel moved from depthDecayK to minPx-at-floor.
- Pin fixtures (rt_x, sc_x, sc_hub) and the facing-near* crowd fixture re-padded with three headings: content-fit renders one-line notes at ~40px, below the pin chip's 90px border-box reveal and tight enough to trigger a routing wrong-side wrap.

Follow-ups filed:
- nid_izwyr4brgokbnw6equmyfe5xv_e — edge routing wrong-side wrap under dense small-node crowding (reproduced: facing-near12 199px above the box attached on its right border).
- nid_tclb98q9hxhmcuonamvr4ig1f_e (decide) — hover pin chip hidden on small nodes, now including a default-sized EMPTY central (82px floor < 90px chip threshold).
