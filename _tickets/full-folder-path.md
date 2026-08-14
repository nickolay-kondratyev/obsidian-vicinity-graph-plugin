---
session_ids: [{"a": "claude", "type": "execution", "id": "c457b216-e70b-44ab-901d-ebff8d89bd27"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
id: nid_oebzyb9a3tjtdwrwkvxiuj5wl_e
title: "Full folder path"
status: in_progress
deps: []
links: []
created_iso: 2026-08-14T19:18:42Z
status_updated_iso: 2026-08-14T19:21:21Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
---

IN the grouping settings when we have full folder path to show in the folder, we should use elipses on the front of the path and not the back.

Right now we use elipses at the back that eats the most important part of the path.


So instead of the 
```
ancestor-path/some/chil...
```

We should have something like
```
...ath/some/child-path
```

When we need to use elipses.

And better yet divide it by `/` instead of 

```
ancestor-path/some/chil...
```
Show
```
.../some/child-path
```

WHen the elipses need to be used so that we don't cut words halfway and just use `/` as delimiter and cut paths cleanly.