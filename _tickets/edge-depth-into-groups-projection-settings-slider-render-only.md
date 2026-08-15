---
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_39fjevyqyfv0ge849rc77stn5_e
title: "Edge depth into groups: projection + settings slider (render-only)"
status: in_progress
deps: [nid_6fkhyw97hjs84xb62z6tommhi_e]
links: []
created_iso: 2026-08-14T23:38:31Z
status_updated_iso: 2026-08-15T00:14:56Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: []
---

Implements phase 1 of plan ticket nid_6fkhyw97hjs84xb62z6tommhi_e (read it first; it holds the human-signed decisions D1-D4 and the architecture facts).

Goal: add the "Edge depth into groups" slider (per-endpoint depth allowance N, default 0 = current behavior) and let each rendered edge endpoint reach up to N levels past today's collapse target: it projects onto its ancestor group N levels BELOW the LCA container's direct child (= depth N+1 below the LCA; the true note when its chain is shallower). RENDER-ONLY: src/view/elkMapping.ts attachEdgesToContainers keeps the depth-0 projection unchanged.

Work items:
1. Engine: new BoundedNumberSpec leaf in src/engine/SettingsSpec.ts grouping block - min 0, max 6, step 1, default 0. Register default in src/engine/settingsProductDefaults.test.ts (the ONE literal-defaults file).
2. Settings machinery (all templated, tripwires enforce wiring): row in src/view/settingsRows.ts (Grouping heading), label "Edge depth into groups", desc "How many levels of nested groups an edge may reach into before collapsing onto the group box. 0 keeps every group edge collapsed." Accessor in src/view/settingsRowAccessors.ts. Both presenters (tab + panel) render via their control-kind switch. src/view/settingsRowSpecCoverage.test.ts must pass without allowlisting.
3. Projection: parametrize the endpoint projection in src/view/folderGrouping.ts (today projectOntoContainerChildOf projects onto the LCA's direct child) with a depth allowance; an endpoint whose chain runs deeper projects onto its ancestor group N levels below that direct child, a shallower endpoint stays the true note. src/view/flowMapping.ts buildFlowEdges consumes the allowance from settings; aggregation (CollapsedEdgeAccumulator keying, count badge, bidirectional merge, notePairs flyout) works unchanged on the deeper projected pair.
4. Tests: BDD, parametrize/extend src/view/folderGrouping.test.ts + src/view/flowMapping.test.ts (N=0 unchanged snapshot of today's expectations; N=1 edge terminates at inner note / nested group box; N large = true endpoints; both-endpoints-deep case; badge/bidirectional still merge at deeper level). Settings structure suites pick the new leaf up automatically - verify.
5. Doc note (decision D2 requirement): add to docs-internal/plan/high-level-plan.md that layout deliberately does NOT see deep edges yet, and that pulling linked inner nodes together is a recorded future consideration (ticket nid_my99vi73iouq1y9hkomoedqgd_e).
6. e2e: settings row appears + writes settle (copy SettingsWriteWindow pattern); a graph screenshot-level check that N>0 renders an edge terminating inside a group. Run npm run test:e2e (view-layer change).

EXPLICIT interim caveat (from plan): with N>0 the libavoid router still runs today's single pass, so a piercing edge's interior leg is straight and may cross inner squares/titles - decision D3 is satisfied only by the follow-up routing ticket. Default 0 ships identical behavior; do not advertise the slider until the routing ticket lands.

## Acceptance Criteria

- N=0: rendered edges byte-identical to today (tests prove).
- N>=1: edges terminate at notes/groups up to N levels below the LCA; aggregation intact.
- Slider present in tab AND panel via declared row machinery; defaults test updated; spec-coverage tripwire green.
- elk layout input unchanged (attachEdgesToContainers untouched by depth).
- docs-internal/plan/high-level-plan.md notes the render-only decision + future layout pull-in consideration.
- npm run check, npm test, npm run test:e2e green.

