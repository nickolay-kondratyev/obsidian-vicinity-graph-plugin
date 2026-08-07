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

Right now we store the data into data.json (as far as I understand).

However, as we expand what we store we will likely want to store the data into a separate hidden folder like the smart connections is doing. Or like visit history is doing since I think the hidden folders may not be synced yet still (https://forum.obsidian.md/t/obsidian-sync-sync-hidden-files-and-folders-as-well-start-with-a-dot/32123) and we would like this to sync across desktop so likely will want to put the special data into something like `${VAULT_PATH}/_plugin_data/vicinity_graph/` and then store the data with one JSON document per ID. 