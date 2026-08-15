---
id: nid_s28ucpwyu62674ndvbzst8nct_e
title: When we group lets have the group folder be placed at the top right corner
  of the group
status: in_progress
deps: []
links: []
created_iso: '2026-08-15T02:48:07Z'
status_updated_iso: '2026-08-15T03:00:14Z'
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
Let's have the node that matches the group be placed at the top right corner of the group. - WHEN its visible.

IF the node is visible by means of discovery it should appear the top of right corner of the group. 

IF there is at least one node that matches the folder by folder notes rules name (Eg `Jon/Jon.md` or `/Jon.md /Jon`) THEN clicking on the folder name should lead us to that node, if there are multiple matches then clicking on the folder name shows a dropdown with all the candidates of the notes/canvases that match it by folder name rules and clicking on one of them leads to them. - This applies to both when we discovered the node and when we have NOT discovered the node.
