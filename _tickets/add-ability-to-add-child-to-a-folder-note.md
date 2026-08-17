---
id: nid_mgp572ljuxzajfrb64gkiyreq_e
title: "Add ability to add child to a folder note"
status: open
deps: []
links: []
created_iso: 2026-08-17T16:45:25Z
status_updated_iso: 2026-08-17T16:45:25Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
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
WHEN a note is considered a folder note AND it is the main note. 
THEN when hovering over that note we should get an icon in the bottom right corner to create a CHILD note. (Research icons that fit this pattern and use + sign icon as fallback.)

Folder note is either the 
`Jon/Jon.md`

or 
```
Jon.md
Jon/
```
Pattern.
If in conflict we favor the `Jon/Jon.md` pattern and would create the note next to `Jon/Jon.md` as `Jon/Child.md`.
--------------------------------------------------------------------------------