---
closed_iso: 2026-08-01T05:28:13Z
id: nid_ebseuy07s6f3fs3el09kxsnb8_e
title: Styling make the group border more visible
status: closed
deps: []
links: []
created_iso: '2026-07-31T18:44:26Z'
status_updated_iso: 2026-08-01T05:28:13Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Styling make the border of the groups more visible.

## Resolution (2026-08-01)

Folder-group card border strengthened in `src/view/graph-view.css`
(`.vicinity-graph-group`): `1px solid var(--background-modifier-border)` →
`2px solid var(--background-modifier-border-hover)`.

- WHY 2px: at zoomed-out graph scales a 1px border renders sub-pixel and the
  group outline nearly disappears.
- WHY the hover-tier variable: it is Obsidian's stronger neutral border color,
  so the border stays theme-adaptive (light/dark) and respects the standing
  human decision of NO folder colors on groups (noted in
  `src/view/FolderGroupNode.tsx` doc comment, which was updated to match).

Verified: `npm run build` (regenerates `styles.css`), `npm test`
(110 files / 1462 tests pass), `npm run test:e2e -- vicinityGraph.e2e.ts`
(21 pass) — the required gate for view-layer CSS changes.
