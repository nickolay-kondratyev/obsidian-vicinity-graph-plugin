---
id: nid_qveuch88qov6rr7pr2y7a1vki_e
title: Custom sizing - add ability to drop custom size
status: in_progress
deps: [nid_9hx6okamx3yt0rg9iad2f4151_e]
links: []
tags: []
created_iso: '2026-08-05T16:38:59Z'
status_updated_iso: '2026-08-06T22:41:50Z'
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Right now once we custom size a node we do not have a way to drop the custom size.

We should add ability to drop the custom size when the node has custom size, 
It we should get an icon that pops up when the node has custom size and when we are hovering over the node we would see this icon IF the node sizing has been overriden. Clicking on this icon would reset the node sizing to default (remove the override of node sizing that is was set by dragging the node), after reset of the size we would not see the node icon anymore since it wouldn't be actionable. We will also want to have a hover over the icon to explain what it does and when its shown to educate the user.


I am thinking we will want to put this functionality under the gear icon of the node. 
The gear icon of the node will have multiple different options under it, this included as one of the options.
