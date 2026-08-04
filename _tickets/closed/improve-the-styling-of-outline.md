---
closed_iso: 2026-07-31T18:35:46Z
id: nid_sg4wqt2n7iphzvu3c83q4rota_e
title: Improve the styling of outline
status: closed
deps: []
links: []
created_iso: '2026-07-31T18:28:20Z'
status_updated_iso: 2026-07-31T18:35:46Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Right now the styling of outline looks like nested buttons see screenshot "/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin/.tmp/Screenshot From 2026-07-31 12-28-37.png".

We would like to create a UI view of more of a tree outline structure rather than nested buttons. Draw inspiration from best UIs in this domain, and change the outline component to have the new look.

## Resolution

**Root cause — not missing design, a lost cascade fight.** The tree-outline design (flat rows, indent guides, weight-tiered top level) already existed in `src/view/node-outline.css`, but Obsidian's app-wide rule `button:not(.clickable-icon) { background-color: var(--interactive-normal); box-shadow: var(--input-shadow); color: ... }` has specificity (0,1,1), which BEATS the plugin's single-class reset `.vicinity-graph-outline__entry` (0,1,0). So in the real app every outline row kept Obsidian's raised-pill button chrome — the "nested buttons" in the screenshot. Invisible to unit tests; verified against the pinned Obsidian 1.12.7 `obsidian.asar` CSS.

**Fix (CSS-only):** prefixed the entry rules in `src/view/node-outline.css` with the `.vicinity-graph-outline` ancestor class → (0,2,0) wins. WHY comment added at the rule.

**Test-first:** new e2e case in `e2e/nodeOutline.e2e.ts` ("outline entries render as flat tree rows, not Obsidian buttons") asserts the computed background is transparent and box-shadow none in a REAL Obsidian. Red before the fix (bg `rgb(255,255,255)` + input shadow), green after. Full file (15 tests), `npm test` (1344), and `npm run check` all pass.

**Visual verification:** screenshot of the rendered node saved at `.out/outline-node-after.png` — reads as a proper tree outline (Obsidian-Outline-pane-style indent guides, hairline section edge, medium-weight top-level headings, flat hover-highlight rows).

**Follow-up filed:** `nid_zine3xz9xp8a04vn8v0bezakz_e` — the SAME specificity trap still affects `.vicinity-graph-attachment`, `.vicinity-graph-pin-button`, and possibly the stepper (out of this ticket's scope).

## Resolution

**Root cause — not missing design, a lost cascade fight.** The tree-outline design (flat rows, indent guides, weight-tiered top level) already existed in `src/view/node-outline.css`, but Obsidian's app-wide rule `button:not(.clickable-icon) { background-color: var(--interactive-normal); box-shadow: var(--input-shadow); color: ... }` has specificity (0,1,1), which BEATS the plugin's single-class reset `.vicinity-graph-outline__entry` (0,1,0). So in the real app every outline row kept Obsidian's raised-pill button chrome — the "nested buttons" in the screenshot. Invisible to unit tests; verified against the pinned Obsidian 1.12.7 `obsidian.asar` CSS.

**Fix (CSS-only):** prefixed the entry rules in `src/view/node-outline.css` with the `.vicinity-graph-outline` ancestor class → (0,2,0) wins. WHY comment added at the rule.

**Test-first:** new e2e case in `e2e/nodeOutline.e2e.ts` ("outline entries render as flat tree rows, not Obsidian buttons") asserts the computed background is transparent and box-shadow none in a REAL Obsidian. Red before the fix (bg `rgb(255,255,255)` + input shadow), green after. Full file (15 tests), `npm test` (1344), and `npm run check` all pass.

**Visual verification:** screenshot of the rendered node saved at `.out/outline-node-after.png` — reads as a proper tree outline (Obsidian-Outline-pane-style indent guides, hairline section edge, medium-weight top-level headings, flat hover-highlight rows).

**Follow-up filed:** `nid_zine3xz9xp8a04vn8v0bezakz_e` — the SAME specificity trap still affects `.vicinity-graph-attachment`, `.vicinity-graph-pin-button`, and possibly the stepper (out of this ticket's scope).
