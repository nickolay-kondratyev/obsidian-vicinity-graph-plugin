---
id: nid_tohotgq2s92dvd1iov1rd0umv_e
title: "Show the preview of the links"
status: open
deps: []
links: []
created_iso: 2026-07-31T18:30:48Z
status_updated_iso: 2026-07-31T18:30:48Z
type: task
priority: 3
assignee: nickolaykondratyev
---

Right now when we click on the links we get NO preview whatsoever. I would like a modal to be shown after we clicked on the links in the vicinity graph that shows where the links are used and a short context of those links COLLAPSED

The view is going to be a list of short context of each link, and we should be able to click on that context to expand the context around that link within the preview. When we click on the context we still remain in the same focus note. There should be an icon to GO to that particular link reference which in the case of a backlink can change the center note. 

Within this link preview we should have two buttons collapse all/expand all. They should have active state when they are able to be used. IF all elements are collapsed then we should be able to use expand all but not collapse all, if all the elements are expanded we should be able to use collapse all, but not expand all. If there is a mix then both are enabled. 

We should load in /Users/nkondrat/vintrin-env/config/claude/ai_input/deep/my-frontend-design.md when designing the UX/UI of the preview. 

IF rendering the context around the link is hard, then its ok to show raw markdown of the context.

Also when we show the links in the preview we should group the links and the backlinks.
The backlinks must be grouped from which note they are backlinking from as well. 