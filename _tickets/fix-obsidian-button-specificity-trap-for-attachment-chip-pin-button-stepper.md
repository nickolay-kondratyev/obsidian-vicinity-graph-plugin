---
id: nid_zine3xz9xp8a04vn8v0bezakz_e
title: "Fix Obsidian button-specificity trap for attachment chip, pin button, stepper"
status: open
deps: []
links: []
created_iso: 2026-07-31T18:35:22Z
status_updated_iso: 2026-07-31T18:35:22Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
---

(FIRST analyze whether the fix is right)


Obsidian paints every plain button via `button:not(.clickable-icon)` (specificity 0,1,1): background-color: var(--interactive-normal); box-shadow: var(--input-shadow); color: var(--text-color). Any plugin reset written as a SINGLE class (0,1,0) silently LOSES those three properties in the real app (invisible in unit tests; only real-Obsidian e2e can see it).

The in-node outline had exactly this bug (nid_sg4wqt2n7iphzvu3c83q4rota_e) — fixed by prefixing the ancestor class in src/view/node-outline.css, guarded by the "outline entries render as flat tree rows" assertion in e2e/nodeOutline.e2e.ts.

Still affected (all in src/view/graph-view.css, single-class selectors that set background/box-shadow/color):
- .vicinity-graph-attachment (visible: the attachment chip renders with Obsidian raised-button chrome, not var(--background-secondary))
- .vicinity-graph-pin-button (background-primary/shadow-s both lose)
- .vicinity-graph-stepper__button (audit)
- Audit ALL other plain <button> styling in src/view/*.css for the same trap.

Fix pattern: prefix an ancestor class (e.g. .vicinity-graph-node .vicinity-graph-attachment) to reach (0,2,0) > (0,1,1); add e2e computed-style assertions like the outline one.

