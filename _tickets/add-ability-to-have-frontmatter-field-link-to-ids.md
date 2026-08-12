---
id: nid_zklwx8uxsk3bzvgcbnm3wvvj9_e
title: "Add ability to have frontmatter field link to ids"
status: open
deps: []
links: []
created_iso: 2026-08-10T18:25:45Z
status_updated_iso: 2026-08-10T18:25:45Z
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

--------------------------------------------------------------------------------
GOAL: add ability to link based on note `id` field from frontmatter.

For example ticket notes used 

```
deps: [note-id-1]
links: [note-id-2, note-id-3]
```

'note-id-1' is the `id` field in frontmatter of some_note_with_note-id-1_in_id_field.md
```
---
id: note-id-1
---
```

--------------------------------------------------------------------------------
We would like to be able to display these relationship in the graph. 

For now we will use the regular links out budget to process them in the graph.

My assumption, is that this should be straighforward to do as Obsidian should already CACHE the frontmatter in its index. Do NOT read entire vault to power this feature if we are not able to pull from Obsidian cache then STOP the planning and pull in the human.