---
closed_iso: 2026-08-14T00:19:24Z
id: nid_4ntyhn708ycqnzqmjlgf6zq70_e
title: Allow grouping of nodes recursively.
status: closed
deps: []
links: []
created_iso: '2026-08-13T23:20:18Z'
status_updated_iso: 2026-08-14T00:19:24Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
TASK: **PLAN**. Lets clarify any gaps that exist for this ticket
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

GOAL of plan: Allow grouping nodes recursively and allow groups to be within other groups. So that if let's say we have `SQL folder` and there is another node that is a descendent of it will be in group within a group. We can multiply groups within groups.

If its simple to make it a toggle lets make it a setting to turn this behavior on and off. HOWEVER, if its requires large branching and separate rendering code then lets just always turn on the grouping. Do research to see how much of branching of logic would it require, and lean towards always defaulting to groups turned on. 

IF it's really simple to turn groups off then we should turn the entire grouping concept OFF and that would be in graph controls under new setting group called: Grouping and just have a pill like UI to turn this on/off. HOWEVER: remember if it adds large test surface area then just TURN this sort of recursive grouping on. So notes should be aware of ancestors and fall into the folder grouping according to their parent/ancestors.

--------------------------------------------------------------------------------

# RESOLUTION (2026-08-14)

Planning completed. Every decision was signed off item-by-item by the owner
(two rounds via `.out/current_decision.md`).

**Research outcome:** recursion is architecturally natural (elk + React Flow
support arbitrary nesting; extraction walks already recursive), while an
on/off toggle is the EXPENSIVE branch (second rendering mode, doubled test
matrix; a `groupByFolder` toggle was already deliberately deleted once).

**Signed-off decisions (full detail in the plan ticket):**
- D1: recursive grouping ALWAYS ON, no toggle.
- D2: folder qualifies with >=2 visible DESCENDANT notes; note joins nearest
  qualifying ancestor; groups nest recursively; redundant single-child chains
  collapse into one box carrying the chain (e.g. `A/B/C`).
- A1: new "Grouping" settings group, ONE row: group label `Folder name`
  (DEFAULT) vs `Full path` for collapsed chains.
- D3: edge collapse via lowest-common-ancestor container; edges live inside
  boxes but never cross a boundary line; cross links share the pipeline.
- D4: truncation `+N` counts attach to nearest RENDERED ancestor group;
  corner orphan badge only as last resort.
- D5: `rectpacking` interiors in phase 1; edge-aware interior layout is a
  first-class follow-up (plumbing + measured evaluation + owner sign-off).

**Tickets created:**
- Plan (closed): `nid_xko67wo2z4awg5gdrm1xx1chz_e` — design source of truth.
- Implementation chain (open, deps wired):
  `nid_unqqausmhnujjixitr6kieflq_e` (grouping tree core) →
  `nid_d44vbnq9o6rhuelfwclx2e34n_e` (nested elk + LCA edges) →
  `nid_9uh2twn8whoqtplbxk0ywzpx7_e` (nested flow rendering + collapse) →
  `nid_3wnxsfexabjnx1uj9js2o1c43_e` (badges) ∥
  `nid_0nmhmv03071derz5ok30cisaa_e` (Grouping settings row) →
  `nid_5hnmpwtzakhd3le95jzigsvs0_e` (e2e + docs, final gate).
- Follow-ups (open): `nid_as3hdgn25pbxttimy643f46v7_e` (per-container layout
  seam) → `nid_7abfje1vus15rx9hzmpel9jin_e` (edge-aware interiors evaluation,
  `decide` tag).
