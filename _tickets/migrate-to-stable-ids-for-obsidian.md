---
id: nid_813lccr2s8xfvsc978eatygdx_e
title: "migrate to stable ids for obsidian"
status: open
deps: []
links: []
created_iso: 2026-08-10T20:00:33Z
status_updated_iso: 2026-08-10T20:00:33Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
---


the following is now deprecated (name was changed)
```json file=[$(git.repo_root)/package.json] Lines=[28-29]
		"obsidian-id-lib": "^0.1.0",
```

In its place we should use https://www.npmjs.com/package/stable-ids-for-obsidian

The code is the same from this repo just the name of library has changed.
This ticket is to migrate to updated name.