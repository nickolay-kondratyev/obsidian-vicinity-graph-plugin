---
id: nid_h55sqq8nz172mgx5etez2gd77_e
title: "On initial load we should have a different message"
status: open
deps: []
links: []
created_iso: 2026-08-06T22:31:35Z
status_updated_iso: 2026-08-06T22:31:35Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
---

Right now we have a simple message on building the graph,
But it really shows up only on the beginning load, while making it look like it may have slow build out for the future as well.
```tsx file=[$(git.repo_root)/src/view/VicinityGraphFlow.tsx] Lines=[171-172]
		return <div className="vicinity-graph-building">Building the vicinity graph…</div>;
```

I am thinking IF and only IF **its straightforward** to detect whether obsidian just loaded and we are doing the first reload, then the message should say so so the users dont think it takes forever to load the graphs all the time. But only on the initial load, so if we can detect that its initial load and we are building the graph then we should have different message for that case.