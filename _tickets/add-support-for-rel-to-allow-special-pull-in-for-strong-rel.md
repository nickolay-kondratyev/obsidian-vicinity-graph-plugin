---
id: nid_h8noa3wy468bay7j3t374ux9s_e
title: "Add support for rel to allow special pull in for strong rel"
status: open
deps: []
links: []
created_iso: 2026-08-07T21:16:43Z
status_updated_iso: 2026-08-07T21:16:43Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
---

Model the strength of relationship as a number in the data model from 1-10.

Also allow just `strong: true` flag which will be something like strength of level 6.

That would live use with: 
```
x-strong:7
xx-strong:8
xxx-strong:9
```

Naming wise.

We will want to have link-out be based on the strength of the relationship. 
We will want to look into how much pre-processing we have to be able to figure out the strength named relationship.

named relationship would have the syntax like

- [[rel/alias]]::[[target-note]]
