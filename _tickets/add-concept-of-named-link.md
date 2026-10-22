---
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_wu4gfieqps2uw9l8f4wab1abq_e
title: "Add concept of named link"
status: in_progress
deps: []
links: []
created_iso: 2026-10-22T16:08:49Z
status_updated_iso: 2026-10-22T16:11:48Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
---

Named link would be only with the following syntax:

```
<rel-name>::[[target-note]]
```

such as

```
uses::[[TCP]]
```

then we would show the label 'uses' in the vicinity graph.

IF there are multiple different rel labels for now KISS and choose the first one.

Just this format and space breaks it so 

```md - note1
greatly-improves::[[note2]] -> label would be note1-'greatly-improves'->note2

greatly improves::[[note2]] -> label would be note1-'improves'->note2
```

