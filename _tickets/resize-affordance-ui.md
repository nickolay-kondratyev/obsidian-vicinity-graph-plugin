---
id: nid_rcs31edfd3uadudhlxo1gdjue_e
title: "resize affordance UI"
status: open
deps: []
links: []
created_iso: 2026-08-05T16:43:41Z
status_updated_iso: 2026-08-05T16:43:41Z
type: task
priority: 3
assignee: nickolaykondratyev
---

Right now resize affordance UI looks clear what it does but it doesn't look as pretty as it can.
The thing that throws me off right now is that when we hover over the node to resize the lines to resize go past the round borders of the nodes that at they are resizing creating an unpolished look


Lets say below is the round the border (pretend / is the round border)
```
   | 
---/
```

Right now the resize lines look as
```
   | 
---/
---- <-resize line
```

While we would want the resize line to stop before the rounding starts
```
   | 
---/
---  <-resize line
```