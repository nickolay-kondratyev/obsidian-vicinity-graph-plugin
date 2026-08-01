---
id: nid_156zg4bvhjc7nnl0gwut20bvs_e
title: Fix issue with canvas not being able to use space
status: in_progress
deps: []
links: []
created_iso: '2026-08-01T18:14:18Z'
status_updated_iso: '2026-08-01T18:16:49Z'
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Right now now there is an issue with canvas when the vicinity plugin is enabled, in the canvas the 'space' inside nodes stops working.

The way to repros is to start the vicinity plugin,
Navigate to a note, then navigate to a canvas, then try to create a NODE in the canvas and try typing space. 
EXPECTED: being able to use space as usual.
ACTUAL: Space does not work at all.

Let's make sure we end e2e test for this. And a follow up ticket to add e2e tests for core canvas and note functionality to work while the vicinity graph plugin is enabled, also note for the follow up ticket this issue particurly happened after navigating the canvas while vicnity view is open.
