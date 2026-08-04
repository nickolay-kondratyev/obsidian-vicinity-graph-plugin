---
closed_iso: 2026-08-01T05:55:58Z
id: nid_gytdn8nwjno1737meyrdxjxoh_e
title: Add e2e coverage for the link-preview drawer, incl. button-chrome assertions
status: closed
deps: []
links: []
created_iso: '2026-08-01T05:38:27Z'
status_updated_iso: 2026-08-01T05:55:58Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
No e2e spec opens the link-preview drawer today (grep link-preview e2e/*.e2e.ts is empty). Ticket nid_zine3xz9xp8a04vn8v0bezakz_e fixed the Obsidian button-specificity trap in src/view/link-preview.css by prefixing the drawer/preview root class onto the three all:unset buttons (.vicinity-graph-link-preview-drawer__close, .vicinity-graph-link-preview__row-toggle, .vicinity-graph-link-preview__go), but only unit-invisible real-Obsidian rendering can PROVE their chrome — the fix currently ships unasserted.

Add an e2e spec that opens the drawer through the real UI and asserts, at minimum, computed background-color/box-shadow of those three buttons using the probe-element pattern (buttonChromeVsDeclared in e2e/vicinityGraph.e2e.ts; original idiom in e2e/nodeOutline.e2e.ts "flat tree rows" test).

## Notes

**2026-08-01T05:55:58Z**

RESOLVED (commit 00d84c8 on branch CC_nid_gytdn8nwjno1737meyrdxjxoh_e__add-e2e-coverage-for-the-link-preview-drawer-incl-_fable):

- Added e2e/linkPreview.e2e.ts (serial, own Obsidian instance): opens the drawer through the real UI by pointer-clicking the MIDPOINT of the rendered edge path `folder-group:projects->note1.md` on the alpha vicinity (getPointAtLength + getScreenCTM -> page.mouse.click, robust to routed polylines where a bbox-center click can miss the stroke).
- Asserts: drawer visible with 2 occurrence rows (alpha links [[note1]] twice, both with context); computed background-color/box-shadow of all three all:unset buttons (.vicinity-graph-link-preview-drawer__close, .vicinity-graph-link-preview__row-toggle, .vicinity-graph-link-preview__go) via the probe-element pattern = transparent/none, not Obsidian's raised-button chrome; and that clicking close dismisses the drawer.
- DRY: buttonChromeVsDeclared extracted from e2e/vicinityGraph.e2e.ts into shared e2e/buttonChrome.ts, imported by both specs.
- Mutation-verified: temporarily removing the drawer prefix from the close button's rule in src/view/link-preview.css turned the close-button chrome test red (1 failed) while npm test stayed green; reverted, all green again. Noted in the spec comment.
- Gates: npm run check PASS, npm test PASS (1462 tests, selectorGuard covers the new selectors), npm run test:e2e -- linkPreview.e2e.ts vicinityGraph.e2e.ts PASS (30/30).
