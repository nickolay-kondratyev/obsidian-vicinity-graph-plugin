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
  Finally create detailed plan with requirements of what we want to achieve
  and steps of execution and put it into a new ticket 
  (or multiple tickets if it warrants a split across multiple tickets).
  Close this ticket after planning is complete.

--------------------------------------------------------------------------------
GOAL: add ability to link based on note `id` field from frontmatter.

For example ticket notes used 

```
deps: [note-id-1]
links: [note-id-2, note-id-3]
```

We would like to be able to display these relationship in the graph. 