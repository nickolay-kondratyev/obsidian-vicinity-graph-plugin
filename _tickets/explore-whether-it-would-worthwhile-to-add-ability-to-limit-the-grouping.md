---
id: nid_d422lwuzc4ks6v9dng9e3hd3e_e
title: Explore whether it would worthwhile to add ability to limit the grouping
status: in_progress
deps: []
links: []
created_iso: '2026-08-15T03:08:51Z'
status_updated_iso: '2026-08-15T03:11:40Z'
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2
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
Let's explore ability to add a slider in the grouping that would limit the depth of grouping.

Lets say we have grouping 0-20 with default at 20 (which essentially means as many group levels as you want).

If someone goes to 0 then there is NO grouping by folders at all. 

It should have a good hover over explaining what this does as well.

Right now lets explore to see if this is straightforward to add.
