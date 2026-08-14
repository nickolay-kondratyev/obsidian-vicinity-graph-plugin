---
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2
id: nid_ivt836nuelyse1c0epp86d36z_e
title: "Dont render the same image twice in the graph"
status: in_progress
deps: []
links: []
created_iso: 2026-08-14T19:23:31Z
status_updated_iso: 2026-08-14T19:26:35Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
---

Avoid rendering the same twice in the graph, 

IF one node already renders the image in the graph we should avoid rendering the same image again.

I presume this is easy addition to add this sort of filtering. 

Also as tie-breaker we should look for the note that is higher up in the folder hierarchies, the one that is higher up with the same image wins and it displayed the image. 

This rule applies only to the nodes that were going to display the image. So the 2nd node with that image for now is NOT going to display the image.