---
id: nid_ndoy0bq50w1p1qzd2i9di2fxo_e
title: "Add ability to do local pinning"
status: open
deps: []
links: []
created_iso: 2026-08-07T19:24:26Z
status_updated_iso: 2026-08-07T19:24:26Z
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


What is local pinning it's when a node is pinned ONLY in the context of the main node.

We still retain global pinning functionality, and we will add another icon to represent LOCAL pinning.

A locally pinned note is seen as a PINNED note in the context of the MAIN(active) note. 
A note can be globally pinned AND locally pinned at the same time, or just one type of pinned.

We want to persist the pinned of the notes that are locally pinned for the note so we will want to save the IDs of the notes that are locally pinned under the settings for main id note. 