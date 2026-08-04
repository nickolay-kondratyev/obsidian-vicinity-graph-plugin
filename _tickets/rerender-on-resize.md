---
id: nid_9ep12hkmk4zjv2p28emmrhieq_e
title: Rerender on resize - poke if can be improved
status: in_progress
deps: []
links: []
created_iso: '2026-08-04T18:32:19Z'
status_updated_iso: '2026-08-04T18:34:03Z'
type: null
priority: null
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Right now we just recently simplified to ALWAYS re-render the layout on resize.

However, If there was enough space for the node to be resized then its a bit odd to retrigger the layout resize.

I am wondering whether it's straightforward to adjust to retrigger layout ONLY when there was overlap with nodes after resize and otherwise keep the layout as it was.
