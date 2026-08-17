---
id: nid_fg66tanwkoyq3cqs1wdxagn21_e
title: "Add ability for named relationships"
status: open
deps: []
links: []
created_iso: 2026-08-17T15:20:34Z
status_updated_iso: 2026-08-17T15:20:34Z
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

The typical relationship is just a wiki link or an embed. - These are NOT named.
A named relationship will have some prefixed to it.
The syntax that I am thinking of is this 
```
<rel-name>::<dest-note>
```

#### example 1:

note1.md:
```
supports::[[note2]]
```

This means note1 --supports--> note2

--------------------------------------------------------------------------------

Also we want to be able to express that relationships between notes that are not originating from the note that we are writing from. So if we write:

note1.md:
```
[[note2]]::supports::[[note3]]
```
This would mean note2--supports-->note3

And we would NOT render the relationhips of note1 to note2 and NOT rendering note1 to note3. note1 in this case just describes relationships between other notes. 

--------------------------------------------------------------------------------

NOTES: we will want to grab the context of the links efficiently, and "parallelize" the file fetch where needed with bounded concurrency. so that we are able to gather the context to understand these relationships rapidly. 