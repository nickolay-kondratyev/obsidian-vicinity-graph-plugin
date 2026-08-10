---
id: nid_vb246h5pr4609hid76ts1ufe5_e
title: "Adjust how we store the data per main node"
status: open
deps: []
links: []
created_iso: 2026-08-07T21:28:00Z
status_updated_iso: 2026-08-07T21:28:00Z
type: task
priority: 1
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


Right now we store the data into data.json (as far as I understand).

However, as we expand what we store we will likely want to store the data into a separate hidden folder. The path of folder will be `${VAULT_PATH}/.plugin_data/vicinity_graph/` and then store the data with one JSON document per ID. 

The individual settings for a file will be stored in a id based file in path

`${VAULT_PATH}/.plugin_data/vicinity_graph/per_file/<ID>.json`

ID is the stable identifier that gets assigned to the file when we modify it.
