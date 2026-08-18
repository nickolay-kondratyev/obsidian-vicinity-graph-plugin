---
id: nid_3s47jew297bthxajy1v288hiu_e
title: Appears to be a bug in named lins
status: in_progress
deps: []
links: []
created_iso: '2026-08-18T00:00:29Z'
status_updated_iso: '2026-08-18T00:02:54Z'
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
There are appears to be a bug in how we reach named links 


--------------------------------------------------------------------------------
USE CASE:
note: A.md
```
supports::[[B]]
```

note: B.md
```
supports::[[C]]
```

C exists.

Went to A as the main note. Put links out at 2. 
EXPECTED: C is visible.
ACTUAL: C is not visible.
--------------------------------------------------------------------------------

ROOT CAUSE and FIX.
