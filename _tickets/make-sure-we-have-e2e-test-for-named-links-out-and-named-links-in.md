---
id: nid_wecll6kqjlq3jmdkudq092xte_e
title: "Make sure we have e2e test for named links out and named links in"
status: open
deps: []
links: []
created_iso: 2026-08-18T14:55:24Z
status_updated_iso: 2026-08-18T14:55:24Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
---

Make sure we have an e2e integration test for named links out and named links in .

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

Lets make sure we have a e2e integration test that reproduces this. And THEN Root cause and fix.