---
id: nid_g1iavmz653xxsnpdj6wzf5h98_e
title: Allow edge to go through boxes
status: open
deps: []
links: []
created_iso: '2026-08-14T22:48:45Z'
status_updated_iso: 2026-08-14T23:02:43Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
FIRST: This task is to first consider feasability without OVER COMPLICATING code.

IF its straightforward into current flow of rendering to add and doesnt explode our testing, then we can proceed to planning

--------------------------------------------------------------------------------

ONLY if straightforward THEN PLAN: **PLAN**. Lets clarify any gaps that exist for this ticket
  (if you need to explore code base use cheaper Explore-cheap sub-agent)
  ask human any questions that come up that require human decision.
  Finally create detailed plan with requirements of what we want to achieve.
  IF there are multiple tickets that we want to create 
    THEN put the high level plan into a new ticket and `close` it 
         AND create focused implementation tickets that reference the closed plan.
    ELSE put the plan into a new `open` ticket
  After we are done close this ticket.
  DONT RUSH and make sure the decisions that need to be made are fully signed off one by one by the HUMAN.
--------------------------------------------------------------------------------

GOAL: look into feasability of allowing to show edges between nodes within the groups.  I am envsioning it would be a slider under grouping settings to how many group edges we allow to cross with the links. And that slider will determine how many of the innner groups allow to keep their own edges without getting collapsed to the outer groups.

## Notes

**2026-08-14T23:02:43Z**

FEASIBILITY DONE (verdict: straightforward, proceed to plan after human sign-off).

Findings:
- Edge collapse is a pure view-layer projection: folderGrouping.projectOntoContainerChildOf, used by flowMapping.buildFlowEdges (render) and elkMapping.attachEdgesToContainers (layout). Letting edges reach deeper = a depth parameter on that projection.
- React Flow renders edges to subflow children already (intra-group passthrough edges exist) - no RF blocker.
- libavoid spike (.tmp/libavoid-through-box-spike.mjs, real wasm): an edge whose endpoint sits INSIDE a group-box obstacle still avoids obstacles OUTSIDE the box, then runs a straight leg from the box border to the inner endpoint (ignores inner squares). Piercing works with zero router changes; trade-off is the straight interior leg.
- Testing impact bounded: parametrize existing flowMapping/folderGrouping suites + one templated settings row.

BLOCKED ON HUMAN: 4 decisions written to .out/current_decision.md (D1 slider semantics - recommended per-endpoint depth allowance; D2 render-only vs layout-aware; D3 accept straight interior leg; D4 slider label/bounds/default 0..4 default 0). After sign-off: write plan ticket(s), then close this ticket.
