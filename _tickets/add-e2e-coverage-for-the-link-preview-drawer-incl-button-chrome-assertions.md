---
id: nid_gytdn8nwjno1737meyrdxjxoh_e
title: "Add e2e coverage for the link-preview drawer, incl. button-chrome assertions"
status: open
deps: []
links: []
created_iso: 2026-08-01T05:38:27Z
status_updated_iso: 2026-08-01T05:38:27Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
---

No e2e spec opens the link-preview drawer today (grep link-preview e2e/*.e2e.ts is empty). Ticket nid_zine3xz9xp8a04vn8v0bezakz_e fixed the Obsidian button-specificity trap in src/view/link-preview.css by prefixing the drawer/preview root class onto the three all:unset buttons (.vicinity-graph-link-preview-drawer__close, .vicinity-graph-link-preview__row-toggle, .vicinity-graph-link-preview__go), but only unit-invisible real-Obsidian rendering can PROVE their chrome — the fix currently ships unasserted.

Add an e2e spec that opens the drawer through the real UI and asserts, at minimum, computed background-color/box-shadow of those three buttons using the probe-element pattern (buttonChromeVsDeclared in e2e/vicinityGraph.e2e.ts; original idiom in e2e/nodeOutline.e2e.ts "flat tree rows" test).

