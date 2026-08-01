---
id: nid_bhgjaq9mbfkvx0nhab6xscagm_e
title: "Link fly out display look at deduping when multiple links in the same paragraph"
status: open
deps: []
links: []
created_iso: 2026-08-01T05:20:13Z
status_updated_iso: 2026-08-01T05:20:13Z
type: task
priority: 3
assignee: nickolaykondratyev
---


Look at the display of /home/nickolaykondratyev/dendron_ws/public/p/Lao-Tzu/th/Te.md

This screenshot "./_tickets/assets/Screenshot From 2026-07-31 23-20-41.png" it shows the issue that the same paragraph has multiple links and each link renders separately in the fly out display.

However, this is worth thinking through prior to implementing as what happens if we have multiple links to the same note that are not grouped. I guess it would still make sense to group different groups together even if one note will be in multiple groups. Such grouping should still help the user understand the linking.