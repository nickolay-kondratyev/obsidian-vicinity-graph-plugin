---
id: nid_yw2m80g72pahcvtsxi09o7vkd_e
title: Improve the rendering of link preview when embedded link is used
status: in_progress
deps: []
links: []
created_iso: '2026-08-04T00:20:25Z'
status_updated_iso: '2026-08-04T22:05:44Z'
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
Right now when we have embedded links they render as their full note in link preview which is NOT what we want. 

I am thinking maybe we just render them as 

```
!<<Rendered Note Name/or title if title exists in frontmatter>>
```

So that we would just render the note name and the `!` to signify the embed. But not the full embedded portion.
