---
id: nid_otmc0t1jlcuwy3g3a3iychvl0_e
title: Improve descendent and ancestor processing - add special case for folder notes
status: in_progress
deps: []
links: []
created_iso: '2026-08-13T19:31:34Z'
status_updated_iso: '2026-08-13T19:35:31Z'
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
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

Adding special case for folder notes, for ancestors and descendents.

Right now we have 

```
note1/
note1.md
note1/other/other.md
```

[note1] -> [other] : is not seen as a descendent due to folder skip.

However, we should treat these as special case, we should recognize that 
other/ is right under note1/ and note1/ is the folder tied to note.md and GIVEN that other/ has other.md HENCE they should be linked as parent child note - at level 1 of descendent 

same thing with ancestor other.md should see that its tied to other/ folder and therefore can go up to note1.md - as level 1 ancestor.
