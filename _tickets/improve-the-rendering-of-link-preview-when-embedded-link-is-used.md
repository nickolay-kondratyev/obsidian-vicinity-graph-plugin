---
id: nid_yw2m80g72pahcvtsxi09o7vkd_e
title: "Improve the rendering of link preview when embedded link is used"
status: open
deps: []
links: []
created_iso: 2026-08-04T00:20:25Z
status_updated_iso: 2026-08-04T00:20:25Z
type: task
priority: 3
assignee: nickolaykondratyev
---

Right now when we have embedded links they render as their full note in link preview which is NOT what we want. 

I am thinking maybe we just render them as 

```
!{{Rendered Note Name/or title if title exists in frontmatter}}
```

So that we would just render the note name and the `!` to signify the embed. But not the full embedded portion.