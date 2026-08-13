---
id: nid_ofacqul281sr71qrdacqy8jv3_e
title: Rename at time eats the visualization of the node
status: in_progress
deps: []
links: []
created_iso: '2026-08-13T19:43:09Z'
status_updated_iso: '2026-08-13T19:48:40Z'
type: bug
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
ROOT cause and fix.

--------------------------------------------------------------------------------

After renames we at times end up with a ghost looking node where the node is transparent in the vicinity graph:

"/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1/.tmp/Screenshot From 2026-08-13 13-42-29.png"

It particurly, happens when "folder note" plugin is used and we rename the folder note:

So if we rename a folder note such as 

```
Jon/Jon.md

# 'Jon' renamed to 'Jon1', which causes the folder to be renamed to Jon1 as well 

Jon1/Jon1.md
```

Then we end up with transparent looking node in the graph. So to reproduce it we may want to have the test trigger the folder rename as well in e2e test.
