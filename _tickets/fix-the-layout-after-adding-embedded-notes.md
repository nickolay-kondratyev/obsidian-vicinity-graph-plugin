---
id: nid_88yuw7c8y9xa4k1miy9lz0mwe_e
title: "Fix the layout after adding embedded notes"
status: open
deps: []
links: []
created_iso: 2026-08-07T15:04:34Z
status_updated_iso: 2026-08-07T15:04:34Z
type: bug
priority: 1
assignee: nickolaykondratyev
tags: []
---

We are in the process of nesting notes visually (more info in nid_14potmihi2tc0x421abf0awz6_e)

We have added nesting but the layout appears broken. Notes render on top of notes etc. things are not not looking right. 

What I would like to see 
Being for layout of other nodes that are not embedded to WORK again. So the nodes are properly layed out and are not clashing on top of each other. This particurly appears when there are nodes with heavy embedded nesting. So I think we need a test case with nesting. AND make sure the layout works with that. When we draw the layout only the outermost containers should be affecting the interaction (meaning the nodes in the containers should not be affecting the layout). Look into how grouping nodes have made this work such that there are nodes in the group that are layed out and then then group is the one that affects the external layout. 