---
id: nid_4ntyhn708ycqnzqmjlgf6zq70_e
title: Allow grouping of nodes recursively.
status: in_progress
deps: []
links: []
created_iso: '2026-08-13T23:20:18Z'
status_updated_iso: '2026-08-13T23:24:45Z'
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
